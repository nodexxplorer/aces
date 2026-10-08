// Command tenant manages departments (tenants).
//
//	tenant list
//	tenant create -slug uniport-ee -name "Department of Electrical Engineering" \
//	              -matric-code EG/EE [-institution "University of Port Harcourt"] [-faculty "Faculty of Engineering"]
//	tenant update -slug uniport-ee [-name ...] [-institution ...] [-faculty ...] [-matric-code EG/EE]
//	tenant activate -slug uniport-ee
//	tenant deactivate -slug uniport-ee
//
// -matric-code is the department part of its students' matric numbers: EG/EE
// for 20/EG/EE/1234. A department without one refuses matric-based sign-up and
// onboarding until one is set. Pass -matric-code "" to unset it.
//
// It connects with DB_SOURCE. The tenants table is a global registry without
// row-level security, so the role needs INSERT and UPDATE on it. Run it with
// the migration owner's connection string, not the restricted runtime role.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"text/tabwriter"

	"github.com/aces/backend/internal/tenant"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
	case "update":
		update(ctx, pool, args)
	case "activate":
		setActive(ctx, pool, args, true)
	case "deactivate":
		setActive(ctx, pool, args, false)
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: tenant <list | create | update | activate | deactivate> [flags]")
	fmt.Fprintln(os.Stderr, "  create      -slug <slug> -name <name> [-matric-code <EG/EE>] [-institution <text>] [-faculty <text>]")
	fmt.Fprintln(os.Stderr, "  update      -slug <slug> [-name <name>] [-matric-code <EG/EE>] [-institution <text>] [-faculty <text>]")
	fmt.Fprintln(os.Stderr, "  activate    -slug <slug>")
	fmt.Fprintln(os.Stderr, "  deactivate  -slug <slug>")
	os.Exit(2)
}

func list(ctx context.Context, pool *pgxpool.Pool) {
	rows, err := pool.Query(ctx, `SELECT slug, name, COALESCE(institution, ''), COALESCE(faculty, ''), COALESCE(matric_code, ''), is_active FROM tenants ORDER BY slug`)
	if err != nil {
		log.Fatalf("list departments: %v", err)
	}
	defer rows.Close()

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SLUG\tNAME\tINSTITUTION\tFACULTY\tMATRIC CODE\tACTIVE")
	for rows.Next() {
		var slug, name, institution, faculty, matricCode string
		var active bool
		if err := rows.Scan(&slug, &name, &institution, &faculty, &matricCode, &active); err != nil {
			log.Fatalf("read department: %v", err)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%t\n", slug, name, institution, faculty, matricCode, active)
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
	matricCode := fs.String("matric-code", "", "matric code, e.g. EG/EE for 20/EG/EE/1234")
	institution := fs.String("institution", "", "institution name")
	faculty := fs.String("faculty", "", "faculty name")
	_ = fs.Parse(args)

	*slug = normalizeSlug(*slug)
	if !slugPattern.MatchString(*slug) || len(*slug) > 64 {
		log.Fatalf("invalid -slug %q: use lowercase letters, digits and single hyphens (max 64)", *slug)
	}
	if strings.TrimSpace(*name) == "" {
		log.Fatal("-name is required")
	}
	code, err := normalizeMatricCode(*matricCode)
	if err != nil {
		log.Fatal(err)
	}

	var id string
	err = pool.QueryRow(ctx, `
		INSERT INTO tenants (slug, name, institution, faculty, matric_code)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))
		RETURNING id::text`, *slug, strings.TrimSpace(*name), strings.TrimSpace(*institution), strings.TrimSpace(*faculty), code,
	).Scan(&id)
	if err != nil {
		log.Fatalf("create department %q: %v", *slug, describeWriteError(err, code))
	}
	fmt.Printf("created department %q (id %s)\n", *slug, id)
	if code == "" {
		fmt.Printf("warning: %q has no matric code, so students cannot sign up or complete onboarding until you run:\n", *slug)
		fmt.Printf("  tenant update -slug %s -matric-code EG/XX\n", *slug)
	}
	fmt.Printf("create its first admin with: DB_SOURCE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... go run ./cmd/seed_admin -tenant %s\n", *slug)
}

// update changes only the fields whose flags were given. An empty value passed
// explicitly clears an optional field (-institution, -faculty, -matric-code).
func update(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("update", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug")
	name := fs.String("name", "", "department name")
	matricCode := fs.String("matric-code", "", "matric code, e.g. EG/EE for 20/EG/EE/1234 (\"\" clears it)")
	institution := fs.String("institution", "", "institution name (\"\" clears it)")
	faculty := fs.String("faculty", "", "faculty name (\"\" clears it)")
	_ = fs.Parse(args)

	given := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { given[f.Name] = true })

	*slug = normalizeSlug(*slug)
	if *slug == "" {
		log.Fatal("-slug is required")
	}
	if len(given) == 1 {
		log.Fatal("nothing to update: pass at least one of -name, -matric-code, -institution, -faculty")
	}
	if given["name"] && strings.TrimSpace(*name) == "" {
		log.Fatal("-name cannot be empty")
	}
	var code string
	if given["matric-code"] {
		var err error
		if code, err = normalizeMatricCode(*matricCode); err != nil {
			log.Fatal(err)
		}
	}

	var newName, newInstitution, newFaculty, newCode string
	err := pool.QueryRow(ctx, `
		UPDATE tenants SET
			name        = CASE WHEN $2::bool THEN $3::text ELSE name END,
			institution = CASE WHEN $4::bool THEN NULLIF($5::text, '') ELSE institution END,
			faculty     = CASE WHEN $6::bool THEN NULLIF($7::text, '') ELSE faculty END,
			matric_code = CASE WHEN $8::bool THEN NULLIF($9::text, '') ELSE matric_code END,
			updated_at  = NOW()
		WHERE slug = $1
		RETURNING name, COALESCE(institution, ''), COALESCE(faculty, ''), COALESCE(matric_code, '')`,
		*slug,
		given["name"], strings.TrimSpace(*name),
		given["institution"], strings.TrimSpace(*institution),
		given["faculty"], strings.TrimSpace(*faculty),
		given["matric-code"], code,
	).Scan(&newName, &newInstitution, &newFaculty, &newCode)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Fatalf("no department with slug %q", *slug)
	}
	if err != nil {
		log.Fatalf("update department %q: %v", *slug, describeWriteError(err, code))
	}

	fmt.Printf("updated department %q\n", *slug)
	fmt.Printf("  name:         %s\n", newName)
	fmt.Printf("  institution:  %s\n", newInstitution)
	fmt.Printf("  faculty:      %s\n", newFaculty)
	fmt.Printf("  matric code:  %s\n", orNone(newCode))
	if newCode == "" {
		fmt.Println("warning: no matric code, so students cannot sign up or complete onboarding in this department")
	}
	fmt.Println("the server picks up the change within a minute (its department cache), or on restart")
}

func setActive(ctx context.Context, pool *pgxpool.Pool, args []string, active bool) {
	fs := flag.NewFlagSet("activate", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug")
	_ = fs.Parse(args)

	tag, err := pool.Exec(ctx, `UPDATE tenants SET is_active = $2, updated_at = NOW() WHERE slug = $1`,
		normalizeSlug(*slug), active)
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

// normalizeMatricCode returns the stored form of a matric code, or "" when none
// is given. It accepts the form the server stores, EG/EE, in any letter case.
func normalizeMatricCode(raw string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if code == "" {
		return "", nil
	}
	if !tenant.ValidMatricCode(code) {
		return "", fmt.Errorf("invalid -matric-code %q: use the department part of a matric number, "+
			"for example EG/EE for 20/EG/EE/1234", raw)
	}
	return code, nil
}

// describeWriteError turns the database errors a write can hit into messages
// that name the problem.
func describeWriteError(err error, code string) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation: the matric code index
			return fmt.Errorf("matric code %s is already used by another department", code)
		case "23514": // check_violation: the matric code format
			return fmt.Errorf("matric code %q does not have the form EG/EE", code)
		}
	}
	return err
}

func normalizeSlug(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func orNone(s string) string {
	if s == "" {
		return "(none)"
	}
	return s
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
