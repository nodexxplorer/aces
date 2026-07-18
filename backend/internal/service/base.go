package service

import (
	"context"
	"fmt"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/jackc/pgx/v5"
)

type BaseService struct {
	store db.Querier
	pool  DBPool
}

type DBPool interface {
	BeginTx(ctx context.Context, opts *pgx.TxOptions) (pgx.Tx, error)
}

func NewBaseService(store db.Querier, pool DBPool) *BaseService {
	return &BaseService{store: store, pool: pool}
}

func (s *BaseService) WithTx(ctx context.Context, fn func(q *db.Queries) error) error {
	if s.pool == nil {
		return fn(s.store.(*db.Queries))
	}

	tx, err := s.pool.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	q := db.New(tx).WithTx(tx)

	if err := fn(q); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return fmt.Errorf("rollback failed: %v (original error: %w)", rbErr, err)
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
