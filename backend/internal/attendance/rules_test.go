package attendance

import (
	"math"
	"testing"
	"time"
)

func TestExactEligibility(t *testing.T) {
	for _, tc := range []struct {
		n, d, p int
		want    string
	}{{15, 20, 0, "eligible"}, {3, 4, 0, "eligible"}, {8, 11, 0, "not_eligible"}, {746, 1000, 0, "not_eligible"}, {0, 0, 0, "not_assessable"}, {0, 0, 1, "pending_review"}, {0, 20, 1, "pending_review"}} {
		if got := Decision(tc.n, tc.d, tc.p); got != tc.want {
			t.Fatalf("%+v: %s", tc, got)
		}
	}
}
func TestRotatingChallenge(t *testing.T) {
	now := time.Unix(2000000001, 0)
	token, expires := Challenge("secret", "session", now)
	if !ValidChallenge("secret", "session", token, now) {
		t.Fatal("current challenge rejected")
	}
	for _, tc := range []struct {
		s, id, token string
		at           time.Time
	}{{"wrong", "session", token, now}, {"secret", "other", token, now}, {"secret", "session", token, expires}, {"secret", "session", token, now.Add(-time.Minute)}, {"secret", "session", "bad", now}} {
		if ValidChallenge(tc.s, tc.id, tc.token, tc.at) {
			t.Fatal("invalid challenge accepted", tc)
		}
	}
}
func TestSoftLocation(t *testing.T) {
	lat, lon := 5.0, 8.0
	now := time.Now()
	l := &Location{Latitude: lat, Longitude: lon, Accuracy: 10, CapturedAt: now}
	flags, d := Presence(&lat, &lon, 100, l, now)
	if len(flags) != 0 || d == nil || *d > 1 {
		t.Fatal(flags, d)
	}
	l.Accuracy = 200
	flags, _ = Presence(&lat, &lon, 100, l, now)
	if len(flags) == 0 {
		t.Fatal("inaccurate reading passed")
	}
	l.Accuracy = 10
	l.Latitude = 6
	flags, _ = Presence(&lat, &lon, 100, l, now)
	if len(flags) == 0 {
		t.Fatal("distant reading passed")
	}
	l.Latitude = math.NaN()
	flags, d = Presence(&lat, &lon, 100, l, now)
	if len(flags) == 0 || d != nil {
		t.Fatal("invalid coordinates accepted")
	}
	flags, _ = Presence(&lat, &lon, 100, nil, now)
	if len(flags) == 0 {
		t.Fatal("missing GPS not reviewed")
	}
}
