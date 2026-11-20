package main

import (
	"context"
	"flag"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Exercise the actual command in an isolated test process (including flag parsing).
func TestCleanupProcess(t *testing.T) {
	if os.Getenv("ACES_CLEANUP_HELPER") != "1" {
		return
	}
	for i, a := range os.Args {
		if a == "--" {
			os.Args = append([]string{os.Args[0]}, os.Args[i+1:]...)
			break
		}
	}
	flag.CommandLine = flag.NewFlagSet("cleanup", flag.ExitOnError)
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}
func TestCleanupPostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(ctx)
	name := "aces_cleanup_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{name}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP DATABASE "+pgx.Identifier{name}.Sanitize()+" WITH (FORCE)")
	u, err := url.Parse(src)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	db, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close(ctx)
	must := func(q string, args ...any) {
		t.Helper()
		if _, err = db.Exec(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	must(`CREATE TABLE connect_media(id uuid PRIMARY KEY,tenant_id uuid,path text,created_at timestamptz,message_id uuid,group_message_id uuid,recording_intent uuid);CREATE TABLE connect_recording_intents(id uuid,tenant_id uuid,expires_at timestamptz);CREATE TABLE connect_media_usage(created_at timestamptz);`)
	root := t.TempDir()
	private := filepath.Join(root, ".connect-private")
	if err = os.Mkdir(private, 0700); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-48 * time.Hour)
	file := func(stale bool) string {
		t.Helper()
		name := uuid.NewString() + ".jpg"
		if err = os.WriteFile(filepath.Join(private, name), []byte("test"), 0600); err != nil {
			t.Fatal(err)
		}
		if stale {
			if err = os.Chtimes(filepath.Join(private, name), old, old); err != nil {
				t.Fatal(err)
			}
		}
		return name
	}
	pending, attached, recent, orphan := file(true), file(true), file(false), file(true)
	tenantID := uuid.New()
	intent := uuid.New()
	must(`INSERT INTO connect_media(id,tenant_id,path,created_at,recording_intent)VALUES($1,$2,$3,$4,$5)`, uuid.New(), tenantID, pending, old, intent)
	must(`INSERT INTO connect_media(id,tenant_id,path,created_at,message_id)VALUES($1,$2,$3,$4,$5)`, uuid.New(), tenantID, attached, old, uuid.New())
	must(`INSERT INTO connect_media(id,tenant_id,path,created_at)VALUES($1,$2,$3,now())`, uuid.New(), tenantID, recent)
	must(`INSERT INTO connect_recording_intents VALUES($1,$2,$3)`, intent, tenantID, old)
	must(`INSERT INTO connect_media_usage VALUES(now()-interval '8 days'),(now())`)
	tmp := filepath.Join(private, ".processing-abandoned")
	if err = os.WriteFile(tmp, []byte("partial"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = os.Chtimes(tmp, old, old); err != nil {
		t.Fatal(err)
	}
	invoke := func(apply bool) {
		t.Helper()
		args := []string{"-test.run=^TestCleanupProcess$", "--", "-storage", root}
		if apply {
			args = append(args, "-apply")
		}
		cmd := exec.Command(os.Args[0], args...)
		cmd.Env = append(os.Environ(), "ACES_CLEANUP_HELPER=1", "DB_SOURCE="+u.String())
		if out, e := cmd.CombinedOutput(); e != nil {
			t.Fatal(e, string(out))
		}
	}
	invoke(false)
	for _, name := range []string{pending, attached, recent, orphan} {
		if _, err = os.Stat(filepath.Join(private, name)); err != nil {
			t.Fatal("dry run removed file", err)
		}
	}
	invoke(true)
	for _, name := range []string{pending, orphan, ".processing-abandoned"} {
		if _, err = os.Stat(filepath.Join(private, name)); !os.IsNotExist(err) {
			t.Fatal("stale file retained", name, err)
		}
	}
	for _, name := range []string{attached, recent} {
		if _, err = os.Stat(filepath.Join(private, name)); err != nil {
			t.Fatal("live file removed", name, err)
		}
	}
	for _, q := range []string{`SELECT count(*)=2 FROM connect_media`, `SELECT count(*)=0 FROM connect_recording_intents`, `SELECT count(*)=1 FROM connect_media_usage`} {
		var ok bool
		if err = db.QueryRow(ctx, q).Scan(&ok); err != nil || !ok {
			t.Fatal(q, err)
		}
	}
	invoke(true) // Repeated sweeps are safe.
}
