// Command tenant manages departments (tenants).
//
//	tenant list
//	tenant create -slug uniport-ee -name "Department of Electrical Engineering" \
//	              -matric-code EG/EE [-institution "University of Port Harcourt"] [-faculty "Faculty of Engineering"]
//	tenant ensure [-file deploy/departments.json] [-dry-run]
//	tenant update -slug uniport-ee [-name ...] [-institution ...] [-faculty ...] [-matric-code EG/EE]
//	tenant activate -slug uniport-ee
//	tenant deactivate -slug uniport-ee
//
// ensure is the bulk form of create: it takes a JSON file of departments and
// creates the ones that are missing, leaving the rest alone. Running it twice
// changes nothing the second time. deploy/departments.json ships with the eight
// departments of the Faculty of Engineering; edit it for your own faculty.
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
	"net/http"
	"os"
	"regexp"
	"strings"
	"text/tabwriter"
	"unicode/utf8"

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
	case "ensure":
		ensure(ctx, pool, args)
	case "update":
		update(ctx, pool, args)
	case "logos":
		applyLogos(ctx, pool, args)
	case "activate":
		setActive(ctx, pool, args, true)
	case "deactivate":
		setActive(ctx, pool, args, false)
	default:
		usage()
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: tenant <list | create | ensure | update | logos | activate | deactivate> [flags]")
	fmt.Fprintln(os.Stderr, "  create      -slug <slug> -name <name> [-matric-code <EG/EE>] [-institution <text>] [-faculty <text>]")
	fmt.Fprintln(os.Stderr, "  ensure      [-file deploy/departments.json] [-dry-run]   create every department of a file that is missing")
	fmt.Fprintln(os.Stderr, "  update      -slug <slug> [-name <name>] [-matric-code <EG/EE>] [-institution <text>] [-faculty <text>]")
	fmt.Fprintln(os.Stderr, "              [-description <text>] [-logo <file.png|jpg|webp>] [-remove-logo]")
	fmt.Fprintln(os.Stderr, "  logos       -dir <folder> [-dry-run]   set logos from files named by matric code, e.g. EG-CE.png")
	fmt.Fprintln(os.Stderr, "  activate    -slug <slug>")
	fmt.Fprintln(os.Stderr, "  deactivate  -slug <slug>")
	os.Exit(2)
}

func list(ctx context.Context, pool *pgxpool.Pool) {
	rows, err := pool.Query(ctx, `SELECT slug, name, COALESCE(institution, ''), COALESCE(faculty, ''), COALESCE(matric_code, ''), COALESCE(url_code, ''), COALESCE(accent_color, ''), is_active FROM tenants ORDER BY slug`)
	if err != nil {
		log.Fatalf("list departments: %v", err)
	}
	defer rows.Close()

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SLUG\tNAME\tINSTITUTION\tFACULTY\tMATRIC CODE\tURL CODE\tACCENT\tACTIVE")
	for rows.Next() {
		var slug, name, institution, faculty, matricCode, urlCode, accent string
		var active bool
		if err := rows.Scan(&slug, &name, &institution, &faculty, &matricCode, &urlCode, &accent, &active); err != nil {
			log.Fatalf("read department: %v", err)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%t\n", slug, name, institution, faculty, matricCode, orNone(urlCode), orNone(accent), active)
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
	urlCodeFlag := fs.String("url-code", "", "web address code, e.g. co for /co and /co/admin (default: the matric code's suffix, so EG/CO gives co)")
	_ = fs.Parse(args)
	urlCodeGiven := false
	fs.Visit(func(f *flag.Flag) {
		if f.Name == "url-code" {
			urlCodeGiven = true
		}
	})

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
	urlCode := tenant.DefaultURLCode(code)
	if urlCodeGiven {
		urlCode = strings.ToLower(strings.TrimSpace(*urlCodeFlag))
		if urlCode != "" {
			if err := tenant.ValidURLCode(urlCode); err != nil {
				log.Fatalf("-url-code: %v", err)
			}
		}
	}

	id, err := insertDepartment(ctx, pool, departmentSpec{
		Slug:        *slug,
		Name:        strings.TrimSpace(*name),
		Institution: strings.TrimSpace(*institution),
		Faculty:     strings.TrimSpace(*faculty),
		MatricCode:  code,
		URLCode:     urlCode,
	})
	if err != nil {
		log.Fatalf("create department %q: %v", *slug, err)
	}
	fmt.Printf("created department %q (id %s)\n", *slug, id)
	fmt.Printf("  web address:  %s\n", webAddress(urlCode))
	if urlCode == "" {
		fmt.Printf("warning: %q has no web address code, so its /<code> sign-in pages do not exist until you run:\n", *slug)
		fmt.Printf("  tenant update -slug %s -url-code CODE\n", *slug)
	}
	if code == "" {
		fmt.Printf("warning: %q has no matric code, so students cannot sign up or complete onboarding until you run:\n", *slug)
		fmt.Printf("  tenant update -slug %s -matric-code EG/XX\n", *slug)
	}
	fmt.Printf("create its first admin with: DB_SOURCE=... ADMIN_EMAIL=... go run ./cmd/seed_admin -tenant %s (it prints the generated password once)\n", *slug)
}

// update changes only the fields whose flags were given. An empty value passed
// explicitly clears an optional field (-institution, -faculty, -matric-code,
// -description).
func update(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("update", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug")
	name := fs.String("name", "", "department name")
	matricCode := fs.String("matric-code", "", "matric code, e.g. EG/EE for 20/EG/EE/1234 (\"\" clears it)")
	institution := fs.String("institution", "", "institution name (\"\" clears it)")
	faculty := fs.String("faculty", "", "faculty name (\"\" clears it)")
	description := fs.String("description", "", "short description shown on the sign-in page and dashboard footer (\"\" clears it)")
	contactEmail := fs.String("contact-email", "", "contact email printed on the department's dues receipts (\"\" clears it)")
	approvalEmail := fs.String("approval-email", "", "address the approval page sends students to; without one it uses the contact email (\"\" clears it)")
	urlCodeFlag := fs.String("url-code", "", "web address code, e.g. co for /co and /co/admin (\"\" clears it)")
	logoPath := fs.String("logo", "", "logo file: PNG, JPEG or WebP, at most 256 KiB; the accent colour is read from PNG and JPEG logos")
	removeLogo := fs.Bool("remove-logo", false, "remove the department's logo")
	_ = fs.Parse(args)

	given := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { given[f.Name] = true })

	*slug = normalizeSlug(*slug)
	if *slug == "" {
		log.Fatal("-slug is required")
	}
	if len(given) == 1 {
		log.Fatal("nothing to update: pass at least one of -name, -matric-code, -institution, -faculty, -description, -contact-email, -approval-email, -url-code, -logo, -remove-logo")
	}
	var urlCode string
	if given["url-code"] {
		urlCode = strings.ToLower(strings.TrimSpace(*urlCodeFlag))
		if urlCode != "" {
			if err := tenant.ValidURLCode(urlCode); err != nil {
				log.Fatalf("-url-code: %v", err)
			}
		}
	}
	if given["contact-email"] && strings.TrimSpace(*contactEmail) != "" && !validContactEmail(strings.TrimSpace(*contactEmail)) {
		log.Fatalf("-contact-email %q is not an email address", *contactEmail)
	}
	if given["approval-email"] && strings.TrimSpace(*approvalEmail) != "" && !validContactEmail(strings.TrimSpace(*approvalEmail)) {
		log.Fatalf("-approval-email %q is not an email address", *approvalEmail)
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
	// A department with no web address code takes one from a new matric code.
	defaultURLCode := ""
	if given["matric-code"] {
		defaultURLCode = tenant.DefaultURLCode(code)
	}
	desc := strings.TrimSpace(*description)
	if utf8.RuneCountInString(desc) > maxDescriptionLength {
		log.Fatalf("-description is longer than %d characters", maxDescriptionLength)
	}
	if given["logo"] && given["remove-logo"] {
		log.Fatal("pass either -logo or -remove-logo, not both")
	}
	var logo []byte
	var logoType string
	if given["logo"] {
		var err error
		if logo, logoType, err = readLogo(*logoPath); err != nil {
			log.Fatal(err)
		}
	}
	// The accent follows the logo: it is set with a new logo, and cleared when
	// the logo is removed. An empty accent means none.
	setAccent := given["logo"] || *removeLogo
	var accent string
	if given["logo"] {
		accent = logoAccent(logoType, logo)
	}

	var newName, newInstitution, newFaculty, newCode, newDescription, newAccent, newURLCode string
	var hasLogo bool
	err := pool.QueryRow(ctx, `
		UPDATE tenants SET
			name        = CASE WHEN $2::bool THEN $3::text ELSE name END,
			institution = CASE WHEN $4::bool THEN NULLIF($5::text, '') ELSE institution END,
			faculty     = CASE WHEN $6::bool THEN NULLIF($7::text, '') ELSE faculty END,
			matric_code = CASE WHEN $8::bool THEN NULLIF($9::text, '') ELSE matric_code END,
			description = CASE WHEN $10::bool THEN NULLIF($11::text, '') ELSE description END,
			logo        = CASE WHEN $12::bool THEN $13::bytea WHEN $14::bool THEN NULL ELSE logo END,
			logo_type   = CASE WHEN $12::bool THEN $15::text WHEN $14::bool THEN NULL ELSE logo_type END,
			contact_email = CASE WHEN $16::bool THEN NULLIF($17::text, '') ELSE contact_email END,
			approval_email = CASE WHEN $18::bool THEN NULLIF($19::text, '') ELSE approval_email END,
			accent_color = CASE WHEN $20::bool THEN NULLIF($21::text, '') ELSE accent_color END,
			url_code = CASE WHEN $22::bool THEN NULLIF($23::text, '') WHEN $24::bool AND url_code IS NULL THEN NULLIF($25::text, '') ELSE url_code END,
			updated_at  = NOW()
		WHERE slug = $1
		RETURNING name, COALESCE(institution, ''), COALESCE(faculty, ''), COALESCE(matric_code, ''),
		          COALESCE(description, ''), logo_type IS NOT NULL, COALESCE(accent_color, ''), COALESCE(url_code, '')`,
		*slug,
		given["name"], strings.TrimSpace(*name),
		given["institution"], strings.TrimSpace(*institution),
		given["faculty"], strings.TrimSpace(*faculty),
		given["matric-code"], code,
		given["description"], desc,
		given["logo"], logo,
		*removeLogo, logoType,
		given["contact-email"], strings.TrimSpace(*contactEmail),
		given["approval-email"], strings.TrimSpace(*approvalEmail),
		setAccent, accent,
		given["url-code"], urlCode, defaultURLCode != "", defaultURLCode,
	).Scan(&newName, &newInstitution, &newFaculty, &newCode, &newDescription, &hasLogo, &newAccent, &newURLCode)
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
	fmt.Printf("  description:  %s\n", orNone(newDescription))
	fmt.Printf("  logo:         %s\n", map[bool]string{true: "set", false: "none"}[hasLogo])
	fmt.Printf("  accent:       %s\n", orNone(newAccent))
	fmt.Printf("  web address:  %s\n", webAddress(newURLCode))
	if newCode == "" {
		fmt.Println("warning: no matric code, so students cannot sign up or complete onboarding in this department")
	}
	fmt.Println("the server picks up the change within a minute (its department cache), or on restart")
}

// maxDescriptionLength matches the CHECK constraint on tenants.description.
const maxDescriptionLength = 500

// maxLogoBytes matches the CHECK constraint on tenants.logo.
const maxLogoBytes = 256 << 10

// readLogo reads a logo file and checks what it really is. The file extension is
// ignored: the bytes must start with a PNG, JPEG or WebP signature, which rules
// out SVG (it can carry script), GIF and anything else.
func readLogo(path string) ([]byte, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", fmt.Errorf("read -logo: %w", err)
	}
	return checkLogo(data)
}

func checkLogo(data []byte) ([]byte, string, error) {
	if len(data) > maxLogoBytes {
		return nil, "", fmt.Errorf("logo is %d bytes; the limit is %d (256 KiB)", len(data), maxLogoBytes)
	}
	contentType := http.DetectContentType(data)
	switch contentType {
	case "image/png", "image/jpeg", "image/webp":
		return data, contentType, nil
	}
	return nil, "", fmt.Errorf("logo must be a PNG, JPEG or WebP image, not %q", contentType)
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
		case "23505": // unique_violation: the web address code, or the matric code index
			if pgErr.ConstraintName == "tenants_url_code_key" {
				return errors.New("that web address code is already used by another department")
			}
			return fmt.Errorf("matric code %s is already used by another department", code)
		case "23514": // check_violation: name the rule that failed
			if pgErr.ConstraintName == "tenants_url_code_format" {
				return errors.New("a web address code is 2 to 12 lowercase letters or digits")
			}
			if pgErr.ConstraintName == "tenants_matric_code_format" {
				return fmt.Errorf("matric code %q does not have the form EG/EE", code)
			}
			if pgErr.ConstraintName == "tenants_logo_type_pair" {
				return errors.New("the logo and its type must be set or cleared together")
			}
			return fmt.Errorf("%s: %s", pgErr.ConstraintName, pgErr.Message)
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

// webAddress describes a department's web addresses for the command output.
func webAddress(code string) string {
	if code == "" {
		return "(none)"
	}
	return "/" + code + " (admin: /" + code + "/admin)"
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

// validContactEmail reports whether s is an email address the database accepts
// for a contact or approval email: one @, no spaces, and a dot in the domain that is neither
// the first nor the last character.
func validContactEmail(s string) bool {
	if strings.ContainsAny(s, " \t\r\n") || strings.Count(s, "@") != 1 {
		return false
	}
	at := strings.Index(s, "@")
	local, domain := s[:at], s[at+1:]
	return local != "" && strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}
