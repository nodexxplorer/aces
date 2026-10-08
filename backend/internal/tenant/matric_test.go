package tenant

import "testing"

func TestValidMatricCode(t *testing.T) {
	valid := []string{"EG/CO", "EG/EE", "EG/CE", "EG/PE", "EG/AE", "EG/FE", "EG/CV", "EG/ME"}
	for _, code := range valid {
		if !ValidMatricCode(code) {
			t.Errorf("ValidMatricCode(%q) = false, want true", code)
		}
	}

	invalid := []string{"", "EE", "eg/ee", "EG-EE", "EG/EE/1", "EG/E", "EG/EEE", "E1/EE", "EG/EE ", " EG/EE"}
	for _, code := range invalid {
		if ValidMatricCode(code) {
			t.Errorf("ValidMatricCode(%q) = true, want false", code)
		}
	}
}

func TestMatricNumberMatches(t *testing.T) {
	cases := []struct {
		name   string
		code   string
		matric string
		want   bool
	}{
		{"computer engineering", "EG/CO", "20/EG/CO/1234", true},
		{"electrical engineering", "EG/EE", "20/EG/EE/1234", true},
		{"three-digit serial", "EG/EE", "21/EG/EE/123", true},
		{"five-digit serial", "EG/EE", "21/EG/EE/12345", true},
		{"other department", "EG/EE", "20/EG/CO/1234", false},
		{"other faculty", "EG/EE", "20/AG/EE/1234", false},
		{"serial too short", "EG/EE", "20/EG/EE/12", false},
		{"serial too long", "EG/EE", "20/EG/EE/123456", false},
		{"serial not digits", "EG/EE", "20/EG/EE/12A4", false},
		{"year not two digits", "EG/EE", "2020/EG/EE/1234", false},
		{"year not digits", "EG/EE", "AA/EG/EE/1234", false},
		{"extra segment", "EG/EE", "20/EG/EE/1234/1", false},
		{"missing segment", "EG/EE", "20/EE/1234", false},
		{"lowercase matric", "EG/EE", "20/eg/ee/1234", false},
		{"empty matric", "EG/EE", "", false},
		{"empty code matches nothing", "", "20/EG/EE/1234", false},
		{"malformed code matches nothing", "EE", "20/EG/EE/1234", false},
		{"code with whitespace", "EG/EE ", "20/EG/EE/1234", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := MatricNumberMatches(c.code, c.matric); got != c.want {
				t.Errorf("MatricNumberMatches(%q, %q) = %v, want %v", c.code, c.matric, got, c.want)
			}
		})
	}
}

func TestMatricExample(t *testing.T) {
	if got := MatricExample("EG/EE"); got != "20/EG/EE/1234" {
		t.Errorf("MatricExample(EG/EE) = %q", got)
	}
	// The example must itself match its own department.
	if !MatricNumberMatches("EG/CO", MatricExample("EG/CO")) {
		t.Error("MatricExample does not match its own code")
	}
}
