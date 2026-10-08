package middleware

import (
	"context"
	"errors"
	"net/http"

	"github.com/aces/backend/internal/auth"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TenantResolver looks a tenant up by ID.
type TenantResolver interface {
	ByID(ctx context.Context, id uuid.UUID) (tenant.Tenant, error)
}

// TenantScope binds the request to the department named in the caller's
// access token. It must run after JWTAuth. A token without a tenant claim was
// issued before multi-tenancy and belongs to the legacy tenant, which owns all
// data created before departments existed.
func TenantScope(resolver TenantResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := claimsFrom(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		id, ok := tenant.ClaimID(claims.TenantID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		t, err := resolver.ByID(c.Request.Context(), id)
		if errors.Is(err, tenant.ErrNotFound) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if !t.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "this department is not active"})
			return
		}

		c.Request = c.Request.WithContext(tenant.With(c.Request.Context(), t))
		c.Next()
	}
}

func claimsFrom(c *gin.Context) (*auth.Claims, bool) {
	v, ok := c.Get("claims")
	if !ok {
		return nil, false
	}
	claims, ok := v.(*auth.Claims)
	return claims, ok && claims != nil
}
