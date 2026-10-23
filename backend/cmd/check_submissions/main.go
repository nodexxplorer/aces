package main

import (
	"context"
	"fmt"
	"log"

	"github.com/aces/backend/internal/config"
	"github.com/aces/backend/internal/tenant"
	db "github.com/aces/backend/internal/db/sql"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	tenants, err := tenant.NewManager(ctx, cfg.DBSource, tenant.Options{
		DefaultSlug:       cfg.DefaultTenantSlug,
		MaxConnsPerTenant: cfg.DBMaxConnsPerTenant,
		MaxConnsSystem:    cfg.DBMaxConnsSystem,
	})
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer tenants.Close()

	// Resolve default tenant
	t, err := tenants.Resolve(ctx, cfg.DefaultTenantSlug)
	if err != nil {
		log.Fatalf("cannot resolve tenant: %v", err)
	}
	tenantCtx := tenant.With(ctx, t)

	queries := db.New(tenants.DB())

	subs, err := queries.ListAllCRFSubmissions(tenantCtx)
	if err != nil {
		log.Fatalf("ListAllCRFSubmissions error: %v", err)
	}

	fmt.Printf("Total CRF Submissions found: %d\n", len(subs))
	for _, s := range subs {
		fmt.Printf("ID: %s, UserID: %s, Student: %s, Matric: %s, Level: %d, Status: %s, Semester: %s, Session: %s, SignedPath: %s\n",
			s.ID, s.UserID, s.StudentName, s.MatricNumber, s.Level, s.Status, s.SemesterName, s.SessionName, s.SignedFilePath)
	}
}
