package attendance

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestVerifiedAttendancePostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping attendance database integration tests")
	}
	ctx := context.Background()
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	dbname := "aces_attendance_" + suffix
	role := "aces_attendance_rt_" + suffix
	must := func(conn *pgx.Conn, sql string, args ...any) {
		t.Helper()
		if _, e := conn.Exec(ctx, sql, args...); e != nil {
			t.Fatalf("SQL %s: %v", sql, e)
		}
	}
	must(setup, "CREATE DATABASE "+pgx.Identifier{dbname}.Sanitize())
	t.Cleanup(func() {
		_, _ = setup.Exec(context.Background(), "DROP DATABASE "+pgx.Identifier{dbname}.Sanitize()+" WITH (FORCE)")
		_, _ = setup.Exec(context.Background(), "DROP ROLE IF EXISTS "+pgx.Identifier{role}.Sanitize())
		setup.Close(context.Background())
	})
	u, err := url.Parse(src)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + dbname
	owner, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { owner.Close(context.Background()) })
	dir := os.Getenv("ACES_MIGRATIONS_DIR")
	if dir == "" {
		dir = filepath.Join("..", "db", "migrations")
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	sort.Strings(files)
	for _, file := range files {
		b, e := os.ReadFile(file)
		if e != nil {
			t.Fatal(e)
		}
		must(owner, string(b))
	}
	ident := pgx.Identifier{role}.Sanitize()
	for _, sql := range []string{"CREATE ROLE " + ident + " NOLOGIN", "GRANT USAGE ON SCHEMA public TO " + ident, "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO " + ident, "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO " + ident} {
		must(owner, sql)
	}
	mgr, err := tenant.NewManager(ctx, u.String(), tenant.Options{DefaultSlug: "uniuyo-ce", RuntimeRole: role})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(mgr.Close)
	dept := tenant.Tenant{ID: uuid.New(), Slug: "invite-dept", Name: "Invitation Department", URLCode: "iv", IsActive: true}
	other := tenant.Tenant{ID: uuid.New(), Slug: "other-invite", Name: "Other", IsActive: true}
	must(owner, `INSERT INTO tenants(id,slug,name,url_code) VALUES($1,$2,$3,$4)`, dept.ID, dept.Slug, dept.Name, dept.URLCode)
	must(owner, `INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)`, other.ID, other.Slug, other.Name)
	bound := tenant.With(ctx, dept)
	otherCtx := tenant.With(ctx, other)
	svc := Service{Pool: mgr.DB()}
	lecturer, student, rep, outsider := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, a := range []struct {
		id   uuid.UUID
		role string
	}{{lecturer, "lecturer"}, {student, "student"}, {rep, "class_rep"}, {outsider, "lecturer"}} {
		must(owner, `INSERT INTO users(tenant_id,id,email,password_hash,first_name,role,is_approved)VALUES($1,$2,$3,'hash',$3,$4,true)`, dept.ID, a.id, a.id.String()+"@example.edu", a.role)
	}
	year, semester, course := uuid.New(), uuid.New(), uuid.New()
	must(owner, `INSERT INTO sessions(tenant_id,id,name,start_date,end_date)VALUES($1,$2,'2026/2027',now()-interval '1 year',now()+interval '1 year')`, dept.ID, year)
	must(owner, `INSERT INTO semesters(tenant_id,id,session_id,name,start_date,end_date)VALUES($1,$2,$3,'harmattan',now()-interval '1 year',now()+interval '1 year')`, dept.ID, semester, year)
	must(owner, `INSERT INTO courses(tenant_id,id,code,title,unit,level,semester,lecturer_id)VALUES($1,$2,'CE101','Engineering',3,100,'harmattan',$3)`, dept.ID, course, lecturer)
	for _, u := range []uuid.UUID{student, rep} {
		st, reg := uuid.New(), uuid.New()
		must(owner, `INSERT INTO students(tenant_id,id,user_id,matric_number,entry_year,level)VALUES($1,$2,$3,$4,2026,100)`, dept.ID, st, u, u.String())
		must(owner, `INSERT INTO course_registrations(tenant_id,id,student_id,session_id,semester_id,status)VALUES($1,$2,$3,$4,$5,'approved')`, dept.ID, reg, st, year, semester)
		must(owner, `INSERT INTO registered_courses(tenant_id,registration_id,course_id)VALUES($1,$2,$3)`, dept.ID, reg, course)
	}
	if catalog, e := svc.Catalog(bound, lecturer); e != nil || !strings.Contains(string(catalog), "CE101") {
		t.Fatal("catalog", string(catalog), e)
	}
	lat, lon := 5.0, 8.0
	req := CreateRequest{CourseID: course, SemesterID: semester, Title: "Lecture 1", Venue: "Hall", ScheduledAt: time.Now(), Duration: 15, Radius: 100, Latitude: &lat, Longitude: &lon}
	if _, err = svc.Create(bound, rep, req); !errors.Is(err, ErrForbidden) {
		t.Fatal("rep created unapproved session", err)
	}
	x, err := svc.Create(bound, lecturer, req)
	if err != nil {
		t.Fatal("create", err)
	}
	if list, e := svc.List(bound, lecturer, course, semester); e != nil || !strings.Contains(string(list), x.ID.String()) || strings.Contains(string(list), "secret") {
		t.Fatal("session list", string(list), e)
	}
	if _, err = svc.Act(bound, outsider, x.ID, "open", ActionRequest{}); !errors.Is(err, ErrForbidden) {
		t.Fatal("unassigned lecturer opened", err)
	}
	if _, err = svc.Act(bound, lecturer, x.ID, "delegate", ActionRequest{DelegateID: &rep}); err != nil {
		t.Fatal("delegate", err)
	}
	if _, err = svc.Act(bound, rep, x.ID, "open", ActionRequest{}); err != nil {
		t.Fatal("open", err)
	}
	if _, err = svc.Code(otherCtx, student, x.ID); !errors.Is(err, ErrForbidden) {
		t.Fatal("tenant boundary", err)
	}
	if _, err = svc.Code(bound, student, x.ID); !errors.Is(err, ErrForbidden) {
		t.Fatal("student retrieved challenge", err)
	}
	code, err := svc.Code(bound, rep, x.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Checkin(bound, student, x.ID, CheckinRequest{Device: strings.Repeat("a", 64), Challenge: "invalid"}); !errors.Is(err, ErrChallenge) {
		t.Fatal("invalid challenge", err)
	}
	check := CheckinRequest{Challenge: code["challenge"].(string), Device: strings.Repeat("a", 64), Location: &Location{Latitude: lat, Longitude: lon, Accuracy: 10, CapturedAt: time.Now()}}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for n := 0; n < 2; n++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, e := svc.Checkin(bound, student, x.ID, check); errs <- e }()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal("concurrent checkin", e)
		}
	}
	var count int
	err = owner.QueryRow(ctx, `SELECT count(*) FROM attendance_v2_events WHERE session_id=$1 AND action='checkin'`, x.ID).Scan(&count)
	if err != nil || count != 1 {
		t.Fatal("duplicate checkin event", count, err)
	}
	detail, err := svc.Detail(bound, student, x.ID)
	if err != nil {
		t.Fatal("detail", err)
	}
	var d struct {
		Records []struct {
			User         uuid.UUID `json:"user_id"`
			Verification string    `json:"verification"`
		}
	}
	if err = json.Unmarshal(detail, &d); err != nil || len(d.Records) != 1 || d.Records[0].User != student || d.Records[0].Verification != "flagged" {
		t.Fatal("record isolation/first-device review", string(detail), err)
	}
	if _, err = svc.Act(bound, rep, x.ID, "close", ActionRequest{}); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Act(bound, rep, x.ID, "finalize", ActionRequest{Held: true}); !errors.Is(err, ErrForbidden) {
		t.Fatal("rep finalized", err)
	}
	if _, err = svc.Act(bound, lecturer, x.ID, "finalize", ActionRequest{Held: true}); !errors.Is(err, ErrConflict) {
		t.Fatal("flagged record finalized", err)
	}
	if err = svc.Review(bound, lecturer, x.ID, ReviewRequest{UserID: student, Outcome: "present", Reason: "Supervised student identity", ApproveDevice: true}); err != nil {
		t.Fatal("review", err)
	}
	if _, err = svc.Act(bound, lecturer, x.ID, "finalize", ActionRequest{}); !errors.Is(err, ErrConflict) {
		t.Fatal("held confirmation omitted", err)
	}
	if _, err = svc.Act(bound, lecturer, x.ID, "finalize", ActionRequest{Held: true}); err != nil {
		t.Fatal("finalize", err)
	}
	snap1, err := svc.Eligibility(bound, lecturer, course, semester, true)
	if err != nil {
		t.Fatal("snapshot", err)
	}
	if _, err = svc.Eligibility(bound, rep, course, semester, true); !errors.Is(err, ErrForbidden) {
		t.Fatal("rep published", err)
	}
	if snaps, e := svc.Snapshots(bound, student, course, semester); e != nil || strings.Contains(string(snaps), rep.String()) || strings.Contains(string(snaps), "basis") {
		t.Fatal("student snapshot privacy", string(snaps), e)
	}
	if _, e := svc.Snapshots(bound, lecturer, course, semester); e != nil {
		t.Fatal("snapshot history", e)
	}
	if _, e := svc.Detail(bound, lecturer, x.ID); e != nil {
		t.Fatal("teacher detail", e)
	}
	if err = svc.Dispute(bound, student, x.ID, "My record needs academic review"); err != nil {
		t.Fatal("dispute", err)
	}
	if repDetail, e := svc.Detail(bound, rep, x.ID); e != nil || strings.Contains(string(repDetail), "My record needs academic review") {
		t.Fatal("rep saw peer dispute evidence", string(repDetail), e)
	}
	live, err := svc.Eligibility(bound, student, course, semester, false)
	if err != nil || !strings.Contains(string(live), "pending_review") {
		t.Fatal("dispute not pending", string(live), err)
	}
	if err = svc.Review(bound, lecturer, x.ID, ReviewRequest{UserID: student, Outcome: "absent", Reason: "Verified correction after review"}); err != nil {
		t.Fatal(err)
	}
	snap2, err := svc.Eligibility(bound, lecturer, course, semester, true)
	if err != nil {
		t.Fatal(err)
	}
	if string(snap1) == string(snap2) || !strings.Contains(string(snap2), `"version": 2`) {
		t.Fatal("snapshot not versioned", string(snap2))
	}
	if _, err = owner.Exec(ctx, `UPDATE attendance_v2_snapshots SET version=100 WHERE course_id=$1`, course); err == nil {
		t.Fatal("snapshot mutable")
	}
	if _, err = owner.Exec(ctx, `DELETE FROM attendance_v2_events WHERE session_id=$1`, x.ID); err == nil {
		t.Fatal("audit deletable")
	}
	// Three further attended sessions give exactly 3/4 = 75%; unsubmitted
	// roster members remain absent. An approved device passes automatically.
	for n := 0; n < 3; n++ {
		req.ScheduledAt = time.Now().Add(time.Duration(n+1) * time.Minute)
		next, e := svc.Create(bound, lecturer, req)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = svc.Act(bound, lecturer, next.ID, "open", ActionRequest{}); e != nil {
			t.Fatal(e)
		}
		c, e := svc.Code(bound, lecturer, next.ID)
		if e != nil {
			t.Fatal(e)
		}
		check.Challenge = c["challenge"].(string)
		check.Location.CapturedAt = time.Now()
		record, e := svc.Checkin(bound, student, next.ID, check)
		if e != nil || !strings.Contains(string(record), `"verified"`) {
			t.Fatal("approved device not verified", string(record), e)
		}
		if _, e = svc.Act(bound, lecturer, next.ID, "close", ActionRequest{}); e != nil {
			t.Fatal(e)
		}
		if _, e = svc.Act(bound, lecturer, next.ID, "finalize", ActionRequest{Held: true}); e != nil {
			t.Fatal(e)
		}
	}
	live, err = svc.Eligibility(bound, student, course, semester, false)
	if err != nil || !strings.Contains(string(live), `"percentage":75`) || !strings.Contains(string(live), `"decision":"eligible"`) {
		t.Fatal("exact 75%", string(live), err)
	}
	// A newly presented credential requires supervised replacement. Poor GPS
	// remains reviewable even for an approved credential.
	req.ScheduledAt = time.Now().Add(5 * time.Minute)
	replacement, e := svc.Create(bound, lecturer, req)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = svc.Act(bound, lecturer, replacement.ID, "open", ActionRequest{}); e != nil {
		t.Fatal(e)
	}
	c, e := svc.Code(bound, lecturer, replacement.ID)
	if e != nil {
		t.Fatal(e)
	}
	check.Challenge = c["challenge"].(string)
	check.Device = strings.Repeat("b", 64)
	check.Location = nil
	rec, e := svc.Checkin(bound, student, replacement.ID, check)
	if e != nil || !strings.Contains(string(rec), "device_unverified") || !strings.Contains(string(rec), "location_unavailable") {
		t.Fatal("replacement missing GPS", string(rec), e)
	}
	// Shared-device detection is only a signal; it must not silently reject.
	rec, e = svc.Checkin(bound, rep, replacement.ID, check)
	if e != nil || !strings.Contains(string(rec), "device_shared") {
		t.Fatal("shared-device signal", string(rec), e)
	}
	if _, e = svc.Act(bound, lecturer, replacement.ID, "close", ActionRequest{}); e != nil {
		t.Fatal(e)
	}
	if _, e = svc.Act(bound, lecturer, replacement.ID, "cancel", ActionRequest{Reason: "Pilot replacement exercise cancelled"}); e != nil {
		t.Fatal(e)
	}
	live, e = svc.Eligibility(bound, student, course, semester, false)
	if e != nil || !strings.Contains(string(live), `"percentage":75`) {
		t.Fatal("cancel inflated denominator", string(live), e)
	}
	// A closed session cannot accept a previously absent student's check-in.
	if _, e = svc.Checkin(bound, rep, x.ID, check); !errors.Is(e, ErrConflict) {
		t.Fatal("late checkin accepted", e)
	}
	// Removing the teaching role also removes authority even if the course
	// assignment has not yet been cleaned up.
	must(owner, `UPDATE users SET role='student' WHERE id=$1`, lecturer)
	if _, e = svc.Create(bound, lecturer, req); !errors.Is(e, ErrForbidden) {
		t.Fatal("removed teaching role still authorized", e)
	}
	must(owner, `UPDATE users SET role='lecturer' WHERE id=$1`, lecturer)
	// Archived course/semester records stay visible in the catalog.
	must(owner, `UPDATE semesters SET is_active=false WHERE id=$1`, semester)
	if catalog, e := svc.Catalog(bound, student); e != nil || !strings.Contains(string(catalog), "CE101") {
		t.Fatal("archived history disappeared", string(catalog), e)
	}
	// Revoking a teaching assignment immediately removes write authority.
	must(owner, `UPDATE courses SET lecturer_id=$2 WHERE id=$1`, course, outsider)
	if err = svc.Review(bound, lecturer, x.ID, ReviewRequest{UserID: student, Outcome: "present", Reason: "Old authority must fail"}); !errors.Is(err, ErrForbidden) {
		t.Fatal("stale authority", err)
	}
}
