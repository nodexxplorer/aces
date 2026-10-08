// Command tenant manages departments (tenants).
//
//	tenant list
//	tenant create -slug uniport-ee -name "Department of Electrical Engineering" \
//	              [-institution "University of Port Harcourt"] [-faculty "Faculty of Engineering"]
//	tenant activate -slug uniport-ee
//	tenant deactivate -slug uniport-ee
//
// It connects with DB_SOURCE. The tenants table is a global registry without
// row-level security, so the role needs INSERT and UPDATE on it. Run it with
// the migration owner's connection string, not the restricted runtime role.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"text/tabwriter"

	"github.com/jackc/pgx/v5/pgxpool"
)

// slugPattern mirrors the CHECK constraint on tenants.slug.
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func init() {
	loadDotEnv(".env")
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	ctx := context.Background()

	dbSource := os.Getenv("DB_SOURCE")
	if dbSource == "" {
		log.Fatal("DB_SOURCE environment variable is required.")
	}
	pool, err := pgxpool.New(ctx, dbSource)
	if err != nil {
		log.Fatalf("cannot connect to db: %v", err)
	}
	defer pool.Close()

	switch cmd, args := os.Args[1], os.Args[2:]; cmd {
	case "list":
		list(ctx, pool)
	case "create":
		create(ctx, pool, args)
	case "activate":
		setActive(ctx, pool, args, true)
	case "deactivate":
		setActive(ctx, pool, args, false)
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: tenant <list | create | activate | deactivate> [flags]")
	fmt.Fprintln(os.Stderr, "  create      -slug <slug> -name <name> [-institution <text>] [-faculty <text>]")
	fmt.Fprintln(os.Stderr, "  activate    -slug <slug>")
	fmt.Fprintln(os.Stderr, "  deactivate  -slug <slug>")
	os.Exit(2)
}

func list(ctx context.Context, pool *pgxpool.Pool) {
	rows, err := pool.Query(ctx, `SELECT slug, name, COALESCE(institution, ''), COALESCE(faculty, ''), is_active FROM tenants ORDER BY slug`)
	if err != nil {
		log.Fatalf("list departments: %v", err)
	}
	defer rows.Close()

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SLUG\tNAME\tINSTITUTION\tFACULTY\tACTIVE")
	for rows.Next() {
		var slug, name, institution, faculty string
		var active bool
		if err := rows.Scan(&slug, &name, &institution, &faculty, &active); err != nil {
			log.Fatalf("read department: %v", err)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%t\n", slug, name, institution, faculty, active)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("list departments: %v", err)
	}
	_ = w.Flush()
}

func create(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug, e.g. uniport-ee (lowercase letters, digits, hyphens)")
	name := fs.String("name", "", "department name")
	institution := fs.String("institution", "", "institution name")
	faculty := fs.String("faculty", "", "faculty name")
	_ = fs.Parse(args)

	*slug = strings.ToLower(strings.TrimSpace(*slug))
	if !slugPattern.MatchString(*slug) || len(*slug) > 64 {
		log.Fatalf("invalid -slug %q: use lowercase letters, digits and single hyphens (max 64)", *slug)
	}
	if strings.TrimSpace(*name) == "" {
		log.Fatal("-name is required")
	}

	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO tenants (slug, name, institution, faculty)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))
		RETURNING id::text`, *slug, strings.TrimSpace(*name), strings.TrimSpace(*institution), strings.TrimSpace(*faculty),
	).Scan(&id)
	if err != nil {
		log.Fatalf("create department %q: %v", *slug, err)
	}
	fmt.Printf("created department %q (id %s)\n", *slug, id)
	fmt.Printf("create its first admin with: DB_SOURCE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... go run ./cmd/seed_admin -tenant %s\n", *slug)
}

func setActive(ctx context.Context, pool *pgxpool.Pool, args []string, active bool) {
	fs := flag.NewFlagSet("activate", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug")
	_ = fs.Parse(args)

	tag, err := pool.Exec(ctx, `UPDATE tenants SET is_active = $2, updated_at = NOW() WHERE slug = $1`,
		strings.ToLower(strings.TrimSpace(*slug)), active)
	if err != nil {
		log.Fatalf("update department %q: %v", *slug, err)
	}
	if tag.RowsAffected() == 0 {
		log.Fatalf("no department with slug %q", *slug)
	}
	state := "activated"
	if !active {
		state = "deactivated"
	}
	fmt.Printf("%s department %q\n", state, *slug)
}

// loadDotEnv reads KEY=VALUE pairs from path without overriding variables that
// are already set, the same as the other commands.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx < 1 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			value = value[1 : len(value)-1]
		}
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}
