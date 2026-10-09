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
