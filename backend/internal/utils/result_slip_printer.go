package utils

import (
	"bytes"
	"fmt"
	"strings"
)

type ResultSlipCourse struct {
	CourseCode string
	CourseTitle string
	Unit       int
	Score      float64
	Grade      string
	GradePoint float64
}

type ResultSlipInput struct {
	DepartmentName string
	StudentName    string
	MatricNumber   string
	Level          int
	SessionName    string
	SemesterName   string
	Courses        []ResultSlipCourse
	SemesterGPA    float64
	CumulativeCGPA float64
}

// GenerateResultSlipPDF produces a branded PDF showing one semester's
// results — a lighter-weight document than a full transcript, suitable for
// scholarship applications and other internal use, following the same
// hand-rolled PDF scaffolding as GenerateAttendancePDF.
func GenerateResultSlipPDF(input ResultSlipInput) ([]byte, error) {
	var totalUnits int
	for _, c := range input.Courses {
		totalUnits += c.Unit
	}

	content := buildResultSlipStream(input, totalUnits)

	var buf bytes.Buffer
	objs := []string{}
	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	pageObjIdx := addObj("")
	contentObjIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>")
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>")

	objs[pageObjIdx-1] = fmt.Sprintf(
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> >>",
		contentObjIdx,
	)

	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs))
	for i, body := range objs {
		offsets[i] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, body))
	}

	xrefOff := buf.Len()
	n := len(objs) + 1
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", n))
	buf.WriteString("0000000000 65535 f \n")
	for _, off := range offsets {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", off))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", n, xrefOff))

	return buf.Bytes(), nil
}

func buildResultSlipStream(input ResultSlipInput, totalUnits int) string {
	var txt strings.Builder
	var gfx strings.Builder

	const (
		pageW   = 595.0
		centerX = pageW / 2
	)

	// Watermark
	gfx.WriteString("q\n0.85 0.9 0.95 rg\n")
	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, 400, 72, "F4", "ACES ZONE")
	txt.WriteString("ET\n")
	gfx.WriteString("Q\n")

	deptName := input.DepartmentName
	if deptName == "" {
		deptName = "ELECTRICAL & COMPUTER ENGINEERING"
	}

	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, 800, 16, "F4", fmt.Sprintf("DEPARTMENT OF %s", strings.ToUpper(deptName)))
	pdfCentered(&txt, centerX, 780, 14, "F2", "SEMESTER RESULT SLIP")
	pdfCentered(&txt, centerX, 764, 10, "F3", "(Unofficial — for internal use; not a substitute for an official transcript)")

	pdfAt(&txt, 40, 738, 11, "F2", fmt.Sprintf("Student: %s", input.StudentName))
	pdfAt(&txt, 40, 723, 10, "F1", fmt.Sprintf("Matric Number: %s   |   Level: %d", input.MatricNumber, input.Level))
	pdfAt(&txt, 40, 708, 10, "F1", fmt.Sprintf("Session: %s   |   Semester: %s", input.SessionName, input.SemesterName))
	txt.WriteString("ET\n")

	// Header bar
	gfx.WriteString("0.0 0.2 0.4 rg\n")
	gfx.WriteString("40 678 515 20 re f\n")

	txt.WriteString("BT\n1 1 1 rg\n")
	pdfAt(&txt, 45, 684, 10, "F2", "Code")
	pdfAt(&txt, 105, 684, 10, "F2", "Course Title")
	pdfAt(&txt, 350, 684, 10, "F2", "Unit")
	pdfAt(&txt, 390, 684, 10, "F2", "Score")
	pdfAt(&txt, 440, 684, 10, "F2", "Grade")
	pdfAt(&txt, 485, 684, 10, "F2", "Point")
	txt.WriteString("0 0 0 rg\nET\n")

	y := 658.0
	rowH := 18.0

	txt.WriteString("BT\n")
	for i, c := range input.Courses {
		if y < 160 {
			break
		}
		if i%2 == 1 {
			gfx.WriteString("0.95 0.96 0.98 rg\n")
			gfx.WriteString(fmt.Sprintf("40 %.2f 515 %.2f re f\n", y-3, rowH))
			gfx.WriteString("0 0 0 rg\n")
		}

		pdfAt(&txt, 45, y+2, 9, "F2", c.CourseCode)
		pdfAt(&txt, 105, y+2, 9, "F1", c.CourseTitle)
		pdfAt(&txt, 350, y+2, 9, "F1", fmt.Sprintf("%d", c.Unit))
		pdfAt(&txt, 390, y+2, 9, "F1", fmt.Sprintf("%.1f", c.Score))
		pdfAt(&txt, 440, y+2, 9, "F2", c.Grade)
		pdfAt(&txt, 485, y+2, 9, "F1", fmt.Sprintf("%.1f", c.GradePoint))

		y -= rowH
	}
	txt.WriteString("ET\n")

	summaryY := y - 20
	if summaryY < 140 {
		summaryY = 140
	}

	gfx.WriteString("0.2 w\n")
	gfx.WriteString(fmt.Sprintf("40 %.2f 515 45 re S\n", summaryY))

	txt.WriteString("BT\n")
	pdfAt(&txt, 50, summaryY+28, 10, "F2", fmt.Sprintf("Courses: %d   |   Total Units: %d", len(input.Courses), totalUnits))
	pdfAt(&txt, 50, summaryY+14, 11, "F4", fmt.Sprintf("Semester GPA: %.2f", input.SemesterGPA))
	pdfAt(&txt, 250, summaryY+14, 11, "F4", fmt.Sprintf("Cumulative CGPA: %.2f", input.CumulativeCGPA))

	sigY := summaryY - 35
	pdfAt(&txt, 50, sigY, 10, "F1", "Registrar/HOD Signature: _______________________")
	pdfAt(&txt, 340, sigY, 10, "F1", "Date: ____________________")

	pdfCentered(&txt, centerX, 30, 8, "F1", "Generated by ACES Zone System · Departmental Academic Records")
	txt.WriteString("ET\n")

	return gfx.String() + txt.String()
}
