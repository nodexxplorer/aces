package api

import (
	"errors"
	"github.com/aces/backend/internal/connectmedia"
	"github.com/gin-gonic/gin"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestConnectMediaErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		err  error
		code int
	}{{connectmedia.ErrInvalid, 400}, {connectmedia.ErrForbidden, 403}, {connectmedia.ErrConflict, 409}, {connectmedia.ErrQuota, 429}, {connectmedia.ErrUnavailable, 503}, {errors.New("database password secret"), 500}} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		connectError(c, tc.err)
		if w.Code != tc.code {
			t.Fatal(w.Code, tc.code)
		}
		if strings.Contains(w.Body.String(), "password secret") {
			t.Fatal("internal error exposed")
		}
	}
}
func TestConnectUploadRejectsVideoAndInvalidMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := &Server{}
	r := gin.New()
	r.POST("/media", server.uploadConnectMedia)
	for _, body := range []string{"video payload", strings.Repeat("x", (9<<20)+1)} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/media", strings.NewReader(body))
		req.Header.Set("Content-Type", "multipart/form-data; boundary=broken")
		r.ServeHTTP(w, req)
		if w.Code != 400 {
			t.Fatal(w.Code)
		}
	}
}
func TestConnectUnknownContentAction(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := &Server{}
	r := gin.New()
	r.GET("/media/:id/:action", server.getConnectMedia)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/media/id/public", nil))
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
}
