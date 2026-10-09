package main

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// A web address code clash must be reported as one, not as a matric code clash:
// both are unique violations, and only the constraint name tells them apart.
func TestDescribeWriteErrorNamesTheRightUniqueConstraint(t *testing.T) {
	url := describeWriteError(&pgconn.PgError{Code: "23505", ConstraintName: "tenants_url_code_key"}, "EG/EE")
	if url == nil || !strings.Contains(url.Error(), "web address code is already used") {
		t.Fatalf("URL code clash reported as %v", url)
	}
	matric := describeWriteError(&pgconn.PgError{Code: "23505", ConstraintName: "tenants_matric_code_idx"}, "EG/EE")
	if matric == nil || !strings.Contains(matric.Error(), "matric code EG/EE is already used") {
		t.Fatalf("matric code clash reported as %v", matric)
	}
}

func TestDescribeWriteErrorExplainsTheURLCodeRule(t *testing.T) {
	err := describeWriteError(&pgconn.PgError{Code: "23514", ConstraintName: "tenants_url_code_format"}, "")
	if err == nil || !strings.Contains(err.Error(), "2 to 12 lowercase letters or digits") {
		t.Fatalf("URL code format error reported as %v", err)
	}
}
