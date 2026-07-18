package middleware

import (
	"net/http"
	"strings"

	"github.com/aces/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

func JWTAuth(tm *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := ""

		if cookie, err := c.Cookie("aces_access_token"); err == nil && cookie != "" {
			token = cookie
		}

		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
					token = parts[1]
				}
			}
		}

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization token"})
			return
		}

		claims, err := tm.Verify(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("email", claims.Email)
		c.Set("claims", claims)

		c.Next()
	}
}
