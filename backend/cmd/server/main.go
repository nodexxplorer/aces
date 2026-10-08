package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aces/backend/internal/api"
	"github.com/aces/backend/internal/config"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/tenant"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	log.Println("Connecting to database...")
	tenants, err := tenant.NewManager(ctx, cfg.DBSource, tenant.Options{
		DefaultSlug:       cfg.DefaultTenantSlug,
		MaxConnsPerTenant: cfg.DBMaxConnsPerTenant,
	})
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer tenants.Close()

	if err := tenants.Ping(ctx); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	// Refuse to run as a role that would bypass row-level security: that
	// would let every department read every other department's data.
	if err := tenants.CheckRuntimeRole(ctx, cfg.DBAllowRLSBypass); err != nil {
		log.Fatalf("database role check failed: %v", err)
	}
	// Mobile clients send no department, so the default one must exist.
	if _, err := tenants.Resolve(ctx, ""); err != nil {
		log.Fatalf("default department %q is not usable (create it with cmd/tenant): %v", cfg.DefaultTenantSlug, err)
	}
	log.Println("Database connection established")

	store := db.New(tenants.DB())

	// Seed help articles on first run. They are global, not per department.
	go func() {
		seedCtx, seedCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer seedCancel()
		if err := api.SeedHelpArticles(seedCtx, store); err != nil {
			log.Printf("[startup] help seeding: %v", err)
		}
	}()

	server := api.NewServer(store, tenants, cfg)

	go server.RunBirthdayScheduler(ctx)
	go server.RunStudyTaskReminderScheduler(ctx)

	srv := &http.Server{
		Addr:         cfg.ServerAddress,
		Handler:      server.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Starting HTTP server on %s", cfg.ServerAddress)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("cannot start server: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("server forced shutdown: %v", err)
	}

	log.Println("Server stopped")
}
