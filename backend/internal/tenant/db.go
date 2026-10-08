package tenant

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB routes each database call to the pool of the tenant bound to the call's
// context. It satisfies the DBTX interface that sqlc generates, so callers keep
// using db.New(...) and the generated query methods unchanged. A context with
// no tenant goes to the system pool, where RLS hides all tenant rows.
type DB struct {
	m *Manager
}

// DB returns the tenant-routing database handle.
func (m *Manager) DB() *DB {
	return &DB{m: m}
}

func (d *DB) pool(ctx context.Context) (*pgxpool.Pool, error) {
	if id, ok := IDFrom(ctx); ok {
		return d.m.poolFor(id)
	}
	return d.m.system, nil
}

// Exec runs a statement on the pool for ctx's tenant.
func (d *DB) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	p, err := d.pool(ctx)
	if err != nil {
		return pgconn.CommandTag{}, err
	}
	return p.Exec(ctx, sql, args...)
}

// Query runs a query on the pool for ctx's tenant.
func (d *DB) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	p, err := d.pool(ctx)
	if err != nil {
		return nil, err
	}
	return p.Query(ctx, sql, args...)
}

// QueryRow runs a single-row query on the pool for ctx's tenant.
func (d *DB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	p, err := d.pool(ctx)
	if err != nil {
		return errRow{err: err}
	}
	return p.QueryRow(ctx, sql, args...)
}

// Begin starts a transaction on the pool for ctx's tenant. Every statement in
// the transaction runs with that tenant bound.
func (d *DB) Begin(ctx context.Context) (pgx.Tx, error) {
	return d.BeginTx(ctx, nil)
}

// BeginTx starts a transaction on the pool for ctx's tenant.
func (d *DB) BeginTx(ctx context.Context, opts *pgx.TxOptions) (pgx.Tx, error) {
	p, err := d.pool(ctx)
	if err != nil {
		return nil, err
	}
	txOpts := pgx.TxOptions{}
	if opts != nil {
		txOpts = *opts
	}
	return p.BeginTx(ctx, txOpts)
}

// Ping checks connectivity through the system pool.
func (d *DB) Ping(ctx context.Context) error {
	return d.m.Ping(ctx)
}

type errRow struct{ err error }

func (r errRow) Scan(...any) error { return r.err }
