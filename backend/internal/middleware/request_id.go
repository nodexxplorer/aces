package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-ID"
const RequestIDKey = "requestID"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.New().String()
		}

		c.Set(RequestIDKey, id)
		c.Header(RequestIDHeader, id)

		c.Next()
	}
}

func GetRequestID(c *gin.Context) string {
	if val, exists := c.Get(RequestIDKey); exists {
		if id, ok := val.(string); ok {
			return id
		}
	}
	return ""
}
