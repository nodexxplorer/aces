package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

func generateCalendarFeedToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// getCalendarToken GET /calendar/token
// Returns the caller's calendar feed token, generating one on first call.
// The frontend builds the full subscribe URL from this (same pattern as
// downloadAttendancePDF in frontend/src/api/attendance.ts).
func (server *Server) getCalendarToken(ctx *gin.Context) {
	userID := getUserID(ctx)

	token, err := server.store.GetUserCalendarFeedToken(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if token == nil || *token == "" {
		newToken, err := generateCalendarFeedToken()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate calendar token"})
			return
		}
		if err := server.store.SetUserCalendarFeedToken(ctx, userID, newToken); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save calendar token"})
			return
		}
		token = &newToken
	}

	ctx.JSON(http.StatusOK, gin.H{"token": *token})
}

// regenerateCalendarToken POST /calendar/token/regenerate
// Issues a fresh token, immediately invalidating whatever URL was built
// from the old one — the only way to revoke a leaked calendar link.
func (server *Server) regenerateCalendarToken(ctx *gin.Context) {
	userID := getUserID(ctx)

	newToken, err := generateCalendarFeedToken()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate calendar token"})
		return
	}
	if err := server.store.SetUserCalendarFeedToken(ctx, userID, newToken); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save calendar token"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"token": newToken})
}

// getCalendarFeed GET /calendar/feed/:token
// Public — no auth. Calendar clients (Google/Apple/Outlook "subscribe by
// URL") fetch subscription URLs with no auth headers, so the token in the
// path is the only credential. Merges the caller's timetable (weekly
// classes as recurring events, exams as one-off events — same conversion
// approach as downloadTimetableEntryICS in notices_calendar.go, which
// handles a single entry's "Add to Calendar" download) with their study
// task due dates into one .ics feed.
func (server *Server) getCalendarFeed(ctx *gin.Context) {
	token := ctx.Param("token")
	if token == "" {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	user, err := server.store.GetUserByCalendarFeedToken(ctx, token)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var events []utils.ICSEvent

	queries, ok := server.store.(*db.Queries)
	activeSem, semErr := server.store.GetActiveSemester(ctx)
	if ok && semErr == nil {
		// Timetable: level-scoped for students/class reps, lecturer-scoped
		// for lecturers — ListTimetableByType has no lecturer filter, so
		// fetch unscoped (level=nil) and filter in Go for that case.
		var level *int32
		isLecturer := user.Role == "lecturer"
		if !isLecturer {
			if student, serr := server.store.GetStudentByUserId(ctx, user.ID); serr == nil {
				l := student.Level
				level = &l
			}
		}

		for _, entryType := range []string{"class", "exam"} {
			entries, eerr := queries.ListTimetableByType(ctx, db.ListTimetableByTypeParams{
				EntryType: entryType,
				Level:     level,
			})
			if eerr != nil {
				continue
			}
			for _, e := range entries {
				// timetable.lecturer_id is frequently left unset even when
				// the course itself has one — course_material.go hit the
				// same gap and settled on this dual check (course's primary
				// lecturer_id OR a lecturer_course_assignments row) as the
				// reliable way to ask "does this lecturer teach this course".
				if isLecturer {
					owns, oerr := queries.IsLecturerOrPrimaryForCourse(ctx, user.ID, e.CourseID)
					if oerr != nil || !owns {
						continue
					}
				}
				if ev, ok := timetableEntryToICSEvent(e, activeSem.EndDate.Time); ok {
					events = append(events, ev)
				}
			}
		}
	}

	// Study tasks — personal, not level-scoped.
	tasks, terr := server.store.ListUserStudyTasks(ctx, user.ID)
	if terr == nil {
		for _, t := range tasks {
			if !t.DueDate.Valid {
				continue
			}
			desc := ""
			if t.Description != nil {
				desc = *t.Description
			}
			location := ""
			if t.CourseCode != nil {
				location = *t.CourseCode
			}
			events = append(events, utils.ICSEvent{
				UID:         "task-" + t.ID.String(),
				Title:       "Due: " + t.Title,
				Description: desc,
				Location:    location,
				Start:       t.DueDate.Time,
				End:         t.DueDate.Time.Add(30 * time.Minute),
			})
		}
	}

	ics := utils.GenerateICSFeed("ACES Zone — "+user.FullName, events)
	ctx.Header("Content-Disposition", `inline; filename="aces-zone.ics"`)
	ctx.Data(http.StatusOK, "text/calendar; charset=utf-8", ics)
}

// timetableEntryToICSEvent converts one timetable row (from the same
// ListTimetableByType query the /timetable page itself uses, so the feed
// always matches what the student sees in-app) into an ICS event. Exam
// entries carry a fixed date already, so they produce a one-off event;
// class entries only carry a day_of_week + time-of-day (their weekly
// recurring slot) — those recur weekly, anchored to the next real calendar
// date matching that weekday (via nextWeekdayAt, notices_calendar.go),
// bounded by the active semester's end date. Returns ok=false for rows
// missing what's needed to place them on a calendar (e.g. an exam with no
// date set yet).
func timetableEntryToICSEvent(e db.TimetableListItem, semesterEnd time.Time) (utils.ICSEvent, bool) {
	startTOD, sok := parseClockTime(e.StartTime)
	endTOD, eok := parseClockTime(e.EndTime)
	if !sok || !eok {
		return utils.ICSEvent{}, false
	}

	title := e.CourseCode
	if e.CourseTitle != "" {
		title = e.CourseCode + " — " + e.CourseTitle
	}

	if e.EntryType == "exam" {
		if e.ExamDate == nil || *e.ExamDate == "" {
			return utils.ICSEvent{}, false
		}
		date, derr := time.Parse("2006-01-02", *e.ExamDate)
		if derr != nil {
			return utils.ICSEvent{}, false
		}
		start := time.Date(date.Year(), date.Month(), date.Day(), startTOD.Hour(), startTOD.Minute(), 0, 0, time.UTC)
		end := time.Date(date.Year(), date.Month(), date.Day(), endTOD.Hour(), endTOD.Minute(), 0, 0, time.UTC)
		return utils.ICSEvent{
			UID:         "timetable-" + e.ID.String(),
			Title:       "Exam: " + title,
			Description: pointerOrEmpty(e.Invigilators),
			Location:    e.Venue,
			Start:       start,
			End:         end,
		}, true
	}

	if e.DayOfWeek == nil {
		return utils.ICSEvent{}, false
	}
	start := nextWeekdayAt(time.Now(), int(*e.DayOfWeek), startTOD)
	end := nextWeekdayAt(time.Now(), int(*e.DayOfWeek), endTOD)
	if !end.After(start) {
		end = end.AddDate(0, 0, 7)
	}
	until := start.AddDate(0, 4, 0) // ~one semester, used if no active semester end date is on record
	if !semesterEnd.IsZero() {
		until = semesterEnd
	}

	return utils.ICSEvent{
		UID:            "timetable-" + e.ID.String(),
		Title:          title,
		Description:    strings.TrimSpace(pointerOrEmpty(e.ClassType)),
		Location:       e.Venue,
		Start:          start,
		End:            end,
		RecurrenceRule: "FREQ=WEEKLY;UNTIL=" + until.UTC().Format("20060102T150405Z"),
	}, true
}

// parseClockTime extracts a time-of-day from ListTimetableByType's
// StartTime/EndTime strings. timetable.start_time/end_time are TIMESTAMPTZ
// columns (a placeholder date + the real time-of-day), and the query's
// ::text cast keeps the full value — e.g. "1970-01-01 08:00:00+00" — not a
// bare "HH:MM:SS", so this needs to parse the whole thing and only use
// Hour()/Minute() from it, for feeding into nextWeekdayAt.
func parseClockTime(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{"2006-01-02 15:04:05-07", "2006-01-02 15:04:05", "15:04:05", "15:04"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func pointerOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
