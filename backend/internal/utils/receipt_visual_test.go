package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// TestVisualOutput renders the dues receipts (department and class, as PNG and
// PDF) and the department stamp for two departments to real files, so they can
// be inspected visually. Each receipt and stamp carries that department's own
// name. Output goes to $RECEIPT_VISUAL_DIR (default: ./visual_output next to
// this file, git-ignored). Run it with:
//
//	go test ./internal/utils/ -run TestVisualOutput -v
//
// The printed paths are the files to open.
func TestVisualOutput(t *testing.T) {
	outDir := os.Getenv("RECEIPT_VISUAL_DIR")
	if outDir == "" {
		outDir = filepath.Join(".", "visual_output")
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", outDir, err)
	}

	d := ReceiptData{
		Date:         "29/09/2026",
		ReceivedFrom: "John Doe (20/EE/1234)",
		Of:           "John Doe (20/EE/1234)",
		SumOf:        "Fifteen Thousand Naira, Only",
		NairaWords:   "Fifteen Thousand",
		KoboWords:    "Zero",
		Being:        "Payment of Department Dues 2025/2026",
		AmountNaira:  "15000",
		AmountKobo:   "00",
		RegNo:        "20/EE/1234",
	}

	departments := []struct {
		slug, name, email string
		logo              []byte // nil draws the placeholder, as for a department with no logo yet
	}{
		{"ce", "Department of Computer Engineering", "acesuniuyo112@gmail.com", acesLogoPNG},
		{"ee", "Department of Electrical Engineering", "", nil},
	}

	paths := []string{}
	for _, dept := range departments {
		org := OrgFor(dept.name, "University of Uyo", dept.email, dept.logo)

		for _, kind := range []ReceiptKind{DepartmentDues, ClassDues} {
			kindName := "department"
			if kind == ClassDues {
				kindName = "class"
			}
			base := "receipt_" + dept.slug + "_" + kindName

			dc := RenderReceipt(org, kind, 1, d)
			pngPath := filepath.Join(outDir, base+".png")
			if err := dc.SavePNG(pngPath); err != nil {
				t.Fatalf("SavePNG(%s): %v", base, err)
			}
			paths = append(paths, pngPath)

			pdfBytes, err := RenderReceiptPDF(org, kind, 1, d)
			if err != nil {
				t.Fatalf("RenderReceiptPDF(%s): %v", base, err)
			}
			pdfPath := filepath.Join(outDir, base+".pdf")
			if err := os.WriteFile(pdfPath, pdfBytes, 0o644); err != nil {
				t.Fatalf("write %s: %v", pdfPath, err)
			}
			paths = append(paths, pdfPath)
		}

		// Department stamp (transparent PNG), with the department's own name.
		cfg, err := StampConfigFor(dept.name)
		if err != nil {
			t.Fatalf("StampConfigFor(%s): %v", dept.name, err)
		}
		stampPNG, err := DeptStampPNG(500, 320, cfg)
		if err != nil {
			t.Fatalf("DeptStampPNG(%s): %v", dept.slug, err)
		}
		stampPath := filepath.Join(outDir, "dept_stamp_"+dept.slug+".png")
		if err := os.WriteFile(stampPath, stampPNG, 0o644); err != nil {
			t.Fatalf("write %s: %v", stampPath, err)
		}
		paths = append(paths, stampPath)
	}

	fmt.Println("\nVisual samples written:")
	for _, p := range paths {
		abs, _ := filepath.Abs(p)
		fmt.Println("  " + abs)
	}
}
