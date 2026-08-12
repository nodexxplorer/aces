package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CSRFCookieName holds a double-submit CSRF token, readable by frontend JS
// (unlike the httpOnly access/refresh token cookies) so it can be echoed
// back as a header on state-changing requests.
const CSRFCookieName = "aces_csrf_token"

// CSRFHeaderName is the header the frontend must echo the cookie's value
// into for the check below to pass.
const CSRFHeaderName = "X-CSRF-Token"

// GenerateCSRFToken returns a random 32-byte hex-encoded token.
func GenerateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// csrfExemptPaths are endpoints reachable before a session cookie exists
// (login/signup), or that only rotate tokens rather than mutate user data
// (refresh) — excluded so a not-yet-issued or stale CSRF cookie can't lock
// a legitimate client out of authenticating in the first place.
var csrfExemptPaths = map[string]bool{
	"/api/v1/auth/login":   true,
	"/api/v1/auth/signup":  true,
	"/api/v1/auth/refresh": true,
}

// CSRFProtect implements double-submit-cookie CSRF defense: any cookie-
// authenticated, state-changing request must echo the aces_csrf_token
// cookie's value back in the X-CSRF-Token header. A cross-site page can
// trigger a browser to send the cookie automatically, but — unlike this
// app's own frontend — it cannot read the cookie's value to copy it into
// the header, so a forged request fails the comparison.
//
// Requests authenticated via a bearer Authorization header (mobile app)
// carry no ambient browser-attached credential, so they're not CSRF-able
// and are left alone here regardless of method.
func CSRFProtect() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		if csrfExemptPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		accessCookie, err := c.Cookie("aces_access_token")
		if err != nil || accessCookie == "" {
			// No session cookie in play — auth (if any) is via bearer header.
			c.Next()
			return
		}

		csrfCookie, err := c.Cookie(CSRFCookieName)
		if err != nil || csrfCookie == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing csrf token"})
			return
		}

		headerToken := c.GetHeader(CSRFHeaderName)
		if headerToken == "" || headerToken != csrfCookie {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid csrf token"})
			return
		}

		c.Next()
	}
}
