package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/aces/backend/internal/tenant"
	"github.com/google/uuid"
)

var (
	idCE = uuid.MustParse("00000000-0000-4000-8000-000000000001")
	idEE = uuid.MustParse("55555555-5555-4555-8555-555555555555")
	idCH = uuid.MustParse("66666666-6666-4666-8666-666666666666")
)

func testDepartments() (ce, ee, chem tenant.Tenant, active []tenant.Tenant) {
	ce = tenant.Tenant{ID: idCE, Slug: "uniuyo-ce", Name: "Department of Computer Engineering", MatricCode: "EG/CO", IsActive: true}
	ee = tenant.Tenant{ID: idEE, Slug: "dept-ee", Name: "Department of Electrical Engineering", MatricCode: "EG/EE", IsActive: true}
	chem = tenant.Tenant{ID: idCH, Slug: "dept-che", Name: "Department of Chemical Engineering", MatricCode: "EG/CE", IsActive: true}
	return ce, ee, chem, []tenant.Tenant{ce, ee, chem}
}

func TestMatricProblem(t *testing.T) {
	ce, ee, _, active := testDepartments()
	unset := tenant.Tenant{ID: uuid.New(), Slug: "dept-new", Name: "Department of Petroleum Engineering", IsActive: true}

	cases := []struct {
		name       string
		current    tenant.Tenant
		matric     string
		active     []tenant.Tenant
		wantStatus int
		wantMsg    string // substring; empty means accepted
	}{
		{
			name:    "own department accepted",
			current: ce, matric: "20/EG/CO/1234", active: active,
		},
		{
			name:    "electrical student in electrical department accepted",
			current: ee, matric: "20/EG/EE/0456", active: active,
		},
		{
			name:    "electrical matric in computer engineering names electrical",
			current: ce, matric: "20/EG/EE/1234", active: active,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "This matric number belongs to Department of Electrical Engineering.",
		},
		{
			name:    "unknown code gets the format for the current department",
			current: ce, matric: "20/EG/XX/1234", active: active,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "Matric numbers for Department of Computer Engineering look like 20/EG/CO/1234.",
		},
		{
			name:    "malformed matric gets the format",
			current: ee, matric: "", active: active,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "look like 20/EG/EE/1234.",
		},
		{
			name:    "wrong serial length gets the format",
			current: ee, matric: "20/EG/EE/12", active: active,
			wantStatus: http.StatusBadRequest,
			wantMsg:    "look like 20/EG/EE/1234.",
		},
		{
			name:    "department without a code fails closed",
			current: unset, matric: "20/EG/CO/1234", active: active,
			wantStatus: http.StatusUnprocessableEntity,
			wantMsg:    "Matric numbers are not set up for Department of Petroleum Engineering yet.",
		},
		{
			// A department with no code must not accept a matric number that
			// belongs to another department, even though it is active.
			name:    "unset department does not accept another department's matric",
			current: unset, matric: "20/EG/EE/1234", active: active,
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name:    "other department not active is not named",
			current: ce, matric: "20/EG/EE/1234", active: []tenant.Tenant{ce},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "look like 20/EG/CO/1234.",
		},
		{
			name:    "current department is never named as another",
			current: ee, matric: "20/EG/CO/1234", active: []tenant.Tenant{ee},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "look like 20/EG/EE/1234.",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			status, msg := matricProblem(c.current, c.matric, c.active)
			if status != c.wantStatus {
				t.Fatalf("status = %d, want %d (message %q)", status, c.wantStatus, msg)
			}
			if c.wantMsg != "" && !strings.Contains(msg, c.wantMsg) {
				t.Errorf("message = %q, want it to contain %q", msg, c.wantMsg)
			}
			if c.wantStatus == 0 && msg != "" {
				t.Errorf("accepted matric should have no message, got %q", msg)
			}
		})
	}
}
