package middleware

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"strings"

	"github.com/aces/backend/internal/uploads"
	"github.com/gin-gonic/gin"
)

// SignUploadLinks turns every upload reference in a JSON response into a
// signed link.
//
// Handlers return stored upload paths ("/uploads/...") from many different
// shapes: avatars on user-like rows, attachments, receipts, and so on. Signing
// each one at its source would mean touching every query that carries one, so
// this middleware does it once. A JSON response is buffered, and each string
// value that starts with "/uploads/" is replaced by a freshly signed link.
// Responses that are not JSON stream through untouched, so file downloads and
// event streams behave as before.
func SignUploadLinks(signer *uploads.Signer) gin.HandlerFunc {
	return func(c *gin.Context) {
		w := &uploadLinkWriter{ResponseWriter: c.Writer, signer: signer}
		c.Writer = w
		c.Next()
		w.finish()
		c.Writer = w.ResponseWriter
	}
}

type uploadLinkWriter struct {
	gin.ResponseWriter
	signer    *uploads.Signer
	decided   bool
	buffering bool
	body      bytes.Buffer
}

// decide fixes, once per response, whether the body is buffered. The first
// write or header flush is the point at which the handler's Content-Type is
// settled.
func (w *uploadLinkWriter) decide() {
	if w.decided {
		return
	}
	w.decided = true
	w.buffering = strings.HasPrefix(w.Header().Get("Content-Type"), "application/json")
}

func (w *uploadLinkWriter) Write(b []byte) (int, error) {
	w.decide()
	if w.buffering {
		return w.body.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *uploadLinkWriter) WriteString(s string) (int, error) {
	w.decide()
	if w.buffering {
		return w.body.WriteString(s)
	}
	return w.ResponseWriter.WriteString(s)
}

func (w *uploadLinkWriter) WriteHeaderNow() {
	w.decide()
	if !w.buffering {
		w.ResponseWriter.WriteHeaderNow()
	}
}

func (w *uploadLinkWriter) Flush() {
	w.decide()
	if !w.buffering {
		w.ResponseWriter.Flush()
	}
}

// finish writes the buffered JSON, signed, to the underlying writer. The status
// code was already passed through by WriteHeader, so it is not set again here.
func (w *uploadLinkWriter) finish() {
	if !w.buffering {
		return
	}
	body := signUploadLinksJSON(w.body.Bytes(), w.signer)
	if w.Header().Get("Content-Length") != "" {
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	}
	w.ResponseWriter.Write(body)
}

// signUploadLinksJSON returns body with every "/uploads/" string value signed.
// If nothing needs signing, or the body is not one JSON document, the original
// bytes are returned unchanged.
func signUploadLinksJSON(body []byte, signer *uploads.Signer) []byte {
	// The word alone, not the full prefix: a JSON encoder may escape the slashes.
	if !bytes.Contains(body, []byte("uploads")) {
		return body
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	var doc any
	if err := dec.Decode(&doc); err != nil {
		return body
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return body
	}
	signed, changed := signLinkValues(doc, signer)
	if !changed {
		return body
	}
	out, err := json.Marshal(signed)
	if err != nil {
		return body
	}
	return out
}

func signLinkValues(v any, signer *uploads.Signer) (any, bool) {
	switch t := v.(type) {
	case string:
		if signed := signer.SignRef(t); signed != t {
			return signed, true
		}
	case []any:
		changed := false
		for i, item := range t {
			if next, ok := signLinkValues(item, signer); ok {
				t[i] = next
				changed = true
			}
		}
		return t, changed
	case map[string]any:
		changed := false
		for k, item := range t {
			if next, ok := signLinkValues(item, signer); ok {
				t[k] = next
				changed = true
			}
		}
		return t, changed
	}
	return v, false
}
