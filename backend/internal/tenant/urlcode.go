package tenant

import (
	"errors"
	"regexp"
	"strings"
)

// A department's URL code is its short name in web addresses: /co is its
// student sign-in page and /co/admin its admin sign-in page.
var urlCodePattern = regexp.MustCompile(`^[a-z0-9]{2,12}$`)

// reservedURLCodes are the first path segments the web app already uses, and
// the names the platform keeps for its own paths on the same origin. A code
// that is one of them would never reach its department's page, because the
// app's own route answers first. TestReservedURLCodesCoverTheWebRouter checks
// this list against frontend/src/router.tsx, so a new page cannot be missed.
var reservedURLCodes = map[string]bool{
	"admin": true, "alumni": true, "api": true, "assets": true,
	"attendance": true, "bursar": true, "complaints": true, "connect": true,
	"courses": true, "dashboard": true, "error": true, "forbidden": true,
	"gpa": true, "health": true, "lecturer": true, "login": true,
	"materials": true, "notices": true, "onboarding": true, "payments": true,
	"portalsign": true, "profile": true, "results": true, "scan": true,
	"search": true, "signup": true, "static": true, "student": true,
	"students": true, "support": true, "uploads": true, "waiting": true,
}

// ValidURLCode returns nil when code can name a department in web addresses:
// 2 to 12 lowercase letters or digits, and not a page the web app already has.
func ValidURLCode(code string) error {
	if !urlCodePattern.MatchString(code) {
		return errors.New("a web address code is 2 to 12 lowercase letters or digits, such as co")
	}
	if reservedURLCodes[code] {
		return errors.New("\"" + code + "\" is a page of the web app, so it cannot be a department's web address code")
	}
	return nil
}

// DefaultURLCode is the web address code a department gets from its matric
// code: the department part, lowercased. EG/CO gives co. It returns "" when no
// valid code can be taken from the matric code.
func DefaultURLCode(matricCode string) string {
	i := strings.LastIndex(matricCode, "/")
	if i < 0 {
		return ""
	}
	code := strings.ToLower(strings.TrimSpace(matricCode[i+1:]))
	if ValidURLCode(code) != nil {
		return ""
	}
	return code
}
