package tenant

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrNotFound means no tenant has the requested slug or ID.
	ErrNotFound = errors.New("tenant not found")
	// ErrInactive means the tenant exists but has been deactivated.
	ErrInactive = errors.New("tenant is inactive")
	// ErrUnsafeRole means the database role would bypass row-level security.
	ErrUnsafeRole = errors.New("database role bypasses row-level security")
)

// Options configures a Manager.
type Options struct {
	// DefaultSlug names the tenant used when a request does not name one.
	// Mobile clients rely on this, so it must always resolve.
	DefaultSlug string
	// RuntimeRole, if set, is assumed with SET ROLE on every connection. Use
	// it when the DSN connects as a privileged user (for example in tests)
	// but queries must run as the restricted application role.
	RuntimeRole string
	// MaxConnsPerTenant caps each tenant's pool. Default 4.
	MaxConnsPerTenant int32
	// MaxConnsSystem caps the pool used for requests with no tenant bound.
	// Default 4.
	MaxConnsSystem int32
	// CacheTTL bounds how long a tenant looked up by ID is trusted. Default 1m.
	CacheTTL time.Duration
}

// Manager owns the connection pools and the tenant registry.
type Manager struct {
	dsn    string
	opts   Options
	system *pgxpool.Pool

	mu    sync.Mutex
	pools map[uuid.UUID]*pgxpool.Pool

	cacheMu sync.Mutex
	cache   map[uuid.UUID]cachedTenant
}

type cachedTenant struct {
	tenant  Tenant
	expires time.Time
}

// NewManager opens the system pool. It does not check the schema or the role;
// call CheckRuntimeRole for that.
func NewManager(ctx context.Context, dsn string, opts Options) (*Manager, error) {
	opts.DefaultSlug = normalizeSlug(opts.DefaultSlug)
	if opts.DefaultSlug == "" {
		return nil, errors.New("tenant: a default tenant slug is required")
	}
	if opts.MaxConnsPerTenant <= 0 {
		opts.MaxConnsPerTenant = 4
	}
	if opts.MaxConnsSystem <= 0 {
		opts.MaxConnsSystem = 4
	}
	if opts.CacheTTL <= 0 {
		opts.CacheTTL = time.Minute
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("tenant: parse database url: %w", err)
	}
	cfg.MaxConns = opts.MaxConnsSystem
	cfg.AfterConnect = roleHook(opts.RuntimeRole)

	system, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("tenant: open database pool: %w", err)
	}

	return &Manager{
		dsn:    dsn,
		opts:   opts,
		system: system,
		pools:  make(map[uuid.UUID]*pgxpool.Pool),
		cache:  make(map[uuid.UUID]cachedTenant),
	}, nil
}

// Close releases every pool.
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, p := range m.pools {
		p.Close()
		delete(m.pools, id)
	}
	m.system.Close()
}

// Ping checks connectivity through the system pool.
func (m *Manager) Ping(ctx context.Context) error {
	return m.system.Ping(ctx)
}

// DefaultSlug returns the slug of the tenant used when a request names none.
func (m *Manager) DefaultSlug() string {
	return m.opts.DefaultSlug
}

// Resolve returns the tenant with the given slug, or the default tenant when
// slug is empty. The result may be inactive; callers check IsActive.
func (m *Manager) Resolve(ctx context.Context, slug string) (Tenant, error) {
	slug = normalizeSlug(slug)
	if slug == "" {
		slug = m.opts.DefaultSlug
	}
	row := m.system.QueryRow(ctx, tenantSelect+" WHERE slug = $1", slug)
	t, err := scanTenant(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Tenant{}, ErrNotFound
	}
	return t, err
}

// ByID returns the tenant with the given ID. Results are cached for CacheTTL.
// The result may be inactive; callers check IsActive.
func (m *Manager) ByID(ctx context.Context, id uuid.UUID) (Tenant, error) {
	m.cacheMu.Lock()
	c, ok := m.cache[id]
	m.cacheMu.Unlock()
	if ok && time.Now().Before(c.expires) {
		return c.tenant, nil
	}

	t, err := scanTenant(m.system.QueryRow(ctx, tenantSelect+" WHERE id = $1", id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Tenant{}, ErrNotFound
	}
	if err != nil {
		return Tenant{}, err
	}

	m.cacheMu.Lock()
	m.cache[id] = cachedTenant{tenant: t, expires: time.Now().Add(m.opts.CacheTTL)}
	m.cacheMu.Unlock()
	return t, nil
}

// Active lists every active tenant, for background jobs that run per tenant.
func (m *Manager) Active(ctx context.Context) ([]Tenant, error) {
	rows, err := m.system.Query(ctx, tenantSelect+" WHERE is_active ORDER BY slug")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Tenant
	for rows.Next() {
		t, err := scanTenant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Logo returns the logo of the active department with the given slug, and its
// MIME type. It reports ErrNotFound when the department is missing, inactive,
// or has no logo, so a deactivated department's logo stops being served too.
func (m *Manager) Logo(ctx context.Context, slug string) (contentType string, data []byte, err error) {
	err = m.system.QueryRow(ctx,
		`SELECT logo_type, logo FROM tenants WHERE slug = $1 AND is_active AND logo IS NOT NULL`,
		normalizeSlug(slug),
	).Scan(&contentType, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, ErrNotFound
	}
	if err != nil {
		return "", nil, err
	}
	return contentType, data, nil
}

// Bind returns ctx bound to the active tenant with the given ID.
func (m *Manager) Bind(ctx context.Context, id uuid.UUID) (context.Context, error) {
	t, err := m.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !t.IsActive {
		return nil, ErrInactive
	}
	return With(ctx, t), nil
}

// CheckRuntimeRole verifies that the role the pools run as is subject to
// row-level security. A superuser, a BYPASSRLS role, or the owner of a tenant
// table sees every department's rows, so the server refuses to start as one
// of them unless allowUnsafe is set. It also checks that the tenant schema
// has been migrated.
func (m *Manager) CheckRuntimeRole(ctx context.Context, allowUnsafe bool) error {
	var migrated bool
	if err := m.system.QueryRow(ctx, `SELECT to_regclass('public.tenants') IS NOT NULL`).Scan(&migrated); err != nil {
		return fmt.Errorf("tenant: check schema: %w", err)
	}
	if !migrated {
		return errors.New("tenant: the tenants table is missing; run database migrations (000004_multi_tenancy)")
	}

	var role string
	var super, bypass bool
	err := m.system.QueryRow(ctx,
		`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
	).Scan(&role, &super, &bypass)
	if err != nil {
		return fmt.Errorf("tenant: read runtime role: %w", err)
	}

	var ownsTenantTables bool
	err = m.system.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
			WHERE n.nspname = 'public' AND c.relkind = 'r' AND pg_has_role(c.relowner, 'USAGE')
		)`).Scan(&ownsTenantTables)
	if err != nil {
		return fmt.Errorf("tenant: check table ownership: %w", err)
	}

	var problems []string
	if super {
		problems = append(problems, "is a superuser")
	}
	if bypass {
		problems = append(problems, "has BYPASSRLS")
	}
	if ownsTenantTables {
		problems = append(problems, "owns tenant tables")
	}
	if len(problems) == 0 {
		return nil
	}

	msg := fmt.Sprintf("database role %q %s", role, strings.Join(problems, " and "))
	if allowUnsafe {
		log.Printf("[tenant] WARNING: %s, so row-level security is not enforced (DB_ALLOW_RLS_BYPASS is set)", msg)
		return nil
	}
	return fmt.Errorf("%w: %s; connect as a restricted role (see docs/multi-tenancy.md)", ErrUnsafeRole, msg)
}

// poolFor returns the pool whose connections are bound to tenant id.
func (m *Manager) poolFor(id uuid.UUID) (*pgxpool.Pool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if p, ok := m.pools[id]; ok {
		return p, nil
	}

	cfg, err := pgxpool.ParseConfig(m.dsn)
	if err != nil {
		return nil, fmt.Errorf("tenant: parse database url: %w", err)
	}
	cfg.MaxConns = m.opts.MaxConnsPerTenant
	role := roleHook(m.opts.RuntimeRole)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		// Bind once, when the physical connection opens. The value is never
		// changed afterwards, so this connection only ever serves this tenant.
		if _, err := conn.Exec(ctx, "SELECT set_config('app.tenant_id', $1, false)", id.String()); err != nil {
			return fmt.Errorf("tenant: bind connection: %w", err)
		}
		if role != nil {
			return role(ctx, conn)
		}
		return nil
	}

	p, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		return nil, fmt.Errorf("tenant: open pool for tenant %s: %w", id, err)
	}
	m.pools[id] = p
	return p, nil
}

func roleHook(role string) func(context.Context, *pgx.Conn) error {
	if role == "" {
		return nil
	}
	return func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET ROLE "+pgx.Identifier{role}.Sanitize())
		return err
	}
}

const tenantSelect = `SELECT id, slug, name, COALESCE(institution, ''), COALESCE(faculty, ''), COALESCE(matric_code, ''), COALESCE(description, ''), COALESCE(logo_type, ''), COALESCE(contact_email, ''), COALESCE(approval_email, ''), is_active FROM tenants`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTenant(row rowScanner) (Tenant, error) {
	var t Tenant
	err := row.Scan(&t.ID, &t.Slug, &t.Name, &t.Institution, &t.Faculty, &t.MatricCode, &t.Description, &t.LogoType, &t.ContactEmail, &t.ApprovalEmail, &t.IsActive)
	return t, err
}

func normalizeSlug(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
