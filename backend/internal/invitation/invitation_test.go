package invitation

import (
	"errors"
	"strings"
	"testing"
)

func TestInvitationAuthority(t *testing.T) {
	for _, tc := range []struct {
		name string
		a    Authority
		role string
		want bool
	}{
		{"HOD admin", Authority{HOD: true}, "delegated_admin", true},
		{"HOD HOD", Authority{HOD: true}, "hod", true},
		{"delegate lecturer", Authority{ManageUsers: true}, "lecturer", true},
		{"delegate cannot authorize admin", Authority{ManageUsers: true}, "delegated_admin", false},
		{"delegate cannot authorize HOD", Authority{ManageUsers: true}, "hod", false},
		{"unprivileged", Authority{}, "lecturer", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.a.CanAuthorize(tc.role) != tc.want {
				t.Fatal("wrong authorization")
			}
		})
	}
}
func TestNormalizeInvitation(t *testing.T) {
	r, err := Normalize(Request{Email: " HOD@Example.edu ", Name: " Jane Doe ", Role: "admin", Grants: map[string]bool{"can_manage_users": true}})
	if err != nil || r.Email != "hod@example.edu" || r.Name != "Jane Doe" || r.Role != "delegated_admin" {
		t.Fatalf("%+v %v", r, err)
	}
	for _, bad := range []Request{
		{Email: "Name <a@example.edu>", Name: "Name", Role: "hod"},
		{Email: "a@example.edu", Name: "\r\nBcc:other", Role: "hod"},
		{Email: "a@example.edu", Name: "Name", Role: "superadmin"},
		{Email: "a@example.edu", Name: "Name", Role: "hod", Grants: map[string]bool{"can_manage_users": true}},
		{Email: "a@example.edu", Name: "Name", Role: "admin", Grants: map[string]bool{"all": true}},
	} {
		if _, err := Normalize(bad); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted invalid request %+v", bad)
		}
	}
}
func TestInvitationToken(t *testing.T) {
	a, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := NewToken()
	if a == b || len(a) != 64 {
		t.Fatal("tokens must be random 256-bit values")
	}
	h, err := HashToken(a)
	if err != nil || h == a || len(h) != 64 {
		t.Fatal("must store digest, not bearer token")
	}
	upper, _ := HashToken(strings.ToUpper(a))
	if upper != h {
		t.Fatal("case changes must not bypass single-use hash")
	}
	for _, bad := range []string{"", strings.Repeat("a", 63), strings.Repeat("x", 64), strings.Repeat("a", 66)} {
		if _, err := HashToken(bad); err == nil {
			t.Fatal("accepted malformed token")
		}
	}
}
func TestFrontendOrigin(t *testing.T) {
	for _, raw := range []string{"https://app.example.edu", "http://localhost:5173"} {
		if _, err := FrontendOrigin(raw); err != nil {
			t.Fatal(err)
		}
	}
	for _, raw := range []string{"", "http://evil.example", "https://user:pass@app.example", "https://app.example/?redirect=evil", "https://app.example/#secret", "https://app.example/subpath", "javascript:alert(1)"} {
		if _, err := FrontendOrigin(raw); err == nil {
			t.Fatalf("accepted unsafe origin %q", raw)
		}
	}
}
