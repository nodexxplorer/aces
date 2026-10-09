package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/aces/backend/internal/config"
	"github.com/aces/backend/internal/middleware"
	"github.com/aces/backend/internal/uploads"
	"github.com/gin-gonic/gin"
)

// newUploadRouteServer builds a server with two stored files under a temp
// root and the upload routes registered on a fresh engine.
func newUploadRouteServer(t *testing.T, signed bool) (*Server, *gin.Engine) {
	t.Helper()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "crf-signatures"), 0o755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{"sig.png": "PNG-SIGNED", "other.png": "PNG-OTHER"} {
		if err := os.WriteFile(filepath.Join(root, "crf-signatures", name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	server := &Server{config: &config.Config{StorageLocalPath: root}}
	if signed {
		signer, err := uploads.NewSigner("test-secret-for-upload-routes-0123456789", time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		server.uploads = signer
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	server.registerUploadRoutes(router)
	return server, router
}

func serveRequest(router *gin.Engine, method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestUploadRouteServesValidSignedLink(t *testing.T) {
	server, router := newUploadRouteServer(t, true)
	link := server.uploads.SignStored("crf-signatures/sig.png")

	rec := serveRequest(router, http.MethodGet, link)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %q", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != "PNG-SIGNED" {
		t.Errorf("body = %q", rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "image/png" {
		t.Errorf("Content-Type = %q", got)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q", got)
	}
}

func TestUploadRouteServesHeadWithoutBody(t *testing.T) {
	server, router := newUploadRouteServer(t, true)
	rec := serveRequest(router, http.MethodHead, server.uploads.SignStored("crf-signatures/sig.png"))
	if rec.Code != http.StatusOK {
		t.Errorf("HEAD status = %d", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("HEAD returned a body of %d bytes", rec.Body.Len())
	}
}

func TestUploadRouteRefusesWhatIsNotSignedForThatPath(t *testing.T) {
	server, router := newUploadRouteServer(t, true)
	link := server.uploads.SignStored("crf-signatures/sig.png")
	swapped := strings.Replace(link, "sig.png", "other.png", 1)

	cases := map[string]string{
		"no query":          "/uploads/crf-signatures/sig.png",
		"empty parameters":  "/uploads/crf-signatures/sig.png?exp=&sig=",
		"other file's path": swapped,
		"forged signature":  "/uploads/crf-signatures/sig.png?exp=9999999999&sig=AAAA",
		"traversal":         "/uploads/%2e%2e/%2e%2e/etc/passwd?exp=9999999999&sig=AAAA",
		"missing file":      server.uploads.SignStored("crf-signatures/gone.png"),
		"directory":         server.uploads.SignStored("crf-signatures"),
	}
	for name, target := range cases {
		rec := serveRequest(router, http.MethodGet, target)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404 (body %q)", name, rec.Code, rec.Body.String())
			continue
		}
		var body map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body["error"] != "not found" {
			t.Errorf("%s: body = %q, want the same not-found body as a missing file", name, rec.Body.String())
		}
		if strings.Contains(rec.Body.String(), "PNG") {
			t.Errorf("%s: file content leaked", name)
		}
	}
}

func TestUploadRouteFailsClosedWithoutASigner(t *testing.T) {
	_, router := newUploadRouteServer(t, false)
	if rec := serveRequest(router, http.MethodGet, "/uploads/crf-signatures/sig.png?exp=9999999999&sig=AAAA"); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 when no signer is configured", rec.Code)
	}
}

// A link issued by the response middleware, read from a JSON body, must open
// the file it names. This ties step 1 (signing) to step 2 (checking).
func TestLinkFromJSONResponseServesTheFile(t *testing.T) {
	server, _ := newUploadRouteServer(t, true)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.SignUploadLinks(server.uploads))
	router.GET("/api/v1/me", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"avatar": "/uploads/crf-signatures/sig.png"})
	})
	server.registerUploadRoutes(router)

	rec := serveRequest(router, http.MethodGet, "/api/v1/me")
	var body struct {
		Avatar string `json:"avatar"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !strings.HasPrefix(body.Avatar, "/uploads/crf-signatures/sig.png?exp=") {
		t.Fatalf("avatar = %q, want a signed link", body.Avatar)
	}
	if got := serveRequest(router, http.MethodGet, body.Avatar); got.Code != http.StatusOK || got.Body.String() != "PNG-SIGNED" {
		t.Errorf("link from the response: status %d, body %q", got.Code, got.Body.String())
	}
}
