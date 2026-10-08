package api

import (
	"strings"
	"testing"

	"github.com/aces/backend/internal/tenant"
)

func TestPasswordResetEmailNamesDepartment(t *testing.T) {
	body := passwordResetOTPEmailHTML(tenant.Brand{Name: "Department of Electrical Engineering"}, "123456")
	if !strings.Contains(body, ">Department of Electrical Engineering</div>") {
		t.Error("the reset email must name the department in its header")
	}
	if strings.Contains(body, "ACES Zone") || !strings.Contains(body, "123456") {
		t.Error("the reset email must carry the code and no association name")
	}
}

func TestReceiptFileNameUsesDepartment(t *testing.T) {
	got := receiptFileName(tenant.Brand{Slug: "dept-ee"}, "abcdef12-3456-7890-abcd-ef1234567890", "DUES", 7)
	if got != "DEPT-EE-DUES-Receipt-0007-abcdef12.pdf" {
		t.Errorf("got %q", got)
	}
	if plain := receiptFileName(tenant.PlatformBrand(), "abcdef12-3456", "DUES", 7); !strings.HasPrefix(plain, "RECEIPT-") {
		t.Errorf("a receipt with no department must not borrow another one's prefix, got %q", plain)
	}
}
