package api

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/aces/backend/internal/config"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func TestNotificationSettingsPostgres(t *testing.T) {
	src := os.Getenv("DB_SOURCE")
	if src == "" {
		t.Skip("DB_SOURCE not set; skipping Connect database integration tests")
	}
	ctx := context.Background()
	setup, err := pgx.Connect(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	dbname := "aces_notifications_" + suffix
	role := "aces_notifications_rt_" + suffix
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
	_ = otherCtx
	q := db.New(mgr.DB())
	server := &Server{store: q, dbPool: mgr.DB(), config: &config.Config{SMTPMock: true, PushMock: true}, notificationsFull: service.NewNotificationServiceFull(q, nil, nil, nil, "https://portal.example", nil, "")}
	actor, otherActor := uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{actor, otherActor} {
		must(owner, `INSERT INTO users(tenant_id,id,email,password_hash,first_name,role,is_approved)VALUES($1,$2,$3,'hash','User','student',true)`, dept.ID, id, id.String()+"@example.edu")
	}
	gin.SetMode(gin.TestMode)
	r := newEngine()
	r.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(bound)
		c.Set("userID", actor.String())
		c.Next()
	})
	r.GET("/preferences", server.getMyNotificationPreferences)
	r.PUT("/preferences", server.updateMyNotificationPreferences)
	r.PUT("/devices", server.registerNotificationDevice)
	r.DELETE("/devices", server.unregisterNotificationDevice)
	r.POST("/test", server.testNotification)
	r.GET("/test/:id", server.notificationTestStatus)
	r.GET("/delivery-status", server.notificationDeliveryStatus)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		return w
	}
	if w := request("GET", "/preferences", ""); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, body := range []string{`{"quiet_hours_start":"22:00"}`, `{"quiet_hours_start":"99:00","quiet_hours_end":"07:00"}`, `{"quiet_hours_start":null,"quiet_hours_end":"07:00"}`, `null`} {
		if w := request("PUT", "/preferences", body); w.Code != 400 {
			t.Fatal("invalid preference accepted", body, w.Code, w.Body.String())
		}
	}
	if w := request("PUT", "/preferences", `{"email_enabled":false,"quiet_hours_start":"22:00","quiet_hours_end":"07:00"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := request("PUT", "/preferences", `{"email_auth":false}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	p, err := q.GetNotificationPreferences(bound, actor)
	if err != nil || p.EmailEnabled || p.EmailAuth || !p.PushEnabled || p.QuietHoursStart == nil {
		t.Fatal("PATCH semantics", p, err)
	}
	if w := request("PUT", "/preferences", `{"quiet_hours_start":null,"quiet_hours_end":null}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	p, err = q.GetNotificationPreferences(bound, actor)
	if err != nil || p.QuietHoursStart != nil || p.QuietHoursEnd != nil {
		t.Fatal("quiet hours not cleared", err)
	}
	if w := request("PUT", "/devices", `{"platform":"web","subscription":{"endpoint":"https://127.0.0.1/admin"}}`); w.Code != 400 {
		t.Fatal("SSRF endpoint accepted", w.Code)
	}
	token := "ExpoPushToken[abcdefghijklmnop]"
	if w := request("PUT", "/devices", `{"platform":"expo","token":"`+token+`"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	testID := uuid.NewString()
	if w := request("POST", "/test", `{"id":"`+testID+`"}`); w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := request("GET", "/test/"+testID, ""); w.Code != 200 || !strings.Contains(w.Body.String(), "queued") {
		t.Fatal(w.Code, w.Body.String())
	}
	original := actor
	actor = otherActor
	if w := request("GET", "/test/"+testID, ""); w.Code != 404 {
		t.Fatal("other user can inspect test", w.Code)
	}
	actor = original
	for i := 0; i < 4; i++ {
		if w := request("POST", "/test", `{"id":"`+uuid.NewString()+`"}`); w.Code != 202 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if w := request("POST", "/test", `{"id":"`+testID+`"}`); w.Code != 202 {
		t.Fatal("idempotent test retry rejected", w.Code, w.Body.String())
	}
	if w := request("POST", "/test", `{"id":"`+uuid.NewString()+`"}`); w.Code != 429 {
		t.Fatal("test rate limit ignored", w.Code, w.Body.String())
	}
	w := request("GET", "/delivery-status", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "simulated") {
		t.Fatal(w.Code, w.Body.String())
	}
	var response map[string]any
	if json.Unmarshal(w.Body.Bytes(), &response) != nil {
		t.Fatal("invalid status response")
	}
	if w := request("DELETE", "/devices", `{"address":"`+token+`"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var active int
	if err = mgr.DB().QueryRow(bound, `SELECT count(*) FROM notification_devices WHERE active`).Scan(&active); err != nil || active != 0 {
		t.Fatal("logout device retained", active, err)
	}
}
