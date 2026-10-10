package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeGemini serves one canned reply and records the request it got.
func fakeGemini(t *testing.T, status int, reply string) (*WallpaperService, *http.Request, *[]byte) {
	t.Helper()
	var got http.Request
	var body []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = *r
		body, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(srv.Close)
	svc := NewWallpaperService("test-key", "gemini-test-image")
	svc.baseURL = srv.URL
	return svc, &got, &body
}

func imageReply(mime string, data []byte) string {
	b, _ := json.Marshal(map[string]any{
		"candidates": []any{map[string]any{
			"content": map[string]any{"parts": []any{
				map[string]any{"text": "here you go"},
				map[string]any{"inlineData": map[string]any{"mimeType": mime, "data": base64.StdEncoding.EncodeToString(data)}},
			}},
		}},
	})
	return string(b)
}

func TestGenerateReturnsTheImageAndSendsTheFrame(t *testing.T) {
	png := []byte("\x89PNG-test-bytes")
	svc, req, body := fakeGemini(t, http.StatusOK, imageReply("image/png", png))

	out, err := svc.Generate(context.Background(), "  a river at dusk  ")
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if out.MimeType != "image/png" {
		t.Fatalf("mime = %q", out.MimeType)
	}
	if dec, _ := base64.StdEncoding.DecodeString(out.Data); string(dec) != string(png) {
		t.Fatalf("image bytes differ")
	}
	if req.URL.Path != "/v1beta/models/gemini-test-image:generateContent" {
		t.Fatalf("path = %s", req.URL.Path)
	}
	if req.Header.Get("x-goog-api-key") != "test-key" {
		t.Fatalf("key not sent in header")
	}
	if req.URL.RawQuery != "" {
		t.Fatalf("key must not be in the URL: %s", req.URL.RawQuery)
	}
	sent := string(*body)
	if !strings.Contains(sent, `"responseModalities":["TEXT","IMAGE"]`) {
		t.Fatalf("request does not ask for an image: %s", sent)
	}
	if !strings.Contains(sent, "a river at dusk") || strings.Contains(sent, "  a river") {
		t.Fatalf("prompt not framed and trimmed: %s", sent)
	}
}

func TestGenerateRefusesWithNoKey(t *testing.T) {
	svc := NewWallpaperService("", "gemini-test-image")
	if _, err := svc.Generate(context.Background(), "x"); !errors.Is(err, ErrWallpaperNotConfigured) {
		t.Fatalf("err = %v, want ErrWallpaperNotConfigured", err)
	}
}

func TestGenerateRejectsEmptyPrompt(t *testing.T) {
	svc, _, _ := fakeGemini(t, http.StatusOK, "{}")
	if _, err := svc.Generate(context.Background(), "   "); err == nil {
		t.Fatal("empty prompt accepted")
	}
}

func TestGenerateReportsUpstreamErrorsWithoutTheKey(t *testing.T) {
	svc, _, _ := fakeGemini(t, http.StatusTooManyRequests, `{"error":{"message":"quota exceeded"}}`)
	_, err := svc.Generate(context.Background(), "x")
	if err == nil || !strings.Contains(err.Error(), "quota exceeded") {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), "test-key") {
		t.Fatal("error leaks the key")
	}
}

func TestGenerateRejectsTheWrongTypeOrNoImage(t *testing.T) {
	svc, _, _ := fakeGemini(t, http.StatusOK, imageReply("image/gif", []byte("GIF89a")))
	if _, err := svc.Generate(context.Background(), "x"); err == nil || !strings.Contains(err.Error(), "image/gif") {
		t.Fatalf("gif accepted: %v", err)
	}

	svc2, _, _ := fakeGemini(t, http.StatusOK, `{"candidates":[{"content":{"parts":[{"text":"no picture"}]}}]}`)
	if _, err := svc2.Generate(context.Background(), "x"); err == nil {
		t.Fatal("reply without an image accepted")
	}
}

func TestCheckWallpaperLimitsSize(t *testing.T) {
	big := make([]byte, maxWallpaperBytes+1)
	if _, err := checkWallpaper("image/jpeg", base64.StdEncoding.EncodeToString(big)); err == nil {
		t.Fatal("oversized image accepted")
	}
	if _, err := checkWallpaper("image/jpeg", "%%%not-base64"); err == nil {
		t.Fatal("bad base64 accepted")
	}
}
