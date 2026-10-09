package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/aces/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func modoolsTestContext(t *testing.T, target, cookie string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodGet, target, nil)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	ctx.Request = req
	return ctx, rec
}

func TestModoolsStartsOnMobileAcceptsOnlyTheExactValue(t *testing.T) {
	cases := map[string]bool{
		"?client=mobile":  true,
		"?client=web":     false,
		"?client=Mobile":  false,
		"?client=mobile2": false,
		"":                false,
	}
	for query, want := range cases {
		ctx, _ := modoolsTestContext(t, "/api/v1/auth/modools/login"+query, "")
		if got := modoolsStartsOnMobile(ctx); got != want {
			t.Fatalf("query %q: got %v, want %v", query, got, want)
		}
	}
}

func TestModoolsIsMobileReadsTheRecordedClient(t *testing.T) {
	cases := map[string]bool{
		"aces_modools_client=mobile": true,
		"aces_modools_client=web":    false,
		"aces_modools_client=":       false,
		"":                           false,
	}
	for cookie, want := range cases {
		ctx, _ := modoolsTestContext(t, "/api/v1/auth/modools/callback", cookie)
		if got := modoolsIsMobile(ctx); got != want {
			t.Fatalf("cookie %q: got %v, want %v", cookie, got, want)
		}
	}
}

func TestModoolsBackSendsMobileFlowsToTheAppAndWebFlowsToTheSignInPage(t *testing.T) {
	server := &Server{config: &config.Config{FrontendPublicURL: "https://site.example/"}}

	ctx, rec := modoolsTestContext(t, "/api/v1/auth/modools/callback", "")
	server.modoolsBack(ctx, true, "error=auth_failed")
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "aceszone://modools-complete?error=auth_failed" {
		t.Fatalf("mobile: status %d, location %q", rec.Code, rec.Header().Get("Location"))
	}

	ctx, rec = modoolsTestContext(t, "/api/v1/auth/modools/callback", "")
	server.modoolsBack(ctx, false, "error=staff_email")
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "https://site.example/login?error=staff_email" {
		t.Fatalf("web: status %d, location %q", rec.Code, rec.Header().Get("Location"))
	}
}

// The app takes its own return address back, so the scheme in the backend must
// be the scheme in the app's config. Reading both keeps them from drifting apart.
func TestMobileModoolsReturnUsesTheAppScheme(t *testing.T) {
	raw, err := os.ReadFile("../../../mobile/app.json")
	if err != nil {
		t.Fatal(err)
	}
	var app struct {
		Expo struct {
			Scheme string `json:"scheme"`
		} `json:"expo"`
	}
	if err := json.Unmarshal(raw, &app); err != nil {
		t.Fatal(err)
	}
	if app.Expo.Scheme == "" {
		t.Fatal("mobile/app.json has no expo.scheme")
	}
	if !strings.HasPrefix(mobileModoolsReturn, app.Expo.Scheme+"://") {
		t.Fatalf("mobileModoolsReturn %q does not use the app scheme %q", mobileModoolsReturn, app.Expo.Scheme)
	}
}

// The app's PKCE pair. RFC 7636 appendix B gives this verifier and its challenge.
func TestPKCEChallengeMatchesRFC7636(t *testing.T) {
	const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
	if got := pkceS256(verifier); got != challenge {
		t.Fatalf("pkceS256 = %q, want %q", got, challenge)
	}
	if !validPKCEVerifier(verifier) || !validPKCEChallenge(challenge) {
		t.Fatal("the RFC 7636 example fails the shape checks")
	}
}

func TestPKCEAndCodeShapes(t *testing.T) {
	cases := []struct {
		name string
		want bool
		got  bool
	}{
		{"challenge: 43 base64url characters", true, validPKCEChallenge("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")},
		{"challenge: 42 characters", false, validPKCEChallenge(strings.Repeat("A", 42))},
		{"challenge: 44 characters", false, validPKCEChallenge(strings.Repeat("A", 44))},
		{"challenge: standard base64 '+'", false, validPKCEChallenge(strings.Repeat("A", 42) + "+")},
		{"verifier: 43 characters", true, validPKCEVerifier(strings.Repeat("a", 43))},
		{"verifier: 128 characters", true, validPKCEVerifier(strings.Repeat("a", 128))},
		{"verifier: 42 characters", false, validPKCEVerifier(strings.Repeat("a", 42))},
		{"verifier: 129 characters", false, validPKCEVerifier(strings.Repeat("a", 129))},
		{"verifier: a space", false, validPKCEVerifier(strings.Repeat("a", 42) + " ")},
		{"verifier: unreserved punctuation", true, validPKCEVerifier(strings.Repeat("a", 40) + "-._~")},
		{"code: 32 random bytes", true, validCodeShape(randomToken(32))},
		{"code: 31 random bytes", false, validCodeShape(randomToken(31))},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, c.got, c.want)
		}
	}
}

// A mobile sign-in that does not carry the app's challenge is refused when it
// starts, before the provider is contacted, and sets no cookies.
func TestModoolsMobileLoginNeedsAChallenge(t *testing.T) {
	server := &Server{config: &config.Config{FrontendPublicURL: "https://site.example/"}}
	queries := []string{
		"?client=mobile",
		"?client=mobile&code_challenge=abc",
		"?client=mobile&code_challenge=" + strings.Repeat("A", 42) + "%2B",
	}
	for _, query := range queries {
		ctx, rec := modoolsTestContext(t, "/api/v1/auth/modools/login"+query, "")
		server.modoolsLogin(ctx)
		if rec.Code != http.StatusFound || rec.Header().Get("Location") != "aceszone://modools-complete?error=auth_failed" {
			t.Fatalf("%s: status %d, location %q", query, rec.Code, rec.Header().Get("Location"))
		}
		if n := len(rec.Result().Cookies()); n != 0 {
			t.Fatalf("%s: a refused sign-in set %d cookies", query, n)
		}
	}
}

// A mobile sign-in whose challenge cookie is missing is refused at the callback
// too. The refusal comes before the department lookup and the provider, so the
// test needs neither the database nor Modools.
func TestModoolsMobileCallbackNeedsTheChallengeCookie(t *testing.T) {
	server := &Server{config: &config.Config{FrontendPublicURL: "https://site.example/"}}
	ctx, rec := modoolsTestContext(t,
		"/api/v1/auth/modools/callback?code=provider-code&state=s1",
		"aces_modools_state=s1; aces_modools_verifier=v1; aces_modools_client=mobile")
	server.modoolsCallback(ctx)
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "aceszone://modools-complete?error=auth_failed" {
		t.Fatalf("status %d, location %q", rec.Code, rec.Header().Get("Location"))
	}
}
