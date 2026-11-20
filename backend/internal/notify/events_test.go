package notify

import (
	db "github.com/aces/backend/internal/db/sql"
	"testing"
	"time"
)

func str(s string) *string { return &s }
func TestQuietHours(t *testing.T) {
	for _, tc := range []struct{ name, now, start, end, category, want string }{{"overnight", "2026-11-05T23:00:00+01:00", "22:00", "07:00", "system", "2026-11-06T07:00:00+01:00"}, {"morning", "2026-11-05T06:00:00+01:00", "22:00", "07:00", "messages", "2026-11-05T07:00:00+01:00"}, {"end exclusive", "2026-11-05T07:00:00+01:00", "22:00", "07:00", "system", "2026-11-05T07:00:00+01:00"}, {"daytime", "2026-11-05T13:00:00+01:00", "12:00", "14:00", "dues", "2026-11-05T14:00:00+01:00"}, {"auth bypass", "2026-11-05T23:00:00+01:00", "22:00", "07:00", "auth", "2026-11-05T23:00:00+01:00"}, {"equal disabled", "2026-11-05T23:00:00+01:00", "22:00", "22:00", "system", "2026-11-05T23:00:00+01:00"}} {
		t.Run(tc.name, func(t *testing.T) {
			now, _ := time.Parse(time.RFC3339, tc.now)
			want, _ := time.Parse(time.RFC3339, tc.want)
			p := db.NotificationPreferenceView{QuietHoursStart: str(tc.start), QuietHoursEnd: str(tc.end)}
			if got := QuietUntil(now, p, tc.category); !got.Equal(want) {
				t.Fatal(got, want)
			}
		})
	}
}
func TestCategorySwitches(t *testing.T) {
	p := db.NotificationPreferenceView{EmailDues: true, PushMessages: true}
	if !EmailAllowed(p, "dues") || EmailAllowed(p, "messages") || !PushAllowed(p, "messages") || PushAllowed(p, "dues") {
		t.Fatal("topic switches ignored")
	}
}
