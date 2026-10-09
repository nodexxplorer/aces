package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/aces/backend/internal/uploads"
	"github.com/gin-gonic/gin"
)

func newLinkSigner(t *testing.T) *uploads.Signer {
	t.Helper()
	s, err := uploads.NewSigner("test-secret-for-upload-links-0123456789", time.Hour)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	return s
}

func serveWithLinks(t *testing.T, signer *uploads.Signer, h gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SignUploadLinks(signer))
	r.GET("/x", h)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	return rec
}

// assertVerifies parses a signed link from a response and checks that the
// signer accepts it for the path it names.
func assertVerifies(t *testing.T, signer *uploads.Signer, link string) {
	t.Helper()
	u, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse %q: %v", link, err)
	}
	if err := signer.Verify(strings.TrimPrefix(u.Path, uploads.Route), u.Query().Get("exp"), u.Query().Get("sig")); err != nil {
		t.Errorf("link %q does not verify: %v", link, err)
	}
}

func TestSignUploadLinksSignsEveryUploadValueInJSON(t *testing.T) {
	signer := newLinkSigner(t)
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"avatar":   "/uploads/profile-photos/a.png",
			"external": "https://cdn.example.com/uploads/x.png",
			"stored":   "documents/c.pdf",
			"empty":    "",
			"count":    3,
			"items": []any{
				gin.H{"file_url": "/uploads/documents/b.pdf"},
				gin.H{"nested": gin.H{"deep": "/uploads/reports/r.pdf"}},
			},
		})
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %v\n%s", err, rec.Body.String())
	}

	avatar, _ := body["avatar"].(string)
	if !strings.HasPrefix(avatar, "/uploads/profile-photos/a.png?exp=") {
		t.Errorf("avatar = %q, want a signed link", avatar)
	}
	assertVerifies(t, signer, avatar)

	if body["external"] != "https://cdn.example.com/uploads/x.png" {
		t.Errorf("external URL changed: %v", body["external"])
	}
	if body["stored"] != "documents/c.pdf" {
		t.Errorf("storage-relative value changed: %v", body["stored"])
	}
	if body["empty"] != "" {
		t.Errorf("empty value changed: %v", body["empty"])
	}
	if body["count"] != float64(3) {
		t.Errorf("number changed: %v", body["count"])
	}

	items := body["items"].([]any)
	first := items[0].(map[string]any)["file_url"].(string)
	assertVerifies(t, signer, first)
	deep := items[1].(map[string]any)["nested"].(map[string]any)["deep"].(string)
	assertVerifies(t, signer, deep)
}

func TestSignUploadLinksLeavesJSONWithoutUploadsByteForByte(t *testing.T) {
	signer := newLinkSigner(t)
	value := gin.H{"name": "Ada", "tags": []string{"x", "y"}, "html": "<b>&</b>"}
	want, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	rec := serveWithLinks(t, signer, func(c *gin.Context) { c.JSON(http.StatusOK, value) })
	if rec.Body.String() != string(want) {
		t.Errorf("body changed:\n got %s\nwant %s", rec.Body.String(), want)
	}
}

func TestSignUploadLinksKeepsStatusAndFixesContentLength(t *testing.T) {
	signer := newLinkSigner(t)
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.Header("Content-Length", "1")
		c.JSON(http.StatusCreated, gin.H{"avatar_url": "/uploads/profile-photos/a.png"})
	})
	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d, want 201", rec.Code)
	}
	if got := rec.Header().Get("Content-Length"); got != strconv.Itoa(rec.Body.Len()) {
		t.Errorf("Content-Length = %s, body is %d bytes", got, rec.Body.Len())
	}
}

func TestSignUploadLinksSignsErrorBodies(t *testing.T) {
	signer := newLinkSigner(t)
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "missing", "file": "/uploads/documents/gone.pdf"})
	})
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	assertVerifies(t, signer, body["file"])
}

func TestSignUploadLinksAcceptsEscapedSlashes(t *testing.T) {
	signer := newLinkSigner(t)
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json", []byte(`{"a":"\/uploads\/x.png"}`))
	})
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(body["a"], "/uploads/x.png?exp=") {
		t.Errorf("escaped slash value not signed: %q", body["a"])
	}
}

func TestSignUploadLinksPassesNonJSONThroughUnchanged(t *testing.T) {
	signer := newLinkSigner(t)
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.String(http.StatusOK, "/uploads/x.png")
	})
	if rec.Body.String() != "/uploads/x.png" {
		t.Errorf("plain text body changed: %q", rec.Body.String())
	}
}

func TestSignUploadLinksStreamsNonJSONAsItGoes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SignUploadLinks(newLinkSigner(t)))
	rec := httptest.NewRecorder()
	seenBeforeReturn := -1
	r.GET("/x", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Writer.Write([]byte("data: hello\n\n"))
		c.Writer.Flush()
		seenBeforeReturn = rec.Body.Len()
		c.Writer.Write([]byte("data: again\n\n"))
	})
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))

	if seenBeforeReturn == 0 {
		t.Error("event stream was buffered until the handler returned")
	}
	if !strings.Contains(rec.Body.String(), "data: again") {
		t.Errorf("stream body incomplete: %q", rec.Body.String())
	}
}

func TestSignUploadLinksLeavesMalformedJSONAlone(t *testing.T) {
	signer := newLinkSigner(t)
	raw := `{"a":"/uploads/x.png"`
	rec := serveWithLinks(t, signer, func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json", []byte(raw))
	})
	if rec.Body.String() != raw {
		t.Errorf("malformed body changed: %q", rec.Body.String())
	}
}
