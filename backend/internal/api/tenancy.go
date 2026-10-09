package api

import (
	"context"
	"errors"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aces/backend/internal/auth"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// tenantResponse describes the department in auth responses, so clients can
// show it and remember which one to sign in to.
type tenantResponse struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Institution string `json:"institution,omitempty"`
	Faculty     string `json:"faculty,omitempty"`
	MatricCode  string `json:"matricCode,omitempty"`
	Description string `json:"description,omitempty"`
	LogoURL     string `json:"logoUrl,omitempty"`
	// AccentColor is the department's accent as #rrggbb, when its logo gives
	// one. Clients use it in place of the platform colour.
	AccentColor string `json:"accentColor,omitempty"`
	// URLCode is the department's short name in web addresses (/co, /co/admin).
	URLCode string `json:"urlCode,omitempty"`
	// ContactEmail is the department's contact address, when it has one. It is
	// for the signed-in user (the approval page links to it), so it appears
	// here and not in the public list.
	ContactEmail string `json:"contactEmail,omitempty"`
	// ApprovalContactEmail is where the approval page sends the student: the
	// department's approval address, or its contact address when it has none.
	ApprovalContactEmail string `json:"approvalContactEmail,omitempty"`
}

func toTenantResponse(t tenant.Tenant) *tenantResponse {
	return &tenantResponse{
		Slug:                 t.Slug,
		Name:                 t.Name,
		Institution:          t.Institution,
		Faculty:              t.Faculty,
		MatricCode:           t.MatricCode,
		Description:          t.Description,
		LogoURL:              logoURL(t),
		AccentColor:          t.AccentColor,
		URLCode:              t.URLCode,
		ContactEmail:         t.ContactEmail,
		ApprovalContactEmail: approvalContactEmail(t),
	}
}

// approvalContactEmail is the address the approval page links to: the approval
// address when the department set one, otherwise its contact address.
func approvalContactEmail(t tenant.Tenant) string {
	if t.ApprovalEmail != "" {
		return t.ApprovalEmail
	}
	return t.ContactEmail
}

// logoURL is the API path of a department's logo, or empty when it has none.
// It is a path, not a full URL: clients add the API's base address.
func logoURL(t tenant.Tenant) string {
	if t.LogoType == "" {
		return ""
	}
	return "/api/v1/tenants/" + t.Slug + "/logo"
}

// tenantListItem is one department in the public list. It carries only what
// a sign-in page needs to show, never account data or identifiers.
type tenantListItem struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Institution string `json:"institution,omitempty"`
	Faculty     string `json:"faculty,omitempty"`
	// MatricCode is the department part of its matric numbers (EG/EE for
	// 20/EG/EE/1234). It is not sensitive: every matric number contains it.
	// Sign-up and onboarding forms use it to show the expected format.
	MatricCode string `json:"matricCode,omitempty"`
	// Description and LogoURL are the department's branding.
	Description string `json:"description,omitempty"`
	LogoURL     string `json:"logoUrl,omitempty"`
	// AccentColor is the department's accent, when its logo gives one.
	AccentColor string `json:"accentColor,omitempty"`
	// URLCode is the department's short name in web addresses: /co is its
	// sign-in page and /co/admin its admin sign-in page. Absent until it is set.
	URLCode string `json:"urlCode,omitempty"`
	// Default marks the department used when a request names none (mobile
	// clients, and sign-in forms before a choice is made).
	Default bool `json:"default,omitempty"`
}

// listTenants returns the active departments, sorted by name, so sign-in and
// sign-up pages can offer a choice. It is public: it exposes no account data.
func (server *Server) listTenants(ctx *gin.Context) {
	active, err := server.tenants.Active(ctx.Request.Context())
	if err != nil {
		log.Printf("[tenant] list departments: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	out := make([]tenantListItem, 0, len(active))
	for _, t := range active {
		out = append(out, tenantListItem{
			Slug:        t.Slug,
			Name:        t.Name,
			Institution: t.Institution,
			Faculty:     t.Faculty,
			MatricCode:  t.MatricCode,
			Description: t.Description,
			LogoURL:     logoURL(t),
			AccentColor: t.AccentColor,
			URLCode:     t.URLCode,
			Default:     t.Slug == server.tenants.DefaultSlug(),
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	ctx.JSON(http.StatusOK, out)
}

// bindTenant binds the request to the department named by slug. An empty slug
// means the default department, which mobile clients rely on. On failure it
// writes the error response and returns false.
func (server *Server) bindTenant(ctx *gin.Context, slug string) bool {
	bound, err := server.bindTenantSlug(ctx.Request.Context(), slug)
	switch {
	case errors.Is(err, tenant.ErrNotFound):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "unknown department"})
		return false
	case errors.Is(err, tenant.ErrInactive):
		ctx.JSON(http.StatusForbidden, gin.H{"error": "this department is not active"})
		return false
	case err != nil:
		log.Printf("[tenant] resolve %q: %v", slug, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return false
	}
	ctx.Request = ctx.Request.WithContext(bound)
	return true
}

// bindTenantSlug returns ctx bound to the active department named by slug (the
// default department when slug is empty). It writes nothing, so redirecting
// callers can use it too. It returns tenant.ErrNotFound or tenant.ErrInactive
// when the department cannot be used.
func (server *Server) bindTenantSlug(ctx context.Context, slug string) (context.Context, error) {
	t, err := server.tenants.Resolve(ctx, slug)
	if err != nil {
		return nil, err
	}
	if !t.IsActive {
		return nil, tenant.ErrInactive
	}
	return tenant.With(ctx, t), nil
}

// bindTenantByCalendarToken binds the department that owns a calendar feed
// token. Feed URLs carry no tenant, so the token itself is the lookup key.
// It returns false when no department owns the token.
func (server *Server) bindTenantByCalendarToken(ctx *gin.Context, token string) bool {
	return server.bindTenantByLookup(ctx, lookupTenantForCalendarToken, token)
}

// bindTenantByUnsubscribeToken binds the department that owns an email
// unsubscribe token.
func (server *Server) bindTenantByUnsubscribeToken(ctx *gin.Context, token string) bool {
	return server.bindTenantByLookup(ctx, lookupTenantForUnsubscribeToken, token)
}

// bindTenantByPaystackReference binds the department that owns a Paystack
// payment or donation reference.
func (server *Server) bindTenantByPaystackReference(ctx *gin.Context, reference string) bool {
	return server.bindTenantByLookup(ctx, lookupTenantForPaystackReference, reference)
}

// The lookup functions are SECURITY DEFINER SQL functions (migration 000004).
// They return only the owning tenant ID and are the single cross-tenant read
// the server performs before a tenant is known.
const (
	lookupTenantForCalendarToken     = `SELECT tenant_for_calendar_token($1)`
	lookupTenantForUnsubscribeToken  = `SELECT tenant_for_unsubscribe_token($1)`
	lookupTenantForPaystackReference = `SELECT tenant_for_paystack_reference($1)`
)

func (server *Server) bindTenantByLookup(ctx *gin.Context, query, key string) bool {
	if key == "" {
		return false
	}
	reqCtx := ctx.Request.Context()

	var id *uuid.UUID
	if err := server.dbPool.QueryRow(reqCtx, query, key).Scan(&id); err != nil {
		log.Printf("[tenant] token lookup failed: %v", err)
		return false
	}
	if id == nil {
		return false
	}

	bound, err := server.tenants.Bind(reqCtx, *id)
	if err != nil {
		return false
	}
	ctx.Request = ctx.Request.WithContext(bound)
	return true
}

// bindTenantFromClaims binds the department named by a verified token. Used
// where a token (rather than a login form) names the account, such as a
// refresh.
func (server *Server) bindTenantFromClaims(ctx *gin.Context, claims *auth.Claims) bool {
	id, ok := tenant.ClaimID(claims.TenantID)
	if !ok {
		return false
	}
	bound, err := server.tenants.Bind(ctx.Request.Context(), id)
	if err != nil {
		return false
	}
	ctx.Request = ctx.Request.WithContext(bound)
	return true
}

// socketContext returns the context for work started by a WebSocket message.
// It is bound to the sender's department and bounded by a timeout.
func (server *Server) socketContext(tenantID uuid.UUID) (context.Context, context.CancelFunc, error) {
	base, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	ctx, err := server.tenants.Bind(base, tenantID)
	if err != nil {
		cancel()
		return nil, nil, err
	}
	return ctx, cancel, nil
}

// forEachActiveTenant runs job once for each active department, with ctx bound
// to that department. A department whose run fails is logged by the job and
// does not stop the others.
func (server *Server) forEachActiveTenant(ctx context.Context, name string, job func(context.Context)) {
	tenants, err := server.tenants.Active(ctx)
	if err != nil {
		log.Printf("[%s] list departments: %v", name, err)
		return
	}
	for _, t := range tenants {
		if ctx.Err() != nil {
			return
		}
		job(tenant.With(ctx, t))
	}
}

// tenantIDOf returns the ID of the department bound to the request. Handlers
// behind the tenant middleware always have one; uuid.Nil never names a
// department, so anything keyed on it fails closed.
func tenantIDOf(ctx *gin.Context) uuid.UUID {
	id, _ := tenant.IDFrom(ctx.Request.Context())
	return id
}

// tenantLogo serves a department's logo. It is public, because the sign-in page
// shows the logo before anyone has signed in. A missing, inactive, or logo-less
// department gets 404.
func (server *Server) tenantLogo(ctx *gin.Context) {
	contentType, data, err := server.tenants.Logo(ctx.Request.Context(), ctx.Param("slug"))
	if errors.Is(err, tenant.ErrNotFound) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no logo for this department"})
		return
	}
	if err != nil {
		log.Printf("[tenant] logo %q: %v", ctx.Param("slug"), err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h := ctx.Writer.Header()
	h.Set("Cache-Control", "public, max-age=300")
	h.Set("X-Content-Type-Options", "nosniff")
	// The bytes are an image and nothing else: no scripts, no embedded content.
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	ctx.Data(http.StatusOK, contentType, data)
}

// lecturerDepartment is the department a lecturer's sign-up is filed under: the
// name the form sent, or the department's own name when it sent none. A
// lecturer is never filed under another department's name by default.
func lecturerDepartment(ctx *gin.Context, sent string) string {
	if d := strings.TrimSpace(sent); d != "" {
		return d
	}
	if t, ok := tenant.From(ctx.Request.Context()); ok {
		return tenant.ShortName(t.Name)
	}
	return ""
}
