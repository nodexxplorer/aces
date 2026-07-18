package utils

import (
	"bytes"
	"fmt"
	"strings"
)

type CoverPageInput struct {
	StudentName string
	RegNo       string
	Department  string
	Level       int
	CourseCode  string
	CourseTitle string
	QRCodeData  *string
}

func GenerateManualCover(input CoverPageInput) ([]byte, error) {
	var buf bytes.Buffer

	objects := []string{}
	objectOffsets := []int{}

	addObject := func(content string) int {
		objects = append(objects, content)
		return len(objects)
	}

	// Obj 1: Catalog
	addObject("<< /Type /Catalog /Pages 2 0 R >>")

	// Obj 2: Pages
	addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")

	// Build page content stream
	content := buildCoverContent(input)
	contentIdx := addObject(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))

	// Obj 3: Page
	addObject(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>", contentIdx))

	// Font objects
	addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
	addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
	addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")

	// Write PDF header
	buf.WriteString("%PDF-1.4\n")

	for _, obj := range objects {
		objectOffsets = append(objectOffsets, buf.Len())
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", len(objectOffsets), obj))
	}

	// Cross-reference table
	xrefOffset := buf.Len()
	totalObjs := len(objects) + 1
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", totalObjs))
	buf.WriteString("0000000000 65535 f \n")
	for _, off := range objectOffsets {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", off))
	}

	// Trailer
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", totalObjs, xrefOffset))

	return buf.Bytes(), nil
}

func buildCoverContent(input CoverPageInput) string {
	var b strings.Builder

	b.WriteString("BT\n")

	writeText(&b, 200, 760, 16, "F2", "UNIVERSITY OF TECHNOLOGY")
	writeText(&b, 200, 740, 12, "F1", "Faculty of Engineering")
	writeText(&b, 200, 720, 12, "F1", "Department of "+input.Department)

	writeTextCentered(&b, 297, 680, 11, "F3", "LABORATORY MANUAL FOR")
	writeTextCentered(&b, 297, 650, 20, "F2", input.CourseCode)
	writeTextCentered(&b, 297, 625, 14, "F2", input.CourseTitle)

	writeTextCentered(&b, 297, 570, 13, "F2", "STUDENT'S IDENTIFICATION")

	y := 540.0
	writeField(&b, y, "NAME:", input.StudentName)
	y -= 25
	writeField(&b, y, "REG. NO:", input.RegNo)
	y -= 25
	writeField(&b, y, "DEPARTMENT:", input.Department)
	y -= 25
	writeField(&b, y, "LEVEL:", fmt.Sprintf("%d00", input.Level))
	y -= 25
	writeField(&b, y, "SESSION:", "2025/2026")

	// QR code section
	writeTextCentered(&b, 297, 370, 10, "F3", "Scan to Verify")
	writeTextCentered(&b, 297, 355, 10, "F1", "Submission | Payment | Identity")

	b.WriteString("ET\n")
	return b.String()
}

func writeText(b *strings.Builder, x, y, size float64, font, text string) {
	safeText := strings.ReplaceAll(text, "(", "\\(")
	safeText = strings.ReplaceAll(safeText, ")", "\\)")
	b.WriteString(fmt.Sprintf("/%s %g Tf\n", font, size))
	b.WriteString(fmt.Sprintf("%g %g Td\n", x, y))
	b.WriteString(fmt.Sprintf("(%s) Tj\n", safeText))
	b.WriteString("T*\n")
}

func writeTextCentered(b *strings.Builder, centerX, y, size float64, font, text string) {
	approxWidth := float64(len(text)) * size * 0.45
	x := centerX - approxWidth/2
	writeText(b, x, y, size, font, text)
}

func writeField(b *strings.Builder, y float64, label, value string) {
	safeVal := strings.ReplaceAll(value, "(", "\\(")
	safeVal = strings.ReplaceAll(safeVal, ")", "\\)")
	writeText(b, 120, y, 11, "F2", label)
	writeText(b, 250, y, 11, "F1", safeVal)
	b.WriteString(fmt.Sprintf("120 %g m\n", y-3))
	b.WriteString("420 0 l\n")
	b.WriteString("0.5 w\n")
	b.WriteString("S\n")
}
