package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/aces/backend/internal/tenant"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// logoNamePattern matches a logo file named after a matric code: EG-CE.png is
// the logo for EG/CE. A slash cannot appear in a file name, so it becomes a dash.
var logoNamePattern = regexp.MustCompile(`^([A-Za-z]{2})-([A-Za-z]{2})\.(?i:png|jpe?g|webp)$`)

// placeholderMarker is written into the placeholder images in the logo folder.
// The apply step skips any file that still carries it, so a placeholder is
// never published by accident.
const placeholderMarker = "aces-placeholder"

// matricCodeFromLogoName returns the matric code a logo file is for, such as
// EG/CE for EG-CE.png.
func matricCodeFromLogoName(name string) (string, bool) {
	m := logoNamePattern.FindStringSubmatch(name)
	if m == nil {
		return "", false
	}
	code := strings.ToUpper(m[1]) + "/" + strings.ToUpper(m[2])
	return code, tenant.ValidMatricCode(code)
}

func isPlaceholderLogo(data []byte) bool {
	return bytes.Contains(data, []byte(placeholderMarker))
}

func isImageName(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".png", ".jpg", ".jpeg", ".webp":
		return true
	}
	return false
}

// applyLogos sets department logos from one folder: the bulk form of
// `update -logo`. Each file is named after the matric code of the department
// it belongs to, so the folder can hold every department's logo at once.
func applyLogos(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("logos", flag.ExitOnError)
	dir := fs.String("dir", "", "folder of logo files named by matric code, e.g. EG-CE.png")
	dryRun := fs.Bool("dry-run", false, "show what would change without writing")
	_ = fs.Parse(args)

	if *dir == "" {
		log.Fatal("-dir is required")
	}
	entries, err := os.ReadDir(*dir)
	if err != nil {
		log.Fatalf("read -dir: %v", err)
	}

	problems := 0
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !isImageName(name) {
			continue // README.md and other notes are not logos
		}
		code, ok := matricCodeFromLogoName(name)
		if !ok {
			fmt.Printf("fail %s: name the file after a matric code, such as EG-CE.png\n", name)
			problems++
			continue
		}
		if err := applyOneLogo(ctx, pool, filepath.Join(*dir, name), code, *dryRun); err != nil {
			fmt.Printf("fail %s: %v\n", name, err)
			problems++
		}
	}
	if problems > 0 {
		fmt.Printf("%d problem(s); nothing was written for the files that failed\n", problems)
		os.Exit(1)
	}
}

func applyOneLogo(ctx context.Context, pool *pgxpool.Pool, path, code string, dryRun bool) error {
	base := filepath.Base(path)
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if isPlaceholderLogo(data) {
		fmt.Printf("skip %s: still the placeholder; replace the image with the department's logo\n", base)
		return nil
	}
	logo, logoType, err := checkLogo(data)
	if err != nil {
		return err
	}

	var slug, name string
	var active bool
	if dryRun {
		err = pool.QueryRow(ctx,
			`SELECT slug, name, is_active FROM tenants WHERE matric_code = $1`, code,
		).Scan(&slug, &name, &active)
	} else {
		err = pool.QueryRow(ctx, `
			UPDATE tenants SET logo = $2, logo_type = $3, updated_at = NOW()
			WHERE matric_code = $1
			RETURNING slug, name, is_active`, code, logo, logoType,
		).Scan(&slug, &name, &active)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("no department has matric code %s; create it with -matric-code %s first", code, code)
	}
	if err != nil {
		return err
	}

	verb := "set the logo for"
	if dryRun {
		verb = "would set the logo for"
	}
	note := ""
	if !active {
		note = " (the department is inactive, so the logo is not shown until it is activated)"
	}
	fmt.Printf("%s %s (%s) from %s%s\n", verb, slug, name, base, note)
	return nil
}
