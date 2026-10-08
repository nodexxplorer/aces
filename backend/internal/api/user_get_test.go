package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// missingUserStore answers GetUser the way the database does for an unknown
// id (or one in another department, which row-level security hides).
type missingUserStore struct {
	db.Querier
}

func (missingUserStore) GetUser(_ context.Context, _ uuid.UUID) (db.User, error) {
	return db.User{}, pgx.ErrNoRows
}

func TestGetUserUnknownIDIsNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := &Server{users: service.NewUserService(missingUserStore{})}

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Params = gin.Params{{Key: "id", Value: uuid.NewString()}}
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/v1/users/x", nil)

	server.getUser(ctx)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body %s)", w.Code, w.Body.String())
	}
	if body := w.Body.String(); body != `{"error":"user not found"}` {
		t.Fatalf("body = %s", body)
	}
}
