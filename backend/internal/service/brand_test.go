package service

import (
	"strings"
	"testing"

	"github.com/aces/backend/internal/tenant"
)

func TestQuickActionsNameTheDepartment(t *testing.T) {
	actions := quickActionsFor(tenant.Brand{Name: "Department of Electrical Engineering"})
	last := actions[len(actions)-1]
	if last.Query != "How do I use Department of Electrical Engineering?" {
		t.Errorf("help query = %q", last.Query)
	}
	for _, a := range actions {
		if strings.Contains(a.Query+a.Label, "ACES") {
			t.Errorf("quick action %q still names ACES", a.ID)
		}
	}
}

func TestAssistantIntroNamesDepartmentAndInstitution(t *testing.T) {
	got := assistantIntro(tenant.Brand{Name: "Department of Petroleum Engineering", Institution: "University of Uyo"})
	want := "You are Department of Petroleum Engineering Assistant, the AI helper for Department of Petroleum Engineering, the students' platform at University of Uyo."
	if got != want {
		t.Errorf("got %q", got)
	}
	if plain := assistantIntro(tenant.Brand{Name: "Admin Pack"}); strings.Contains(plain, "University") {
		t.Errorf("no institution must not name one: %q", plain)
	}
}

func TestNotificationEmailNamesDepartmentAndLinksItsLogo(t *testing.T) {
	s := &NotificationServiceFull{apiURL: "https://api.example.edu"}
	brand := tenant.Brand{Slug: "dept-ee", Name: "Department of Electrical Engineering", Institution: "University of Uyo", HasLogo: true}
	body := s.buildNotificationEmailHTML(brand, "Dues due", "Pay by Friday", "", "", "")
	for _, want := range []string{
		"Department of Electrical Engineering",
		"https://api.example.edu/api/v1/tenants/dept-ee/logo",
		"University of Uyo",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("email is missing %q", want)
		}
	}
	if strings.Contains(body, "ACES") || strings.Contains(body, "aces-logo.png") {
		t.Error("a department's email must not carry the association's name or the old logo path")
	}

	noLogo := s.buildNotificationEmailHTML(tenant.Brand{Slug: "dept-ee", Name: "Department of Electrical Engineering"}, "t", "m", "", "", "")
	if strings.Contains(noLogo, "<img") {
		t.Error("a department without a logo must not get an image tag")
	}
}
