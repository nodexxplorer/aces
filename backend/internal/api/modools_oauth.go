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
	"golang.org/x/oauth2"
)

const (
	modoolsStateCookie     = "aces_modools_state"
	modoolsVerifierCkie    = "aces_modools_verifier"
	modoolsTenantCookie    = "aces_modools_tenant"
	modoolsClientCookie    = "aces_modools_client"
	modoolsChallengeCookie = "aces_modools_challenge"
	modoolsCallbackError   = "auth_failed"

	// mobileModoolsReturn is where a mobile sign-in ends. It uses the app's URL
	// scheme (app.json "scheme"), so the app can take it back. The app asks for
	// this with client=mobile and never names a URL, so there is no open redirect.
	// The return carries a one-time code, never a session (see modools_exchange.go).
	mobileModoolsReturn = "aceszone://modools-complete"
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

// modoolsStartsOnMobile reports whether a sign-in is starting in the mobile app.
// Only the exact value "mobile" counts.
func modoolsStartsOnMobile(ctx *gin.Context) bool {
	return ctx.Query("client") == "mobile"
}

// modoolsIsMobile reports whether this round trip started in the mobile app,
// as recorded in the client cookie at the start of the sign-in.
func modoolsIsMobile(ctx *gin.Context) bool {
	client, err := ctx.Cookie(modoolsClientCookie)
	return err == nil && client == "mobile"
}

// modoolsBack sends the browser back at the end of a Modools round trip. The
// app receives the query through its URL scheme; the website gets it on its
// sign-in page.
func (server *Server) modoolsBack(ctx *gin.Context, mobile bool, query string) {
	if mobile {
		ctx.Redirect(http.StatusFound, mobileModoolsReturn+"?"+query)
		return
	}
	ctx.Redirect(http.StatusFound, server.frontendBase()+"/login?"+query)
}

func (server *Server) modoolsLogin(ctx *gin.Context) {
	mobile := modoolsStartsOnMobile(ctx)
	challenge := ctx.Query("code_challenge")
	// The app sends the challenge of its PKCE pair. The one-time code that ends
	// the sign-in is bound to it, so a mobile sign-in without one is refused.
	if mobile && !validPKCEChallenge(challenge) {
		server.modoolsBack(ctx, true, "error="+modoolsCallbackError)
		return
	}
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
		server.modoolsBack(ctx, mobile, "error=unknown_department")
		return
	}
	t, _ := tenant.From(bound)

	state := randomToken(16)
	verifier := randomToken(48)

	// 10 minutes is plenty for the user to come back from Modools.
	server.setShortCookie(ctx, modoolsStateCookie, state, 600)
	server.setShortCookie(ctx, modoolsVerifierCkie, verifier, 600)
	server.setShortCookie(ctx, modoolsTenantCookie, t.Slug, 600)
	client := "web"
	if mobile {
		client = "mobile"
	}
	server.setShortCookie(ctx, modoolsClientCookie, client, 600)
	if mobile {
		server.setShortCookie(ctx, modoolsChallengeCookie, challenge, 600)
	}

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
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	code := ctx.Query("code")
	if code == "" {
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}

	state := ctx.Query("state")
	storedState, err := ctx.Cookie(modoolsStateCookie)
	if err != nil || state == "" || storedState == "" || state != storedState {
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	verifier, err := ctx.Cookie(modoolsVerifierCkie)
	if err != nil || verifier == "" {
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	challenge, _ := ctx.Cookie(modoolsChallengeCookie)
	// Cookies are single-use — clear them immediately.
	tenantSlug, _ := ctx.Cookie(modoolsTenantCookie)
	server.setShortCookie(ctx, modoolsStateCookie, "", -1)
	server.setShortCookie(ctx, modoolsVerifierCkie, "", -1)
	server.setShortCookie(ctx, modoolsTenantCookie, "", -1)
	server.setShortCookie(ctx, modoolsChallengeCookie, "", -1)
	// The client cookie is not cleared. It only says where errors go, and the
	// next sign-in sets it again, so a replayed callback still ends in the app.

	// A mobile sign-in needs the challenge the app started it with. Without one no
	// one-time code can be made, so the sign-in is refused before any provider or
	// database work.
	if modoolsIsMobile(ctx) && !validPKCEChallenge(challenge) {
		server.modoolsBack(ctx, true, "error="+modoolsCallbackError)
		return
	}

	// Bind the department before any database work. A flow started before this
	// deploy has no tenant cookie and belongs to the default department.
	bound, err := server.bindTenantSlug(ctx.Request.Context(), tenantSlug)
	if err != nil {
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error=unknown_department")
		return
	}
	ctx.Request = ctx.Request.WithContext(bound)

	provider, cfg, err := modoolsInit(ctx.Request.Context())
	if err != nil {
		log.Printf("[modools] init failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}

	oauthToken, err := cfg.Exchange(ctx.Request.Context(), code,
		oauth2.SetAuthURLParam("code_verifier", verifier))
	if err != nil {
		log.Printf("[modools] token exchange failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	rawIDToken, ok := oauthToken.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		log.Printf("[modools] no id_token in token response")
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	idTokenVerifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})
	idToken, err := idTokenVerifier.Verify(ctx.Request.Context(), rawIDToken)
	if err != nil {
		log.Printf("[modools] id_token verification failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	var claims modoolsClaims
	if err := idToken.Claims(&claims); err != nil {
		log.Printf("[modools] claim parse failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	if claims.Subject == "" || claims.Email == "" {
		log.Printf("[modools] id_token missing sub/email")
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	name := strings.TrimSpace(claims.Name)
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}

	// 1) Existing Modools link → straight in.
	if mu, err := queries.GetUserByModoolsSub(ctx, claims.Subject); err == nil {
		if !mu.IsActive || mu.DeletedAt.Valid {
			server.modoolsBack(ctx, modoolsIsMobile(ctx), "error=account_deactivated")
			return
		}
		server.modoolsFinish(ctx, mu, oauthToken, challenge)
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
			server.modoolsBack(ctx, modoolsIsMobile(ctx), "error=staff_email")
			return
		}
		if err := queries.LinkModoolsAccount(ctx, existing.ID, claims.Subject, strPtr(oauthToken.RefreshToken)); err != nil {
			log.Printf("[modools] link failed: %v", err)
			server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
			return
		}
		if !existing.IsActive || existing.DeletedAt.Valid {
			server.modoolsBack(ctx, modoolsIsMobile(ctx), "error=account_deactivated")
			return
		}
		server.modoolsFinish(ctx, existing, oauthToken, challenge)
		return
	}
	firstName, lastName := splitFullName(name)
	hashedPassword, err := util.HashPassword(randomToken(40)) // unusable; password login is not offered
	if err != nil {
		log.Printf("[modools] password hash failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}

	tx, err := server.dbPool.Begin(ctx)
	if err != nil {
		log.Printf("[modools] begin tx failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
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
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	if err := txq.CreateModoolsStudentRow(ctx, userID); err != nil {
		log.Printf("[modools] student row create failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("[modools] create commit failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}

	created, err := queries.GetUser(ctx, userID)
	if err != nil {
		log.Printf("[modools] post-create fetch failed: %v", err)
		server.modoolsBack(ctx, modoolsIsMobile(ctx), "error="+modoolsCallbackError)
		return
	}
	server.notifyUser(
		ctx,
		created.ID,
		"general",
		"system",
		"normal",
		"Welcome to "+brandName(ctx)+"!",
		"Your account was created via Modools. Finish setting up your profile to continue.",
		"/onboarding",
		"Complete Setup",
		nil,
		nil,
	)

	server.modoolsFinish(ctx, created, oauthToken, challenge)
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

// modoolsFinish completes a Modools sign-in for user. The provider's refresh
// token is kept either way. A mobile sign-in ends with a one-time code for the
// app (modoolsHandOff). A web sign-in ends with the session in the fragment of
// the website's own sign-in page, as before.
func (server *Server) modoolsFinish(ctx *gin.Context, user db.User, oauthToken *oauth2.Token, challenge string) {
	if oauthToken != nil && oauthToken.RefreshToken != "" {
		if q, ok := server.store.(*db.Queries); ok {
			_ = q.UpdateModoolsRefreshToken(ctx, user.ID, strPtr(oauthToken.RefreshToken))
		}
	}
	if modoolsIsMobile(ctx) {
		server.modoolsHandOff(ctx, user, challenge)
		return
	}
	server.modoolsWebSession(ctx, user)
}

// modoolsWebSession sends the website the session, in the fragment of its own
// sign-in page. The fragment is never sent to a server, and the page clears it.
func (server *Server) modoolsWebSession(ctx *gin.Context, user db.User) {
	roleNames, _ := server.roles.ListUserRolesByName(ctx, user.ID)
	if len(roleNames) == 0 {
		roleNames = []string{string(user.Role)}
	}

	resp, err := server.generateAuthResponse(ctx, user, server.modoolsOnboardingCompleted(ctx.Request.Context(), user.ID), roleNames)
	if err != nil {
		log.Printf("[modools] session issue failed: %v", err)
		server.modoolsBack(ctx, false, "error="+modoolsCallbackError)
		return
	}
	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)
	payload, err := json.Marshal(gin.H{"user": resp.User, "tokens": resp.Tokens})
	if err != nil {
		server.modoolsBack(ctx, false, "error="+modoolsCallbackError)
		return
	}
	ctx.Redirect(http.StatusFound,
		server.frontendBase()+"/login#auth="+base64.RawURLEncoding.EncodeToString(payload))
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

func (server *Server) modoolsStatus(ctx *gin.Context) {
	_, _, _, _, ok := modoolsEnv()
	ctx.JSON(http.StatusOK, gin.H{"configured": ok})
}
