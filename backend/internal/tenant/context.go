// Package tenant implements department-level multi-tenancy on one shared
// Postgres database.
//
// Each department is a tenant. Tenant-owned tables carry a tenant_id and are
// protected by row-level security (RLS, see migration 000004). This package
// makes sure every database call runs on a connection bound to exactly one
// tenant:
//
//   - Each tenant has its own pool. Every connection in that pool sets
//     app.tenant_id once, when it is opened, and is never re-bound, so a
//     connection never serves two tenants.
//   - A caller selects the tenant by putting it in the context (With, or
//     Manager.Bind). DB routes each query to the pool for that context.
//   - A context with no tenant goes to a system pool with nothing bound. RLS
//     hides every tenant row from that pool and rejects tenant inserts, so a
//     code path that forgets to bind a tenant fails closed instead of
//     returning another department's data.
package tenant

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// LegacyID is the tenant that owns all data created before multi-tenancy.
// It must match the row inserted by migration 000004. Access tokens issued
// before tokens carried a tenant claim are bound to it.
var LegacyID = uuid.MustParse("00000000-0000-4000-8000-000000000001")

// Tenant is one department.
type Tenant struct {
	ID          uuid.UUID
	Slug        string
	Name        string
	Institution string
	Faculty     string
	// MatricCode is the department part of its matric numbers, such as EG/EE
	// for 20/EG/EE/1234. Empty means the department has no code yet, and it
	// then refuses matric-based sign-up and onboarding (see matric.go).
	MatricCode string
	IsActive   bool
}

type ctxKey struct{}

// With returns a copy of ctx bound to t.
func With(ctx context.Context, t Tenant) context.Context {
	return context.WithValue(ctx, ctxKey{}, t)
}

// From returns the tenant bound to ctx.
func From(ctx context.Context) (Tenant, bool) {
	t, ok := ctx.Value(ctxKey{}).(Tenant)
	return t, ok
}

// IDFrom returns the ID of the tenant bound to ctx.
func IDFrom(ctx context.Context) (uuid.UUID, bool) {
	t, ok := From(ctx)
	if !ok {
		return uuid.Nil, false
	}
	return t.ID, true
}

// Detach returns a context for background work that outlives the request
// that started it. It keeps the tenant binding but none of the request's
// cancellation, and applies timeout (no timeout if zero).
func Detach(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	base := context.Background()
	if t, ok := From(parent); ok {
		base = With(base, t)
	}
	if timeout > 0 {
		return context.WithTimeout(base, timeout)
	}
	return context.WithCancel(base)
}

// ClaimID returns the tenant named by a token's tenant claim. A token with no
// claim was issued before tenants existed, so it belongs to the legacy tenant.
// It reports false for a claim that is not a valid tenant ID.
func ClaimID(claim string) (uuid.UUID, bool) {
	if claim == "" {
		return LegacyID, true
	}
	id, err := uuid.Parse(claim)
	if err != nil || id == uuid.Nil {
		return uuid.Nil, false
	}
	return id, true
}
