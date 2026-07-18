package middleware

import (
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

var logger = log.New(os.Stdout, "", 0)

type LogEntry struct {
	Level     string        `json:"level"`
	Method    string        `json:"method"`
	Path      string        `json:"path"`
	Status    int           `json:"status"`
	Latency   string        `json:"latency"`
	ClientIP  string        `json:"client_ip"`
	RequestID string        `json:"request_id"`
	Errors    string        `json:"errors,omitempty"`
}

type responseWriter struct {
	gin.ResponseWriter
	statusCode int
}

func (w *responseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method
		requestID := GetRequestID(c)

		wrapped := &responseWriter{ResponseWriter: c.Writer, statusCode: 200}
		c.Writer = wrapped

		c.Next()

		latency := time.Since(start)
		status := wrapped.statusCode
		clientIP := c.ClientIP()
		errors := c.Errors.ByType(gin.ErrorTypePrivate).String()

		level := "info"
		if status >= 500 {
			level = "error"
		} else if status >= 400 {
			level = "warn"
		}

		entry := LogEntry{
			Level:     level,
			Method:    method,
			Path:      path,
			Status:    status,
			Latency:   latency.String(),
			ClientIP:  clientIP,
			RequestID: requestID,
			Errors:    errors,
		}

		data, _ := json.Marshal(entry)
		logger.Println(string(data))
	}
}
