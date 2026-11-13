// Package attendance implements the verified-attendance pilot. Legacy attendance
// sheets never contribute to these calculations.
package attendance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalid   = errors.New("invalid attendance request")
	ErrForbidden = errors.New("not authorized for this attendance record")
	ErrConflict  = errors.New("attendance state changed or unresolved reviews remain")
	ErrChallenge = errors.New("attendance code expired or invalid; scan the current code")
	ErrLimit     = errors.New("too many attempts; please try again later")
)

const PolicyVersion = "pilot-session-75-v1"

// Decision uses integer arithmetic, never display rounding. Pending review is
// deliberately not an academic rejection (nor an automatic attendance credit).
func Decision(credited, total, pending int) string {
	if pending > 0 {
		return "pending_review"
	}
	if total == 0 {
		return "not_assessable"
	}
	if int64(credited)*100 >= int64(total)*75 {
		return "eligible"
	}
	return "not_eligible"
}
func hash(value string) string { s := sha256.Sum256([]byte(value)); return hex.EncodeToString(s[:]) }
func Challenge(secret, session string, now time.Time) (string, time.Time) {
	expires := now.Truncate(20 * time.Second).Add(20 * time.Second)
	payload := strconv.FormatInt(expires.Unix(), 10)
	m := hmac.New(sha256.New, []byte(secret))
	fmt.Fprint(m, session+":"+payload)
	return payload + "." + hex.EncodeToString(m.Sum(nil)), expires
}
func ValidChallenge(secret, session, token string, now time.Time) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	n, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || n <= now.Unix() || n > now.Unix()+20 {
		return false
	}
	sig, err := hex.DecodeString(parts[1])
	if err != nil {
		return false
	}
	m := hmac.New(sha256.New, []byte(secret))
	fmt.Fprint(m, session+":"+parts[0])
	return hmac.Equal(sig, m.Sum(nil))
}

type Location struct {
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Accuracy   float64   `json:"accuracy"`
	CapturedAt time.Time `json:"capturedAt"`
}

func validCoordinates(lat, lon float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lon) && !math.IsInf(lat, 0) && !math.IsInf(lon, 0) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}
func Distance(a, b, c, d float64) float64 {
	rad := math.Pi / 180
	x := (c - a) * rad
	y := (d - b) * rad
	h := math.Sin(x/2)*math.Sin(x/2) + math.Cos(a*rad)*math.Cos(c*rad)*math.Sin(y/2)*math.Sin(y/2)
	return 6371000 * 2 * math.Asin(math.Sqrt(math.Min(1, h)))
}
func Presence(lat, lon *float64, radius int, l *Location, now time.Time) ([]string, *float64) {
	flags := []string{}
	if lat == nil || lon == nil {
		return append(flags, "venue_location_unconfigured"), nil
	}
	if l == nil {
		return append(flags, "location_unavailable"), nil
	}
	if !validCoordinates(l.Latitude, l.Longitude) || math.IsNaN(l.Accuracy) || math.IsInf(l.Accuracy, 0) || l.Accuracy <= 0 || l.CapturedAt.Before(now.Add(-2*time.Minute)) || l.CapturedAt.After(now.Add(15*time.Second)) {
		return append(flags, "location_invalid_or_stale"), nil
	}
	distance := Distance(*lat, *lon, l.Latitude, l.Longitude)
	if l.Accuracy > 50 {
		flags = append(flags, "location_uncertain")
	}
	if distance > float64(radius) {
		flags = append(flags, "outside_venue_radius")
	}
	return flags, &distance
}
