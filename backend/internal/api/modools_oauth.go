package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/util"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

const (
	modoolsStateCookie   = "aces_modools_state"
	modoolsVerifierCkie  = "aces_modools_verifier"
	modoolsTenantCookie  = "aces_modools_tenant"
	modoolsCallbackError = "auth_failed"
)

var (
	modoolsMu       sync.Mutex
	modoolsProvider *oidc.Provider
	modoolsConfig   *oauth2.Config
	modoolsReady    bool
)

// modoolsEnv reads the current Modools configuration from env. Re-read on
// every use so rotating credentials doesn't require a code change.
func modoolsEnv() (clientID, clientSecret, issuer, redirectURL string, ok bool) {
	clientID = strings.TrimSpace(os.Getenv("MODOOLS_CLIENT_ID"))
	clientSecret = strings.TrimSpace(os.Getenv("MODOOLS_CLIENT_SECRET"))
	issuer = strings.TrimSpace(os.Getenv("MODOOLS_ISSUER"))
	redirectURL = strings.TrimSpace(os.Getenv("MODOOLS_REDIRECT_URL"))
	ok = clientID != "" && clientSecret != "" && issuer != "" && redirectURL != ""
	return
}

func modoolsInit(ctx context.Context) (*oidc.Provider, *oauth2.Config, error) {
	modoolsMu.Lock()
	defer modoolsMu.Unlock()

	clientID, clientSecret, issuer, redirectURL, ok := modoolsEnv()
	if !ok {
		return nil, nil, errors.New("Modools OAuth is not configured (MODOOLS_* env vars missing)")
	}
	if modoolsProvider != nil && modoolsReady {
		return modoolsProvider, modoolsConfig, nil
	}

	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, nil, fmt.Errorf("modools discovery failed: %w", err)
	}
	modoolsProvider = provider
	modoolsConfig = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "offline_access"},
	}
	modoolsReady = true
	return modoolsProvider, modoolsConfig, nil
}

// randomToken returns n bytes of crypto/rand, base64url-encoded.
func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failing is a system-level problem; panic is honest here.
		panic(fmt.Sprintf("crypto/rand failed: %v", err))
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func pkceS256(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

// setShortCookie sets a short-lived, path-scoped cookie for the OAuth dance.
func (server *Server) setShortCookie(ctx *gin.Context, name, value string, maxAge int) {
	ctx.SetCookie(name, value, maxAge, "/api/v1/auth/modools", "", server.modoolsSecureCookie(ctx), true)
}

func (server *Server) modoolsSecureCookie(ctx *gin.Context) bool {

	return server.config.IsProduction() || ctx.GetHeader("X-Forwarded-Proto") == "https"
}

// frontendBase returns the frontend origin for absolute redirects (the SPA
// and API deploy on different domains, so relative /login redirects would
// land users on the API host). Empty when FRONTEND_PUBLIC_URL is unset.
func (server *Server) frontendBase() string {
	base := strings.TrimRight(server.config.FrontendPublicURL, "/")
	return base
}

func (server *Server) modoolsLogin(ctx *gin.Context) {
	_, cfg, err := modoolsInit(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	// The department is chosen on the sign-in page and carried through the
	// provider round trip in a cookie, because the callback has no other way
	// to know it.
	bound, err := server.bindTenantSlug(ctx.Request.Context(), ctx.Query("tenant"))
	if err != nil {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error=unknown_department")
		return
	}
	t, _ := tenant.From(bound)

	state := randomToken(16)
	verifier := randomToken(48)

	// 10 minutes is plenty for the user to come back from Modools.
	server.setShortCookie(ctx, modoolsStateCookie, state, 600)
	server.setShortCookie(ctx, modoolsVerifierCkie, verifier, 600)
	server.setShortCookie(ctx, modoolsTenantCookie, t.Slug, 600)

	authURL := cfg.AuthCodeURL(
		state,
		oauth2.SetAuthURLParam("code_challenge", pkceS256(verifier)),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		oauth2.SetAuthURLParam("access_type", "offline"), // revocable refresh token
	)
	ctx.Redirect(http.StatusFound, authURL)
}

type modoolsClaims struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (server *Server) modoolsCallback(ctx *gin.Context) {

	if errParam := ctx.Query("error"); errParam != "" {
		log.Printf("[modools] provider error: %s (%s)", errParam, ctx.Query("error_description"))
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	code := ctx.Query("code")
	if code == "" {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}

	state := ctx.Query("state")
	storedState, err := ctx.Cookie(modoolsStateCookie)
	if err != nil || state == "" || storedState == "" || state != storedState {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	verifier, err := ctx.Cookie(modoolsVerifierCkie)
	if err != nil || verifier == "" {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	// Cookies are single-use — clear them immediately.
	tenantSlug, _ := ctx.Cookie(modoolsTenantCookie)
	server.setShortCookie(ctx, modoolsStateCookie, "", -1)
	server.setShortCookie(ctx, modoolsVerifierCkie, "", -1)
	server.setShortCookie(ctx, modoolsTenantCookie, "", -1)

	// Bind the department before any database work. A flow started before this
	// deploy has no tenant cookie and belongs to the default department.
	bound, err := server.bindTenantSlug(ctx.Request.Context(), tenantSlug)
	if err != nil {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error=unknown_department")
		return
	}
	ctx.Request = ctx.Request.WithContext(bound)

	provider, cfg, err := modoolsInit(ctx.Request.Context())
	if err != nil {
		log.Printf("[modools] init failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}

	oauthToken, err := cfg.Exchange(ctx.Request.Context(), code,
		oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		log.Printf("[modools] token exchange failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	rawIDToken, ok := oauthToken.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		log.Printf("[modools] no id_token in token response")
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	idTokenVerifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})
	idToken, err := idTokenVerifier.Verify(ctx.Request.Context(), rawIDToken)
	if err != nil {
		log.Printf("[modools] id_token verification failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	var claims modoolsClaims
	if err := idToken.Claims(&claims); err != nil {
		log.Printf("[modools] claim parse failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	if claims.Subject == "" || claims.Email == "" {
		log.Printf("[modools] id_token missing sub/email")
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	name := strings.TrimSpace(claims.Name)
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}

	// 1) Existing Modools link → straight in.
	if mu, err := queries.GetUserByModoolsSub(ctx, claims.Subject); err == nil {
		if !mu.IsActive || mu.DeletedAt.Valid {
			ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error=account_deactivated")
			return
		}
		server.modoolsFinish(ctx, mu, oauthToken)
		return
	}
	if existing, err := queries.GetUserByEmail(ctx, email); err == nil {
		roleNames, _ := server.roles.ListUserRolesByName(ctx, existing.ID)
		if len(roleNames) == 0 {
			roleNames = []string{string(existing.Role)}
		}
		if hasStaffRole(roleNames) || existing.Role != db.UserRoleStudent {
			// Staff emails must never be claimable through the student IdP.
			log.Printf("[modools] staff email %s attempted Modools login — rejected", email)
			ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error=staff_email")
			return
		}
		if err := queries.LinkModoolsAccount(ctx, existing.ID, claims.Subject, strPtr(oauthToken.RefreshToken)); err != nil {
			log.Printf("[modools] link failed: %v", err)
			ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
			return
		}
		if !existing.IsActive || existing.DeletedAt.Valid {
			ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error=account_deactivated")
			return
		}
		server.modoolsFinish(ctx, existing, oauthToken)
		return
	}
	firstName, lastName := splitFullName(name)
	hashedPassword, err := util.HashPassword(randomToken(40)) // unusable; password login is not offered
	if err != nil {
		log.Printf("[modools] password hash failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}

	tx, err := server.dbPool.Begin(ctx)
	if err != nil {
		log.Printf("[modools] begin tx failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	defer tx.Rollback(ctx)
	txq := queries.WithTx(tx)

	userID, err := txq.CreateModoolsUser(ctx, db.CreateModoolsUserParams{
		Email:        email,
		PasswordHash: hashedPassword,
		FirstName:    firstName,
		LastName:     lastName,
		ModoolsSub:   claims.Subject,
		RefreshToken: strPtr(oauthToken.RefreshToken),
		AvatarURL:    strPtr(claims.Picture),
	})
	if err != nil {
		log.Printf("[modools] auto-create failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	if err := txq.CreateModoolsStudentRow(ctx, userID); err != nil {
		log.Printf("[modools] student row create failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("[modools] create commit failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}

	created, err := queries.GetUser(ctx, userID)
	if err != nil {
		log.Printf("[modools] post-create fetch failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	server.notifyUser(
		ctx,
		created.ID,
		"general",
		"system",
		"normal",
		"Welcome to ACES Zone!",
		"Your account was created via Modools. Finish setting up your profile to continue.",
		"/onboarding",
		"Complete Setup",
		nil,
		nil,
	)

	server.modoolsFinish(ctx, created, oauthToken)
}
func hasStaffRole(roleNames []string) bool {
	for _, r := range roleNames {
		switch r {
		case "lecturer", "hod", "admin", "bursar_dept", "bursar_class",
			"project_coordinator", "event_coordinator", "alumni_rep":
			return true
		}
	}
	return false
}
func (server *Server) modoolsFinish(ctx *gin.Context, user db.User, oauthToken *oauth2.Token) {
	if oauthToken != nil && oauthToken.RefreshToken != "" {
		if q, ok := server.store.(*db.Queries); ok {
			_ = q.UpdateModoolsRefreshToken(ctx, user.ID, strPtr(oauthToken.RefreshToken))
		}
	}
	onboardingCompleted := true
	if q, ok := server.store.(*db.Queries); ok {
		if s, err := q.GetStudentByUserId(ctx, user.ID); err == nil {
			onboardingCompleted = s.OnboardingCompleted
		} else if errors.Is(err, pgx.ErrNoRows) {
			// No student row (shouldn't happen on this path) — force the wall.
			onboardingCompleted = false
		}
	}

	roleNames, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}

	resp, err := server.generateAuthResponse(ctx, user, onboardingCompleted, roleNames)
	if err != nil {
		log.Printf("[modools] session issue failed: %v", err)
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)
	payload, err := json.Marshal(gin.H{"user": resp.User, "tokens": resp.Tokens})
	if err != nil {
		ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?error="+modoolsCallbackError)
		return
	}
	ctx.Redirect(http.StatusFound,
		"/auth/modools/complete#auth="+base64.RawURLEncoding.EncodeToString(payload))
}

func splitFullName(name string) (first, last string) {
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}

func (server *Server) modoolsComplete(ctx *gin.Context) {
	page := `<!doctype html><html><body><script>
(function(){
  try {
    var h = location.hash.substring(1), p = new URLSearchParams(h);
    var auth = p.get('auth');
    if (auth) {
      localStorage.setItem('aces_auth_payload', auth);
      var b64 = auth.replace(/-/g,'+').replace(/_/g,'/');
      var bytes = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0); });
      var payload = JSON.parse(new TextDecoder().decode(bytes));
      var onb = payload && payload.user && payload.user.onboardingCompleted;
      location.replace(onb === false ? '/onboarding' : '/login/celebration');
      return;
    }
  } catch (e) {}
  location.replace('/login?error=auth_failed');
})();
</script></body></html>`
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", []byte(page))
}

func (server *Server) modoolsStatus(ctx *gin.Context) {
	_, _, _, _, ok := modoolsEnv()
	ctx.JSON(http.StatusOK, gin.H{"configured": ok})
}
