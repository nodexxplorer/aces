package utils

import "strings"

// brandLabel is the name printed on a department's documents. A document with
// no department name gets the platform's name.
func brandLabel(name string) string {
	if n := strings.TrimSpace(name); n != "" {
		return n
	}
	return "Admin Pack"
}
