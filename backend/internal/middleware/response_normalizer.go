package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
)

type normalizerResponseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *normalizerResponseWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func ResponseNormalizer() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/health") {
			c.Next()
			return
		}

		normalizer := &normalizerResponseWriter{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = normalizer

		c.Next()

		status := c.Writer.Status()
		bodyBytes := normalizer.body.Bytes()

		// For error responses (status >= 400) with a JSON body containing "error",
		// inject the requestId if not already present.
		if status >= 400 && len(bodyBytes) > 0 {
			var body map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &body); err == nil {
				if _, hasError := body["error"]; hasError {
					if _, hasReqID := body["requestId"]; !hasReqID {
						if reqID := GetRequestID(c); reqID != "" {
							body["requestId"] = reqID
						}
						normalized, err := json.Marshal(body)
						if err == nil {
							bodyBytes = normalized
						}
					}
				}
			}
		}

		// Always flush the buffered body to the real ResponseWriter
		if len(bodyBytes) > 0 {
			normalizer.ResponseWriter.WriteHeader(status)
			io.Copy(normalizer.ResponseWriter, bytes.NewReader(bodyBytes))
		}
	}
}
