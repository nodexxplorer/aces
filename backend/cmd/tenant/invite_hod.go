package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/aces/backend/internal/email"
	"github.com/aces/backend/internal/invitation"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// invite-hod is an operator command, not an API privilege. Use the migration
// owner's DSN just like tenant create; all invitation queries explicitly bind
// and filter the chosen department. Tokens/passwords are never printed here.
func inviteHOD(ctx context.Context, pool *pgxpool.Pool, args []string) {
	fs := flag.NewFlagSet("invite-hod", flag.ExitOnError)
	slug := fs.String("slug", "", "department slug")
	address := fs.String("email", "", "intended HOD's personal account email (not the department contact address)")
	name := fs.String("name", "", "intended HOD's full name")
	resend := fs.String("resend", "", "rotate and resend this bootstrap invitation UUID")
	revoke := fs.String("revoke", "", "revoke this bootstrap invitation UUID")
	_ = fs.Parse(args)
	if err := issueHODInvitation(ctx, pool, *slug, *address, *name, *resend, *revoke); err != nil {
		log.Fatal(err)
	}
}
func issueHODInvitation(ctx context.Context, pool *pgxpool.Pool, slug, address, name, resend, revoke string) error {
	if strings.TrimSpace(slug) == "" {
		return errors.New("-slug is required")
	}
	var t tenant.Tenant
	err := pool.QueryRow(ctx, `SELECT id,slug,name,COALESCE(url_code,''),is_active FROM tenants WHERE slug=$1`, normalizeSlug(slug)).Scan(&t.ID, &t.Slug, &t.Name, &t.URLCode, &t.IsActive)
	if err != nil {
		return fmt.Errorf("find department: %w", err)
	}
	if !t.IsActive {
		return errors.New("department is inactive")
	}
	origin, err := invitation.FrontendOrigin(os.Getenv("FRONTEND_PUBLIC_URL"))
	if err != nil {
		return err
	}
	port := 587
	if raw := os.Getenv("SMTP_PORT"); raw != "" {
		port, err = strconv.Atoi(raw)
		if err != nil {
			return errors.New("invalid SMTP_PORT")
		}
	}
	mock, _ := strconv.ParseBool(os.Getenv("SMTP_MOCK"))
	sender := email.NewSMTPSender(os.Getenv("SMTP_HOST"), port, os.Getenv("SMTP_USERNAME"), os.Getenv("SMTP_PASSWORD"), os.Getenv("SMTP_FROM"), mock)
	svc := invitation.Service{Pool: pool, Sender: sender, FrontendURL: origin}
	ctx = tenant.With(ctx, t)
	var i invitation.Invitation
	if resend != "" || revoke != "" {
		if resend != "" && revoke != "" {
			return errors.New("choose -resend or -revoke, not both")
		}
		raw := resend
		if revoke != "" {
			raw = revoke
		}
		id, e := uuid.Parse(raw)
		if e != nil {
			return errors.New("invalid invitation UUID")
		}
		i, err = svc.BootstrapResend(ctx, id, revoke != "")
	} else {
		i, err = svc.Bootstrap(ctx, invitation.Request{Email: address, Name: name})
	}
	if err != nil {
		return err
	}
	fmt.Printf("HOD invitation %s for department %s: %s\n", i.ID, t.Slug, i.Status)
	if i.DeliveryFailed {
		return fmt.Errorf("invitation saved but email delivery failed; after one minute retry with tenant invite-hod -slug %s -resend %s", t.Slug, i.ID)
	}
	return nil
}
