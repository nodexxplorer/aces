package tenant

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestWithAndFrom(t *testing.T) {
	if _, ok := From(context.Background()); ok {
		t.Fatal("empty context must not carry a tenant")
	}
	want := Tenant{ID: uuid.New(), Slug: "dept-a", IsActive: true}
	ctx := With(context.Background(), want)

	got, ok := From(ctx)
	if !ok || got != want {
		t.Fatalf("From = %+v, %v; want %+v", got, ok, want)
	}
	if id, ok := IDFrom(ctx); !ok || id != want.ID {
		t.Fatalf("IDFrom = %v, %v; want %v", id, ok, want.ID)
	}
}

func TestDetachKeepsTenantButNotCancellation(t *testing.T) {
	want := Tenant{ID: uuid.New(), Slug: "dept-a", IsActive: true}
	parent, cancel := context.WithCancel(With(context.Background(), want))
	cancel()

	ctx, done := Detach(parent, time.Second)
	defer done()

	if ctx.Err() != nil {
		t.Fatalf("detached context inherited cancellation: %v", ctx.Err())
	}
	if got, ok := From(ctx); !ok || got.ID != want.ID {
		t.Fatalf("detached context lost the tenant: %+v, %v", got, ok)
	}
	if _, has := ctx.Deadline(); !has {
		t.Fatal("expected a deadline when a timeout is given")
	}
}

func TestDetachWithoutTenant(t *testing.T) {
	ctx, done := Detach(context.Background(), 0)
	defer done()
	if _, ok := From(ctx); ok {
		t.Fatal("detached context invented a tenant")
	}
	if _, has := ctx.Deadline(); has {
		t.Fatal("no timeout requested, but a deadline was set")
	}
}

func TestClaimID(t *testing.T) {
	// Tokens issued before tenants existed carry no claim: legacy tenant.
	if id, ok := ClaimID(""); !ok || id != LegacyID {
		t.Fatalf("empty claim = %v, %v; want legacy tenant", id, ok)
	}

	want := uuid.New()
	if id, ok := ClaimID(want.String()); !ok || id != want {
		t.Fatalf("valid claim = %v, %v; want %v", id, ok, want)
	}

	for _, bad := range []string{"not-a-uuid", "00000000-0000-0000-0000-000000000000"} {
		if _, ok := ClaimID(bad); ok {
			t.Fatalf("ClaimID(%q) accepted an invalid tenant", bad)
		}
	}
}

func TestNormalizeSlug(t *testing.T) {
	if got := normalizeSlug("  Uniport-EE "); got != "uniport-ee" {
		t.Fatalf("normalizeSlug = %q", got)
	}
}
