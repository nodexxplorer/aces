package tenant

import (
	"context"
	"testing"
)

func TestBrandOfDepartment(t *testing.T) {
	b := BrandOf(Tenant{Slug: "dept-ee", Name: "  Department of Electrical Engineering ", Institution: "University of Uyo", ContactEmail: "ee@example.edu", LogoType: "image/png"})
	if b.Name != "Department of Electrical Engineering" || b.Slug != "dept-ee" || b.Institution != "University of Uyo" || b.ContactEmail != "ee@example.edu" || !b.HasLogo {
		t.Fatalf("unexpected brand: %+v", b)
	}
}

func TestBrandOfNamelessDepartmentIsPlatform(t *testing.T) {
	if b := BrandOf(Tenant{Slug: "x", Name: "  "}); b != PlatformBrand() {
		t.Fatalf("a department with no name must fall back to the platform brand, got %+v", b)
	}
}

func TestBrandFromWithoutTenantIsPlatform(t *testing.T) {
	if b := BrandFrom(context.Background()); b.Name != PlatformName || b.HasLogo {
		t.Fatalf("no bound tenant must give the platform brand, got %+v", b)
	}
}

func TestBrandFromBoundTenant(t *testing.T) {
	ctx := With(context.Background(), Tenant{Slug: "dept-ce", Name: "Department of Chemical Engineering"})
	if b := BrandFrom(ctx); b.Name != "Department of Chemical Engineering" || b.Slug != "dept-ce" {
		t.Fatalf("got %+v", b)
	}
}

func TestLogoURL(t *testing.T) {
	with := Brand{Slug: "dept-ee", Name: "EE", HasLogo: true}
	if got := LogoURL("https://api.example.edu/", with); got != "https://api.example.edu/api/v1/tenants/dept-ee/logo" {
		t.Fatalf("got %q", got)
	}
	if got := LogoURL("https://api.example.edu", Brand{Slug: "dept-ee", Name: "EE"}); got != "" {
		t.Fatalf("no logo must give no URL, got %q", got)
	}
	if got := LogoURL("", with); got != "" {
		t.Fatalf("no API base must give no URL, got %q", got)
	}
	if got := LogoURL("https://api.example.edu", PlatformBrand()); got != "" {
		t.Fatalf("the platform brand has no logo URL, got %q", got)
	}
}
