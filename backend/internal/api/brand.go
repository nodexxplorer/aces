package api

import (
	"context"

	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
)

// brandName is the name of the department bound to the request. Messages that
// speak for a department use it; platform-wide messages name the platform.
func brandName(ctx *gin.Context) string {
	return tenant.BrandFrom(ctx.Request.Context()).Name
}

// tenantDirectory gives services the tenant manager as a lookup. A nil manager
// (tests) gives a nil directory, so services fall back to the platform brand.
func tenantDirectory(m *tenant.Manager) service.TenantDirectory {
	if m == nil {
		return nil
	}
	return m
}

// departmentLogo returns the bytes of a department's logo, or nil when it has
// none or it cannot be read. A missing logo leaves the letterhead without one.
func (server *Server) departmentLogo(ctx context.Context, b tenant.Brand) []byte {
	if !b.HasLogo || b.Slug == "" || server.tenants == nil {
		return nil
	}
	_, data, err := server.tenants.Logo(ctx, b.Slug)
	if err != nil {
		return nil
	}
	return data
}
