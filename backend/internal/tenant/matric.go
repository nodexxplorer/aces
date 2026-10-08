package tenant

import (
	"regexp"
	"strings"
)

// A matric number has the form 20/EG/EE/1234: the entry year (two digits), the
// department part (EG/EE, which is the tenant's MatricCode), and a serial
// number of three to five digits. The rules below are the only place that
// knows this shape. Nothing else hard-codes a department's code.

// matricCodeFormat is the stored form of a MatricCode. It is the same rule as
// the CHECK constraint in migration 000005.
var matricCodeFormat = regexp.MustCompile(`^[A-Z]{2}/[A-Z]{2}$`)

// ValidMatricCode reports whether code has the stored form, such as EG/EE.
func ValidMatricCode(code string) bool {
	return matricCodeFormat.MatchString(code)
}

// MatricNumberMatches reports whether matric belongs to a department with the
// given code. matric must already be trimmed and upper-cased. A department
// with no valid code matches nothing, which is how a missing code fails closed.
func MatricNumberMatches(code, matric string) bool {
	if !ValidMatricCode(code) {
		return false
	}
	parts := strings.Split(matric, "/")
	if len(parts) != 4 {
		return false
	}
	return isDigits(parts[0], 2, 2) &&
		parts[1]+"/"+parts[2] == code &&
		isDigits(parts[3], 3, 5)
}

// MatricExample returns a matric number in a department's format, for error
// messages, such as 20/EG/EE/1234.
func MatricExample(code string) string {
	return "20/" + code + "/1234"
}

func isDigits(s string, minLen, maxLen int) bool {
	if len(s) < minLen || len(s) > maxLen {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
