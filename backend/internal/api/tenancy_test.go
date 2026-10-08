package api

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/aces/backend/internal/tenant"
)

// The contact address is part of the signed-in user's tenant object. The public
// department list has no field for it, so anonymous callers never see it.
func TestTenantResponseCarriesContactEmail(t *testing.T) {
	withContact, err := json.Marshal(toTenantResponse(tenant.Tenant{
		Slug:         "dept-ee",
		Name:         "Department of Electrical Engineering",
		ContactEmail: "ee@example.edu",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(withContact), `"contactEmail":"ee@example.edu"`) {
		t.Fatalf("contact address missing from tenant response: %s", withContact)
	}

	withoutContact, err := json.Marshal(toTenantResponse(tenant.Tenant{
		Slug: "dept-new",
		Name: "Department of New Studies",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(withoutContact), "contactEmail") {
		t.Fatalf("an empty contact address should be omitted: %s", withoutContact)
	}
}

func TestTenantListItemHasNoContactEmail(t *testing.T) {
	raw, err := json.Marshal(tenantListItem{Slug: "dept-ee", Name: "Department of Electrical Engineering"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "contactEmail") {
		t.Fatalf("the public department list must not carry a contact address: %s", raw)
	}
}
