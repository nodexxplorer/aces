package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/aces/backend/internal/db/sql"
)

// Needs a real Postgres, skipped unless DB_SOURCE names a server whose user can
// create databases. ACES_MIGRATIONS_DIR can point at a copy of the migrations
// with the uuid-ossp/pgcrypto lines removed, as for the admin grant test.

const feeTestTenant = "00000000-0000-4000-8000-000000000001"

func applyFeeMigrations(t *testing.T, conn *pgx.Conn) {
	t.Helper()
	dir := os.Getenv("ACES_MIGRATIONS_DIR")
	if dir == "" {
		dir = filepath.Join("..", "db", "migrations")
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("find migrations in %s: %v (found %d)", dir, err, len(files))
	}
	sort.Strings(files)
	for _, f := range files {
		sqlBytes, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if _, err := conn.Exec(context.Background(), string(sqlBytes)); err != nil {
			t.Fatalf("apply %s: %v", filepath.Base(f), err)
		}
	}
}

func TestCRFSigningFeePostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping signing fee database test")
	}
	ctx := context.Background()

	dbName := fmt.Sprintf("aces_fee_test_%d", time.Now().UnixNano())
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatalf("connect to DB_SOURCE: %v", err)
	}
	if _, err := setup.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{dbName}.Sanitize()); err != nil {
		t.Fatalf("create database: %v", err)
	}
	setup.Close(ctx)
	t.Cleanup(func() {
		c, err := pgx.Connect(context.Background(), src)
		if err != nil {
			return
		}
		defer c.Close(context.Background())
		_, _ = c.Exec(context.Background(), "DROP DATABASE IF EXISTS "+pgx.Identifier{dbName}.Sanitize()+" WITH (FORCE)")
	})

	u, err := url.Parse(src)
	if err != nil {
		t.Fatalf("parse DB_SOURCE: %v", err)
	}
	u.Path = "/" + dbName
	conn, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	defer conn.Close(ctx)

	applyFeeMigrations(t, conn)
	if _, err := conn.Exec(ctx, "SELECT set_config('app.tenant_id', $1, false)", feeTestTenant); err != nil {
		t.Fatalf("set tenant: %v", err)
	}

	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := conn.Exec(ctx, q, args...); err != nil {
			t.Fatalf("seed %q: %v", q, err)
		}
	}
	var sessionID, activeSem, pastSem uuid.UUID
	if err := conn.QueryRow(ctx, `INSERT INTO sessions (name, start_date, end_date) VALUES ('2026/2027', now(), now() + interval '1 year') RETURNING id`).Scan(&sessionID); err != nil {
		t.Fatalf("seed session: %v", err)
	}
	if err := conn.QueryRow(ctx, `INSERT INTO semesters (session_id, name, start_date, end_date, is_active) VALUES ($1, 'first', now(), now() + interval '6 months', true) RETURNING id`, sessionID).Scan(&activeSem); err != nil {
		t.Fatalf("seed active semester: %v", err)
	}
	if err := conn.QueryRow(ctx, `INSERT INTO semesters (session_id, name, start_date, end_date, is_active) VALUES ($1, 'second', now() - interval '1 year', now() - interval '6 months', false) RETURNING id`, sessionID).Scan(&pastSem); err != nil {
		t.Fatalf("seed past semester: %v", err)
	}
	studentUser := uuid.New()
	mustExec(`INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES ($1, 'fee-student@x', 'x', 'student', 'F', 'Ee')`, studentUser)
	var studentID uuid.UUID
	if err := conn.QueryRow(ctx, `INSERT INTO students (user_id, matric_number, level, entry_year, current_session_id, current_semester) VALUES ($1, 'FEE/0001', 300, 2024, $2, 'first') RETURNING id`, studentUser, sessionID).Scan(&studentID); err != nil {
		t.Fatalf("seed student: %v", err)
	}

	// newSubmission inserts a draft course form for the student in the given semester.
	newSubmission := func(user uuid.UUID, semester uuid.UUID) db.CRFSigningSubmission {
		t.Helper()
		var id uuid.UUID
		if err := conn.QueryRow(ctx, `INSERT INTO crf_signing_submissions (user_id, semester_id, original_file_path, signed_file_path, status) VALUES ($1, $2, 'orig.pdf', '', 'draft') RETURNING id`, user, semester).Scan(&id); err != nil {
			t.Fatalf("seed submission: %v", err)
		}
		return db.CRFSigningSubmission{ID: id, UserID: user, SemesterID: semester}
	}

	queries := db.New(conn)
	server := &Server{store: queries}
	gin.SetMode(gin.TestMode)
	run := func(t *testing.T, sub db.CRFSigningSubmission) (bool, *httptest.ResponseRecorder) {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil).WithContext(ctx)
		blocked := server.requireCRFSigningFee(c, queries, sub)
		return blocked, w
	}
	feeRows := func(sub db.CRFSigningSubmission) int {
		t.Helper()
		var n int
		if err := conn.QueryRow(ctx, `SELECT count(*) FROM payments WHERE crf_submission_id = $1`, sub.ID).Scan(&n); err != nil {
			t.Fatalf("count fees: %v", err)
		}
		return n
	}

	regular := newSubmission(studentUser, activeSem)

	t.Run("regular form without a fee is blocked and gets one pending fee", func(t *testing.T) {
		blocked, w := run(t, regular)
		if !blocked {
			t.Fatal("regular form was allowed to sign without the fee")
		}
		if w.Code != http.StatusPaymentRequired {
			t.Fatalf("status = %d, want 402", w.Code)
		}
		if n := feeRows(regular); n != 1 {
			t.Fatalf("fee rows = %d, want 1", n)
		}
		var isTwoHundred bool
		var status, typ string
		if err := conn.QueryRow(ctx, `SELECT amount = 200, status::text, type::text FROM payments WHERE crf_submission_id = $1`, regular.ID).Scan(&isTwoHundred, &status, &typ); err != nil {
			t.Fatalf("read fee: %v", err)
		}
		if !isTwoHundred || status != "pending" || typ != "other" {
			t.Fatalf("fee: amount is 200 = %v, status %s, type %s; want 200 pending other", isTwoHundred, status, typ)
		}
	})

	t.Run("a repeat attempt reuses the pending fee", func(t *testing.T) {
		blocked, _ := run(t, regular)
		if !blocked {
			t.Fatal("pending fee should still block signing")
		}
		if n := feeRows(regular); n != 1 {
			t.Fatalf("fee rows = %d after retry, want 1", n)
		}
	})

	t.Run("a completed fee lets the form be signed", func(t *testing.T) {
		mustExec(`UPDATE payments SET status = 'completed', paid_at = now() WHERE crf_submission_id = $1`, regular.ID)
		blocked, _ := run(t, regular)
		if blocked {
			t.Fatal("completed fee should allow signing")
		}
		if n := feeRows(regular); n != 1 {
			t.Fatalf("fee rows = %d, want 1", n)
		}
	})

	t.Run("a second regular form needs its own fee", func(t *testing.T) {
		// One submission per student per semester, so the second form is another student's.
		otherUser := uuid.New()
		mustExec(`INSERT INTO users (id, email, password_hash, role, first_name, last_name) VALUES ($1, 'fee-other@x', 'x', 'student', 'G', 'Ee')`, otherUser)
		mustExec(`INSERT INTO students (user_id, matric_number, level, entry_year, current_session_id, current_semester) VALUES ($1, 'FEE/0002', 300, 2024, $2, 'first')`, otherUser, sessionID)
		second := newSubmission(otherUser, activeSem)
		blocked, _ := run(t, second)
		if !blocked {
			t.Fatal("second regular form was allowed without its own fee")
		}
		if n := feeRows(second); n != 1 {
			t.Fatalf("fee rows for second form = %d, want 1", n)
		}
	})

	t.Run("backlog form for a past semester is not charged the signing fee", func(t *testing.T) {
		backlog := newSubmission(studentUser, pastSem)
		blocked, _ := run(t, backlog)
		if blocked {
			t.Fatal("backlog form was blocked; its fee is in the backlog price")
		}
		if n := feeRows(backlog); n != 0 {
			t.Fatalf("backlog form got %d fee rows, want 0", n)
		}
	})

	t.Run("dues checkout charge is part of the batch the webhook reconciles", func(t *testing.T) {
		// A cart of ₦1000 dues with the ₦200 charge: one batch of ₦1200 whose two rows share the reference.
		const reference = "ACES-FEE-TEST-1"
		var batchID uuid.UUID
		if err := conn.QueryRow(ctx, `INSERT INTO payment_batches (student_id, total_amount, paystack_reference) VALUES ($1, 1200, $2) RETURNING id`, studentID, reference).Scan(&batchID); err != nil {
			t.Fatalf("seed batch: %v", err)
		}
		mustExec(`INSERT INTO payments (student_id, batch_id, type, item_name, amount, paystack_reference, status) VALUES ($1, $2, 'dept_dues', 'Dues', 1000, $3, 'pending')`, studentID, batchID, reference)
		mustExec(`INSERT INTO payments (student_id, batch_id, type, item_name, amount, paystack_reference, status) VALUES ($1, $2, 'other', 'Payment Processing Charge', 200, $3, 'pending')`, studentID, batchID, reference)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil).WithContext(ctx)

		// Underpaid by the charge (paid ₦1000): refused, nothing completed.
		if _, err := server.completePaymentsForReference(c, reference, 100000); err == nil {
			t.Fatal("underpayment of the batch total was accepted")
		}
		var pending int
		if err := conn.QueryRow(ctx, `SELECT count(*) FROM payments WHERE batch_id = $1 AND status = 'pending'`, batchID).Scan(&pending); err != nil {
			t.Fatalf("count: %v", err)
		}
		if pending != 2 {
			t.Fatalf("pending rows after refused payment = %d, want 2", pending)
		}

		// Paid in full (₦1200): both the dues and the charge complete.
		if _, err := server.completePaymentsForReference(c, reference, 120000); err != nil {
			t.Fatalf("full payment refused: %v", err)
		}
		var completed int
		if err := conn.QueryRow(ctx, `SELECT count(*) FROM payments WHERE batch_id = $1 AND status = 'completed'`, batchID).Scan(&completed); err != nil {
			t.Fatalf("count completed: %v", err)
		}
		if completed != 2 {
			t.Fatalf("completed rows = %d, want 2", completed)
		}
	})

	t.Run("fee query prefers the completed fee over a newer pending one", func(t *testing.T) {
		ref := pgtype.UUID{Bytes: regular.ID, Valid: true}
		if _, err := queries.CreateCRFSigningFeePayment(ctx, db.CreateCRFSigningFeePaymentParams{
			StudentID: studentID, Type: db.PaymentTypeOther, ItemName: "dup", Amount: crfSigningFee, CrfSubmissionID: ref,
		}); err != nil {
			t.Fatalf("create duplicate: %v", err)
		}
		got, err := queries.GetCRFSigningFeeForSubmission(ctx, ref)
		if err != nil {
			t.Fatalf("get fee: %v", err)
		}
		if got.Status != db.PaymentStatus("completed") {
			t.Fatalf("got status %s, want completed", got.Status)
		}
	})
}
