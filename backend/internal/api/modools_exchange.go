package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"log"
	"net/http"
	"net/url"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// A mobile Modools sign-in does not end with a session in the return address.
// On Android another app can register the same URL scheme and receive whatever
// the address carries. So the browser gets a one-time code instead. The app
// posts the code to modoolsExchange with the PKCE verifier it kept, and gets the
// session in the response body. A code works once, expires after 60 seconds,
// and is useless without the verifier its challenge was made from.

// modoolsHandOff ends a mobile sign-in without a session. It stores a one-time
// code for user, bound to the app's challenge, and sends the browser back to the
// app with the code in the query.
func (server *Server) modoolsHandOff(ctx *gin.Context, user db.User, challenge string) {
	queries, ok := server.store.(*db.Queries)
	reqCtx := ctx.Request.Context()
	tenantID, hasTenant := tenant.IDFrom(reqCtx)
	if !ok || !hasTenant || !validPKCEChallenge(challenge) {
		server.modoolsBack(ctx, true, "error="+modoolsCallbackError)
		return
	}
	code := randomToken(32)
	if err := queries.CreateModoolsExchangeCode(reqCtx, tenantID, sha256Sum(code), user.ID, challenge); err != nil {
		log.Printf("[modools] one-time code not stored: %v", err)
		server.modoolsBack(ctx, true, "error="+modoolsCallbackError)
		return
	}
	ctx.Redirect(http.StatusFound, mobileModoolsReturn+"?code="+url.QueryEscape(code))
}

// modoolsExchangeRequest is what the app sends: the one-time code, the PKCE
// verifier that the sign-in's challenge was made from, and the department the
// sign-in was for.
type modoolsExchangeRequest struct {
	Code     string `json:"code"`
	Verifier string `json:"verifier"`
	Tenant   string `json:"tenant"`
}

// modoolsExchange trades a one-time code from a mobile sign-in for the session.
// Refusals carry an error code in the body. A well-formed attempt uses the code
// up, even one with the wrong verifier, so a code cannot be tried twice.
func (server *Server) modoolsExchange(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")

	var req modoolsExchangeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil || !validCodeShape(req.Code) || !validPKCEVerifier(req.Verifier) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	bound, err := server.bindTenantSlug(ctx.Request.Context(), req.Tenant)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
		return
	}
	ctx.Request = ctx.Request.WithContext(bound)
	reqCtx := ctx.Request.Context()

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	claim, err := queries.ClaimModoolsExchangeCode(reqCtx, sha256Sum(req.Code))
	if errors.Is(err, pgx.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
		return
	}
	if err != nil {
		log.Printf("[modools] exchange claim failed: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if subtle.ConstantTimeCompare([]byte(pkceS256(req.Verifier)), []byte(claim.CodeChallenge)) != 1 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
		return
	}

	user, err := queries.GetUser(reqCtx, claim.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code"})
		return
	}
	if err != nil {
		log.Printf("[modools] exchange user lookup failed: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if !user.IsActive || user.DeletedAt.Valid {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "account_deactivated"})
		return
	}

	roleNames, _ := server.roles.ListUserRolesByName(reqCtx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}
	// The mobile app is for students and class representatives. Password sign-in
	// refuses the other roles on mobile, and so does this. A Modools account
	// linked to a staff role is caught here, because the callback only checks
	// roles for an email match.
	if hasBlockedMobileRole(roleNames) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "staff_account"})
		return
	}

	resp, err := server.generateAuthResponse(ctx, user, server.modoolsOnboardingCompleted(reqCtx, user.ID), roleNames)
	if err != nil {
		log.Printf("[modools] exchange session failed: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"user": resp.User, "tokens": resp.Tokens})
}

// modoolsOnboardingCompleted reports whether the student has finished onboarding.
// A user with no student row is sent to onboarding. A row that cannot be read
// counts as complete, as the Modools sign-in has always treated it.
func (server *Server) modoolsOnboardingCompleted(ctx context.Context, userID uuid.UUID) bool {
	q, ok := server.store.(*db.Queries)
	if !ok {
		return true
	}
	s, err := q.GetStudentByUserId(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false
	}
	if err != nil {
		return true
	}
	return s.OnboardingCompleted
}

// sha256Sum is the SHA-256 of s. One-time codes are stored under this hash.
func sha256Sum(s string) []byte {
	h := sha256.Sum256([]byte(s))
	return h[:]
}

// validPKCEChallenge reports whether s is an S256 code challenge: the SHA-256 of
// a verifier, as base64url without padding (43 characters).
func validPKCEChallenge(s string) bool {
	return validBase64URL32(s)
}

// validCodeShape reports whether s has the shape of a one-time code: 32 random
// bytes as base64url without padding, the same shape as a challenge.
func validCodeShape(s string) bool {
	return validBase64URL32(s)
}

func validBase64URL32(s string) bool {
	if len(s) != 43 {
		return false
	}
	b, err := base64.RawURLEncoding.DecodeString(s)
	return err == nil && len(b) == 32
}

// validPKCEVerifier reports whether s is a code verifier as RFC 7636 section 4.1
// defines it: 43 to 128 characters from the unreserved set.
func validPKCEVerifier(s string) bool {
	if len(s) < 43 || len(s) > 128 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		isAlphanumeric := (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
		if !isAlphanumeric && c != '-' && c != '.' && c != '_' && c != '~' {
			return false
		}
	}
	return true
}
