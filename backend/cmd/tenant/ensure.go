package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/aces/backend/internal/tenant"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// defaultDepartmentsFile is the starter list shipped with the repository. It
// holds the eight departments of the Faculty of Engineering, so the usual way
// to open a faculty is to edit it and run `tenant ensure`.
const defaultDepartmentsFile = "deploy/departments.json"

// departmentSpec is one department of a bulk file. The slug and the name are
// required; the matric code is what lets students sign up and finish
// onboarding, and the web address code is what gives the department its /<code>
// sign-in page. The URL code defaults to the matric code's suffix, so EG/CO
// gives co.
type departmentSpec struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	MatricCode  string `json:"matric_code"`
	URLCode     string `json:"url_code"`
	Institution string `json:"institution"`
	Faculty     string `json:"faculty"`
}

// parseDepartmentFile reads a bulk file and checks every department in it
// before anything is written, so a typo stops the run instead of leaving half
// the departments behind.
func parseDepartmentFile(data []byte) ([]departmentSpec, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields() // a misspelled key is a mistake, not a field to ignore
	var raw []departmentSpec
	if err := dec.Decode(&raw); err != nil {
		return nil, fmt.Errorf("read the department file: %w", err)
	}
	if dec.More() {
		return nil, errors.New("read the department file: unexpected content after the list of departments")
	}
	if len(raw) == 0 {
		return nil, errors.New("read the department file: it lists no departments")
	}

	out := make([]departmentSpec, 0, len(raw))
	slugs := map[string]bool{}
	codes := map[string]string{}
	for i, d := range raw {
		spec, err := checkDepartmentSpec(d)
		if err != nil {
			return nil, fmt.Errorf("department %d (%s): %w", i+1, orNone(d.Slug), err)
		}
		if slugs[spec.Slug] {
			return nil, fmt.Errorf("department %d: the slug %s is listed twice", i+1, spec.Slug)
		}
		if spec.MatricCode != "" {
			if other, dup := codes[spec.MatricCode]; dup {
				return nil, fmt.Errorf("department %d: matric code %s is listed twice (%s and %s)", i+1, spec.MatricCode, other, spec.Slug)
			}
			codes[spec.MatricCode] = spec.Slug
		}
		slugs[spec.Slug] = true
		out = append(out, spec)
	}
	return out, nil
}

// checkDepartmentSpec normalises one department and refuses it when a field
// could not be stored. The rules are the ones the database enforces, so the
// message arrives before the write, not after it.
func checkDepartmentSpec(d departmentSpec) (departmentSpec, error) {
	d.Slug = normalizeSlug(d.Slug)
	if !slugPattern.MatchString(d.Slug) || len(d.Slug) > 64 {
		return d, fmt.Errorf("invalid slug %q: use lowercase letters, digits and single hyphens (max 64)", d.Slug)
	}
	d.Name = strings.TrimSpace(d.Name)
	if d.Name == "" {
		return d, errors.New("name is required")
	}
	code, err := normalizeMatricCode(d.MatricCode)
	if err != nil {
		return d, err
	}
	d.MatricCode = code
	d.URLCode = strings.ToLower(strings.TrimSpace(d.URLCode))
	if d.URLCode == "" {
		d.URLCode = tenant.DefaultURLCode(code)
	} else if err := tenant.ValidURLCode(d.URLCode); err != nil {
		return d, fmt.Errorf("url_code: %w", err)
	}
	d.Institution = strings.TrimSpace(d.Institution)
	d.Faculty = strings.TrimSpace(d.Faculty)
	return d, nil
}

// ensure creates the departments of a bulk file that are not there yet. It is
// the bulk form of create: running it twice changes nothing the second time, so
// it is safe to run against a database that already holds some of them.
func ensure(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("ensure", flag.ExitOnError)
	file := fs.String("file", defaultDepartmentsFile, "JSON file listing the departments that should exist")
	dryRun := fs.Bool("dry-run", false, "show what would be created without writing")
	_ = fs.Parse(args)

	data, err := os.ReadFile(*file)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) && *file == defaultDepartmentsFile {
			log.Fatalf("read %s: %v (run it from backend/, or pass -file)", *file, err)
		}
		log.Fatalf("read %s: %v", *file, err)
	}
	specs, err := parseDepartmentFile(data)
	if err != nil {
		log.Fatal(err)
	}

	problems := 0
	created := 0
	for _, spec := range specs {
		done, err := ensureOne(ctx, pool, spec, *dryRun)
		if err != nil {
			fmt.Printf("fail %s: %v\n", spec.Slug, err)
			problems++
			continue
		}
		if done {
			created++
		}
	}
	verb := "created"
	if *dryRun {
		verb = "would create"
	}
	fmt.Printf("%s %d of %d department(s); %d were already there\n", verb, created, len(specs), len(specs)-created-problems)
	if problems > 0 {
		fmt.Printf("%d problem(s); the departments that failed were not created\n", problems)
		os.Exit(1)
	}
}

// ensureOne creates one department when it is missing, and reports whether it
// created it. A department that is already there is left exactly as it is.
func ensureOne(ctx context.Context, pool *pgxpool.Pool, spec departmentSpec, dryRun bool) (bool, error) {
	var haveName, haveCode string
	err := pool.QueryRow(ctx,
		`SELECT name, COALESCE(matric_code, '') FROM tenants WHERE slug = $1`, spec.Slug,
	).Scan(&haveName, &haveCode)
	switch {
	case err == nil:
		fmt.Printf("keep   %s (%s)\n", spec.Slug, haveName)
		if spec.MatricCode != "" && haveCode != spec.MatricCode {
			fmt.Printf("       note: %s has matric code %s, the file says %s; change it with\n"+
				"         go run ./cmd/tenant update -slug %s -matric-code %s\n",
				spec.Slug, orNone(haveCode), spec.MatricCode, spec.Slug, spec.MatricCode)
		}
		return false, nil
	case !errors.Is(err, pgx.ErrNoRows):
		return false, err
	}

	// No department carries the slug. The matric code must be free too, or the
	// insert would fail with a message that does not name the other department.
	if spec.MatricCode != "" {
		var other string
		err = pool.QueryRow(ctx, `SELECT slug FROM tenants WHERE matric_code = $1`, spec.MatricCode).Scan(&other)
		switch {
		case err == nil:
			return false, fmt.Errorf("matric code %s already belongs to %s; a matric number maps to one department", spec.MatricCode, other)
		case !errors.Is(err, pgx.ErrNoRows):
			return false, err
		}
	}

	if dryRun {
		fmt.Printf("create %s (%s), matric code %s, web address %s\n",
			spec.Slug, spec.Name, orNone(spec.MatricCode), webAddress(spec.URLCode))
		return true, nil
	}
	id, err := insertDepartment(ctx, pool, spec)
	if err != nil {
		return false, err
	}
	fmt.Printf("create %s (%s), id %s, matric code %s, web address %s\n",
		spec.Slug, spec.Name, id, orNone(spec.MatricCode), webAddress(spec.URLCode))
	if spec.MatricCode == "" {
		fmt.Printf("       warning: no matric code, so students cannot sign up or finish onboarding until you run\n"+
			"         go run ./cmd/tenant update -slug %s -matric-code EG/XX\n", spec.Slug)
	}
	fmt.Printf("       next: DB_SOURCE=<runtime DSN> ADMIN_EMAIL=<email> go run ./cmd/seed_admin -tenant %s\n", spec.Slug)
	return true, nil
}

// insertDepartment writes one department and returns its id. The matric code
// and the web address code are indexed as unique, so a clash is a 23505 the
// caller turns into a message that names the field.
func insertDepartment(ctx context.Context, pool *pgxpool.Pool, d departmentSpec) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO tenants (slug, name, institution, faculty, matric_code, url_code)
		VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''))
		RETURNING id::text`,
		d.Slug, d.Name, d.Institution, d.Faculty, d.MatricCode, d.URLCode,
	).Scan(&id)
	if err != nil {
		return "", describeWriteError(err, d.MatricCode)
	}
	return id, nil
}

// logoFileNameFor is the logo file name the folder expects for a matric code:
// EG/CE is EG-CE.png, because a slash cannot appear in a file name.
func logoFileNameFor(code string) string {
	return strings.ReplaceAll(code, "/", "-") + ".png"
}

// shippedDepartmentsFile finds the starter list whether the command is run from
// backend/ or from cmd/tenant.
func shippedDepartmentsFile() string {
	for _, p := range []string{
		filepath.Join("deploy", "departments.json"),
		filepath.Join("..", "..", "deploy", "departments.json"),
	} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return defaultDepartmentsFile
}
