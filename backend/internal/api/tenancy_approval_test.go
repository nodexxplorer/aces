package api

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/aces/backend/internal/tenant"
)

// The approval page sends the student to the department's approval address.
// Without one it uses the contact address, and with neither it has no address.
func TestTenantResponseApprovalContactFallsBack(t *testing.T) {
	cases := []struct {
		name string
		in   tenant.Tenant
		want string
	}{
		{"approval address wins", tenant.Tenant{ContactEmail: "receipts@example.edu", ApprovalEmail: "hod@example.edu"}, "hod@example.edu"},
		{"contact address when no approval address", tenant.Tenant{ContactEmail: "receipts@example.edu"}, "receipts@example.edu"},
		{"no address at all", tenant.Tenant{}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := toTenantResponse(c.in).ApprovalContactEmail; got != c.want {
				t.Fatalf("ApprovalContactEmail = %q, want %q", got, c.want)
			}
		})
	}
}

// The approval address is part of the signed-in user's tenant object. It is
// left out when the department has no address to give.
func TestTenantResponseApprovalContactJSON(t *testing.T) {
	withApproval, err := json.Marshal(toTenantResponse(tenant.Tenant{ApprovalEmail: "hod@example.edu"}))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withApproval), `"approvalContactEmail":"hod@example.edu"`) {
		t.Fatalf("approval address missing from tenant response: %s", withApproval)
	}

	empty, err := json.Marshal(toTenantResponse(tenant.Tenant{Slug: "dept-new", Name: "Department of New Studies"}))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(empty), "approvalContactEmail") {
		t.Fatalf("an empty approval address should be omitted: %s", empty)
	}
}
