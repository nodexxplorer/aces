package utils

import (
	"fmt"
	"strings"
	"time"
)

// ICSEvent is the minimal set of fields needed to render a single-event
// .ics file that a phone/desktop calendar app can import directly.
type ICSEvent struct {
	UID         string
	Title       string
	Description string
	Location    string
	Start       time.Time
	End         time.Time // zero value means "use Start + 1 hour"
}

// escapeICSText escapes text per RFC 5545 §3.3.11 (backslash, semicolon,
// comma, and newline) before it's placed in a CONTENT-LINE value.
func escapeICSText(s string) string {
	r := strings.NewReplacer(
		"\\", "\\\\",
		";", "\\;",
		",", "\\,",
		"\n", "\\n",
	)
	return r.Replace(s)
}

func formatICSTime(t time.Time) string {
	return t.UTC().Format("20060102T150405Z")
}

// GenerateICS renders a single-VEVENT calendar file body that any standard
// calendar app (iOS/Android/Outlook/Google Calendar's "import" flow) can add
// directly via "Add to Calendar".
func GenerateICS(e ICSEvent) []byte {
	end := e.End
	if end.IsZero() {
		end = e.Start.Add(1 * time.Hour)
	}

	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//ACES Zone//Department Events//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		fmt.Sprintf("UID:%s@aces.zone", e.UID),
		fmt.Sprintf("DTSTAMP:%s", formatICSTime(time.Now())),
		fmt.Sprintf("DTSTART:%s", formatICSTime(e.Start)),
		fmt.Sprintf("DTEND:%s", formatICSTime(end)),
		fmt.Sprintf("SUMMARY:%s", escapeICSText(e.Title)),
	}
	if e.Description != "" {
		lines = append(lines, fmt.Sprintf("DESCRIPTION:%s", escapeICSText(e.Description)))
	}
	if e.Location != "" {
		lines = append(lines, fmt.Sprintf("LOCATION:%s", escapeICSText(e.Location)))
	}
	lines = append(lines, "END:VEVENT", "END:VCALENDAR")

	return []byte(strings.Join(lines, "\r\n") + "\r\n")
}
