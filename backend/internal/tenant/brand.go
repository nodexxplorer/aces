package tenant

import (
	"context"
	"net/url"
	"strings"
)

// PlatformName is the platform's name. It appears only where the output is
// shared by every department: the mobile app, the help center, the sender of
// mail that names no department, and output with no department bound.
const PlatformName = "Admin Pack"

// Brand is how a department names itself in what it sends out: emails,
// receipts, PDFs, calendar feeds and the assistant.
type Brand struct {
	// Slug is the department's URL name. It is empty for the platform brand.
	Slug         string
	Name         string
	Institution  string
	ContactEmail string
	HasLogo      bool
}

// PlatformBrand is the brand for output that no single department owns.
func PlatformBrand() Brand {
	return Brand{Name: PlatformName}
}

// BrandOf returns the brand of a department. A department with no name gets
// the platform brand, so output never goes out with a blank name.
func BrandOf(t Tenant) Brand {
	name := strings.TrimSpace(t.Name)
	if name == "" {
		return PlatformBrand()
	}
	return Brand{
		Slug:         t.Slug,
		Name:         name,
		Institution:  strings.TrimSpace(t.Institution),
		ContactEmail: strings.TrimSpace(t.ContactEmail),
		HasLogo:      t.LogoType != "",
	}
}

// BrandFrom returns the brand of the department bound to ctx, or the platform
// brand when no department is bound.
func BrandFrom(ctx context.Context) Brand {
	if t, ok := From(ctx); ok {
		return BrandOf(t)
	}
	return PlatformBrand()
}

// LogoURL returns the absolute URL of a department's logo as served by the API
// at apiBase, or "" when the department has no logo. Emails link to it, so it
// must be reachable from outside the platform.
func LogoURL(apiBase string, b Brand) string {
	if !b.HasLogo || b.Slug == "" || apiBase == "" {
		return ""
	}
	return strings.TrimRight(apiBase, "/") + "/api/v1/tenants/" + url.PathEscape(b.Slug) + "/logo"
}

// departmentPrefix is how a department's full name starts.
const departmentPrefix = "department of"

// ShortName is a department's name without its "Department of" prefix, for
// example "Computer Engineering". Other names come back trimmed and unchanged.
func ShortName(name string) string {
	name = strings.TrimSpace(name)
	if len(name) >= len(departmentPrefix) && strings.EqualFold(name[:len(departmentPrefix)], departmentPrefix) {
		name = strings.TrimSpace(name[len(departmentPrefix):])
	}
	return name
}
