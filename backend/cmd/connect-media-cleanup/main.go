// Administrative maintenance only. Defaults to dry-run. Never use a runtime
// role: orphan detection needs visibility across every tenant.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aces/backend/internal/connectmedia"
	"github.com/jackc/pgx/v5"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
func run() error {
	root := flag.String("storage", os.Getenv("STORAGE_LOCAL_PATH"), "same storage root as API")
	apply := flag.Bool("apply", false, "delete expired pending/orphan media; otherwise dry-run")
	age := flag.Duration("age", 24*time.Hour, "minimum age (at least 24h)")
	flag.Parse()
	if *root == "" || *age < 24*time.Hour {
		return errors.New("set -storage and use -age >=24h")
	}
	ctx := context.Background()
	db, err := pgx.Connect(ctx, os.Getenv("DB_SOURCE"))
	if err != nil {
		return err
	}
	defer db.Close(ctx)
	var owner bool
	err = db.QueryRow(ctx, `SELECT (r.rolsuper OR r.rolbypassrls OR c.relowner=r.oid) FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='connect_media'::regclass`).Scan(&owner)
	if err != nil || !owner {
		return errors.New("cleanup requires an owner/BYPASSRLS DSN with visibility across all tenants")
	}
	cutoff := time.Now().Add(-*age)
	paths := map[string]bool{}
	rows, err := db.Query(ctx, `SELECT path FROM connect_media WHERE message_id IS NULL AND group_message_id IS NULL AND created_at<$1`, cutoff)
	if err != nil {
		return err
	}
	for rows.Next() {
		var path string
		if err = rows.Scan(&path); err != nil {
			rows.Close()
			return err
		}
		paths[path] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	private := filepath.Join(*root, ".connect-private")
	entries, err := os.ReadDir(private)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, entry := range entries {
		// Interrupted atomic writes are not DB-referenced and never served.
		if strings.HasPrefix(entry.Name(), ".processing-") {
			info, e := entry.Info()
			if e != nil {
				return e
			}
			if info.Mode().IsRegular() && info.ModTime().Before(cutoff) {
				fmt.Printf("abandoned temporary media: %s (apply=%t)\n", entry.Name(), *apply)
				if *apply {
					if e = os.Remove(filepath.Join(private, entry.Name())); e != nil && !os.IsNotExist(e) {
						return e
					}
				}
			}
			continue
		}
		if !connectmedia.SafeFilename(entry.Name()) {
			continue
		}
		info, e := entry.Info()
		if e != nil {
			return e
		}
		if info.Mode().IsRegular() && info.ModTime().Before(cutoff) {
			paths[entry.Name()] = true
		}
	}
	for path := range paths {
		if !connectmedia.SafeFilename(path) {
			return errors.New("unexpected stored media path")
		}
		tx, e := db.Begin(ctx)
		if e != nil {
			return e
		}
		var attached bool
		var created time.Time
		e = tx.QueryRow(ctx, `SELECT (message_id IS NOT NULL OR group_message_id IS NOT NULL),created_at FROM connect_media WHERE path=$1 FOR UPDATE`, path).Scan(&attached, &created)
		if e != nil && e != pgx.ErrNoRows {
			tx.Rollback(ctx)
			return e
		}
		if e == nil && (attached || !created.Before(cutoff)) {
			tx.Rollback(ctx)
			continue
		}
		fmt.Printf("expired unreferenced media: %s (apply=%t)\n", path, *apply)
		if !*apply {
			tx.Rollback(ctx)
			continue
		}
		if _, e = tx.Exec(ctx, `DELETE FROM connect_media WHERE path=$1 AND message_id IS NULL AND group_message_id IS NULL`, path); e != nil {
			tx.Rollback(ctx)
			return e
		}
		if e = tx.Commit(ctx); e != nil {
			return e
		}
		if e = os.Remove(filepath.Join(private, path)); e != nil && !os.IsNotExist(e) {
			return e
		}
	}
	if *apply {
		if _, err = db.Exec(ctx, `DELETE FROM connect_media_usage WHERE created_at<now()-interval '7 days'`); err != nil {
			return err
		}
		_, err = db.Exec(ctx, `DELETE FROM connect_recording_intents i WHERE expires_at<$1 AND NOT EXISTS(SELECT 1 FROM connect_media a WHERE a.tenant_id=i.tenant_id AND a.recording_intent=i.id)`, cutoff)
	}
	return err
}
