# Archived: Timetable, Carryover, Transcript, Grade Appeals

This document preserves the original source of four features removed from ACES Zone, so any of them can be restored later. Each section lists deleted files in full and the exact snippets removed from files that otherwise stayed.

## Scope notes

- **Timetable**: code removed (frontend, backend, mobile) but the database tables and migrations were deliberately left untouched, per explicit instruction — the `timetable` table and its data still exist in the live DB, just orphaned from the app.
- **Carryover**: only the dedicated `carryover_courses` tracking entity (attempt counts, resolution status, its own API/UI) was removed. The `is_carryover` boolean flag on `results` and `registered_courses` is core to the grading/CGPA data model (repeat-course results) and was left untouched, along with all code that reads/writes it.
- **Transcript**: the transcript request/tracking workflow was fully removed (frontend, backend, DB table). The `transcript_fee` payment-type option was left in place as a generic payment purpose (bursar can still record a due named "Transcript Fee" and let a student pay it without a formal request-tracking system behind it).
- **Grade Appeals**: fully removed (frontend, backend, DB table).

## Restoration checklist

1. Recreate deleted files from the snippets below.
2. Re-apply the removed snippets to files that otherwise stayed.
3. For carryover/transcript/grade-appeals: run `migrate down` once on migration 000046 (or restore from its `.down.sql`) to recreate the dropped tables, then re-seed if needed.
4. Timetable's DB tables were never dropped — no migration action needed to restore data; only the application code needs restoring.
5. Regenerate/re-add sqlc bindings, re-wire routes in `server.go`, re-add sidebar/router entries.

## PART 4 — Grade Appeals

### `backend/internal/api/grade_appeals.go`
```go
package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createAppealRequest struct {
	CourseID   string   `json:"course_id" binding:"required"`
	SemesterID string   `json:"semester_id" binding:"required"`
	SessionID  string   `json:"session_id" binding:"required"`
	Reason     string   `json:"reason" binding:"required"`
	Evidence   []string `json:"evidence"`
}

func (server *Server) createGradeAppeal(ctx *gin.Context) {
	var req createAppealRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	semesterID, err := uuid.Parse(req.SemesterID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid semester_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	var evidenceJSON []byte
	if req.Evidence != nil {
		evidenceJSON, err = json.Marshal(req.Evidence)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid evidence"})
			return
		}
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	appeal, err := queries.CreateGradeAppeal(ctx, db.CreateGradeAppealParams{
		StudentID:    userID,
		CourseID:     courseID,
		SemesterID:   semesterID,
		SessionID:    sessionID,
		Reason:       req.Reason,
		EvidenceUrls: evidenceJSON,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": appeal})
}

func (server *Server) listMyAppeals(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	appeals, err := queries.ListStudentAppeals(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeals})
}

func (server *Server) listPendingAppeals(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	statusParam := ctx.Query("status")
	status := db.AppealStatusSubmitted
	if statusParam != "" {
		status = db.AppealStatus(statusParam)
	}

	appeals, err := queries.ListPendingAppeals(ctx, status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeals})
}

func (server *Server) getGradeAppeal(ctx *gin.Context) {
	appealID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid appeal id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	appeal, err := queries.GetGradeAppeal(ctx, appealID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "appeal not found"})
		return
	}

	// appeal.StudentID is actually a users.id (createGradeAppeal stores
	// getUserID(ctx) directly, never students.id) — requireOwnershipOrStaff
	// compares against students.id and would always reject the real owner.
	if !isStaffCaller(ctx) && getUserID(ctx) != appeal.StudentID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you can only access your own records"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": appeal})
}

type updateAppealRequest struct {
	Status       string   `json:"status" binding:"required"`
	Response     string   `json:"response"`
	RevisedScore *float64 `json:"revised_score"`
}

func (server *Server) updateAppealStatus(ctx *gin.Context) {
	appealID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid appeal id"})
		return
	}

	var req updateAppealRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	if req.RevisedScore != nil && (*req.RevisedScore < 0 || *req.RevisedScore > 100) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "revised_score must be between 0 and 100"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	userID := getUserID(ctx)
	callerIsHOD := isStaffCaller(ctx)

	// Lecturer-course assignment check, matching result.go's pattern — a
	// lecturer may only resolve appeals for courses they actually teach.
	if !callerIsHOD {
		existingAppeal, gerr := queries.GetGradeAppeal(ctx, appealID)
		if gerr != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "appeal not found"})
			return
		}
		assigned, aerr := server.store.IsLecturerAssignedToCourse(ctx, db.IsLecturerAssignedToCourseParams{
			LecturerID: userID,
			CourseID:   existingAppeal.CourseID,
		})
		if aerr != nil || !assigned {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to teach this course"})
			return
		}
	}

	var lecturerResponse *string
	var lecturerID pgtype.UUID
	var hodResponse *string
	var hodID pgtype.UUID

	status := db.AppealStatus(req.Status)

	switch status {
	case db.AppealStatusLecturerReview, db.AppealStatusResolved, db.AppealStatusRejected:
		if callerIsHOD {
			hodID = pgtype.UUID{Bytes: userID, Valid: true}
			if req.Response != "" {
				hodResponse = &req.Response
			}
		} else {
			lecturerID = pgtype.UUID{Bytes: userID, Valid: true}
			if req.Response != "" {
				lecturerResponse = &req.Response
			}
		}
	case db.AppealStatusHodReview:
		hodID = pgtype.UUID{Bytes: userID, Valid: true}
		if req.Response != "" {
			hodResponse = &req.Response
		}
	default:
		if req.Response != "" {
			lecturerResponse = &req.Response
			hodResponse = &req.Response
		}
	}

	err = queries.UpdateGradeAppealStatus(ctx, db.UpdateGradeAppealStatusParams{
		ID:               appealID,
		Status:           status,
		LecturerResponse: lecturerResponse,
		LecturerID:       lecturerID,
		HodResponse:      hodResponse,
		HodID:            hodID,
		RevisedScore:     req.RevisedScore,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about their grade appeal status change
	// The StudentID in grade_appeals is actually the user_id (set via getUserID)
	appeal, errGet := queries.GetGradeAppeal(ctx, appealID)
	if errGet == nil {
		title := "Grade Appeal Updated"
		msg := fmt.Sprintf("Your grade appeal status has been updated to %s.", req.Status)
		priority := "normal"
		switch status {
		case db.AppealStatusResolved:
			title = "Grade Appeal Resolved"
			msg = "Your grade appeal has been resolved. Please check the outcome."
			priority = "high"
		case db.AppealStatusRejected:
			title = "Grade Appeal Rejected"
			msg = "Your grade appeal has been rejected."
			priority = "high"
		case db.AppealStatusLecturerReview:
			title = "Grade Appeal Under Lecturer Review"
			msg = "Your grade appeal is now being reviewed by the lecturer."
		case db.AppealStatusHodReview:
			title = "Grade Appeal Under HOD Review"
			msg = "Your grade appeal has been escalated to the HOD for review."
		}
		eType := "grade_appeal"
		eID := appealID
		server.notifyUser(
			ctx,
			appeal.StudentID,
			"academic",
			"results",
			priority,
			title,
			msg,
			"/grade-appeals",
			"View Appeals",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "appeal status updated"}})
}
```

### `frontend/src/pages/student/GradeAppealsPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, XCircle, Send, Filter } from 'lucide-react';
import { createGradeAppeal, listMyAppeals, type GradeAppeal } from '../../api/additional-features';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { getCourses } from '../../api/courses';
import type { Session, SemesterEntry, Course } from '../../types';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  submitted: {
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    label: 'Submitted',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  lecturer_review: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    label: 'Lecturer Review',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  hod_review: {
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    label: 'HOD Review',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  resolved: {
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    label: 'Resolved',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  rejected: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    label: 'Rejected',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const FILTER_TABS = ['all', 'submitted', 'under_review', 'resolved', 'rejected'] as const;

type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'All',
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

function matchesFilter(appeal: GradeAppeal, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'under_review') return appeal.status === 'lecturer_review' || appeal.status === 'hod_review';
  return appeal.status === tab;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

export default function GradeAppealsPage() {
  const [appeals, setAppeals] = useState<GradeAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<GradeAppeal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [semesters, setSemesters] = useState<SemesterEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [formCourseId, setFormCourseId] = useState('');
  const [formSemesterId, setFormSemesterId] = useState('');
  const [formSessionId, setFormSessionId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formEvidence, setFormEvidence] = useState('');

  const fetchAppeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMyAppeals();
      const list = Array.isArray(res) ? res : ((res as { data?: GradeAppeal[] })?.data ?? []);
      setAppeals(list);
    } catch {
      setError('Failed to load grade appeals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    getSessions()
      .then((s) => setSessions(Array.isArray(s) ? s : []))
      .catch(() => {});
    getCourses()
      .then((c) => setCourses(Array.isArray(c) ? c : []))
      .catch(() => {});
  }, [showForm]);

  useEffect(() => {
    if (!formSessionId) {
      setSemesters([]);
      return;
    }
    listSessionSemesters(formSessionId)
      .then((s) => setSemesters(Array.isArray(s) ? s : []))
      .catch(() => {});
  }, [formSessionId]);

  const filteredAppeals = appeals.filter((a) => matchesFilter(a, activeTab));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId.trim() || !formSemesterId.trim() || !formSessionId.trim() || !formReason.trim()) return;
    setSubmitting(true);
    try {
      const evidenceUrls = formEvidence
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      await createGradeAppeal({
        course_id: formCourseId.trim(),
        semester_id: formSemesterId.trim(),
        session_id: formSessionId.trim(),
        reason: formReason.trim(),
        evidence: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      });
      setFormCourseId('');
      setFormSemesterId('');
      setFormSessionId('');
      setFormReason('');
      setFormEvidence('');
      setShowForm(false);
      fetchAppeals();
    } catch {
      setError('Failed to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetail = () => setSelectedAppeal(null);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Appeals</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Submit and track appeals for grade corrections
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
            New Appeal
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-1 shadow-sm w-full sm:w-fit max-w-full overflow-x-auto">
          <Filter className="w-4 h-4 text-surface-400 mx-2 shrink-0" />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {FILTER_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAppeals.length === 0 && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <Clock className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">No Appeals Found</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {activeTab === 'all'
                ? "You haven't submitted any grade appeals yet."
                : `No appeals with status "${FILTER_LABELS[activeTab]}".`}
            </p>
          </div>
        )}

        {/* Appeal Cards */}
        {!loading && filteredAppeals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAppeals.map((appeal) => {
              const statusCfg = STATUS_CONFIG[appeal.status] ?? STATUS_CONFIG.submitted;
              return (
                <button
                  key={appeal.id}
                  onClick={() => setSelectedAppeal(appeal)}
                  className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
                        {appeal.course_code ?? 'N/A'}
                      </p>
                      <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate mt-0.5">
                        {appeal.course_title ?? 'Grade Appeal'}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shrink-0 ${statusCfg.color} ${statusCfg.bg}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">{truncate(appeal.reason, 120)}</p>
                  <div className="flex items-center gap-4 text-xs text-surface-400 dark:text-surface-500">
                    {appeal.created_at && <span>Submitted {new Date(appeal.created_at).toLocaleDateString()}</span>}
                    {appeal.updated_at && appeal.updated_at !== appeal.created_at && (
                      <span>Updated {new Date(appeal.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Appeal Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-200 dark:border-surface-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">New Grade Appeal</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Session
                </label>
                <select
                  value={formSessionId}
                  onChange={(e) => {
                    setFormSessionId(e.target.value);
                    setFormSemesterId('');
                  }}
                  required
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Semester
                </label>
                <select
                  value={formSemesterId}
                  onChange={(e) => setFormSemesterId(e.target.value)}
                  required
                  disabled={!formSessionId}
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all disabled:opacity-50"
                >
                  <option value="">Select semester</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Course
                </label>
                <select
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option value="">Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Reason for Appeal
                </label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Explain why you believe your grade should be reviewed..."
                  required
                  rows={4}
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Evidence URLs <span className="text-surface-400">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formEvidence}
                  onChange={(e) => setFormEvidence(e.target.value)}
                  placeholder="https://example.com/doc1, https://example.com/doc2"
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 px-4 py-2.5 text-sm font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Appeal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {(() => {
              const statusCfg = STATUS_CONFIG[selectedAppeal.status] ?? STATUS_CONFIG.submitted;
              return (
                <>
                  <div className="p-6 border-b border-surface-200 dark:border-surface-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
                          {selectedAppeal.course_code ?? 'N/A'}
                        </p>
                        <h2 className="text-xl font-bold text-surface-900 dark:text-white mt-0.5">
                          {selectedAppeal.course_title ?? 'Grade Appeal'}
                        </h2>
                      </div>
                      <button
                        onClick={closeDetail}
                        className="rounded-lg p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-surface-500 dark:text-surface-400">Status</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCfg.color} ${statusCfg.bg}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* IDs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Course ID</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">
                          {selectedAppeal.course_id ?? selectedAppeal.course_code ?? 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Semester</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">
                          {selectedAppeal.semester_id ?? 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Session</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">
                          {selectedAppeal.session_id ?? 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1.5">Reason</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                        {selectedAppeal.reason}
                      </p>
                    </div>

                    {/* Evidence URLs */}
                    {selectedAppeal.evidence_urls && selectedAppeal.evidence_urls.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1.5">Evidence</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedAppeal.evidence_urls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                            >
                              Evidence {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lecturer Response */}
                    {selectedAppeal.lecturer_response && (
                      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1.5">
                          Lecturer Response
                        </p>
                        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                          {selectedAppeal.lecturer_response}
                        </p>
                      </div>
                    )}

                    {/* HOD Response */}
                    {selectedAppeal.hod_response && (
                      <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1.5">
                          HOD Response
                        </p>
                        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                          {selectedAppeal.hod_response}
                        </p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-6 text-xs text-surface-400 dark:text-surface-500 pt-2 border-t border-surface-200 dark:border-surface-800">
                      {selectedAppeal.created_at && (
                        <span>Submitted {new Date(selectedAppeal.created_at).toLocaleString()}</span>
                      )}
                      {selectedAppeal.updated_at && (
                        <span>Updated {new Date(selectedAppeal.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
```

### `frontend/src/pages/admin/GradeAppealsAdminPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { listPendingAppeals, updateAppealStatus, type GradeAppeal } from '../../api/additional-features';
import { getErrorMessage } from '../../utils/errors';
import { AlertCircle, Clock, CheckCircle, XCircle, Filter, MessageSquare } from 'lucide-react';

const STATUS_TABS = ['submitted', 'lecturer_review', 'hod_review', 'resolved', 'rejected'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_LABELS: Record<StatusTab, string> = {
  submitted: 'Submitted',
  lecturer_review: 'Lecturer Review',
  hod_review: 'HOD Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const STATUS_BADGE: Record<StatusTab, 'primary' | 'warning' | 'success' | 'danger'> = {
  submitted: 'primary',
  lecturer_review: 'warning',
  hod_review: 'warning',
  resolved: 'success',
  rejected: 'danger',
};

const NEXT_ACTIONS: Record<StatusTab, { status: string; label: string; needsScore?: boolean }[]> = {
  submitted: [
    { status: 'lecturer_review', label: 'Move to Lecturer Review' },
    { status: 'hod_review', label: 'Escalate to HOD Review' },
    { status: 'rejected', label: 'Reject' },
  ],
  lecturer_review: [
    { status: 'hod_review', label: 'Escalate to HOD Review' },
    { status: 'resolved', label: 'Resolve', needsScore: true },
    { status: 'rejected', label: 'Reject' },
  ],
  hod_review: [
    { status: 'resolved', label: 'Resolve', needsScore: true },
    { status: 'rejected', label: 'Reject' },
  ],
  resolved: [],
  rejected: [],
};

const GradeAppealsAdminPage = () => {
  const { success, error: notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState<StatusTab>('submitted');
  const [appeals, setAppeals] = useState<GradeAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GradeAppeal | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [revisedScore, setRevisedScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppeals = async (status: StatusTab) => {
    setLoading(true);
    try {
      const data = await listPendingAppeals(status);
      setAppeals(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Error', 'Failed to load grade appeals');
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals(activeTab);
  }, [activeTab]);

  const openAppeal = (appeal: GradeAppeal) => {
    setSelected(appeal);
    setActionStatus(null);
    setResponse('');
    setRevisedScore('');
  };

  const handleSubmitAction = async () => {
    if (!selected || !actionStatus) return;
    setSubmitting(true);
    try {
      await updateAppealStatus(selected.id, {
        status: actionStatus,
        response: response.trim() || undefined,
        revised_score: revisedScore ? Number(revisedScore) : undefined,
      });
      success('Appeal Updated', `Status changed to ${STATUS_LABELS[actionStatus as StatusTab] ?? actionStatus}.`);
      setSelected(null);
      fetchAppeals(activeTab);
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Failed to update appeal'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedActions = selected ? (NEXT_ACTIONS[selected.status as StatusTab] ?? []) : [];
  const selectedAction = selectedActions.find((a) => a.status === actionStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Appeals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review student grade appeals and move them through lecturer/HOD review to a resolution.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-1 shadow-sm w-fit max-w-full overflow-x-auto">
        <Filter className="w-4 h-4 text-surface-400 mx-2 shrink-0" />
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STATUS_LABELS[activeTab]} Appeals</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${appeals.length} appeal(s)`}</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Clock className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : appeals.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No appeals in this status.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {appeals.map((appeal) => (
              <button
                key={appeal.id}
                onClick={() => openAppeal(appeal)}
                className="w-full text-left p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-surface-900 dark:text-white">
                      {appeal.course_code ?? 'Course'}
                    </span>
                    <Badge variant={STATUS_BADGE[appeal.status as StatusTab] ?? 'primary'} className="text-[10px]">
                      {STATUS_LABELS[appeal.status as StatusTab] ?? appeal.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{appeal.student_name || appeal.student_id}</p>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 line-clamp-1">{appeal.reason}</p>
                </div>
                <span className="text-[10px] text-surface-400 shrink-0">
                  {appeal.created_at ? new Date(appeal.created_at).toLocaleDateString() : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                  {selected.course_code ?? 'Grade Appeal'} — {selected.course_title}
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">{selected.student_name || selected.student_id}</p>
              </div>
              <Badge variant={STATUS_BADGE[selected.status as StatusTab] ?? 'primary'}>
                {STATUS_LABELS[selected.status as StatusTab] ?? selected.status}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-semibold text-surface-500 mb-1">Reason</p>
              <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">{selected.reason}</p>
            </div>

            {selected.evidence_urls && selected.evidence_urls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-500 mb-1">Evidence</p>
                <div className="flex flex-wrap gap-2">
                  {selected.evidence_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1"
                    >
                      Evidence {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selected.lecturer_response && (
              <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">Lecturer Response</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{selected.lecturer_response}</p>
              </div>
            )}
            {selected.hod_response && (
              <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-3">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">HOD Response</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{selected.hod_response}</p>
              </div>
            )}

            {selectedActions.length > 0 ? (
              <div className="space-y-3 pt-2 border-t border-surface-200 dark:border-surface-800">
                <p className="text-xs font-semibold text-surface-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Take Action
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedActions.map((action) => (
                    <Button
                      key={action.status}
                      size="sm"
                      variant={
                        action.status === 'rejected' ? 'danger' : action.status === 'resolved' ? 'success' : 'outline'
                      }
                      onClick={() => setActionStatus(action.status)}
                      className={actionStatus === action.status ? 'ring-2 ring-primary-500' : ''}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>

                {actionStatus && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Response to the student (optional but recommended)..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                    />
                    {selectedAction?.needsScore && (
                      <input
                        type="number"
                        value={revisedScore}
                        onChange={(e) => setRevisedScore(e.target.value)}
                        placeholder="Revised score (optional — leave blank if grade stands)"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        isLoading={submitting}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        onClick={handleSubmitAction}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        leftIcon={<XCircle className="w-4 h-4" />}
                        onClick={() => setActionStatus(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-surface-400 pt-2 border-t border-surface-200 dark:border-surface-800">
                This appeal is already {STATUS_LABELS[selected.status as StatusTab]?.toLowerCase()} — no further action
                needed.
              </p>
            )}

            <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GradeAppealsAdminPage;
```


### Removed from `backend/internal/api/server.go`

Route group:
```go
	// ── Grade Appeals ──
	appeals := api.Group("/grade-appeals")
	{
		appeals.POST("", middleware.RequireRoles("student"), server.createGradeAppeal)
		appeals.GET("/my", middleware.RequireRoles("student"), server.listMyAppeals)
		appeals.GET("/pending", middleware.RequireRoles("hod", "admin", "lecturer", "delegated_admin"), server.listPendingAppeals)
		appeals.GET("/:id", server.getGradeAppeal)
		appeals.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "lecturer", "delegated_admin"), server.updateAppealStatus)
	}
```

### Removed from `backend/internal/db/sql/additional_features.sql.go`

```go
const createGradeAppeal = `-- name: CreateGradeAppeal :one
INSERT INTO grade_appeals (student_id, course_id, semester_id, session_id, reason, evidence_urls)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, student_id, course_id, semester_id, session_id, reason, evidence_urls, status, lecturer_response, lecturer_id, hod_response, hod_id, original_score, revised_score, resolved_at, created_at, updated_at
`

type CreateGradeAppealParams struct {
	StudentID    uuid.UUID `json:"student_id"`
	CourseID     uuid.UUID `json:"course_id"`
	SemesterID   uuid.UUID `json:"semester_id"`
	SessionID    uuid.UUID `json:"session_id"`
	Reason       string    `json:"reason"`
	EvidenceUrls []byte    `json:"evidence_urls"`
}

func (q *Queries) CreateGradeAppeal(ctx context.Context, arg CreateGradeAppealParams) (GradeAppeal, error) {
	row := q.db.QueryRow(ctx, createGradeAppeal,
		arg.StudentID,
		arg.CourseID,
		arg.SemesterID,
		arg.SessionID,
		arg.Reason,
		arg.EvidenceUrls,
	)
	var i GradeAppeal
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.SemesterID,
		&i.SessionID,
		&i.Reason,
		&i.EvidenceUrls,
		&i.Status,
		&i.LecturerResponse,
		&i.LecturerID,
		&i.HodResponse,
		&i.HodID,
		&i.OriginalScore,
		&i.RevisedScore,
		&i.ResolvedAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}


const getGradeAppeal = `-- name: GetGradeAppeal :one
SELECT ga.id, ga.student_id, ga.course_id, ga.semester_id, ga.session_id, ga.reason, ga.evidence_urls, ga.status, ga.lecturer_response, ga.lecturer_id, ga.hod_response, ga.hod_id, ga.original_score, ga.revised_score, ga.resolved_at, ga.created_at, ga.updated_at, c.code AS course_code, c.title AS course_title,
       u.full_name AS student_name
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
JOIN users u ON u.id = ga.student_id
WHERE ga.id = $1
`

type GetGradeAppealRow struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	SemesterID       uuid.UUID          `json:"semester_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	Reason           string             `json:"reason"`
	EvidenceUrls     []byte             `json:"evidence_urls"`
	Status           AppealStatus       `json:"status"`
	LecturerResponse *string            `json:"lecturer_response"`
	LecturerID       pgtype.UUID        `json:"lecturer_id"`
	HodResponse      *string            `json:"hod_response"`
	HodID            pgtype.UUID        `json:"hod_id"`
	OriginalScore    *float64           `json:"original_score"`
	RevisedScore     *float64           `json:"revised_score"`
	ResolvedAt       pgtype.Timestamptz `json:"resolved_at"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
	CourseCode       string             `json:"course_code"`
	CourseTitle      string             `json:"course_title"`
	StudentName      string             `json:"student_name"`
}

func (q *Queries) GetGradeAppeal(ctx context.Context, id uuid.UUID) (GetGradeAppealRow, error) {
	row := q.db.QueryRow(ctx, getGradeAppeal, id)
	var i GetGradeAppealRow
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.SemesterID,
		&i.SessionID,
		&i.Reason,
		&i.EvidenceUrls,
		&i.Status,
		&i.LecturerResponse,
		&i.LecturerID,
		&i.HodResponse,
		&i.HodID,
		&i.OriginalScore,
		&i.RevisedScore,
		&i.ResolvedAt,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.CourseCode,
		&i.CourseTitle,
		&i.StudentName,
	)
	return i, err
}


const listPendingAppeals = `-- name: ListPendingAppeals :many
SELECT ga.id, ga.student_id, ga.course_id, ga.semester_id, ga.session_id, ga.reason, ga.evidence_urls, ga.status, ga.lecturer_response, ga.lecturer_id, ga.hod_response, ga.hod_id, ga.original_score, ga.revised_score, ga.resolved_at, ga.created_at, ga.updated_at, c.code AS course_code, c.title AS course_title,
       u.full_name AS student_name
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
JOIN users u ON u.id = ga.student_id
WHERE ga.status = $1
ORDER BY ga.created_at DESC
`

type ListPendingAppealsRow struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	SemesterID       uuid.UUID          `json:"semester_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	Reason           string             `json:"reason"`
	EvidenceUrls     []byte             `json:"evidence_urls"`
	Status           AppealStatus       `json:"status"`
	LecturerResponse *string            `json:"lecturer_response"`
	LecturerID       pgtype.UUID        `json:"lecturer_id"`
	HodResponse      *string            `json:"hod_response"`
	HodID            pgtype.UUID        `json:"hod_id"`
	OriginalScore    *float64           `json:"original_score"`
	RevisedScore     *float64           `json:"revised_score"`
	ResolvedAt       pgtype.Timestamptz `json:"resolved_at"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
	CourseCode       string             `json:"course_code"`
	CourseTitle      string             `json:"course_title"`
	StudentName      string             `json:"student_name"`
}

func (q *Queries) ListPendingAppeals(ctx context.Context, status AppealStatus) ([]ListPendingAppealsRow, error) {
	rows, err := q.db.Query(ctx, listPendingAppeals, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListPendingAppealsRow{}
	for rows.Next() {
		var i ListPendingAppealsRow
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.CourseID,
			&i.SemesterID,
			&i.SessionID,
			&i.Reason,
			&i.EvidenceUrls,
			&i.Status,
			&i.LecturerResponse,
			&i.LecturerID,
			&i.HodResponse,
			&i.HodID,
			&i.OriginalScore,
			&i.RevisedScore,
			&i.ResolvedAt,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.CourseCode,
			&i.CourseTitle,
			&i.StudentName,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}


const listStudentAppeals = `-- name: ListStudentAppeals :many
SELECT ga.id, ga.student_id, ga.course_id, ga.semester_id, ga.session_id, ga.reason, ga.evidence_urls, ga.status, ga.lecturer_response, ga.lecturer_id, ga.hod_response, ga.hod_id, ga.original_score, ga.revised_score, ga.resolved_at, ga.created_at, ga.updated_at, c.code AS course_code, c.title AS course_title
FROM grade_appeals ga
JOIN courses c ON c.id = ga.course_id
WHERE ga.student_id = $1
ORDER BY ga.created_at DESC
`

type ListStudentAppealsRow struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	SemesterID       uuid.UUID          `json:"semester_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	Reason           string             `json:"reason"`
	EvidenceUrls     []byte             `json:"evidence_urls"`
	Status           AppealStatus       `json:"status"`
	LecturerResponse *string            `json:"lecturer_response"`
	LecturerID       pgtype.UUID        `json:"lecturer_id"`
	HodResponse      *string            `json:"hod_response"`
	HodID            pgtype.UUID        `json:"hod_id"`
	OriginalScore    *float64           `json:"original_score"`
	RevisedScore     *float64           `json:"revised_score"`
	ResolvedAt       pgtype.Timestamptz `json:"resolved_at"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
	CourseCode       string             `json:"course_code"`
	CourseTitle      string             `json:"course_title"`
}

func (q *Queries) ListStudentAppeals(ctx context.Context, studentID uuid.UUID) ([]ListStudentAppealsRow, error) {
	rows, err := q.db.Query(ctx, listStudentAppeals, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListStudentAppealsRow{}
	for rows.Next() {
		var i ListStudentAppealsRow
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.CourseID,
			&i.SemesterID,
			&i.SessionID,
			&i.Reason,
			&i.EvidenceUrls,
			&i.Status,
			&i.LecturerResponse,
			&i.LecturerID,
			&i.HodResponse,
			&i.HodID,
			&i.OriginalScore,
			&i.RevisedScore,
			&i.ResolvedAt,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.CourseCode,
			&i.CourseTitle,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}


const updateGradeAppealStatus = `-- name: UpdateGradeAppealStatus :exec
UPDATE grade_appeals
SET status = $2::appeal_status,
    lecturer_response = COALESCE($3, lecturer_response),
    lecturer_id = COALESCE($4, lecturer_id),
    hod_response = COALESCE($5, hod_response),
    hod_id = COALESCE($6, hod_id),
    revised_score = COALESCE($7, revised_score),
    resolved_at = CASE WHEN $2::text IN ('resolved', 'rejected') THEN NOW() ELSE resolved_at END,
    updated_at = NOW()
WHERE id = $1
`

type UpdateGradeAppealStatusParams struct {
	ID               uuid.UUID    `json:"id"`
	Status           AppealStatus `json:"status"`
	LecturerResponse *string      `json:"lecturer_response"`
	LecturerID       pgtype.UUID  `json:"lecturer_id"`
	HodResponse      *string      `json:"hod_response"`
	HodID            pgtype.UUID  `json:"hod_id"`
	RevisedScore     *float64     `json:"revised_score"`
}

func (q *Queries) UpdateGradeAppealStatus(ctx context.Context, arg UpdateGradeAppealStatusParams) error {
	_, err := q.db.Exec(ctx, updateGradeAppealStatus,
		arg.ID,
		arg.Status,
		arg.LecturerResponse,
		arg.LecturerID,
		arg.HodResponse,
		arg.HodID,
		arg.RevisedScore,
	)
	return err
}

```

### Removed from `backend/internal/api/expenses_feedback.go` (grade appeals)

```go
		{"Results", "How to appeal a grade", "1. Go to Results in the sidebar.\n2. Click Grade Appeals.\n3. Select the course, provide your reason and evidence.\n4. Submit the appeal.\nThe lecturer and HOD will review it. You will be notified of the outcome.", 3},
```

### Removed from `frontend/src/api/additional-features.ts`

Note: `parseJSONField` (top of file) is a SHARED helper also used by Class Notices, Calendar Events, and Feature Flags in this same file — it was NOT removed, only the Grade Appeals section below.
```ts
// Grade Appeals
export interface GradeAppeal {
  id: string;
  student_id: string;
  course_id: string;
  semester_id: string;
  session_id: string;
  reason: string;
  evidence_urls: string[];
  status: string;
  lecturer_response?: string;
  hod_response?: string;
  original_score?: number;
  revised_score?: number;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  course_code?: string;
  course_title?: string;
  student_name?: string;
}

// evidence_urls is a jsonb column, which the backend sends as raw Go []byte
// (base64-encoded by encoding/json) rather than an embedded array — without
// this, `evidence_urls.map(...)` throws (strings have no .map) the moment an
// appeal with evidence is opened.
const normalizeAppeal = (a: GradeAppeal): GradeAppeal => ({
  ...a,
  evidence_urls: parseJSONField<string>(a.evidence_urls),
});

export const createGradeAppeal = async (data: {
  course_id: string;
  semester_id: string;
  session_id: string;
  reason: string;
  evidence?: string[];
}) => {
  const res = await apiClient.post('/grade-appeals', data);
  return normalizeAppeal(unwrap<GradeAppeal>(res));
};

export const listMyAppeals = async () => {
  const res = await apiClient.get('/grade-appeals/my');
  return unwrap<GradeAppeal[]>(res).map(normalizeAppeal);
};

export const listPendingAppeals = async (status?: string) => {
  const params = status ? { status } : {};
  const res = await apiClient.get('/grade-appeals/pending', { params });
  return unwrap<GradeAppeal[]>(res).map(normalizeAppeal);
};

export const updateAppealStatus = async (
  id: string,
  data: { status: string; response?: string; revised_score?: number },
) => {
  const res = await apiClient.put(`/grade-appeals/${id}/status`, data);
  return unwrap<{ message: string }>(res);
};

```

### Removed from `frontend/src/pages/admin/SystemAdminPage.tsx`

- Import: `import GradeAppealsAdminPage from './GradeAppealsAdminPage';`
- `Tab` type had `| 'grade-appeals'` removed.
- `tabs` array entry: `{ key: 'grade-appeals', label: 'Grade Appeals', icon: AlertCircle },` (the `AlertCircle` icon import was also removed since nothing else used it).
- Render line: `{activeTab === 'grade-appeals' && <GradeAppealsAdminPage />}`

### Removed from `frontend/src/components/layout/Sidebar.tsx` (grade appeals)

```tsx
  {
    label: 'Grade Appeals',
    path: '/grade-appeals',
    icon: AlertTriangle,
    roles: ['student', 'project_coordinator', 'event_coordinator', 'alumni_rep'],
  },
```

### Removed from `frontend/src/router.tsx` (grade appeals)

```tsx
const GradeAppealsPage = lazy(() => import('./pages/student/GradeAppealsPage'));
```
```tsx
              { path: '/grade-appeals', element: <GradeAppealsPage /> },
```

### Removed from `backend/internal/db/sql/models.go` (grade appeals)

```go
type AppealStatus string

const (
	AppealStatusSubmitted      AppealStatus = "submitted"
	AppealStatusLecturerReview AppealStatus = "lecturer_review"
	AppealStatusHodReview      AppealStatus = "hod_review"
	AppealStatusResolved       AppealStatus = "resolved"
	AppealStatusRejected       AppealStatus = "rejected"
)

func (e *AppealStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = AppealStatus(s)
	case string:
		*e = AppealStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for AppealStatus: %T", src)
	}
	return nil
}

type NullAppealStatus struct {
	AppealStatus AppealStatus `json:"appeal_status"`
	Valid        bool         `json:"valid"` // Valid is true if AppealStatus is not NULL
}

// Scan implements the Scanner interface.
func (ns *NullAppealStatus) Scan(value interface{}) error {
	if value == nil {
		ns.AppealStatus, ns.Valid = "", false
		return nil
	}
	ns.Valid = true
	return ns.AppealStatus.Scan(value)
}

// Value implements the driver Valuer interface.
func (ns NullAppealStatus) Value() (driver.Value, error) {
	if !ns.Valid {
		return nil, nil
	}
	return string(ns.AppealStatus), nil
}
```

```go
type GradeAppeal struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	SemesterID       uuid.UUID          `json:"semester_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	Reason           string             `json:"reason"`
	EvidenceUrls     []byte             `json:"evidence_urls"`
	Status           AppealStatus       `json:"status"`
	LecturerResponse *string            `json:"lecturer_response"`
	LecturerID       pgtype.UUID        `json:"lecturer_id"`
	HodResponse      *string            `json:"hod_response"`
	HodID            pgtype.UUID        `json:"hod_id"`
	OriginalScore    *float64           `json:"original_score"`
	RevisedScore     *float64           `json:"revised_score"`
	ResolvedAt       pgtype.Timestamptz `json:"resolved_at"`
	CreatedAt        pgtype.Timestamptz `json:"created_at"`
	UpdatedAt        pgtype.Timestamptz `json:"updated_at"`
}
```

## PART 3 — Transcript

### `backend/internal/api/transcript_request.go`
```go
package api

import (
	"fmt"
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createTranscriptRequestReq struct {
	StudentID   string `json:"student_id" binding:"omitempty,uuid"`
	Purpose     string `json:"purpose"`
	Destination string `json:"destination"`
}

func (r *createTranscriptRequestReq) GetPurpose() string {
	if r.Purpose != "" {
		return r.Purpose
	}
	if r.Destination != "" {
		return r.Destination
	}
	return "Official transcript request"
}

func (server *Server) createTranscriptRequest(ctx *gin.Context) {
	var req createTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Students can only create transcript requests for themselves
	userID := getUserID(ctx)
	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "student record not found"})
		return
	}
	studentID := student.ID

	transcriptReq, err := server.transcripts.Create(ctx, service.CreateTranscriptInput{
		StudentID: studentID,
		Purpose:   req.GetPurpose(),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": transcriptReq})
}

func (server *Server) getTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	transcriptReq, err := server.transcripts.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, transcriptReq.StudentID) {
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": transcriptReq})
}

func (server *Server) listStudentTranscriptRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	requests, err := server.transcripts.ListByStudent(ctx, studentID)
	if err != nil {
		// Fallback: the provided ID might be a user_id
		student, sErr := server.store.GetStudentByUserId(ctx, studentID)
		if sErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		requests, err = server.transcripts.ListByStudent(ctx, student.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": requests})
}

type listPendingTranscriptRequestsReq struct {
	PageID   int32 `form:"page_id" binding:"required,min=1"`
	PageSize int32 `form:"page_size" binding:"required,min=5,max=100"`
}

func (server *Server) listPendingTranscriptRequests(ctx *gin.Context) {
	var req listPendingTranscriptRequestsReq
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	requests, err := server.transcripts.ListPending(ctx, req.PageSize, (req.PageID-1)*req.PageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

type updateTranscriptRequestReq struct {
	Status       string  `json:"status" binding:"required"`
	FeePaid      bool    `json:"fee_paid"`
	PdfUrl       *string `json:"pdf_url"`
	SentViaEmail bool    `json:"sent_via_email"`
}

func (server *Server) updateTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateTranscriptRequestReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	// Always the caller's own ID, never client-supplied, so the audit trail
	// records who actually processed the request.
	processedByID := getUserID(ctx)
	processedBy := &processedByID

	transcriptReq, err := server.transcripts.Update(ctx, id, service.UpdateTranscriptInput{
		Status:       req.Status,
		FeePaid:      req.FeePaid,
		PdfUrl:       req.PdfUrl,
		SentViaEmail: req.SentViaEmail,
		ProcessedBy:  processedBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about transcript request status change
	if student, err := server.store.GetStudent(ctx, transcriptReq.StudentID); err == nil {
		eType := "transcript_request"
		eID := transcriptReq.ID
		title := "Transcript Request Updated"
		msg := fmt.Sprintf("Your transcript request status has been updated to %s.", req.Status)
		priority := "normal"
		if req.Status == "ready" || req.Status == "completed" {
			title = "Transcript Ready"
			msg = "Your transcript request has been processed and is ready."
			priority = "high"
		} else if req.Status == "rejected" {
			title = "Transcript Request Rejected"
			msg = "Your transcript request has been rejected."
			priority = "high"
		}
		server.notifyUser(
			ctx,
			student.UserID,
			"academic",
			"system",
			priority,
			title,
			msg,
			"/transcripts",
			"View Transcripts",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, transcriptReq)
}

func (server *Server) deleteTranscriptRequest(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := server.transcripts.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "deleted successfully"})
}
```

### `backend/internal/service/transcript_service.go`
```go
package service

import (
	"context"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type TranscriptService struct {
	store db.Querier
}

func NewTranscriptService(store db.Querier) *TranscriptService {
	return &TranscriptService{store: store}
}

type CreateTranscriptInput struct {
	StudentID uuid.UUID
	Purpose   string
}

func (s *TranscriptService) Create(ctx context.Context, input CreateTranscriptInput) (db.TranscriptRequest, error) {
	return s.store.CreateTranscriptRequest(ctx, db.CreateTranscriptRequestParams{
		StudentID: input.StudentID,
		Purpose:   input.Purpose,
		Status:    db.TranscriptStatusRequested,
	})
}

func (s *TranscriptService) GetByID(ctx context.Context, id uuid.UUID) (db.TranscriptRequest, error) {
	return s.store.GetTranscriptRequest(ctx, id)
}

func (s *TranscriptService) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]db.TranscriptRequest, error) {
	return s.store.ListStudentTranscriptRequests(ctx, studentID)
}

func (s *TranscriptService) ListPending(ctx context.Context, limit, offset int32) ([]db.TranscriptRequest, error) {
	return s.store.ListPendingTranscriptRequests(ctx, db.ListPendingTranscriptRequestsParams{
		Limit:  limit,
		Offset: offset,
	})
}

type UpdateTranscriptInput struct {
	Status       string
	ProcessedBy  *uuid.UUID
	FeePaid      bool
	PdfUrl       *string
	SentViaEmail bool
}

func (s *TranscriptService) Update(ctx context.Context, id uuid.UUID, input UpdateTranscriptInput) (db.TranscriptRequest, error) {
	arg := db.UpdateTranscriptRequestParams{
		ID:           id,
		Status:       db.TranscriptStatus(input.Status),
		FeePaid:      input.FeePaid,
		PdfUrl:       input.PdfUrl,
		SentViaEmail: input.SentViaEmail,
	}

	if input.ProcessedBy != nil {
		arg.ProcessedBy = pgtype.UUID{Bytes: *input.ProcessedBy, Valid: true}
	}

	return s.store.UpdateTranscriptRequest(ctx, arg)
}

func (s *TranscriptService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteTranscriptRequest(ctx, id)
}
```

### `backend/internal/db/sql/transcript_requests.sql.go`
```go
// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.31.1
// source: transcript_requests.sql

package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const createTranscriptRequest = `-- name: CreateTranscriptRequest :one
INSERT INTO transcript_requests (
    student_id, purpose, status, fee_paid, fee_amount
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, student_id, purpose, status, fee_paid, fee_amount, pdf_url, qr_code_url, sent_via_email, emailed_at, processed_by, processed_at, created_at
`

type CreateTranscriptRequestParams struct {
	StudentID uuid.UUID        `json:"student_id"`
	Purpose   string           `json:"purpose"`
	Status    TranscriptStatus `json:"status"`
	FeePaid   bool             `json:"fee_paid"`
	FeeAmount pgtype.Numeric   `json:"fee_amount"`
}

func (q *Queries) CreateTranscriptRequest(ctx context.Context, arg CreateTranscriptRequestParams) (TranscriptRequest, error) {
	row := q.db.QueryRow(ctx, createTranscriptRequest,
		arg.StudentID,
		arg.Purpose,
		arg.Status,
		arg.FeePaid,
		arg.FeeAmount,
	)
	var i TranscriptRequest
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.Purpose,
		&i.Status,
		&i.FeePaid,
		&i.FeeAmount,
		&i.PdfUrl,
		&i.QrCodeUrl,
		&i.SentViaEmail,
		&i.EmailedAt,
		&i.ProcessedBy,
		&i.ProcessedAt,
		&i.CreatedAt,
	)
	return i, err
}

const deleteTranscriptRequest = `-- name: DeleteTranscriptRequest :exec
DELETE FROM transcript_requests
WHERE id = $1
`

func (q *Queries) DeleteTranscriptRequest(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteTranscriptRequest, id)
	return err
}

const getTranscriptRequest = `-- name: GetTranscriptRequest :one
SELECT id, student_id, purpose, status, fee_paid, fee_amount, pdf_url, qr_code_url, sent_via_email, emailed_at, processed_by, processed_at, created_at FROM transcript_requests
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetTranscriptRequest(ctx context.Context, id uuid.UUID) (TranscriptRequest, error) {
	row := q.db.QueryRow(ctx, getTranscriptRequest, id)
	var i TranscriptRequest
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.Purpose,
		&i.Status,
		&i.FeePaid,
		&i.FeeAmount,
		&i.PdfUrl,
		&i.QrCodeUrl,
		&i.SentViaEmail,
		&i.EmailedAt,
		&i.ProcessedBy,
		&i.ProcessedAt,
		&i.CreatedAt,
	)
	return i, err
}

const listPendingTranscriptRequests = `-- name: ListPendingTranscriptRequests :many
SELECT id, student_id, purpose, status, fee_paid, fee_amount, pdf_url, qr_code_url, sent_via_email, emailed_at, processed_by, processed_at, created_at FROM transcript_requests
WHERE status = 'requested'
ORDER BY created_at ASC
LIMIT $1 OFFSET $2
`

type ListPendingTranscriptRequestsParams struct {
	Limit  int32 `json:"limit"`
	Offset int32 `json:"offset"`
}

func (q *Queries) ListPendingTranscriptRequests(ctx context.Context, arg ListPendingTranscriptRequestsParams) ([]TranscriptRequest, error) {
	rows, err := q.db.Query(ctx, listPendingTranscriptRequests, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TranscriptRequest{}
	for rows.Next() {
		var i TranscriptRequest
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.Purpose,
			&i.Status,
			&i.FeePaid,
			&i.FeeAmount,
			&i.PdfUrl,
			&i.QrCodeUrl,
			&i.SentViaEmail,
			&i.EmailedAt,
			&i.ProcessedBy,
			&i.ProcessedAt,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listStudentTranscriptRequests = `-- name: ListStudentTranscriptRequests :many
SELECT id, student_id, purpose, status, fee_paid, fee_amount, pdf_url, qr_code_url, sent_via_email, emailed_at, processed_by, processed_at, created_at FROM transcript_requests
WHERE student_id = $1
ORDER BY created_at DESC
`

func (q *Queries) ListStudentTranscriptRequests(ctx context.Context, studentID uuid.UUID) ([]TranscriptRequest, error) {
	rows, err := q.db.Query(ctx, listStudentTranscriptRequests, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TranscriptRequest{}
	for rows.Next() {
		var i TranscriptRequest
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.Purpose,
			&i.Status,
			&i.FeePaid,
			&i.FeeAmount,
			&i.PdfUrl,
			&i.QrCodeUrl,
			&i.SentViaEmail,
			&i.EmailedAt,
			&i.ProcessedBy,
			&i.ProcessedAt,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const updateTranscriptRequest = `-- name: UpdateTranscriptRequest :one
UPDATE transcript_requests
SET
    status = $2,
    fee_paid = $3,
    pdf_url = $4,
    qr_code_url = $5,
    sent_via_email = $6,
    emailed_at = $7,
    processed_by = $8,
    processed_at = $9
WHERE id = $1
RETURNING id, student_id, purpose, status, fee_paid, fee_amount, pdf_url, qr_code_url, sent_via_email, emailed_at, processed_by, processed_at, created_at
`

type UpdateTranscriptRequestParams struct {
	ID           uuid.UUID          `json:"id"`
	Status       TranscriptStatus   `json:"status"`
	FeePaid      bool               `json:"fee_paid"`
	PdfUrl       *string            `json:"pdf_url"`
	QrCodeUrl    *string            `json:"qr_code_url"`
	SentViaEmail bool               `json:"sent_via_email"`
	EmailedAt    pgtype.Timestamptz `json:"emailed_at"`
	ProcessedBy  pgtype.UUID        `json:"processed_by"`
	ProcessedAt  pgtype.Timestamptz `json:"processed_at"`
}

func (q *Queries) UpdateTranscriptRequest(ctx context.Context, arg UpdateTranscriptRequestParams) (TranscriptRequest, error) {
	row := q.db.QueryRow(ctx, updateTranscriptRequest,
		arg.ID,
		arg.Status,
		arg.FeePaid,
		arg.PdfUrl,
		arg.QrCodeUrl,
		arg.SentViaEmail,
		arg.EmailedAt,
		arg.ProcessedBy,
		arg.ProcessedAt,
	)
	var i TranscriptRequest
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.Purpose,
		&i.Status,
		&i.FeePaid,
		&i.FeeAmount,
		&i.PdfUrl,
		&i.QrCodeUrl,
		&i.SentViaEmail,
		&i.EmailedAt,
		&i.ProcessedBy,
		&i.ProcessedAt,
		&i.CreatedAt,
	)
	return i, err
}
```

### `frontend/src/api/transcripts.ts`
```ts
import apiClient, { unwrap } from './client';
import type { TranscriptRequest, PaginationParams } from '../types';

export const requestTranscript = async (payload: { destination?: string }) => {
  const res = await apiClient.post('/transcript-requests', payload);
  return unwrap<TranscriptRequest>(res);
};

export const getStudentTranscriptRequests = async (studentId: string) => {
  const res = await apiClient.get(`/transcript-requests/student/${studentId}`);
  return unwrap<TranscriptRequest[]>(res);
};

export const getPendingTranscriptRequests = async (params?: PaginationParams) => {
  // page_id/page_size are binding:"required" server-side with no defaults —
  // AcademicsHubPage's TranscriptsTab calls this with no arguments at all,
  // which sent an empty query string and 400'd on every load.
  const res = await apiClient.get('/transcript-requests/pending', {
    params: {
      page_id: params?.page || 1,
      page_size: Math.min(params?.perPage || 50, 100),
    },
  });
  return unwrap<TranscriptRequest[]>(res);
};

export const getTranscriptRequest = async (requestId: string) => {
  const res = await apiClient.get(`/transcript-requests/${requestId}`);
  return unwrap<TranscriptRequest>(res);
};

export const updateTranscriptStatus = async (requestId: string, status: string) => {
  const res = await apiClient.put(`/transcript-requests/${requestId}`, { status });
  return unwrap<TranscriptRequest>(res);
};

export const deleteTranscriptRequest = async (requestId: string) => {
  await apiClient.delete(`/transcript-requests/${requestId}`);
};

export const getTranscriptRequests = getPendingTranscriptRequests;
export const approveTranscriptRequest = async (requestId: string) => {
  return updateTranscriptStatus(requestId, 'approved');
};
export const markTranscriptPrinted = async (requestId: string) => {
  return updateTranscriptStatus(requestId, 'printed');
};
```

### `frontend/src/types/transcript.ts`
```ts
// Transcript domain types — re-exported from master index
export type { TranscriptRequest, TranscriptStatus } from './index';
```

### `frontend/src/pages/student/TranscriptsPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { requestTranscript, getStudentTranscriptRequests } from '../../api/transcripts';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { FileText, Send } from 'lucide-react';
import type { TranscriptRequest } from '../../types';

const TranscriptsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [dest, setDest] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getStudentTranscriptRequests(user.id)
      .then(setRequests)
      .catch(() => notifyError('Error', 'Failed to load transcript requests'));
  }, [user?.id]);

  const handleRequestOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest) return;
    setSubmitting(true);
    try {
      await requestTranscript({ destination: dest });
      setDest('');
      success('Request Submitted', 'Official transcript request queued for processing.');
      if (user?.id) {
        getStudentTranscriptRequests(user.id).then(setRequests);
      }
    } catch {
      notifyError('Submission Failed', 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'destination', label: 'Recipient Institution' },
    {
      key: 'createdAt',
      label: 'Date Requested',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Transcripts</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Download unofficial transcripts immediately, or request official transcripts sent directly to institutions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Official Request History</CardTitle>
              <CardDescription>Track the dispatch status of institutional transcripts</CardDescription>
            </CardHeader>
            <DataTable columns={columns} data={requests as unknown as Record<string, unknown>[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-500" />
              Unofficial Transcript
            </h3>
            <p className="text-xs text-surface-500 mb-4 leading-relaxed">
              Generate and download an unofficial copy of your results transcript for personal reference or internship
              applications.
            </p>
            <Button
              className="w-full"
              onClick={() => notifyError('Info', 'Unofficial transcript generation requires results data.')}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              Download Copy
            </Button>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request Official Copy</CardTitle>
              <CardDescription>Fee: ₦10,000 per destination</CardDescription>
            </CardHeader>
            <form onSubmit={handleRequestOfficial} className="p-4 pt-0 space-y-4">
              <Input
                label="Destination Institution & Address"
                placeholder="e.g. Stanford University Admissions..."
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
                Submit Request
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TranscriptsPage;
```


### Removed from `frontend/src/pages/admin/AcademicsHubPage.tsx` (transcript)

This page also has a "Graduation Check" tab (`GraduationTab`) which is an unrelated feature and stays. The "Transcript Queue" tab (`TranscriptsTab`) and everything wiring it in were removed; the page was reduced to graduation-check only (tab bar removed too, since it's now the only tab). Original full file preserved above; key removed pieces:

- Imports: `getTranscriptRequests, approveTranscriptRequest, markTranscriptPrinted` from `../../api/transcripts`; `TranscriptRequest, TranscriptStatus` from `../../types`; icons `FileText, Loader2, Printer, Eye, Send` (all exclusive to the transcripts tab).
- `Tab` type: was `'graduation' | 'transcripts'`, now just `'graduation'` (tab bar removed entirely since only one tab remains).
- The `TranscriptsTab()` function (originally lines 264–446) removed in full.

### Removed from `backend/internal/api/server.go` (transcript)

Struct field: `transcripts       *service.TranscriptService`
Constructor: `transcripts:       service.NewTranscriptService(store),`
Route group:
```go
	transcripts := api.Group("/transcript-requests")
	{
		transcripts.POST("", middleware.RequireRoles("student"), server.createTranscriptRequest)
		transcripts.GET("/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingTranscriptRequests)
		transcripts.GET("/student/:student_id", server.listStudentTranscriptRequests)
		transcripts.GET("/:id", server.getTranscriptRequest)
		transcripts.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateTranscriptRequest)
		transcripts.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteTranscriptRequest)
	}
```

### Removed from `backend/internal/service/ai_service.go` (transcript)

Chatbot rule removed:
```go
		{
			keywords: []string{"transcript", "academic record", "official"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Your unofficial transcript is available on the Transcripts page. For an official transcript, submit a request through the admin and it will be processed by the HOD office.",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View my transcript", "Request official transcript"},
				}
			},
		},
```
The grades rule's `Suggestions: []string{"View full transcript", "Check carryover courses"}` had both suggestions removed (transcript and carryover — both features removed in this pass) and replaced with a neutral suggestion.

### Removed from `frontend/src/components/layout/Sidebar.tsx` (transcript)

```tsx
  {
    label: 'Transcripts',
    path: '/transcripts',
    icon: FileText,
    roles: ['student', 'project_coordinator', 'event_coordinator', 'alumni_rep'],
  },
```
and (grouped mobile/academics section list):
```tsx
      { label: 'Transcripts', path: '/transcripts', icon: FileText },
```

### Removed from `frontend/src/router.tsx` (transcript)

```tsx
const TranscriptsPage = lazy(() => import('./pages/student/TranscriptsPage'));
```
```tsx
              { path: '/transcripts', element: <TranscriptsPage /> },
```

### Removed from `frontend/src/types/index.ts` (transcript)

```ts
export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'collected' | 'approved' | 'printed';
```
```ts
// ───── Transcripts ─────
export interface TranscriptRequest extends BaseEntity {
  studentId: string;
  status: TranscriptStatus;
  requestedAt?: string;
  processedAt?: string;
  readyAt?: string;
  collectedAt?: string;
  paymentId?: string;
  student?: Student;
  destination?: string;
  paymentStatus?: string;
  studentName?: string;
  purpose?: string;
  copies?: number;
}
```

### `frontend/src/utils/pdf.ts` (deleted — was already unused/dead anywhere in the app)

Note: this file's `downloadBlob` export is a generic Blob-download helper, not transcript-specific, but was confirmed unused everywhere (only `generateTranscriptPDF`, also in this file, ever referenced it conceptually) — safe to delete the whole file.
```ts
import { jsPDF } from 'jspdf';

interface TranscriptData {
  studentName: string;
  matricNumber: string;
  department: string;
  semester: string;
  session: string;
  courses: { code: string; title: string; credit: number; grade: string }[];
  cgpa?: string;
}

export const generateTranscriptPDF = async (data: TranscriptData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text('ACES ZONE', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text('OFFICIAL TRANSCRIPT', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Student: ${data.studentName}`, 14, 45);
  doc.text(`Matric No: ${data.matricNumber}`, 14, 52);
  doc.text(`Department: ${data.department}`, 14, 59);
  doc.text(`Session: ${data.session}  |  Semester: ${data.semester}`, 14, 66);

  doc.setFontSize(9);
  const headers = ['Code', 'Course Title', 'Credit', 'Grade'];
  const startY = 78;
  const colWidths = [28, 100, 20, 20];
  const colStarts = [14, 14 + colWidths[0], 14 + colWidths[0] + colWidths[1], 14 + colWidths[0] + colWidths[1] + colWidths[2]];

  doc.setFont('Helvetica', 'bold');
  headers.forEach((h, i) => doc.text(h, colStarts[i], startY));
  doc.line(14, startY + 2, 14 + colWidths.reduce((a, b) => a + b, 0), startY + 2);

  doc.setFont('Helvetica', 'normal');
  let y = startY + 10;
  data.courses.forEach((c) => {
    doc.text(c.code, colStarts[0], y);
    doc.text(c.title.substring(0, 40), colStarts[1], y);
    doc.text(String(c.credit), colStarts[2], y);
    doc.text(c.grade, colStarts[3], y);
    y += 7;
  });

  if (data.cgpa) {
    y += 6;
    doc.setFont('Helvetica', 'bold');
    doc.text(`CGPA: ${data.cgpa}`, 14, y);
  }

  const blob = doc.output('blob');
  return blob;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

### Removed from `backend/internal/db/sql/models.go` (transcript)

```go
type TranscriptStatus string

const (
	TranscriptStatusRequested      TranscriptStatus = "requested"
	TranscriptStatusPendingPayment TranscriptStatus = "pending_payment"
	TranscriptStatusProcessing     TranscriptStatus = "processing"
	TranscriptStatusReady          TranscriptStatus = "ready"
	TranscriptStatusSent           TranscriptStatus = "sent"
)

func (e *TranscriptStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = TranscriptStatus(s)
	case string:
		*e = TranscriptStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for TranscriptStatus: %T", src)
	}
	return nil
}

type NullTranscriptStatus struct {
	TranscriptStatus TranscriptStatus `json:"transcript_status"`
	Valid            bool             `json:"valid"` // Valid is true if TranscriptStatus is not NULL
}

// Scan implements the Scanner interface.
func (ns *NullTranscriptStatus) Scan(value interface{}) error {
	if value == nil {
		ns.TranscriptStatus, ns.Valid = "", false
		return nil
	}
	ns.Valid = true
	return ns.TranscriptStatus.Scan(value)
}

// Value implements the driver Valuer interface.
func (ns NullTranscriptStatus) Value() (driver.Value, error) {
	if !ns.Valid {
		return nil, nil
	}
	return string(ns.TranscriptStatus), nil
}
```

```go
type TranscriptRequest struct {
	ID           uuid.UUID          `json:"id"`
	StudentID    uuid.UUID          `json:"student_id"`
	Purpose      string             `json:"purpose"`
	Status       TranscriptStatus   `json:"status"`
	FeePaid      bool               `json:"fee_paid"`
	FeeAmount    pgtype.Numeric     `json:"fee_amount"`
	PdfUrl       *string            `json:"pdf_url"`
	QrCodeUrl    *string            `json:"qr_code_url"`
	SentViaEmail bool               `json:"sent_via_email"`
	EmailedAt    pgtype.Timestamptz `json:"emailed_at"`
	ProcessedBy  pgtype.UUID        `json:"processed_by"`
	ProcessedAt  pgtype.Timestamptz `json:"processed_at"`
	CreatedAt    pgtype.Timestamptz `json:"created_at"`
}
```

## PART 2 — Carryover (dedicated tracking entity only; `is_carryover` flag on results/registered_courses stays — core grading model)

### `backend/internal/db/sql/carryover_custom.go`
```go
package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// CarryoverCourseDetailed enriches a carryover row with course and session
// names so a student-facing list doesn't need N follow-up lookups.
type CarryoverCourseDetailed struct {
	ID                uuid.UUID          `json:"id"`
	StudentID         uuid.UUID          `json:"student_id"`
	CourseID          uuid.UUID          `json:"course_id"`
	CourseCode        string             `json:"course_code"`
	CourseTitle       string             `json:"course_title"`
	Unit              int32              `json:"unit"`
	OriginalSessionID uuid.UUID          `json:"original_session_id"`
	OriginalSessionName string           `json:"original_session_name"`
	AttemptCount      int32              `json:"attempt_count"`
	MaxAttempts       int32              `json:"max_attempts"`
	IsResolved        bool               `json:"is_resolved"`
	ResolvedResultID  pgtype.UUID        `json:"resolved_result_id"`
	CreatedAt         pgtype.Timestamptz `json:"created_at"`
}

func (q *Queries) ListStudentCarryoverCoursesDetailed(ctx context.Context, studentID uuid.UUID) ([]CarryoverCourseDetailed, error) {
	rows, err := q.db.Query(ctx, `
		SELECT cc.id, cc.student_id, cc.course_id, c.code, c.title, c.unit,
		       cc.original_session_id, s.name, cc.attempt_count, cc.max_attempts,
		       cc.is_resolved, cc.resolved_result_id, cc.created_at
		FROM carryover_courses cc
		JOIN courses c ON c.id = cc.course_id
		JOIN sessions s ON s.id = cc.original_session_id
		WHERE cc.student_id = $1
		ORDER BY cc.is_resolved ASC, cc.created_at DESC
	`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []CarryoverCourseDetailed{}
	for rows.Next() {
		var c CarryoverCourseDetailed
		if err := rows.Scan(
			&c.ID, &c.StudentID, &c.CourseID, &c.CourseCode, &c.CourseTitle, &c.Unit,
			&c.OriginalSessionID, &c.OriginalSessionName, &c.AttemptCount, &c.MaxAttempts,
			&c.IsResolved, &c.ResolvedResultID, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}
```

### `frontend/src/api/carryovers.ts`
```ts
import apiClient, { unwrap } from './client';

export interface CarryoverCourseDetailed {
  id: string;
  student_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  original_session_id: string;
  original_session_name: string;
  attempt_count: number;
  max_attempts: number;
  is_resolved: boolean;
  resolved_result_id: string | null;
  created_at: string;
}

export const getMyCarryovers = async (studentId: string) => {
  const res = await apiClient.get(`/carryovers/student/${studentId}/detailed`);
  return unwrap<CarryoverCourseDetailed[]>(res);
};
```

### `frontend/src/pages/student/CarryoverPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMyCarryovers, type CarryoverCourseDetailed } from '../../api/carryovers';

const CarryoverPage = () => {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [carryovers, setCarryovers] = useState<CarryoverCourseDetailed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getMyCarryovers(user.id)
      .then(setCarryovers)
      .catch(() => notifyError('Error', 'Failed to load carryover courses'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const outstanding = carryovers.filter((c) => !c.is_resolved);
  const resolved = carryovers.filter((c) => c.is_resolved);
  const totalOutstandingUnits = outstanding.reduce((sum, c) => sum + c.unit, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Carryover Courses</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Courses you failed and must retake, and how they affect your CGPA.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-danger-600 dark:text-danger-400 mt-1">{outstanding.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Resolved</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1">{resolved.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Units to Retake</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{totalOutstandingUnits}</p>
        </Card>
      </div>

      {carryovers.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-success-400 mb-2" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No carryover courses</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">You're clear — keep it up.</p>
          </div>
        </Card>
      ) : (
        <>
          {outstanding.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-danger-500" />
                  <CardTitle>Outstanding Carryovers</CardTitle>
                </div>
                <CardDescription>These weigh into your CGPA as an F until retaken and passed.</CardDescription>
              </CardHeader>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {outstanding.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 dark:text-surface-100">{c.course_code}</p>
                      <p className="text-xs text-surface-500 truncate">
                        {c.course_title} · {c.unit} unit(s)
                      </p>
                      <p className="text-[10px] text-surface-400 mt-0.5">Originally taken: {c.original_session_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={c.attempt_count >= c.max_attempts ? 'danger' : 'warning'}>
                        Attempt {c.attempt_count} of {c.max_attempts}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {resolved.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-success-500" />
                  <CardTitle>Resolved</CardTitle>
                </div>
                <CardDescription>Retaken and passed — no longer affecting your CGPA as a fail.</CardDescription>
              </CardHeader>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {resolved.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 dark:text-surface-100">{c.course_code}</p>
                      <p className="text-xs text-surface-500 truncate">{c.course_title}</p>
                    </div>
                    <Badge variant="success">Resolved</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CarryoverPage;
```


### Removed from `backend/internal/api/result.go` (carryover-course handlers, lines 427-574 originally)

```go
type createCarryoverCourseRequest struct {
	StudentID         string `json:"student_id" binding:"required,uuid"`
	CourseID          string `json:"course_id" binding:"required,uuid"`
	OriginalResultID  string `json:"original_result_id" binding:"required,uuid"`
	OriginalSessionID string `json:"original_session_id" binding:"required,uuid"`
	AttemptCount      int32  `json:"attempt_count"`
	MaxAttempts       int32  `json:"max_attempts"`
}

func (server *Server) createCarryoverCourse(ctx *gin.Context) {
	var req createCarryoverCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	carryover, err := server.results.CreateCarryover(ctx, service.CreateCarryoverInput{
		StudentID:         req.StudentID,
		CourseID:          req.CourseID,
		OriginalResultID:  req.OriginalResultID,
		OriginalSessionID: req.OriginalSessionID,
		AttemptCount:      req.AttemptCount,
		MaxAttempts:       req.MaxAttempts,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, carryover)
}

func (server *Server) getCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	carryover, err := server.results.GetCarryover(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "carryover course not found"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, carryover.StudentID) {
		return
	}

	ctx.JSON(http.StatusOK, carryover)
}

type updateCarryoverCourseRequest struct {
	AttemptCount     int32  `json:"attempt_count" binding:"required"`
	IsResolved       bool   `json:"is_resolved"`
	ResolvedResultID string `json:"resolved_result_id" binding:"omitempty,uuid"`
}

func (server *Server) updateCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	var req updateCarryoverCourseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	var resolvedResultID *string
	if req.ResolvedResultID != "" {
		resolvedResultID = &req.ResolvedResultID
	}

	carryover, err := server.results.UpdateCarryover(ctx, id, req.AttemptCount, req.IsResolved, resolvedResultID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, carryover)
}

func (server *Server) listStudentCarryoverCourses(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	carryovers, err := server.results.ListCarryovers(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, carryovers)
}

// listStudentCarryoverCoursesDetailed GET /carryovers/student/:student_id/detailed
func (server *Server) listStudentCarryoverCoursesDetailed(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("student_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student id"})
		return
	}

	if !isStaffCaller(ctx) {
		callerStudentID, ok := requireOwnershipOrStaffByStudentIDParam(ctx, server.store)
		if !ok {
			return
		}
		studentID = callerStudentID
	}

	carryovers, err := server.results.ListCarryoversDetailed(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": carryovers})
}

func (server *Server) deleteCarryoverCourse(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid carryover course id"})
		return
	}

	if err := server.results.DeleteCarryover(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "carryover course deleted successfully"})
}
```

### Removed from `backend/internal/service/result_service.go` (lines 163-233 originally)

```go
type CreateCarryoverInput struct {
	StudentID         string
	CourseID          string
	OriginalResultID  string
	OriginalSessionID string
	AttemptCount      int32
	MaxAttempts       int32
}

func (s *ResultService) CreateCarryover(ctx context.Context, input CreateCarryoverInput) (db.CarryoverCourse, error) {
	studentID, _ := uuid.Parse(input.StudentID)
	courseID, _ := uuid.Parse(input.CourseID)
	originalResultID, _ := uuid.Parse(input.OriginalResultID)
	originalSessionID, _ := uuid.Parse(input.OriginalSessionID)

	maxAttempts := input.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 3
	}

	attemptCount := input.AttemptCount
	if attemptCount <= 0 {
		attemptCount = 1
	}

	return s.store.CreateCarryoverCourse(ctx, db.CreateCarryoverCourseParams{
		StudentID:         studentID,
		CourseID:          courseID,
		OriginalResultID:  originalResultID,
		OriginalSessionID: originalSessionID,
		AttemptCount:      attemptCount,
		MaxAttempts:       maxAttempts,
	})
}

func (s *ResultService) GetCarryover(ctx context.Context, id uuid.UUID) (db.CarryoverCourse, error) {
	return s.store.GetCarryoverCourse(ctx, id)
}

func (s *ResultService) UpdateCarryover(ctx context.Context, id uuid.UUID, attemptCount int32, isResolved bool, resolvedResultID *string) (db.CarryoverCourse, error) {
	arg := db.UpdateCarryoverCourseParams{
		ID:           id,
		AttemptCount: attemptCount,
		IsResolved:   isResolved,
	}

	if resolvedResultID != nil {
		resolvedID, _ := uuid.Parse(*resolvedResultID)
		arg.ResolvedResultID = pgtype.UUID{Bytes: resolvedID, Valid: true}
	}

	return s.store.UpdateCarryoverCourse(ctx, arg)
}

func (s *ResultService) ListCarryovers(ctx context.Context, studentID uuid.UUID) ([]db.CarryoverCourse, error) {
	return s.store.ListStudentCarryoverCourses(ctx, studentID)
}

// ListCarryoversDetailed enriches carryover rows with course/session names
// for student-facing display.
func (s *ResultService) ListCarryoversDetailed(ctx context.Context, studentID uuid.UUID) ([]db.CarryoverCourseDetailed, error) {
	q, ok := s.store.(*db.Queries)
	if !ok {
		return nil, errors.New("this operation requires direct database access")
	}
	return q.ListStudentCarryoverCoursesDetailed(ctx, studentID)
}

func (s *ResultService) DeleteCarryover(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteCarryoverCourse(ctx, id)
}
```

### Removed from `backend/internal/api/server.go` (carryover)

```go
	carryovers := api.Group("/carryovers")
	{
		carryovers.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createCarryoverCourse)
		carryovers.GET("/:id", server.getCarryoverCourse)
		carryovers.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCarryoverCourse)
		carryovers.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCarryoverCourse)
		carryovers.GET("/student/:student_id", server.listStudentCarryoverCourses)
		carryovers.GET("/student/:student_id/detailed", server.listStudentCarryoverCoursesDetailed)
	}
```

### Removed from `backend/internal/db/sql/results.sql.go` (dedicated carryover-course query functions; `is_carryover` column scanning on `Result` rows elsewhere in this file was left untouched — core grading model)

```go
const createCarryoverCourse = `-- name: CreateCarryoverCourse :one
INSERT INTO carryover_courses (
    student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id, student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts, is_resolved, resolved_result_id, created_at
`

type CreateCarryoverCourseParams struct {
	StudentID         uuid.UUID `json:"student_id"`
	CourseID          uuid.UUID `json:"course_id"`
	OriginalResultID  uuid.UUID `json:"original_result_id"`
	OriginalSessionID uuid.UUID `json:"original_session_id"`
	AttemptCount      int32     `json:"attempt_count"`
	MaxAttempts       int32     `json:"max_attempts"`
}

func (q *Queries) CreateCarryoverCourse(ctx context.Context, arg CreateCarryoverCourseParams) (CarryoverCourse, error) {
	row := q.db.QueryRow(ctx, createCarryoverCourse,
		arg.StudentID,
		arg.CourseID,
		arg.OriginalResultID,
		arg.OriginalSessionID,
		arg.AttemptCount,
		arg.MaxAttempts,
	)
	var i CarryoverCourse
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.OriginalResultID,
		&i.OriginalSessionID,
		&i.AttemptCount,
		&i.MaxAttempts,
		&i.IsResolved,
		&i.ResolvedResultID,
		&i.CreatedAt,
	)
	return i, err
}


const deleteCarryoverCourse = `-- name: DeleteCarryoverCourse :exec
DELETE FROM carryover_courses
WHERE id = $1
`

func (q *Queries) DeleteCarryoverCourse(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteCarryoverCourse, id)
	return err
}


const getCarryoverCourse = `-- name: GetCarryoverCourse :one
SELECT id, student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts, is_resolved, resolved_result_id, created_at FROM carryover_courses
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetCarryoverCourse(ctx context.Context, id uuid.UUID) (CarryoverCourse, error) {
	row := q.db.QueryRow(ctx, getCarryoverCourse, id)
	var i CarryoverCourse
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.OriginalResultID,
		&i.OriginalSessionID,
		&i.AttemptCount,
		&i.MaxAttempts,
		&i.IsResolved,
		&i.ResolvedResultID,
		&i.CreatedAt,
	)
	return i, err
}


const listStudentCarryoverCourses = `-- name: ListStudentCarryoverCourses :many
SELECT id, student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts, is_resolved, resolved_result_id, created_at FROM carryover_courses
WHERE student_id = $1
ORDER BY created_at DESC
`

func (q *Queries) ListStudentCarryoverCourses(ctx context.Context, studentID uuid.UUID) ([]CarryoverCourse, error) {
	rows, err := q.db.Query(ctx, listStudentCarryoverCourses, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []CarryoverCourse{}
	for rows.Next() {
		var i CarryoverCourse
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.CourseID,
			&i.OriginalResultID,
			&i.OriginalSessionID,
			&i.AttemptCount,
			&i.MaxAttempts,
			&i.IsResolved,
			&i.ResolvedResultID,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}


const updateCarryoverCourse = `-- name: UpdateCarryoverCourse :one
UPDATE carryover_courses
SET
    attempt_count = $2,
    is_resolved = $3,
    resolved_result_id = $4
WHERE id = $1
RETURNING id, student_id, course_id, original_result_id, original_session_id, attempt_count, max_attempts, is_resolved, resolved_result_id, created_at
`

type UpdateCarryoverCourseParams struct {
	ID               uuid.UUID   `json:"id"`
	AttemptCount     int32       `json:"attempt_count"`
	IsResolved       bool        `json:"is_resolved"`
	ResolvedResultID pgtype.UUID `json:"resolved_result_id"`
}

func (q *Queries) UpdateCarryoverCourse(ctx context.Context, arg UpdateCarryoverCourseParams) (CarryoverCourse, error) {
	row := q.db.QueryRow(ctx, updateCarryoverCourse,
		arg.ID,
		arg.AttemptCount,
		arg.IsResolved,
		arg.ResolvedResultID,
	)
	var i CarryoverCourse
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.OriginalResultID,
		&i.OriginalSessionID,
		&i.AttemptCount,
		&i.MaxAttempts,
		&i.IsResolved,
		&i.ResolvedResultID,
		&i.CreatedAt,
	)
	return i, err
}

```

### Removed from `backend/internal/db/sql/models.go` (carryover)

```go
type CarryoverCourse struct {
	ID                uuid.UUID          `json:"id"`
	StudentID         uuid.UUID          `json:"student_id"`
	CourseID          uuid.UUID          `json:"course_id"`
	OriginalResultID  uuid.UUID          `json:"original_result_id"`
	OriginalSessionID uuid.UUID          `json:"original_session_id"`
	AttemptCount      int32              `json:"attempt_count"`
	MaxAttempts       int32              `json:"max_attempts"`
	IsResolved        bool               `json:"is_resolved"`
	ResolvedResultID  pgtype.UUID        `json:"resolved_result_id"`
	CreatedAt         pgtype.Timestamptz `json:"created_at"`
}
```

### Removed from `backend/internal/api/dashboard.go` (carryover count widget)

Struct field: `Carryovers    int                 \`json:"carryovers"\`` (on the student dashboard response struct).
Query block:
```go
	// 9. Carryover count
	carryovers, err := queries.ListStudentCarryoverCourses(ctx, student.ID)
	if err == nil {
		resp.Carryovers = len(carryovers)
	}
```

### Original `frontend/src/pages/student/CoursesPage.tsx` (carryovers tab removed, register/materials tabs kept)

```tsx
import { useState } from 'react';
import { BookMarked, RotateCcw, FolderOpen } from 'lucide-react';
import CourseRegistrationPage from './CourseRegistrationPage';
import CarryoverPage from './CarryoverPage';
import StudentCourseMaterialsPage from './CourseMaterialsPage';

type Tab = 'register' | 'carryovers' | 'materials';

const TAB_FROM_PARAM: Record<string, Tab> = {
  register: 'register',
  carryovers: 'carryovers',
  materials: 'materials',
};

const tabs: { key: Tab; label: string; icon: typeof BookMarked }[] = [
  { key: 'register', label: 'Course Registration', icon: BookMarked },
  { key: 'carryovers', label: 'Carryovers', icon: RotateCcw },
  { key: 'materials', label: 'Course Materials', icon: FolderOpen },
];

export default function CoursesPage() {
  const params = new URLSearchParams(window.location.search);
  const initialTab = TAB_FROM_PARAM[params.get('tab') ?? ''] ?? 'register';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Courses</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Register for courses, track carryovers, and access course materials.
        </p>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'register' && <CourseRegistrationPage />}
      {activeTab === 'carryovers' && <CarryoverPage />}
      {activeTab === 'materials' && <StudentCourseMaterialsPage />}
    </div>
  );
}
```

### Removed from `frontend/src/router.tsx` (carryover)

```tsx
              { path: '/carryovers', element: <Navigate to="/courses?tab=carryovers" replace /> },
```

### Original `frontend/src/pages/student/CourseRegistrationPage.tsx` (carryover-selection section removed; the plain course-registration flow and the 'My Registrations' table's informational Carryover column — which reflects the core `is_carryover` model flag, not the removed tracking system — were kept)

```tsx
import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getCoursesByLevelAndSemester } from '../../api/courses';
import {
  submitRegistration,
  getActiveSessionAndSemester,
  getMyRegisteredCourseIDs,
  getStudentRegistrations,
} from '../../api/course-registrations';
import type { RawSession, RawSemester } from '../../api/course-registrations';
import { getMyCarryovers, type CarryoverCourseDetailed } from '../../api/carryovers';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Check, Plus, AlertCircle, Save, BookOpen, RefreshCw, ClipboardList, RotateCcw } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';
import type { Course, User } from '../../types';

type Tab = 'register' | 'registrations';

interface RegisteredCourseRow {
  id: string;
  course_id: string;
  status: string;
  grade?: string;
  ca_score?: number;
  caScore?: number;
  exam_score?: number;
  examScore?: number;
  is_carryover?: boolean;
  isCarryover?: boolean;
}

interface RegistrationRow {
  id: string;
  status: string;
  total_units?: number;
  totalUnits?: number;
  registered_courses?: RegisteredCourseRow[];
}

type UserWithStudentId = User & { studentId?: string; student_id?: string };

const CourseRegistrationPage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('register');

  // Register tab state
  const [courses, setCourses] = useState<Course[]>([]);
  const [carryovers, setCarryovers] = useState<CarryoverCourseDetailed[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [registeredCourseIds, setRegisteredCourseIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semesterInfo, setSemesterInfo] = useState<{ session: RawSession | null; semester: RawSemester | null }>({
    session: null,
    semester: null,
  });
  const [loadError, setLoadError] = useState(false);

  // Registrations tab state
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  const studentLevel = user?.level || 100;

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const semResult = await getActiveSessionAndSemester();
      setSemesterInfo(semResult);

      if (!semResult.semester) {
        setLoadError(true);
        setCourses([]);
        return;
      }

      const semName = semResult.semester.name || semResult.semester.season || 'first';
      const u = user as UserWithStudentId | null;
      const studentId = u?.studentId || u?.student_id || u?.id;
      const [courseList, regIds, carryoverList] = await Promise.all([
        getCoursesByLevelAndSemester(studentLevel, semName),
        getMyRegisteredCourseIDs().catch(() => []),
        studentId ? getMyCarryovers(studentId).catch(() => []) : Promise.resolve([]),
      ]);
      setCourses(courseList);
      setRegisteredCourseIds(new Set(regIds));
      setCarryovers(carryoverList);
    } catch {
      setLoadError(true);
      notifyError('Error', 'Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [studentLevel, notifyError, user]);

  const loadRegistrations = useCallback(async () => {
    setLoadingRegistrations(true);
    try {
      const u = user as UserWithStudentId | null;
      const studentId = u?.studentId || u?.student_id || u?.id;
      if (!studentId) return;
      const regs = await getStudentRegistrations(studentId);
      setRegistrations(Array.isArray(regs) ? regs : []);
    } catch {
      notifyError('Error', 'Failed to load your registrations.');
    } finally {
      setLoadingRegistrations(false);
    }
  }, [user, notifyError]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (activeTab === 'registrations') {
      loadRegistrations();
    }
  }, [activeTab, loadRegistrations]);

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const availableCourses = courses.filter((c) => !registeredCourseIds.has(c.id));
  // Outstanding (unresolved) carryovers can be from any level, not just the
  // student's current one — shown as their own section so a carryover from
  // a lower level is still selectable during normal registration instead of
  // being invisible just because it's not this level's course list.
  const availableCarryovers = carryovers.filter((c) => !c.is_resolved && !registeredCourseIds.has(c.course_id));
  const selectedCourses = availableCourses.filter((c) => selectedIds.includes(c.id));
  const selectedCarryovers = availableCarryovers.filter((c) => selectedIds.includes(c.course_id));
  const totalUnits =
    selectedCourses.reduce((sum, c) => sum + c.unit, 0) + selectedCarryovers.reduce((sum, c) => sum + c.unit, 0);
  const minUnits = 4;
  const maxUnits = 24;
  const canSubmit =
    totalUnits >= minUnits &&
    totalUnits <= maxUnits &&
    selectedCourses.length + selectedCarryovers.length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!semesterInfo.session || !semesterInfo.semester) {
      notifyError('Error', 'No active session/semester found.');
      return;
    }
    if (totalUnits < minUnits) {
      warning('Insufficient Credits', `You must register at least ${minUnits} credit units.`);
      return;
    }
    if (totalUnits > maxUnits) {
      warning('Credit Overflow', `Maximum allowed credit units is ${maxUnits}.`);
      return;
    }

    setSubmitting(true);
    try {
      await submitRegistration({
        session_id: semesterInfo.session.id,
        semester_id: semesterInfo.semester.id,
        course_ids: selectedIds,
      });
      success(
        'Registration Submitted',
        `Successfully registered ${selectedCourses.length + selectedCarryovers.length} courses (${totalUnits} units) for the semester.`,
      );
      setSelectedIds([]);
      loadCourses();
    } catch (err) {
      notifyError('Registration Failed', getErrorMessage(err, 'Failed to submit registration.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Registration</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {semesterInfo.semester
              ? `${semesterInfo.semester.name === 'harmattan' || semesterInfo.semester.name === 'first' ? 'First' : semesterInfo.semester.name === 'rain' || semesterInfo.semester.name === 'second' ? 'Second' : semesterInfo.semester.name || semesterInfo.semester.season || 'Current'} Semester — Level ${studentLevel}`
              : 'Select and register your academic courses for the current semester.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadCourses();
            if (activeTab === 'registrations') loadRegistrations();
          }}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {[
          { key: 'register' as Tab, label: 'Register Courses', icon: BookOpen },
          { key: 'registrations' as Tab, label: 'My Registrations', icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'registrations' && registrations.length > 0 && (
              <Badge variant="info" className="ml-1 text-[10px]">
                {registrations.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Register Courses Tab */}
      {activeTab === 'register' && (
        <>
          {registeredCourseIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-success-500/5 border border-success-500/20 rounded-lg text-xs text-success-600">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {registeredCourseIds.size} course(s) already registered this semester — hidden from the list below.
              </span>
            </div>
          )}

          {loadError && (
            <Card className="p-6 border-danger-500/20 bg-danger-500/5">
              <div className="flex items-center gap-3 text-danger-600">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Unable to load courses</p>
                  <p className="text-sm mt-1">No active semester found or the server is unreachable.</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Available Courses</CardTitle>
                  <CardDescription>
                    {loading
                      ? 'Loading courses...'
                      : `${availableCourses.length} courses available for Level ${studentLevel} (${registeredCourseIds.size} already registered)`}
                  </CardDescription>
                </CardHeader>
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
                      <span className="ml-2 text-sm text-surface-500">Loading courses...</span>
                    </div>
                  )}
                  {!loading &&
                    availableCourses.map((c) => {
                      const isSelected = selectedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-surface-900 dark:text-white">{c.code}</span>
                              <Badge
                                variant={
                                  c.courseType === 'core'
                                    ? 'primary'
                                    : c.courseType === 'elective'
                                      ? 'success'
                                      : 'outline'
                                }
                              >
                                {c.courseType || c.subcategory || 'core'}
                              </Badge>
                              {c.prerequisiteId && (
                                <Badge variant="warning" className="text-[10px]">
                                  Prereq
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-surface-500">{c.title}</p>
                            {c.description && (
                              <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{c.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-surface-400 font-medium block">{c.unit} Units</span>
                              <span className="text-[10px] text-surface-400 capitalize">{c.semester}</span>
                            </div>
                            <Button
                              size="xs"
                              variant={isSelected ? 'success' : 'outline'}
                              onClick={() => toggleCourse(c.id)}
                              leftIcon={
                                isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />
                              }
                            >
                              {isSelected ? 'Selected' : 'Add'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  {!loading && !loadError && availableCourses.length === 0 && (
                    <div className="text-center py-12">
                      <BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                      <p className="text-sm text-surface-500">
                        {registeredCourseIds.size > 0
                          ? 'All available courses are already registered.'
                          : 'No courses available for registration.'}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">
                        {registeredCourseIds.size > 0
                          ? 'Check the "My Registrations" tab to see your registered courses.'
                          : 'Courses may not be set up for your level yet.'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {availableCarryovers.length > 0 && (
                <Card className="border-warning-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-warning-500" />
                      Carryover Courses
                    </CardTitle>
                    <CardDescription>
                      Outstanding courses from previous levels you must retake — selectable here regardless of your
                      current level.
                    </CardDescription>
                  </CardHeader>
                  <div className="divide-y divide-surface-100 dark:divide-surface-800">
                    {availableCarryovers.map((c) => {
                      const isSelected = selectedIds.includes(c.course_id);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-surface-900 dark:text-white">
                                {c.course_code}
                              </span>
                              <Badge variant="warning">Carryover</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                Attempt {c.attempt_count + 1}/{c.max_attempts}
                              </Badge>
                            </div>
                            <p className="text-xs text-surface-500">{c.course_title}</p>
                            <p className="text-[11px] text-surface-400 mt-0.5">
                              Originally taken {c.original_session_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-surface-400 font-medium block">{c.unit} Units</span>
                            </div>
                            <Button
                              size="xs"
                              variant={isSelected ? 'success' : 'outline'}
                              onClick={() => toggleCourse(c.course_id)}
                              leftIcon={
                                isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />
                              }
                            >
                              {isSelected ? 'Selected' : 'Add'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="p-6 border border-primary-500/20 bg-primary-500/5">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">Registration Summary</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Level</span>
                    <span className="font-semibold">{studentLevel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Selected Courses</span>
                    <span className="font-semibold">{selectedCourses.length + selectedCarryovers.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Total Credit Units</span>
                    <span
                      className={`font-semibold ${totalUnits < minUnits ? 'text-warning-500' : totalUnits > maxUnits ? 'text-danger-500' : 'text-primary-500'}`}
                    >
                      {totalUnits} / {maxUnits}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Min. Required</span>
                    <span className="font-semibold">{minUnits} units</span>
                  </div>
                </div>

                {totalUnits > maxUnits && (
                  <div className="flex gap-2 p-3 bg-danger-500/10 border border-danger-500/20 text-danger-600 rounded-lg text-xs mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Exceeds maximum of {maxUnits} credit units.</span>
                  </div>
                )}

                {totalUnits < minUnits && totalUnits > 0 && (
                  <div className="flex gap-2 p-3 bg-warning-500/10 border border-warning-500/20 text-warning-600 rounded-lg text-xs mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Minimum {minUnits} credit units required.</span>
                  </div>
                )}

                <Button
                  className="w-full"
                  isLoading={submitting}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {submitting ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </Card>

              {(selectedCourses.length > 0 || selectedCarryovers.length > 0) && (
                <Card className="p-4">
                  <h4 className="font-medium text-sm text-surface-700 dark:text-surface-300 mb-3">Selected Courses</h4>
                  <div className="space-y-2">
                    {selectedCourses.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0"
                      >
                        <div>
                          <span className="font-medium text-surface-800 dark:text-surface-200">{c.code}</span>
                          <span className="text-surface-400 ml-1.5">{c.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-surface-400">{c.unit}u</span>
                          <button
                            onClick={() => toggleCourse(c.id)}
                            className="text-danger-500 hover:text-danger-600 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedCarryovers.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0"
                      >
                        <div>
                          <span className="font-medium text-surface-800 dark:text-surface-200">{c.course_code}</span>
                          <span className="text-surface-400 ml-1.5">{c.course_title}</span>
                          <Badge variant="warning" className="ml-1.5 text-[9px]">
                            CO
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-surface-400">{c.unit}u</span>
                          <button
                            onClick={() => toggleCourse(c.course_id)}
                            className="text-danger-500 hover:text-danger-600 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* My Registrations Tab */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          {loadingRegistrations ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading registrations...</span>
            </div>
          ) : registrations.length === 0 ? (
            <Card className="p-8 text-center">
              <ClipboardList className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No course registrations found.</p>
              <p className="text-xs text-surface-400 mt-1">
                Switch to the "Register Courses" tab to register for courses.
              </p>
            </Card>
          ) : (
            registrations.map((reg, idx: number) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Registration #{registrations.length - idx}
                        <Badge
                          variant={
                            reg.status === 'approved' ? 'success' : reg.status === 'submitted' ? 'warning' : 'default'
                          }
                        >
                          {reg.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {reg.total_units || reg.totalUnits || 0} total units
                        {reg.registered_courses && ` — ${reg.registered_courses.length} course(s)`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {reg.registered_courses && reg.registered_courses.length > 0 && (
                  <div className="p-4 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                            <th className="px-3 py-2">Course ID</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Grade</th>
                            <th className="px-3 py-2">CA Score</th>
                            <th className="px-3 py-2">Exam Score</th>
                            <th className="px-3 py-2">Carryover</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                          {reg.registered_courses.map((rc) => (
                            <tr key={rc.id}>
                              <td className="px-3 py-2 font-mono text-xs">{rc.course_id.slice(0, 8)}...</td>
                              <td className="px-3 py-2">
                                <Badge variant={rc.status === 'enrolled' ? 'info' : 'default'}>{rc.status}</Badge>
                              </td>
                              <td className="px-3 py-2">{rc.grade || '-'}</td>
                              <td className="px-3 py-2">{rc.ca_score ?? rc.caScore ?? '-'}</td>
                              <td className="px-3 py-2">{rc.exam_score ?? rc.examScore ?? '-'}</td>
                              <td className="px-3 py-2">{rc.is_carryover || rc.isCarryover ? 'Yes' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CourseRegistrationPage;
```

### Removed from `frontend/src/api/dashboard.ts` (carryover)

```ts
  carryovers: number;
```
(field on the `StudentDashboard` interface)

### Removed from `frontend/src/pages/student/StudentDashboard.tsx` (carryover)

Destructured field `carryovers,` and this widget:
```tsx
              {carryovers > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-surface-500">Carryovers</span>
                  <span className="font-semibold text-danger-500">{carryovers}</span>
                </div>
              )}
```

### Removed from `mobile/src/api/dashboard.ts` (carryover)

```ts
  carryovers: number;
```

### Removed from `mobile/app/(tabs)/index.tsx` (carryover)

```tsx
          <StatCard
            icon="repeat-outline"
            tone="warning"
            label="Carryovers"
            value={String(data?.carryovers ?? 0)}
          />
```
(third card in the home-tab `statsRow`; the other two — Outstanding, Attendance — stay, and being `flex: 1` each they simply fill the row at two-up now.)

## PART 1 — Timetable (code removed; DB tables/migrations deliberately left untouched)

### `backend/internal/api/timetable.go`
```go
package api

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createTimetableEntryRequest struct {
	CourseID     string  `json:"courseId" binding:"required"`
	DayOfWeek    *int32  `json:"dayOfWeek"`
	StartTime    string  `json:"startTime" binding:"required"`
	EndTime      string  `json:"endTime" binding:"required"`
	Venue        string  `json:"venue" binding:"required"`
	Level        int32   `json:"level" binding:"required"`
	EntryType    string  `json:"entryType" binding:"required,oneof=class exam"`
	ClassType    *string `json:"classType"`
	ExamType     *string `json:"examType"`
	LecturerID   *string `json:"lecturerId"`
	Invigilators *string `json:"invigilators"`
	ExamDate     *string `json:"examDate"`
}

type updateTimetableEntryRequest struct {
	CourseID     string  `json:"courseId" binding:"required"`
	DayOfWeek    *int32  `json:"dayOfWeek"`
	StartTime    string  `json:"startTime" binding:"required"`
	EndTime      string  `json:"endTime" binding:"required"`
	Venue        string  `json:"venue" binding:"required"`
	Level        int32   `json:"level" binding:"required"`
	EntryType    string  `json:"entryType" binding:"required,oneof=class exam"`
	ClassType    *string `json:"classType"`
	ExamType     *string `json:"examType"`
	LecturerID   *string `json:"lecturerId"`
	Invigilators *string `json:"invigilators"`
	ExamDate     *string `json:"examDate"`
}

func (server *Server) createTimetableEntry(ctx *gin.Context) {
	var req createTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid courseId"})
		return
	}

	var lecturerID *uuid.UUID
	if req.LecturerID != nil {
		lid, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturerId"})
			return
		}
		lecturerID = &lid
	}

	var examDate *time.Time
	if req.ExamDate != nil && *req.ExamDate != "" {
		t, err := time.Parse("2006-01-02", *req.ExamDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid examDate, expected YYYY-MM-DD"})
			return
		}
		examDate = &t
	}

	id, err := server.timetables.Create(ctx, service.CreateTimetableInput{
		CourseID:     courseID,
		DayOfWeek:    req.DayOfWeek,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Venue:        req.Venue,
		Level:        req.Level,
		EntryType:    req.EntryType,
		ClassType:    req.ClassType,
		ExamType:     req.ExamType,
		LecturerID:   lecturerID,
		Invigilators: req.Invigilators,
		ExamDate:     examDate,
	})
	if err != nil {
		log.Printf("ERROR creating timetable entry: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusCreated, gin.H{"id": id})
		return
	}

	ctx.JSON(http.StatusCreated, entry)
}

func (server *Server) getTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "timetable entry not found"})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

func (server *Server) listTimetableEntries(ctx *gin.Context) {
	entryType := ctx.DefaultQuery("entryType", "")
	levelStr := ctx.DefaultQuery("level", "")

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if entryType == "class" || entryType == "exam" {
		var level *int32
		if levelStr != "" {
			if v, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
				l := int32(v)
				level = &l
			}
		}
		entries, err := queries.ListTimetableByType(ctx, db.ListTimetableByTypeParams{
			EntryType: entryType,
			Level:     level,
		})
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		ctx.JSON(http.StatusOK, entries)
		return
	}

	entries, err := queries.ListAllTimetableEntries(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, entries)
}

func (server *Server) updateTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	var req updateTimetableEntryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid courseId"})
		return
	}

	var lecturerID *uuid.UUID
	if req.LecturerID != nil {
		lid, err := uuid.Parse(*req.LecturerID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid lecturerId"})
			return
		}
		lecturerID = &lid
	}

	var examDate *time.Time
	if req.ExamDate != nil && *req.ExamDate != "" {
		t, err := time.Parse("2006-01-02", *req.ExamDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid examDate, expected YYYY-MM-DD"})
			return
		}
		examDate = &t
	}

	_ = courseID
	err = server.timetables.Update(ctx, id, service.UpdateTimetableInput{
		DayOfWeek:    req.DayOfWeek,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Venue:        req.Venue,
		Level:        req.Level,
		EntryType:    req.EntryType,
		ClassType:    req.ClassType,
		ExamType:     req.ExamType,
		LecturerID:   lecturerID,
		Invigilators: req.Invigilators,
		ExamDate:     examDate,
	})
	if err != nil {
		log.Printf("ERROR updating timetable entry %s: %v", id, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	entry, err := server.timetables.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"id": id})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

func (server *Server) deleteTimetableEntry(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable id"})
		return
	}

	if err := server.timetables.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "timetable entry deleted successfully"})
}

type publishRequest struct {
	EntryType string `json:"entry_type" binding:"required,oneof=class exam"`
	Publish   bool   `json:"publish"`
}

func (server *Server) publishTimetable(ctx *gin.Context) {
	var req publishRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if req.Publish {
		err := queries.PublishTimetableByType(ctx, req.EntryType)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}

		if server.notificationsFull != nil {
			senderID := getUserID(ctx)
			entryType := req.EntryType
			go func() {
				bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				title := "Timetable Published"
				message := "The " + entryType + " timetable has been published and is now available."
				if _, err := server.notificationsFull.BroadcastNotification(
					bgCtx, title, message, "system", "normal", "role", []string{"student"}, 0, &senderID,
				); err != nil {
					log.Printf("[timetable-notif] publish broadcast failed: %v", err)
				}
			}()
		}

		ctx.JSON(http.StatusOK, gin.H{"message": req.EntryType + " timetable published"})
	} else {
		err := queries.UnpublishTimetableByType(ctx, req.EntryType)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": req.EntryType + " timetable unpublished"})
	}
}

type checkConflictsRequest struct {
	EntryType string `json:"entry_type" binding:"required,oneof=class exam"`
	Level     *int32 `json:"level"`
}

func (server *Server) checkTimetableConflicts(ctx *gin.Context) {
	entryType := ctx.Query("entryType")
	if entryType == "" {
		entryType = "class"
	}

	var level *int32
	if levelStr := ctx.Query("level"); levelStr != "" {
		if v, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			l := int32(v)
			level = &l
		}
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	entries, err := queries.CheckTimetableConflicts(ctx, db.ListTimetableByTypeParams{
		EntryType: entryType,
		Level:     level,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	type conflict struct {
		Type     string `json:"type"`
		Message  string `json:"message"`
		Entry1ID string `json:"entry1_id"`
		Entry2ID string `json:"entry2_id"`
	}

	conflicts := []conflict{}

	// Detect venue + day + time overlaps
	for i := 0; i < len(entries); i++ {
		for j := i + 1; j < len(entries); j++ {
			a, b := entries[i], entries[j]

			// Same day check
			if a.DayOfWeek != nil && b.DayOfWeek != nil {
				if *a.DayOfWeek != *b.DayOfWeek {
					continue
				}
			}

			// Time overlap check (HH:MM string comparison)
			if a.StartTime < b.EndTime && b.StartTime < a.EndTime {
				// Venue clash
				venueA := strings.TrimSpace(strings.ToLower(a.Venue))
				venueB := strings.TrimSpace(strings.ToLower(b.Venue))
				if venueA != "" && venueA == venueB {
					conflicts = append(conflicts, conflict{
						Type:     "venue_clash",
						Message:  a.CourseCode + " and " + b.CourseCode + " both in " + a.Venue + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}

				// Level clash
				if a.Level != nil && b.Level != nil && *a.Level == *b.Level {
					conflicts = append(conflicts, conflict{
						Type:     "level_clash",
						Message:  strconv.Itoa(int(*a.Level)) + "L has " + a.CourseCode + " and " + b.CourseCode + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}

				// Lecturer clash
				if a.LecturerID != nil && b.LecturerID != nil && *a.LecturerID == *b.LecturerID {
					conflicts = append(conflicts, conflict{
						Type:     "lecturer_clash",
						Message:  "Lecturer assigned to both " + a.CourseCode + " and " + b.CourseCode + " at overlapping times",
						Entry1ID: a.ID.String(),
						Entry2ID: b.ID.String(),
					})
				}
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"conflict_count": len(conflicts),
		"conflicts":      conflicts,
	})
}

func (server *Server) bulkDeleteTimetable(ctx *gin.Context) {
	entryType := ctx.Query("entryType")
	levelStr := ctx.Query("level")

	if entryType == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "entryType is required"})
		return
	}

	query := "DELETE FROM timetable WHERE entry_type = $1"
	args := []interface{}{entryType}
	idx := 2
	if levelStr != "" {
		if _, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			query += " AND level = $" + strconv.Itoa(idx)
			args = append(args, levelStr)
			idx++
		}
	}

	if dbq, ok := server.store.(interface{ GetDB() db.DBTX }); ok {
		result, err := dbq.GetDB().Exec(ctx, query, args...)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		rowsAffected := result.RowsAffected()
		ctx.JSON(http.StatusOK, gin.H{"deleted": rowsAffected})
		return
	}

	ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
}
```

### `backend/internal/service/timetable_service.go`
```go
package service

import (
	"context"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type TimetableService struct {
	store db.Querier
}

func NewTimetableService(store db.Querier) *TimetableService {
	return &TimetableService{store: store}
}

type CreateTimetableInput struct {
	CourseID     uuid.UUID
	StartTime    string
	EndTime      string
	Venue        string
	Level        int32
	DayOfWeek    *int32
	EntryType    string
	ClassType    *string
	ExamType     *string
	LecturerID   *uuid.UUID
	Invigilators *string
	ExamDate     *time.Time
}

func (s *TimetableService) Create(ctx context.Context, input CreateTimetableInput) (uuid.UUID, error) {
	queries, ok := s.store.(*db.Queries)
	if !ok {
		return uuid.Nil, nil
	}
	return queries.CreateTimetableEntrySimple(ctx, db.CreateTimetableEntrySimpleParams{
		CourseID:     input.CourseID,
		DayOfWeek:    input.DayOfWeek,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Venue:        input.Venue,
		Level:        input.Level,
		EntryType:    input.EntryType,
		ClassType:    input.ClassType,
		ExamType:     input.ExamType,
		LecturerID:   input.LecturerID,
		Invigilators: input.Invigilators,
		ExamDate:     input.ExamDate,
	})
}

func (s *TimetableService) GetByID(ctx context.Context, id uuid.UUID) (db.Timetable, error) {
	return s.store.GetTimetableEntry(ctx, id)
}

func (s *TimetableService) List(ctx context.Context, sessionID, semesterID uuid.UUID) ([]db.Timetable, error) {
	return s.store.ListTimetableEntries(ctx, db.ListTimetableEntriesParams{
		SessionID:  pgtype.UUID{Bytes: sessionID, Valid: true},
		SemesterID: pgtype.UUID{Bytes: semesterID, Valid: true},
	})
}

type UpdateTimetableInput struct {
	StartTime    string
	EndTime      string
	Venue        string
	Level        int32
	DayOfWeek    *int32
	EntryType    string
	ClassType    *string
	ExamType     *string
	LecturerID   *uuid.UUID
	Invigilators *string
	ExamDate     *time.Time
}

func (s *TimetableService) Update(ctx context.Context, id uuid.UUID, input UpdateTimetableInput) error {
	queries, ok := s.store.(*db.Queries)
	if !ok {
		return nil
	}
	course, err := queries.GetTimetableEntry(ctx, id)
	if err != nil {
		return err
	}
	_ = time.Now()
	return queries.UpdateTimetableEntryFull(ctx, db.CreateTimetableEntrySimpleParams{
		CourseID:     course.CourseID,
		DayOfWeek:    input.DayOfWeek,
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		Venue:        input.Venue,
		Level:        input.Level,
		EntryType:    input.EntryType,
		ClassType:    input.ClassType,
		ExamType:     input.ExamType,
		LecturerID:   input.LecturerID,
		Invigilators: input.Invigilators,
		ExamDate:     input.ExamDate,
	}, id)
}

func (s *TimetableService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteTimetableEntry(ctx, id)
}
```

### `backend/internal/db/sql/timetable.sql.go`
```go
// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.31.1
// source: timetable.sql

package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const createTimetableEntry = `-- name: CreateTimetableEntry :one
INSERT INTO timetable (
    course_id,
    exam_date,
    start_time,
    end_time,
    venue,
    session_id,
    semester_id,
    has_conflict,
    conflict_details,
    created_by,
    day_of_week,
    level,
    entry_type,
    class_type,
    exam_type,
    lecturer_id,
    invigilators,
    is_published
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
) RETURNING id, course_id, exam_date, start_time, end_time, venue, session_id, semester_id, has_conflict, conflict_details, created_by, created_at, day_of_week, level, entry_type, class_type, lecturer_id, exam_type, invigilators, is_published, published_at
`

type CreateTimetableEntryParams struct {
	CourseID        uuid.UUID          `json:"course_id"`
	ExamDate        pgtype.Timestamptz `json:"exam_date"`
	StartTime       pgtype.Timestamptz `json:"start_time"`
	EndTime         pgtype.Timestamptz `json:"end_time"`
	Venue           string             `json:"venue"`
	SessionID       pgtype.UUID        `json:"session_id"`
	SemesterID      pgtype.UUID        `json:"semester_id"`
	HasConflict     bool               `json:"has_conflict"`
	ConflictDetails []byte             `json:"conflict_details"`
	CreatedBy       pgtype.UUID        `json:"created_by"`
	DayOfWeek       *int32             `json:"day_of_week"`
	Level           *int32             `json:"level"`
	EntryType       string             `json:"entry_type"`
	ClassType       *string            `json:"class_type"`
	ExamType        *string            `json:"exam_type"`
	LecturerID      pgtype.UUID        `json:"lecturer_id"`
	Invigilators    *string            `json:"invigilators"`
	IsPublished     bool               `json:"is_published"`
}

func (q *Queries) CreateTimetableEntry(ctx context.Context, arg CreateTimetableEntryParams) (Timetable, error) {
	row := q.db.QueryRow(ctx, createTimetableEntry,
		arg.CourseID,
		arg.ExamDate,
		arg.StartTime,
		arg.EndTime,
		arg.Venue,
		arg.SessionID,
		arg.SemesterID,
		arg.HasConflict,
		arg.ConflictDetails,
		arg.CreatedBy,
		arg.DayOfWeek,
		arg.Level,
		arg.EntryType,
		arg.ClassType,
		arg.ExamType,
		arg.LecturerID,
		arg.Invigilators,
		arg.IsPublished,
	)
	var i Timetable
	err := row.Scan(
		&i.ID,
		&i.CourseID,
		&i.ExamDate,
		&i.StartTime,
		&i.EndTime,
		&i.Venue,
		&i.SessionID,
		&i.SemesterID,
		&i.HasConflict,
		&i.ConflictDetails,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.DayOfWeek,
		&i.Level,
		&i.EntryType,
		&i.ClassType,
		&i.LecturerID,
		&i.ExamType,
		&i.Invigilators,
		&i.IsPublished,
		&i.PublishedAt,
	)
	return i, err
}

const deleteTimetableEntry = `-- name: DeleteTimetableEntry :exec
DELETE FROM timetable
WHERE id = $1
`

func (q *Queries) DeleteTimetableEntry(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteTimetableEntry, id)
	return err
}

const getTimetableEntry = `-- name: GetTimetableEntry :one
SELECT id, course_id, exam_date, start_time, end_time, venue, session_id, semester_id, has_conflict, conflict_details, created_by, created_at, day_of_week, level, entry_type, class_type, lecturer_id, exam_type, invigilators, is_published, published_at FROM timetable
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetTimetableEntry(ctx context.Context, id uuid.UUID) (Timetable, error) {
	row := q.db.QueryRow(ctx, getTimetableEntry, id)
	var i Timetable
	err := row.Scan(
		&i.ID,
		&i.CourseID,
		&i.ExamDate,
		&i.StartTime,
		&i.EndTime,
		&i.Venue,
		&i.SessionID,
		&i.SemesterID,
		&i.HasConflict,
		&i.ConflictDetails,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.DayOfWeek,
		&i.Level,
		&i.EntryType,
		&i.ClassType,
		&i.LecturerID,
		&i.ExamType,
		&i.Invigilators,
		&i.IsPublished,
		&i.PublishedAt,
	)
	return i, err
}

const listTimetableEntries = `-- name: ListTimetableEntries :many
SELECT id, course_id, exam_date, start_time, end_time, venue, session_id, semester_id, has_conflict, conflict_details, created_by, created_at, day_of_week, level, entry_type, class_type, lecturer_id, exam_type, invigilators, is_published, published_at FROM timetable
WHERE session_id = $1 AND semester_id = $2
ORDER BY exam_date, start_time
`

type ListTimetableEntriesParams struct {
	SessionID  pgtype.UUID `json:"session_id"`
	SemesterID pgtype.UUID `json:"semester_id"`
}

func (q *Queries) ListTimetableEntries(ctx context.Context, arg ListTimetableEntriesParams) ([]Timetable, error) {
	rows, err := q.db.Query(ctx, listTimetableEntries, arg.SessionID, arg.SemesterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Timetable{}
	for rows.Next() {
		var i Timetable
		if err := rows.Scan(
			&i.ID,
			&i.CourseID,
			&i.ExamDate,
			&i.StartTime,
			&i.EndTime,
			&i.Venue,
			&i.SessionID,
			&i.SemesterID,
			&i.HasConflict,
			&i.ConflictDetails,
			&i.CreatedBy,
			&i.CreatedAt,
			&i.DayOfWeek,
			&i.Level,
			&i.EntryType,
			&i.ClassType,
			&i.LecturerID,
			&i.ExamType,
			&i.Invigilators,
			&i.IsPublished,
			&i.PublishedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const updateTimetableEntry = `-- name: UpdateTimetableEntry :one
UPDATE timetable
SET 
    exam_date = $2,
    start_time = $3,
    end_time = $4,
    venue = $5,
    has_conflict = $6,
    conflict_details = $7
WHERE id = $1
RETURNING id, course_id, exam_date, start_time, end_time, venue, session_id, semester_id, has_conflict, conflict_details, created_by, created_at, day_of_week, level, entry_type, class_type, lecturer_id, exam_type, invigilators, is_published, published_at
`

type UpdateTimetableEntryParams struct {
	ID              uuid.UUID          `json:"id"`
	ExamDate        pgtype.Timestamptz `json:"exam_date"`
	StartTime       pgtype.Timestamptz `json:"start_time"`
	EndTime         pgtype.Timestamptz `json:"end_time"`
	Venue           string             `json:"venue"`
	HasConflict     bool               `json:"has_conflict"`
	ConflictDetails []byte             `json:"conflict_details"`
}

func (q *Queries) UpdateTimetableEntry(ctx context.Context, arg UpdateTimetableEntryParams) (Timetable, error) {
	row := q.db.QueryRow(ctx, updateTimetableEntry,
		arg.ID,
		arg.ExamDate,
		arg.StartTime,
		arg.EndTime,
		arg.Venue,
		arg.HasConflict,
		arg.ConflictDetails,
	)
	var i Timetable
	err := row.Scan(
		&i.ID,
		&i.CourseID,
		&i.ExamDate,
		&i.StartTime,
		&i.EndTime,
		&i.Venue,
		&i.SessionID,
		&i.SemesterID,
		&i.HasConflict,
		&i.ConflictDetails,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.DayOfWeek,
		&i.Level,
		&i.EntryType,
		&i.ClassType,
		&i.LecturerID,
		&i.ExamType,
		&i.Invigilators,
		&i.IsPublished,
		&i.PublishedAt,
	)
	return i, err
}
```

### `frontend/src/api/timetable.ts`
```ts
import apiClient, { unwrap } from './client';
import type { TimetableEntry, TimetableConflict } from '../types';

export interface ListTimetableParams {
  entryType?: 'class' | 'exam';
  level?: number;
}

export const getTimetable = async (params?: ListTimetableParams) => {
  const res = await apiClient.get('/timetable', { params });
  return unwrap<TimetableEntry[]>(res);
};

export const getTimetableEntry = async (entryId: string) => {
  const res = await apiClient.get(`/timetable/${entryId}`);
  return unwrap<TimetableEntry>(res);
};

export const createTimetableEntry = async (payload: {
  courseId: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  venue: string;
  level?: number;
  entryType: 'class' | 'exam';
  classType?: string;
  examType?: string;
  lecturerId?: string;
  invigilators?: string;
  examDate?: string;
  sessionId?: string;
  semesterId?: string;
}) => {
  const res = await apiClient.post('/timetable', payload);
  return unwrap<TimetableEntry>(res);
};

export const updateTimetableEntry = async (entryId: string, payload: {
  courseId: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  venue: string;
  level?: number;
  entryType: 'class' | 'exam';
  classType?: string;
  examType?: string;
  lecturerId?: string;
  invigilators?: string;
  examDate?: string;
}) => {
  const res = await apiClient.put(`/timetable/${entryId}`, payload);
  return unwrap<TimetableEntry>(res);
};

export const deleteTimetableEntry = async (entryId: string) => {
  await apiClient.delete(`/timetable/${entryId}`);
};

export const checkTimetableConflicts = async (entryType: string, level?: number) => {
  const params: Record<string, string | number> = { entryType };
  if (level) params.level = level;
  const res = await apiClient.get('/timetable/conflicts', { params });
  return unwrap<{ conflict_count: number; conflicts: TimetableConflict[] }>(res);
};

export const publishTimetable = async (entryType: 'class' | 'exam', publish: boolean) => {
  const res = await apiClient.post('/timetable/publish', { entry_type: entryType, publish });
  return res.data;
};

export const bulkDeleteTimetable = async (entryType: string, level?: number) => {
  const params: Record<string, string> = { entryType };
  if (level) params.level = String(level);
  const res = await apiClient.delete('/timetable/bulk', { params });
  return res.data;
};

// Aliases for backward compat
export const getTimetableSlots = getTimetable;
export const createTimetableSlot = createTimetableEntry;
```

### `frontend/src/types/timetable.ts`
```ts
// Timetable domain types — re-exported from master index
export type { TimetableEntry } from './index';
```

### `frontend/src/components/forms/TimetableForm.tsx`
```tsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface TimetableFormProps {
  onSubmit: (data: {
    courseId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    venue: string;
    type: 'lecture' | 'practical' | 'exam';
  }) => void;
  isLoading?: boolean;
}

const TimetableForm = ({ onSubmit, isLoading }: TimetableFormProps) => {
  const [courseId, setCourseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [type, setType] = useState<'lecture' | 'practical' | 'exam'>('lecture');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ courseId, dayOfWeek, startTime, endTime, venue, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Course ID / Code"
        placeholder="e.g. CPE511"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Day of Week"
          options={[
            { value: 'Monday', label: 'Monday' },
            { value: 'Tuesday', label: 'Tuesday' },
            { value: 'Wednesday', label: 'Wednesday' },
            { value: 'Thursday', label: 'Thursday' },
            { value: 'Friday', label: 'Friday' },
          ]}
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
        />
        <Select
          label="Event Category"
          options={[
            { value: 'lecture', label: 'Lecture Session' },
            { value: 'practical', label: 'Practical Lab Session' },
            { value: 'exam', label: 'Examination Schedule' },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value as 'lecture' | 'practical' | 'exam')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
        <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
      </div>
      <Input
        label="Venue / Classroom"
        placeholder="e.g. Engineering Lecture Hall 2"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Save Timetable Schedule
      </Button>
    </form>
  );
};

export default TimetableForm;
```

### `frontend/src/pages/admin/TimetableManagePage.tsx`
```tsx
import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import {
  Plus,
  Loader2,
  CalendarDays,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Clock,
  User,
  BookOpen,
  GraduationCap,
  Filter,
} from 'lucide-react';
import {
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  checkTimetableConflicts,
  publishTimetable,
  bulkDeleteTimetable,
} from '../../api/timetable';
import type { ListTimetableParams } from '../../api/timetable';
import { getCourses } from '../../api/courses';
import type { TimetableEntry, TimetableConflict, EntryType, Course } from '../../types';
import { getErrorMessage } from '../../utils/errors';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const numToDay: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
const hours = Array.from({ length: 14 }, (_, i) => i + 7);
const levels = [100, 200, 300, 400, 500];
const classTypes: { value: string; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'seminar', label: 'Seminar' },
];
const examTypes = [
  { value: 'main', label: 'Main Exam' },
  { value: 'carryover', label: 'Carryover' },
];

const colorMap: Record<string, string> = {
  lecture: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  lab: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  tutorial:
    'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  seminar: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
};

const extractHour = (v: string) => {
  if (!v) return 0;
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  return parseInt(timePart.split(':')[0]) || 0;
};

const formatTime = (v: string) => {
  if (!v) return '';
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  const parts = timePart.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
};

const TimetableManagePage = () => {
  const { success, error: notifyError } = useNotification();
  const [tab, setTab] = useState<EntryType>('class');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [showConflicts, setShowConflicts] = useState(false);
  const [levelFilter, setLevelFilter] = useState<number | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [courseId, setCourseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [level, setLevel] = useState<number>(100);
  const [classType, setClassType] = useState<string>('lecture');
  const [examType, setExamType] = useState<string>('main');
  const [lecturerId, setLecturerId] = useState('');
  const [invigilators, setInvigilators] = useState('');
  const [examDate, setExamDate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: ListTimetableParams = { entryType: tab };
      if (levelFilter) params.level = levelFilter;
      const [entriesRes, coursesRes] = await Promise.allSettled([
        getTimetable(params),
        getCourses({ page: 1, perPage: 200 }),
      ]);
      if (entriesRes.status === 'fulfilled') {
        setEntries(Array.isArray(entriesRes.value) ? entriesRes.value : []);
      }
      if (coursesRes.status === 'fulfilled') {
        const courseList = Array.isArray(coursesRes.value) ? coursesRes.value : [];
        setCourses(courseList.filter((c) => c && c.id && c.code && c.title));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, levelFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setCourseId('');
    setDayOfWeek(1);
    setStartTime('08:00');
    setEndTime('10:00');
    setVenue('');
    setLevel(100);
    setClassType('lecture');
    setExamType('main');
    setLecturerId('');
    setInvigilators('');
    setExamDate('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !startTime || !endTime || !venue) {
      notifyError('Validation', 'Please fill all required fields');
      return;
    }
    if (tab === 'exam' && !examDate) {
      notifyError('Validation', 'Exam date is required for exam entries');
      return;
    }
    try {
      setSubmitting(true);
      await createTimetableEntry({
        courseId,
        dayOfWeek: tab === 'class' ? dayOfWeek : undefined,
        startTime,
        endTime,
        venue,
        level,
        entryType: tab,
        classType: tab === 'class' ? classType : undefined,
        examType: tab === 'exam' ? examType : undefined,
        lecturerId: lecturerId || undefined,
        invigilators: invigilators || undefined,
        examDate: tab === 'exam' ? examDate : undefined,
      });
      setCreateOpen(false);
      resetForm();
      success('Entry Created', `${tab === 'class' ? 'Class' : 'Exam'} entry added successfully`);
      fetchData();
    } catch (err) {
      notifyError('Create Failed', getErrorMessage(err, 'Could not create entry'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (tab === 'exam' && !examDate) {
      notifyError('Validation', 'Exam date is required for exam entries');
      return;
    }
    try {
      setSubmitting(true);
      await updateTimetableEntry(editingEntry.id, {
        courseId,
        dayOfWeek: tab === 'class' ? dayOfWeek : undefined,
        startTime,
        endTime,
        venue,
        level,
        entryType: tab,
        classType: tab === 'class' ? classType : undefined,
        examType: tab === 'exam' ? examType : undefined,
        lecturerId: lecturerId || undefined,
        invigilators: invigilators || undefined,
        examDate: tab === 'exam' ? examDate : undefined,
      });
      setEditOpen(false);
      setEditingEntry(null);
      resetForm();
      success('Entry Updated', 'Timetable entry updated');
      fetchData();
    } catch (err) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not update entry'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: TimetableEntry) => {
    if (!confirm(`Delete ${entry.courseCode} timetable entry?`)) return;
    try {
      await deleteTimetableEntry(entry.id);
      success('Deleted', 'Entry removed');
      fetchData();
    } catch (err) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete entry'));
    }
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setCourseId(entry.course_id);
    setDayOfWeek(entry.day_of_week || 1);
    const st = entry.start_time?.includes(' ')
      ? entry.start_time.split(' ')[1]?.substring(0, 5)
      : entry.start_time?.substring(0, 5);
    const et = entry.end_time?.includes(' ')
      ? entry.end_time.split(' ')[1]?.substring(0, 5)
      : entry.end_time?.substring(0, 5);
    setStartTime(st || '08:00');
    setEndTime(et || '10:00');
    setVenue(entry.venue);
    setLevel(entry.level || 100);
    setClassType(entry.class_type || 'lecture');
    setExamType(entry.exam_type || 'main');
    setLecturerId(entry.lecturer_id || '');
    setInvigilators(entry.invigilators || '');
    setExamDate(entry.exam_date ? entry.exam_date.substring(0, 10) : '');
    setEditOpen(true);
  };

  const handleCheckConflicts = async () => {
    try {
      const res = await checkTimetableConflicts(tab, levelFilter || undefined);
      setConflicts(res.conflicts || []);
      setConflictCount(res.conflict_count || 0);
      setShowConflicts(true);
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to check conflicts'));
    }
  };

  const handlePublish = async (publish: boolean) => {
    try {
      await publishTimetable(tab, publish);
      success(
        publish ? 'Published' : 'Unpublished',
        `${tab === 'class' ? 'Class' : 'Exam'} timetable ${publish ? 'published' : 'unpublished'}`,
      );
      fetchData();
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Operation failed'));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ALL ${tab} timetable entries${levelFilter ? ` for level ${levelFilter}` : ''}?`)) return;
    try {
      const res = await bulkDeleteTimetable(tab, levelFilter || undefined);
      success('Deleted', `${res.deleted || 0} entries removed`);
      fetchData();
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to delete'));
    }
  };

  const getSlotAt = (day: string, hour: number) => {
    return entries.find((s) => {
      const dayNum = s.day_of_week;
      if (!dayNum) return false;
      if (numToDay[dayNum] !== day) return false;
      const sh = extractHour(s.start_time);
      const eh = extractHour(s.end_time);
      return hour >= sh && hour < eh;
    });
  };

  const isPublished = entries.length > 0 && entries.every((e) => e.is_published);

  const CourseForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={isEdit ? handleEdit : handleCreate} className="space-y-2 ">
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Course *</label>
        <select
          className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
        >
          <option value="">Select course... {courses.length === 0 && '(Loading...)'}</option>
          {courses &&
            courses.length > 0 &&
            courses.map((c) => (
              <option key={c?.id || 'null'} value={c?.id || ''}>
                {c?.code} — {c?.title}
              </option>
            ))}
          {courses && courses.length === 0 && <option disabled>No courses available</option>}
        </select>
      </div>

      {tab === 'class' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Day *</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
          >
            {days.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'exam' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Exam Date *</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Start Time *</label>
          <input
            type="time"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">End Time *</label>
          <input
            type="time"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue *</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            placeholder="e.g. LT 301"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Level *</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l} Level
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'class' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Class Type</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
          >
            {classTypes.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'exam' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Exam Type</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
          >
            {examTypes.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Lecturer ID (optional)</label>
        <input
          type="text"
          className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          placeholder="UUID of lecturer"
          value={lecturerId}
          onChange={(e) => setLecturerId(e.target.value)}
        />
      </div>

      {tab === 'exam' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Invigilators (optional)</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            placeholder="Comma-separated names"
            value={invigilators}
            onChange={(e) => setInvigilators(e.target.value)}
          />
        </div>
      )}

      <Button type="submit" className="w-full" isLoading={submitting}>
        {isEdit ? 'Update Entry' : 'Create Entry'}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Timetable Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Schedule, manage and publish class and exam timetables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isPublished ? 'success' : 'outline'}
            leftIcon={isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            onClick={() => handlePublish(!isPublished)}
          >
            {isPublished ? 'Published' : 'Publish'}
          </Button>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            Add Entry
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <Filter className="w-4 h-4" />
          <span>Level:</span>
          <select
            className="px-2 py-1 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All Levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
          onClick={handleCheckConflicts}
        >
          Check Conflicts
        </Button>
        <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleBulkDelete}>
          Delete All {tab === 'class' ? 'Class' : 'Exam'}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'class', label: 'Class Timetable', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'exam', label: 'Exam Timetable', icon: <GraduationCap className="w-4 h-4" /> },
        ]}
        activeTab={tab}
        onChange={(t) => setTab(t as EntryType)}
      />

      {loading ? (
        <Card>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading timetable...</span>
          </div>
        </Card>
      ) : tab === 'class' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-500" />
              Weekly Class Schedule
            </CardTitle>
            <CardDescription>
              {entries.length} class entries
              {levelFilter ? ` for Level ${levelFilter}` : ''}
              {isPublished && (
                <Badge variant="success" className="ml-2">
                  Published
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] font-medium text-surface-500 text-left w-16">Time</th>
                  {days.map((d) => (
                    <th key={d} className="text-[10px] font-medium text-surface-500 text-center px-2">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h}>
                    <td className="text-[10px] text-surface-400 py-2 pr-2">{h}:00</td>
                    {days.map((d) => {
                      const slot = getSlotAt(d, h);
                      return (
                        <td
                          key={d}
                          className="border border-surface-100 dark:border-surface-800 p-1 text-center min-h-[40px]"
                        >
                          {slot && (
                            <div
                              className={`text-[10px] rounded p-1.5 border cursor-pointer hover:shadow-sm transition-shadow ${colorMap[slot.class_type || 'lecture']}`}
                              onClick={() => openEditModal(slot)}
                              title={`${slot.courseCode} — ${slot.courseTitle}\n${slot.venue}\n${slot.level || ''}L\n${slot.lecturer_name || 'No lecturer'}\n${slot.class_type || 'lecture'}`}
                            >
                              <p className="font-bold">{slot.courseCode}</p>
                              <p className="truncate text-[9px] opacity-75">{slot.venue}</p>
                              {slot.level && <p className="text-[9px] opacity-60">{slot.level}L</p>}
                              {slot.lecturer_name && (
                                <p className="text-[9px] truncate opacity-60">{slot.lecturer_name}</p>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-500" />
              Exam Schedule
            </CardTitle>
            <CardDescription>
              {entries.length} exam entries
              {levelFilter ? ` for Level ${levelFilter}` : ''}
              {isPublished && (
                <Badge variant="success" className="ml-2">
                  Published
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-3">
            {entries.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-8">No exam entries scheduled</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => openEditModal(entry)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.exam_type === 'carryover' ? 'warning' : 'primary'}>
                          {entry.courseCode}
                        </Badge>
                        <span className="text-xs text-surface-500">
                          {entry.exam_type === 'carryover' ? 'Carryover' : 'Main'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-surface-700 dark:text-surface-300 mt-0.5">
                        {entry.courseTitle}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-400">
                        {entry.exam_date ? (
                          <span className="flex items-center gap-1 font-semibold text-surface-600 dark:text-surface-300">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(entry.exam_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {entry.day_of_week ? numToDay[entry.day_of_week] : 'No date set'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {entry.venue}
                        </span>
                        {entry.level && <span>{entry.level}L</span>}
                        {entry.lecturer_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.lecturer_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.invigilators && (
                      <span className="text-[10px] text-surface-400 max-w-[120px] truncate">
                        Invig: {entry.invigilators}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {showConflicts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Conflict Detection ({conflictCount})
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowConflicts(false)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            {conflictCount === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400">No conflicts detected</p>
            ) : (
              conflicts.map((c, i) => (
                <div
                  key={i}
                  className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{c.type.replace('_', ' ')}</Badge>
                    <span className="text-xs text-red-700 dark:text-red-300">{c.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`Add ${tab === 'class' ? 'Class' : 'Exam'} Entry`}
      >
        <CourseForm isEdit={false} />
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingEntry(null);
        }}
        title={`Edit ${tab === 'class' ? 'Class' : 'Exam'} Entry`}
      >
        <CourseForm isEdit={true} />
      </Modal>
    </div>
  );
};

export default TimetableManagePage;
```

### `frontend/src/pages/student/TimetablePage.tsx`
```tsx
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import { getTimetable, type ListTimetableParams } from '../../api/timetable';
import CalendarSyncModal from '../../components/features/CalendarSyncModal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Download, MapPin, User, Clock, BookOpen, GraduationCap, CalendarDays } from 'lucide-react';
import type { TimetableEntry, EntryType } from '../../types';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const numToDay: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

const formatTime = (v: string) => {
  if (!v) return '';
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  const parts = timePart.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
};

const colorMap: Record<string, string> = {
  lecture: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  lab: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  tutorial:
    'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  seminar: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
};

const TimetablePage = () => {
  const { error: notifyError } = useNotification();
  const { user } = useAuth();
  const [tab, setTab] = useState<EntryType>('class');
  const [slots, setSlots] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const studentLevel = user?.level;

  useEffect(() => {
    setLoading(true);
    const params: ListTimetableParams = { entryType: tab };
    if (studentLevel) params.level = studentLevel;
    getTimetable(params)
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load timetable'))
      .finally(() => setLoading(false));
  }, [tab, studentLevel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Timetable</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {studentLevel
              ? `Showing schedules for Level ${studentLevel}`
              : 'Class lecture schedules and exam timetable'}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <CalendarSyncModal />
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={() => window.print()}>
            Print Schedule
          </Button>
        </div>
      </div>

      <Tabs
        className="print:hidden"
        tabs={[
          { id: 'class', label: 'Class Timetable', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'exam', label: 'Exam Timetable', icon: <GraduationCap className="w-4 h-4" /> },
        ]}
        activeTab={tab}
        onChange={(t) => setTab(t as EntryType)}
      />

      {tab === 'class' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map((day) => {
            const daySlots = slots.filter((s) => {
              const dayNum = s.day_of_week;
              if (!dayNum) return false;
              return numToDay[dayNum] === day;
            });
            return (
              <Card key={day} className="flex flex-col">
                <CardHeader className="border-b border-surface-150 dark:border-surface-800 pb-3 mb-3">
                  <CardTitle className="text-base font-bold text-primary-500">{day}</CardTitle>
                </CardHeader>
                <div className="flex-1 space-y-3">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-surface-400 text-center py-6">
                      {loading ? 'Loading...' : 'No scheduled classes'}
                    </p>
                  ) : (
                    daySlots.map((s) => (
                      <div key={s.id} className={`p-3 rounded-xl border ${colorMap[s.class_type || 'lecture']}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge variant="primary">{s.courseCode || 'N/A'}</Badge>
                          {s.class_type && (
                            <span className="text-[9px] uppercase tracking-wider opacity-60">{s.class_type}</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 line-clamp-1 mb-2">
                          {s.courseTitle || 'Course'}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {formatTime(s.start_time)} – {formatTime(s.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{s.venue}</span>
                          </div>
                          {s.lecturer_name && (
                            <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              <span>{s.lecturer_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <div className="flex items-center justify-center p-12">
                <span className="text-sm text-surface-500">Loading exam schedule...</span>
              </div>
            </Card>
          ) : slots.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <GraduationCap className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                <p className="text-sm text-surface-500">No exams scheduled yet</p>
              </div>
            </Card>
          ) : (
            slots.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-6 h-6 text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.exam_type === 'carryover' ? 'warning' : 'primary'}>
                          {entry.courseCode}
                        </Badge>
                        <span className="text-xs text-surface-500">
                          {entry.exam_type === 'carryover' ? 'Carryover' : 'Main Exam'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mt-1">
                        {entry.courseTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                        {entry.exam_date ? (
                          <span className="flex items-center gap-1 font-semibold text-surface-700 dark:text-surface-200">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(entry.exam_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {entry.day_of_week ? numToDay[entry.day_of_week] : 'Date TBD'}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {entry.venue}
                        </span>
                        {entry.level && <span>{entry.level} Level</span>}
                        {entry.lecturer_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {entry.lecturer_name}
                          </span>
                        )}
                      </div>
                      {entry.invigilators && (
                        <p className="text-[10px] text-surface-400 mt-2">Invigilators: {entry.invigilators}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TimetablePage;
```

### `mobile/app/(tabs)/timetable.tsx`
```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import Text from '../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { useAuthStore } from '../../src/store/authStore';
import { getTimetable, type TimetableEntry } from '../../src/api/timetable';
import { addTimetableEntryToCalendar } from '../../src/utils/calendar';
import { haptics } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
const DAY_ORDER = [1, 2, 3, 4, 5];

// start_time/end_time come back as full timestamps with a placeholder
// 1970-01-01 date (the columns are really TIME, not TIMESTAMP) — mirrors
// web's TimetablePage formatTime so both surfaces show a plain "8:00 AM"
// instead of the raw "1970-01-01 08:00:00+00" string.
function formatTime(v: string) {
  if (!v) return '';
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  const parts = timePart.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
}

export default function TimetableScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const todayDow = useMemo(() => new Date().getDay(), []); // 0=Sun..6=Sat, matches DAY_NAMES keys 1-5

  const fetchData = useCallback(async () => {
    try {
      const data = await getTimetable(user?.level);
      setEntries(Array.isArray(data) ? data.filter((e) => e.is_published) : []);
    } catch {
      // keep previous state; pull-to-refresh is right there
    }
  }, [user?.level]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAddToCalendar = async (entry: TimetableEntry) => {
    haptics.tap();
    setAddingId(entry.id);
    try {
      await addTimetableEntryToCalendar(entry.id);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not add this class to your calendar'));
    } finally {
      setAddingId(null);
    }
  };

  const grouped = DAY_ORDER.map((day) => ({
    day,
    label: DAY_NAMES[day],
    isToday: day === todayDow,
    items: entries
      .filter((e) => e.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Timetable</Text>
      <Text style={[styles.subheader, { color: theme.textMuted }]}>
        {user?.level ? `Level ${user.level}` : 'Your'} weekly class schedule
      </Text>

      {!loading && entries.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color={theme.textFaint} />
            <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginTop: spacing.sm }}>
              No published timetable yet.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {grouped.map(
            (group, groupIndex) =>
              group.items.length > 0 && (
                <Animated.View key={group.day} entering={FadeInDown.duration(350).delay(groupIndex * 60)}>
                  <View style={styles.dayHeaderRow}>
                    <Text
                      style={[
                        styles.dayLabel,
                        { color: group.isToday ? theme.primary : theme.text },
                      ]}
                    >
                      {group.label}
                    </Text>
                    {group.isToday && <Badge label="Today" tone="primary" />}
                  </View>

                  <View style={{ gap: spacing.sm }}>
                    {group.items.map((entry) => (
                      <Card key={entry.id} style={styles.entryCard}>
                        <View
                          style={[
                            styles.timeStripe,
                            { backgroundColor: group.isToday ? theme.primary : theme.divider },
                          ]}
                        />
                        <View style={styles.flex}>
                          <Text style={[styles.courseTitle, { color: theme.text }]}>
                            {entry.courseCode} · {entry.courseTitle}
                          </Text>
                          <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                              <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                                {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                              </Text>
                            </View>
                            <View style={styles.metaItem}>
                              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
                              <Text style={[styles.metaText, { color: theme.textMuted }]}>{entry.venue}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.entryActions}>
                          {entry.class_type && <Badge label={entry.class_type} tone="neutral" />}
                          <Pressable
                            onPress={() => handleAddToCalendar(entry)}
                            disabled={addingId === entry.id}
                            hitSlop={8}
                            style={[styles.calendarButton, { backgroundColor: theme.primaryMuted }]}
                          >
                            <Ionicons
                              name={addingId === entry.id ? 'hourglass-outline' : 'calendar-outline'}
                              size={16}
                              color={theme.primary}
                            />
                          </Pressable>
                        </View>
                      </Card>
                    ))}
                  </View>
                </Animated.View>
              ),
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  subheader: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: -spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  entryActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  calendarButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.full,
  },
  courseTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  metaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
});
```

### `mobile/src/api/timetable.ts`
```ts
import apiClient, { unwrap } from './client';

export interface TimetableEntry {
  id: string;
  course_id: string;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  venue: string;
  level?: number;
  courseCode: string;
  courseTitle: string;
  entry_type: 'class' | 'exam';
  class_type?: string;
  is_published: boolean;
}

export const getTimetable = async (level?: number) => {
  const res = await apiClient.get('/timetable', { params: { entryType: 'class', level } });
  return unwrap<TimetableEntry[]>(res);
};
```


### Removed from `backend/internal/api/server.go` (timetable)

Struct field: `timetables        *service.TimetableService`
Constructor: `timetables:        service.NewTimetableService(store),`
Route group:
```go
	timetables := api.Group("/timetable")
	{
		timetables.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createTimetableEntry)
		timetables.GET("", server.listTimetableEntries)
		timetables.GET("/conflicts", server.checkTimetableConflicts)
		timetables.GET("/:id", server.getTimetableEntry)
		timetables.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateTimetableEntry)
		timetables.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteTimetableEntry)
		timetables.POST("/publish", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.publishTimetable)
		timetables.DELETE("/bulk", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.bulkDeleteTimetable)
	}
```
Also removed, inside the `class-rep` route group: `classRep.GET("/timetable", server.getClassRepTimetable)`.

### Removed from `backend/internal/api/attendance_class_rep.go` (timetable)

```go
// getClassRepTimetable GET /class-rep/timetable
func (server *Server) getClassRepTimetable(ctx *gin.Context) {
	userID := getUserID(ctx)

	// Get active class rep assignment to find level
	assignment, err := server.store.GetActiveClassRepAssignment(ctx, userID)
	level := int32(400) // default fallback level
	if err == nil {
		level = assignment.Level
	}

	// Get active semester
	activeSem, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no active semester configured"})
		return
	}

	entries, err := server.store.GetClassRepTimetableEntries(ctx, level, activeSem.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch timetable entries"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"semester": activeSem,
		"level":    level,
		"entries":  entries,
	})
}
```

### Original `backend/internal/api/calendar.go` (timetable-merging portion removed; token issuance and study-task ICS generation kept)

```go
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
```

### Removed from `backend/internal/api/notices_calendar.go` (timetable; this handler was already unregistered/dead — no route called it)

```go
// downloadTimetableEntryICS GET /timetable/:id/ics — a standard .ics file for
// a single timetable entry. Exam entries carry a fixed date already, so they
// produce a one-off VEVENT; class entries only carry a day_of_week (their
// weekly recurring slot) and a start_time/end_time whose date component is a
// placeholder — those produce a weekly-recurring VEVENT anchored to the next
// real calendar date matching that weekday, bounded by the entry's semester
// end date when one is on record.
func (server *Server) downloadTimetableEntryICS(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid timetable entry id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "invalid store"})
		return
	}

	entry, err := queries.GetTimetableEntry(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "timetable entry not found"})
		return
	}

	course, err := queries.GetCourse(ctx, entry.CourseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
		return
	}
	title := fmt.Sprintf("%s - %s", course.Code, course.Title)

	classType := ""
	if entry.ClassType != nil {
		classType = *entry.ClassType
	}

	var startTime, endTime time.Time
	var recurrence string

	if entry.DayOfWeek != nil {
		startTime = nextWeekdayAt(time.Now(), int(*entry.DayOfWeek), entry.StartTime.Time)
		endTime = nextWeekdayAt(time.Now(), int(*entry.DayOfWeek), entry.EndTime.Time)
		if !endTime.After(startTime) {
			endTime = endTime.AddDate(0, 0, 7)
		}

		until := startTime.AddDate(0, 4, 0) // ~one semester, used when no semester end date is on record
		if entry.SemesterID.Valid {
			if sem, serr := queries.GetSemester(ctx, uuid.UUID(entry.SemesterID.Bytes)); serr == nil && sem.EndDate.Valid {
				until = sem.EndDate.Time
			}
		}
		recurrence = fmt.Sprintf("FREQ=WEEKLY;UNTIL=%s", until.UTC().Format("20060102T150405Z"))
	} else {
		startTime = entry.StartTime.Time
		endTime = entry.EndTime.Time
	}

	icsBytes := utils.GenerateICS(utils.ICSEvent{
		UID:            entry.ID.String(),
		Title:          title,
		Description:    classType,
		Location:       entry.Venue,
		Start:          startTime,
		End:            endTime,
		RecurrenceRule: recurrence,
	})

	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.ics\"", entry.ID.String()))
	ctx.Data(http.StatusOK, "text/calendar; charset=utf-8", icsBytes)
}

// nextWeekdayAt returns the next date at-or-after `from` (today counts if it
// already matches) that falls on `weekday` (1=Monday..5=Friday, matching how
// timetable.day_of_week is stored), carrying over the hour/minute from
// `clockTime` — its own date component is a stored placeholder and ignored.
func nextWeekdayAt(from time.Time, weekday int, clockTime time.Time) time.Time {
	goTarget := time.Weekday(weekday % 7) // time.Weekday is 0=Sunday..6=Saturday
	daysAhead := (int(goTarget) - int(from.Weekday()) + 7) % 7
	target := from.AddDate(0, 0, daysAhead)
	return time.Date(target.Year(), target.Month(), target.Day(), clockTime.Hour(), clockTime.Minute(), 0, 0, clockTime.Location())
}
```

### Removed from `backend/internal/api/dashboard.go` (timetable)

Struct fields on `studentDashboardResponse`: `NextClass *nextClassInfo \`json:"next_class"\`` and `TodayClasses []todayClassItem \`json:"today_classes"\``. Types `nextClassInfo` and `todayClassItem` (full definitions below). Helper `parseTimeStr` (only caller was this block).
```go
type nextClassInfo struct {
	CourseCode  string  `json:"course_code"`
	CourseTitle string  `json:"course_title"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	Venue       string  `json:"venue"`
	DayOfWeek   string  `json:"day_of_week"`
	TimeUntil   string  `json:"time_until"`
	ClassType   *string `json:"class_type"`
}

type todayClassItem struct {
	CourseCode  string  `json:"course_code"`
	CourseTitle string  `json:"course_title"`
	StartTime   string  `json:"start_time"`
	EndTime     string  `json:"end_time"`
	Venue       string  `json:"venue"`
	ClassType   *string `json:"class_type"`
}

	// 5. Today's timetable + next class
	entries, err := queries.ListTimetableByType(ctx, db.ListTimetableByTypeParams{
		EntryType: "class",
		Level:     &level,
	})
	if err == nil {
		now := time.Now()
		todayDow := int32(now.Weekday())
		// Convert to 1=Mon...5=Fri
		todayDow1 := todayDow
		if todayDow == 0 {
			todayDow1 = 7 // Sunday -> no match
		}

		for _, entry := range entries {
			if entry.DayOfWeek == nil || *entry.DayOfWeek != todayDow1 {
				continue
			}

			item := todayClassItem{
				CourseCode:  entry.CourseCode,
				CourseTitle: entry.CourseTitle,
				StartTime:   entry.StartTime,
				EndTime:     entry.EndTime,
				Venue:       entry.Venue,
				ClassType:   entry.ClassType,
			}
			resp.TodayClasses = append(resp.TodayClasses, item)

			// Next class detection
			if resp.NextClass == nil {
				hour, minute, ok := parseTimeStr(entry.StartTime)
				if ok {
					classTime := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
					if classTime.After(now) {
						timeUntil := classTime.Sub(now)
						var timeStr string
						if timeUntil.Hours() >= 1 {
							timeStr = fmt.Sprintf("%.0fh %dm", timeUntil.Hours(), int(timeUntil.Minutes())%60)
						} else {
							timeStr = fmt.Sprintf("%dm", int(timeUntil.Minutes()))
						}
						resp.NextClass = &nextClassInfo{
							CourseCode:  entry.CourseCode,
							CourseTitle: entry.CourseTitle,
							StartTime:   entry.StartTime,
							EndTime:     entry.EndTime,
							Venue:       entry.Venue,
							DayOfWeek:   now.Weekday().String(),
							TimeUntil:   timeStr,
							ClassType:   entry.ClassType,
						}
					}
				}
			}
		}
	}

func parseTimeStr(timeStr string) (hour, minute int, ok bool) {
	timeStr = strings.TrimSpace(timeStr)
	if strings.Contains(timeStr, " ") {
		parts := strings.Split(timeStr, " ")
		if len(parts) >= 2 {
			timeStr = parts[1]
		}
	}
	if idx := strings.Index(timeStr, "+"); idx > 0 {
		timeStr = timeStr[:idx]
	}
	tp := strings.Split(timeStr, ":")
	if len(tp) >= 2 {
		fmt.Sscanf(tp[0], "%d", &hour)
		fmt.Sscanf(tp[1], "%d", &minute)
		return hour, minute, true
	}
	return 0, 0, false
}
```

### Removed from `backend/internal/db/sql/custom.go` (timetable)

```go
// ==================== TIMETABLE ====================

type TimetableListItem struct {
	ID              uuid.UUID  `json:"id"`
	CourseID        uuid.UUID  `json:"course_id"`
	DayOfWeek       *int32     `json:"day_of_week"`
	StartTime       string     `json:"start_time"`
	EndTime         string     `json:"end_time"`
	Venue           string     `json:"venue"`
	Level           *int32     `json:"level"`
	CourseCode      string     `json:"courseCode"`
	CourseTitle     string     `json:"courseTitle"`
	EntryType       string     `json:"entry_type"`
	ClassType       *string    `json:"class_type"`
	ExamType        *string    `json:"exam_type"`
	LecturerID      *uuid.UUID `json:"lecturer_id"`
	LecturerName    *string    `json:"lecturer_name"`
	Invigilators    *string    `json:"invigilators"`
	IsPublished     bool       `json:"is_published"`
	HasConflict     bool       `json:"has_conflict"`
	ConflictDetails []byte     `json:"conflict_details"`
	ExamDate        *string    `json:"exam_date"`
}

type ListTimetableByTypeParams struct {
	EntryType string
	Level     *int32
}

func (q *Queries) ListTimetableByType(ctx context.Context, arg ListTimetableByTypeParams) ([]TimetableListItem, error) {
	query := `
		SELECT t.id, t.course_id, t.day_of_week,
			t.start_time::text, t.end_time::text, t.venue, t.level,
			COALESCE(c.code, '') as course_code,
			COALESCE(c.title, '') as course_title,
			t.entry_type, t.class_type, t.exam_type, t.lecturer_id,
			(SELECT full_name FROM users WHERE id = t.lecturer_id) as lecturer_name,
			t.invigilators, t.is_published, t.has_conflict, t.conflict_details,
			CASE WHEN t.exam_date > '1970-01-02'::timestamptz THEN t.exam_date::date::text ELSE NULL END as exam_date
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		WHERE t.entry_type = $1
	`
	args := []interface{}{arg.EntryType}
	idx := 2
	if arg.Level != nil {
		query += fmt.Sprintf(" AND (t.level IS NULL OR t.level = $%d)", idx)
		args = append(args, *arg.Level)
		idx++
	}
	query += " ORDER BY t.day_of_week NULLS LAST, t.exam_date NULLS LAST, t.start_time"

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableListItem{}
	for rows.Next() {
		var i TimetableListItem
		if err := rows.Scan(
			&i.ID, &i.CourseID, &i.DayOfWeek,
			&i.StartTime, &i.EndTime, &i.Venue, &i.Level,
			&i.CourseCode, &i.CourseTitle,
			&i.EntryType, &i.ClassType, &i.ExamType, &i.LecturerID,
			&i.LecturerName, &i.Invigilators, &i.IsPublished, &i.HasConflict, &i.ConflictDetails,
			&i.ExamDate,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) ListAllTimetableEntries(ctx context.Context) ([]TimetableListItem, error) {
	rows, err := q.db.Query(ctx, `
		SELECT t.id, t.course_id, t.day_of_week,
			t.start_time::text, t.end_time::text, t.venue, t.level,
			COALESCE(c.code, '') as course_code,
			COALESCE(c.title, '') as course_title,
			t.entry_type, t.class_type, t.exam_type, t.lecturer_id,
			(SELECT full_name FROM users WHERE id = t.lecturer_id) as lecturer_name,
			t.invigilators, t.is_published, t.has_conflict, t.conflict_details,
			CASE WHEN t.exam_date > '1970-01-02'::timestamptz THEN t.exam_date::date::text ELSE NULL END as exam_date
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		ORDER BY t.entry_type, t.day_of_week NULLS LAST, t.exam_date NULLS LAST, t.start_time
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableListItem{}
	for rows.Next() {
		var i TimetableListItem
		if err := rows.Scan(
			&i.ID, &i.CourseID, &i.DayOfWeek,
			&i.StartTime, &i.EndTime, &i.Venue, &i.Level,
			&i.CourseCode, &i.CourseTitle,
			&i.EntryType, &i.ClassType, &i.ExamType, &i.LecturerID,
			&i.LecturerName, &i.Invigilators, &i.IsPublished, &i.HasConflict, &i.ConflictDetails,
			&i.ExamDate,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (q *Queries) PublishTimetableByType(ctx context.Context, entryType string) error {
	_, err := q.db.Exec(ctx, `UPDATE timetable SET is_published = true, published_at = NOW() WHERE entry_type = $1`, entryType)
	return err
}

func (q *Queries) UnpublishTimetableByType(ctx context.Context, entryType string) error {
	_, err := q.db.Exec(ctx, `UPDATE timetable SET is_published = false, published_at = NULL WHERE entry_type = $1`, entryType)
	return err
}

type TimetableConflictRow struct {
	ID         uuid.UUID  `json:"id"`
	CourseCode string     `json:"course_code"`
	Venue      string     `json:"venue"`
	StartTime  string     `json:"start_time"`
	EndTime    string     `json:"end_time"`
	DayOfWeek  *int32     `json:"day_of_week"`
	Level      *int32     `json:"level"`
	LecturerID *uuid.UUID `json:"lecturer_id"`
}

func (q *Queries) CheckTimetableConflicts(ctx context.Context, arg ListTimetableByTypeParams) ([]TimetableConflictRow, error) {
	query := `
		SELECT t.id, COALESCE(c.code, '') as course_code, t.venue,
			t.start_time::text, t.end_time::text, t.day_of_week, t.level, t.lecturer_id
		FROM timetable t
		LEFT JOIN courses c ON c.id = t.course_id
		WHERE t.entry_type = $1
	`
	args := []interface{}{arg.EntryType}
	idx := 2
	if arg.Level != nil {
		query += fmt.Sprintf(" AND (t.level IS NULL OR t.level = $%d)", idx)
		args = append(args, *arg.Level)
		idx++
	}
	query += " ORDER BY t.day_of_week, t.start_time"

	rows, err := q.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TimetableConflictRow{}
	for rows.Next() {
		var i TimetableConflictRow
		if err := rows.Scan(&i.ID, &i.CourseCode, &i.Venue, &i.StartTime, &i.EndTime, &i.DayOfWeek, &i.Level, &i.LecturerID); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

type CreateTimetableEntrySimpleParams struct {
	CourseID     uuid.UUID
	DayOfWeek    *int32
	StartTime    string
	EndTime      string
	Venue        string
	Level        int32
	EntryType    string
	ClassType    *string
	ExamType     *string
	LecturerID   *uuid.UUID
	Invigilators *string
	ExamDate     *time.Time
}

func (q *Queries) CreateTimetableEntrySimple(ctx context.Context, arg CreateTimetableEntrySimpleParams) (uuid.UUID, error) {
	var id uuid.UUID

	// Convert *uuid.UUID to pgtype.UUID for proper NULL encoding
	lecturerPG := pgtype.UUID{}
	if arg.LecturerID != nil {
		lecturerPG = pgtype.UUID{Bytes: *arg.LecturerID, Valid: true}
	}

	// Convert *time.Time to pgtype.Timestamptz for proper NULL encoding
	examDatePG := pgtype.Timestamptz{}
	if arg.ExamDate != nil {
		examDatePG = pgtype.Timestamptz{Time: *arg.ExamDate, Valid: true}
	}

	err := q.db.QueryRow(ctx, `
		INSERT INTO timetable (course_id, day_of_week, start_time, end_time, venue, level, exam_date, session_id, semester_id, created_by, entry_type, class_type, exam_type, lecturer_id, invigilators)
		VALUES ($1, $2, ('1970-01-01 ' || $3)::timestamptz, ('1970-01-01 ' || $4)::timestamptz, $5, $6, COALESCE($7, '1970-01-01T00:00:00Z'::timestamptz), NULL, NULL, NULL, $8, $9, $10, $11, $12)
		RETURNING id
	`, arg.CourseID, arg.DayOfWeek, arg.StartTime, arg.EndTime, arg.Venue, arg.Level, examDatePG, arg.EntryType, arg.ClassType, arg.ExamType, lecturerPG, arg.Invigilators).Scan(&id)
	return id, err
}

func (q *Queries) UpdateTimetableEntryFull(ctx context.Context, arg CreateTimetableEntrySimpleParams, id uuid.UUID) error {
	// Convert *uuid.UUID to pgtype.UUID for proper NULL encoding
	lecturerPG := pgtype.UUID{}
	if arg.LecturerID != nil {
		lecturerPG = pgtype.UUID{Bytes: *arg.LecturerID, Valid: true}
	}

	// Convert *time.Time to pgtype.Timestamptz for proper NULL encoding
	examDatePG := pgtype.Timestamptz{}
	if arg.ExamDate != nil {
		examDatePG = pgtype.Timestamptz{Time: *arg.ExamDate, Valid: true}
	}

	_, err := q.db.Exec(ctx, `
		UPDATE timetable SET
			course_id = $2, day_of_week = $3,
			start_time = ('1970-01-01 ' || $4)::timestamptz,
			end_time = ('1970-01-01 ' || $5)::timestamptz,
			venue = $6, level = $7,
			exam_date = COALESCE($8, '1970-01-01T00:00:00Z'::timestamptz),
			entry_type = $9, class_type = $10, exam_type = $11,
			lecturer_id = $12, invigilators = $13
		WHERE id = $1
	`, id, arg.CourseID, arg.DayOfWeek, arg.StartTime, arg.EndTime, arg.Venue, arg.Level, examDatePG, arg.EntryType, arg.ClassType, arg.ExamType, lecturerPG, arg.Invigilators)
	return err
}


type ClassRepTimetableEntryRow struct {
	TimetableEntryID    uuid.UUID  `json:"timetable_entry_id"`
	CourseID            uuid.UUID  `json:"course_id"`
	CourseCode          string     `json:"course_code"`
	CourseTitle         string     `json:"course_title"`
	LecturerName        string     `json:"lecturer_name"`
	Venue               string     `json:"venue"`
	DayOfWeek           *int32     `json:"day_of_week"`
	StartTime           string     `json:"start_time"`
	EndTime             string     `json:"end_time"`
	CardStatus          string     `json:"card_status"`
	AttendanceSessionID *uuid.UUID `json:"attendance_session_id"`
	AttendanceStatus    *string    `json:"attendance_status"`
}

func (q *Queries) GetClassRepTimetableEntries(ctx context.Context, level int32, semesterID uuid.UUID) ([]ClassRepTimetableEntryRow, error) {
	rows, err := q.db.Query(ctx, `
		SELECT 
			t.id AS timetable_entry_id,
			t.course_id,
			c.code AS course_code,
			c.title AS course_title,
			COALESCE(u.full_name, 'TBA') AS lecturer_name,
			t.venue,
			t.day_of_week,
			t.start_time::text,
			t.end_time::text,
			'upcoming' AS card_status,
			asess.id AS attendance_session_id,
			asess.status AS attendance_status
		FROM timetable t
		JOIN courses c ON c.id = t.course_id
		LEFT JOIN users u ON u.id = t.lecturer_id
		LEFT JOIN attendance_sessions asess ON asess.course_id = t.course_id AND asess.created_at::date = CURRENT_DATE
		WHERE t.level = $1
		ORDER BY t.day_of_week NULLS LAST, t.start_time ASC
	`, level)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ClassRepTimetableEntryRow
	for rows.Next() {
		var r ClassRepTimetableEntryRow
		if err := rows.Scan(
			&r.TimetableEntryID,
			&r.CourseID,
			&r.CourseCode,
			&r.CourseTitle,
			&r.LecturerName,
			&r.Venue,
			&r.DayOfWeek,
			&r.StartTime,
			&r.EndTime,
			&r.CardStatus,
			&r.AttendanceSessionID,
			&r.AttendanceStatus,
		); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

```

### Removed from `backend/internal/db/sql/models.go` (timetable — the DB table itself was left untouched, only this Go struct was removed since nothing calls it anymore)

```go
type Timetable struct {
	ID              uuid.UUID          `json:"id"`
	CourseID        uuid.UUID          `json:"course_id"`
	ExamDate        pgtype.Timestamptz `json:"exam_date"`
	StartTime       pgtype.Timestamptz `json:"start_time"`
	EndTime         pgtype.Timestamptz `json:"end_time"`
	Venue           string             `json:"venue"`
	SessionID       pgtype.UUID        `json:"session_id"`
	SemesterID      pgtype.UUID        `json:"semester_id"`
	HasConflict     bool               `json:"has_conflict"`
	ConflictDetails []byte             `json:"conflict_details"`
	CreatedBy       pgtype.UUID        `json:"created_by"`
	CreatedAt       pgtype.Timestamptz `json:"created_at"`
	DayOfWeek       *int32             `json:"day_of_week"`
	Level           *int32             `json:"level"`
	EntryType       string             `json:"entry_type"`
	ClassType       *string            `json:"class_type"`
	LecturerID      pgtype.UUID        `json:"lecturer_id"`
	ExamType        *string            `json:"exam_type"`
	Invigilators    *string            `json:"invigilators"`
	IsPublished     bool               `json:"is_published"`
	PublishedAt     pgtype.Timestamptz `json:"published_at"`
}
```

### Removed from `backend/internal/api/expenses_feedback.go` (timetable)

```go
		{"Timetable", "How to view your timetable", "Navigate to Timetable in the sidebar.\nFilter between class and exam timetable views.\nYou will receive a notification whenever a new timetable is published or updated.", 1},
```

### Removed from `backend/internal/service/ai_service.go` (timetable)

Quick-action chip:
```go
	{ID: "schedule", Label: "My Schedule", Icon: "📅", Query: "Show me my class schedule for today"},
```

Greeting rule's reply/suggestions changed from mentioning "schedules"/"Show my schedule" to drop that mention. Help-menu text bullet removed: `"📅 **Schedule** — View your class and exam timetables\n" +`. Chatbot rule removed in full:
```go
		{
			keywords: []string{"schedule", "timetable", "class today", "next class", "classes"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "To view your class schedule, visit the Timetable page. You can see your classes by day and week. Would you like me to help with anything else?",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View exam timetable", "Check attendance"},
				}
			},
		},
```

System prompt's academic-matters bullet changed from `"- Academic matters (grades, courses, registration, timetable)"` to drop "timetable".

### Removed from `frontend/src/api/attendance.ts` (timetable)

```ts
export interface TimetableEntry {
  timetable_entry_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  lecturer_name: string;
  venue: string;
  // 1=Monday..7=Sunday, matching timetable.day_of_week — same convention
  // TimetablePage.tsx's numToDay uses for the student-facing timetable.
  day_of_week: number | null;
  // Raw TIMESTAMPTZ text (e.g. "2026-08-17 08:00:00+00") — only the
  // time-of-day portion is meaningful, the date is a placeholder.
  start_time: string;
  end_time: string;
  card_status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  attendance_session_id?: string;
  attendance_status?: string;
}
```
```ts
export const getClassRepTimetable = async () => {
  const res = await apiClient.get<{ entries: TimetableEntry[]; level: number }>('/class-rep/timetable');
  return res.data;
};
```

### Reworked `frontend/src/pages/class-rep/AttendancePage.tsx` (timetable-based course selector replaced with a direct course list)

This page used `getClassRepTimetable()` as its primary course-selector data source, falling back to `getCourses()` filtered by level only when the timetable came back empty (which the in-code comment noted was the common case in practice). Since the timetable feature and its `/class-rep/timetable` endpoint were removed, the page was reworked to use `getCourses()` directly as the only source — the exact same level-filtering logic the fallback already used. Removed pieces:

```tsx
import {
  getClassRepTimetable,
  getRegisteredStudentsForAttendance,
  submitAttendanceSession,
  downloadAttendancePDF,
  type TimetableEntry,
  type RegisteredStudentAttendance,
} from '../../api/attendance';
import { getCourses } from '../../api/courses';

// timetable.day_of_week is 1=Monday..7=Sunday (see TimetablePage.tsx's
// numToDay for the same convention on the student-facing timetable).
const dayNames: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

// start_time/end_time come back as raw TIMESTAMPTZ text (e.g.
// "2026-08-17 08:00:00+00") — only the time-of-day is meaningful.
function formatClockTime(raw: string): string {
  const match = raw.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : raw;
}

function describeSchedule(entry: TimetableEntry): string {
  const day = entry.day_of_week != null ? dayNames[entry.day_of_week] : null;
  const time = formatClockTime(entry.start_time);
  return day ? `${day} ${time}` : time;
}

  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ttRes, coursesRes, sessionsList] = await Promise.allSettled([
          getClassRepTimetable(),
          getCourses(),
          listMyAttendanceSessions(),
        ]);

        let level = 400;
        let entries: TimetableEntry[] = [];
        if (ttRes.status === 'fulfilled') {
          if (ttRes.value.level) {
            level = ttRes.value.level;
          }
          if (ttRes.value.entries?.length > 0) {
            entries = ttRes.value.entries;
          }
        }

        if (entries.length === 0 && coursesRes.status === 'fulfilled' && coursesRes.value.length > 0) {
          const levelCourses = coursesRes.value.filter((c: Course) => c.level === level);
          const sourceCourses = levelCourses.length > 0 ? levelCourses : coursesRes.value;

          entries = sourceCourses.map((c: Course) => ({
            timetable_entry_id: c.id,
            course_id: c.id,
            course_code: c.code,
            course_title: c.title,
            lecturer_name: 'Department Lecturer',
            venue: 'Main Hall',
            day_of_week: null,
            start_time: '08:00',
            end_time: '10:00',
            card_status: 'upcoming',
          }));
        }

        setTimetable(entries);
        if (entries.length > 0) {
          setSelectedCourseId(entries[0].course_id);
        }
```

### Removed from `frontend/src/router.tsx` (timetable)

```tsx
const TimetablePage = lazy(() => import('./pages/student/TimetablePage'));
```
```tsx
const TimetableManagePage = lazy(() => import('./pages/admin/TimetableManagePage'));
```
```tsx
              { path: '/timetable', element: <TimetablePage /> },
```
```tsx
              { path: '/admin/timetable', element: <TimetableManagePage /> },
```

### Removed from `frontend/src/components/layout/Sidebar.tsx` (timetable)

```tsx
  {
    label: 'Timetable',
    path: '/timetable',
    icon: Calendar,
    roles: ['student', 'project_coordinator', 'event_coordinator', 'alumni_rep'],
  },
```
```tsx
  { label: 'Semester Timetable', path: '/timetable', icon: Calendar, roles: ['class_rep'] },
```
```tsx
  { label: 'Timetable', path: '/admin/timetable', icon: Clock, roles: ['hod', 'delegated_admin', 'admin'] },
```
```tsx
      { label: 'Timetable', path: '/timetable', icon: Calendar },
```
(both `Calendar` and `Clock` icons stay imported — still used elsewhere in this file)

### Removed from `frontend/src/pages/student/StudentDashboard.tsx` (timetable)

Destructured fields `next_class,` and `today_classes,`. Three cards (Next Class, Today's Classes populated, Today's Classes empty) and the 'View Timetable' Quick Action link:
```tsx
          {/* Next Class */}
          {next_class && (
            <Card className="border-l-4 border-primary-500">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-500" />
                  <CardTitle>Next Class</CardTitle>
                </div>
                <Badge variant="primary">{next_class.time_until}</Badge>
              </CardHeader>
              <div className="p-4 pt-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-surface-900 dark:text-surface-100">
                      {next_class.course_code} — {next_class.course_title}
                    </h4>
                    <p className="text-sm text-surface-500">
                      {next_class.venue} · {next_class.start_time?.slice(0, 5)} – {next_class.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  {next_class.class_type && <Badge variant="secondary">{next_class.class_type}</Badge>}
                </div>
              </div>
            </Card>
          )}

          {/* Today's Classes */}
          {today_classes && today_classes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-500" />
                  <CardTitle>Today's Classes</CardTitle>
                </div>
                <span className="text-xs text-surface-400">{today_classes.length} classes</span>
              </CardHeader>
              <div className="space-y-2 p-4 pt-0">
                {today_classes.map((c, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 rounded-lg border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900"
                  >
                    <div>
                      <h5 className="font-semibold text-sm text-surface-900 dark:text-surface-100">{c.course_code}</h5>
                      <p className="text-[10px] text-surface-500 truncate max-w-[180px]">{c.course_title}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-primary-500">{c.start_time?.slice(0, 5)}</span>
                      <p className="text-[10px] text-surface-400">{c.venue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* No classes today */}
          {(!today_classes || today_classes.length === 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-surface-400" />
                  <CardTitle>Today's Classes</CardTitle>
                </div>
              </CardHeader>
              <p className="text-center text-surface-400 text-sm py-6">No classes scheduled for today.</p>
            </Card>
          )}

              <Link to="/timetable" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Calendar className="w-4 h-4" />}>
                  View Timetable
                </Button>
              </Link>
```

### Removed from `frontend/src/api/dashboard.ts` (timetable)

```ts
  next_class: {
    course_code: string;
    course_title: string;
    start_time: string;
    end_time: string;
    venue: string;
    day_of_week: string;
    time_until: string;
    class_type: string | null;
  } | null;
  today_classes: Array<{
    course_code: string;
    course_title: string;
    start_time: string;
    end_time: string;
    venue: string;
    class_type: string | null;
  }>;
```

### Removed from `frontend/src/types/index.ts` (timetable)

```ts
// ───── Timetable ─────
export type EntryType = 'class' | 'exam';
export type ClassType = 'lecture' | 'lab' | 'tutorial' | 'seminar';
export type ExamType = 'main' | 'carryover';

export interface TimetableEntry {
  id: string;
  course_id: string;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  venue: string;
  level?: number;
  courseCode: string;
  courseTitle: string;
  entry_type: EntryType;
  class_type?: ClassType;
  exam_type?: ExamType;
  lecturer_id?: string;
  lecturer_name?: string;
  invigilators?: string;
  is_published: boolean;
  has_conflict: boolean;
  conflict_details?: string;
  exam_date?: string;
  session_id?: string;
  semester_id?: string;
  created_by?: string;
  created_at?: string;
  course?: Course;
  // Legacy aliases for backward compat
  courseId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export interface TimetableConflict {
  type: string;
  message: string;
  entry1_id: string;
  entry2_id: string;
}
```
(note: `ExamType`'s `'carryover'` value is unrelated to the carryover feature — it was just an exam-type label — and its removal here is only because the whole `ExamType` type is timetable-only, not part of the carryover cleanup.)

### Removed from `frontend/src/components/notifications/notificationHelpers.ts` (timetable)

```ts
  timetable: { icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/10' },
```
(`Calendar` icon import removed too, no longer used in this file; `getCategoryConfig`/`timeAgo` are shared helpers used by all notification categories and were left untouched.)

### Removed from `frontend/src/pages/shared/NotificationsPage.tsx` (timetable)

```tsx
  { id: 'timetable', label: 'Timetable' },
```

### Removed from `mobile/app/(tabs)/_layout.tsx` (timetable)

```tsx
        <Tabs.Screen name="timetable" options={{ href: null }} />
```

### Removed from `mobile/app/(tabs)/index.tsx` (timetable)

QuickLink:
```tsx
            <QuickLink
              icon="calendar-outline"
              label="Timetable"
              onPress={() => router.push('/(tabs)/timetable')}
            />
```
Next Class card:
```tsx
        {data?.next_class && (
          <Animated.View entering={FadeInDown.duration(400).delay(180)}>
            <Card style={styles.nextClassCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Next Class</Text>
                <Badge label={data.next_class.time_until} tone="primary" />
              </View>
              <Text style={[styles.classCourse, { color: theme.text }]}>
                {data.next_class.course_code} · {data.next_class.course_title}
              </Text>
              <View style={styles.classMetaRow}>
                <View style={styles.classMetaItem}>
                  <Ionicons name="time-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.classMetaText, { color: theme.textMuted }]}>
                    {data.next_class.start_time}–{data.next_class.end_time}
                  </Text>
                </View>
                <View style={styles.classMetaItem}>
                  <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.classMetaText, { color: theme.textMuted }]}>{data.next_class.venue}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
```

### Removed from `mobile/src/api/dashboard.ts` (timetable)

```ts
export interface NextClassInfo {
  course_code: string;
  course_title: string;
  start_time: string;
  end_time: string;
  venue: string;
  day_of_week: string;
  time_until: string;
  class_type: string | null;
}
```
```ts
  next_class: NextClassInfo | null;
  today_classes: NextClassInfo[];
```

### Removed from `mobile/src/api/class-rep.ts` (timetable)

```ts
export interface TimetableEntry {
  timetable_entry_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  lecturer_name: string;
  venue: string;
  // 1=Monday..7=Sunday, or null.
  day_of_week: number | null;
  // Raw TIMESTAMPTZ text (e.g. "2026-08-17 08:00:00+00") — only the
  // time-of-day portion is meaningful.
  start_time: string;
  end_time: string;
  card_status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  attendance_session_id?: string;
  attendance_status?: string;
}
```
```ts
export const getClassRepTimetable = async () => {
  const res = await apiClient.get<{ entries: TimetableEntry[]; level: number }>('/class-rep/timetable');
  return res.data;
};
```

### Reworked `mobile/src/components/ClassRepAttendance.tsx` (timetable-based course selector replaced with a direct course list — mirrors the same rework done to the web app's `AttendancePage.tsx`)

```tsx
import { getCourses } from '../api/courses';
import {
  getClassRepTimetable,
  listMyAttendanceSessions,
  createAttendanceSession,
  openAttendanceSession,
  closeAttendanceSession,
  listAttendanceCheckins,
  getRegisteredStudentsForAttendance,
  submitAttendanceSession,
  downloadAttendancePDF,
  checkInStudent,
  type TimetableEntry,
  type AttendanceSession,
  type AttendanceCheckin,
  type RegisteredStudentAttendance,
} from '../api/class-rep';

  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [ttRes, sessions] = await Promise.allSettled([getClassRepTimetable(), listMyAttendanceSessions()]);

      let level = 400;
      let list: TimetableEntry[] = [];
      if (ttRes.status === 'fulfilled') {
        if (ttRes.value.level) level = ttRes.value.level;
        if (ttRes.value.entries?.length > 0) list = ttRes.value.entries;
      }

      // Timetable entries are frequently empty in practice — fall back to
      // the department's course list for the class rep's level so there's
      // always a way to start a session, same fallback the web app uses.
      if (list.length === 0) {
        try {
          const courses = await getCourses({ level });
          const source = courses.length > 0 ? courses : await getCourses();
          list = source.map((c) => ({
            timetable_entry_id: c.id,
            course_id: c.id,
            course_code: c.code,
            course_title: c.title,
            lecturer_name: 'Department Lecturer',
            venue: '',
            day_of_week: null,
            start_time: '',
            end_time: '',
            card_status: 'upcoming' as const,
          }));
        } catch {
          // leave list empty — the empty state below handles it
        }
      }
      setEntries(list);

  const handleStart = async (entry: TimetableEntry) => {
```

### Removed from `mobile/src/utils/calendar.ts` (timetable)

```ts
export async function addTimetableEntryToCalendar(entryId: string) {
  await shareICS(`/timetable/${entryId}/ics`, `class-${entryId}.ics`);
}
```
(`shareICS` is a shared helper also used by `addDepartmentalEventToCalendar` — left untouched. This function was already effectively dead — its target route `/timetable/:id/ics`, `downloadTimetableEntryICS` in `backend/internal/api/notices_calendar.go`, was unregistered/unrouted before this removal pass even started.)

### Removed from `mobile/src/components/ChatbotFAB.tsx` (timetable)

`suggestions: ['Check my grades', 'How to pay dues', 'Show my timetable']` had `'Show my timetable'` removed.
