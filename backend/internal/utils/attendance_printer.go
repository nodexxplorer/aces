package utils

import (
	"bytes"
	"fmt"
	"strings"
)

type AttendancePDFRecord struct {
	MatricNumber string
	FullName     string
	Level        int
	Status       string // present, absent, late, excused
}

type AttendancePDFInput struct {
	DepartmentName string
	CourseCode     string
	CourseTitle    string
	ScheduledDate  string
	StartTime      string
	EndTime        string
	Venue          string
	LecturerName   string
	ClassRepName   string
	Records        []AttendancePDFRecord
}

// GenerateAttendancePDF produces a branded PDF A4 attendance sheet.
func GenerateAttendancePDF(input AttendancePDFInput) ([]byte, error) {
	presentCount := 0
	absentCount := 0
	lateCount := 0
	excusedCount := 0

	for _, r := range input.Records {
		switch strings.ToLower(r.Status) {
		case "present":
			presentCount++
		case "absent":
			absentCount++
		case "late":
			lateCount++
		case "excused":
			excusedCount++
		}
	}

	total := len(input.Records)
	attendanceRate := 0.0
	if total > 0 {
		attendanceRate = float64(presentCount+lateCount) / float64(total) * 100
	}

	content := buildAttendancePDFStream(input, total, presentCount, absentCount, lateCount, excusedCount, attendanceRate)

	var buf bytes.Buffer
	objs := []string{}
	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")                                                         // 1
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")                                                 // 2
	pageObjIdx := addObj("")                                                                            // 3
	contentObjIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content)) // 4
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")            // 5 F1
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")       // 6 F2
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>")          // 7 F3
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>")           // 8 F4

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

func buildAttendancePDFStream(input AttendancePDFInput, total, present, absent, late, excused int, rate float64) string {
	var txt strings.Builder
	var gfx strings.Builder

	const (
		pageW   = 595.0
		pageH   = 842.0
		centerX = pageW / 2
	)

	// Watermark
	gfx.WriteString("q\n")
	gfx.WriteString("0.85 0.9 0.95 rg\n")
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
	pdfCentered(&txt, centerX, 780, 14, "F2", "CLASS ATTENDANCE SHEET")

	// Info section
	pdfAt(&txt, 40, 745, 11, "F2", fmt.Sprintf("Course: %s - %s", input.CourseCode, input.CourseTitle))
	pdfAt(&txt, 40, 730, 10, "F1", fmt.Sprintf("Date: %s | Time: %s - %s", input.ScheduledDate, input.StartTime, input.EndTime))
	pdfAt(&txt, 40, 715, 10, "F1", fmt.Sprintf("Venue: %s | Lecturer: %s | Class Rep: %s", input.Venue, input.LecturerName, input.ClassRepName))
	txt.WriteString("ET\n")

	// Header background bar
	gfx.WriteString("0.0 0.2 0.4 rg\n") // Dark Blue
	gfx.WriteString("40 685 515 20 re f\n")

	txt.WriteString("BT\n")
	txt.WriteString("1 1 1 rg\n") // White text
	pdfAt(&txt, 45, 691, 10, "F2", "S/N")
	pdfAt(&txt, 75, 691, 10, "F2", "Matric Number")
	pdfAt(&txt, 195, 691, 10, "F2", "Full Name")
	pdfAt(&txt, 385, 691, 10, "F2", "Level")
	pdfAt(&txt, 465, 691, 10, "F2", "Status")
	txt.WriteString("0 0 0 rg\n") // Reset text to black
	txt.WriteString("ET\n")

	y := 665.0
	rowH := 18.0

	txt.WriteString("BT\n")
	for i, r := range input.Records {
		if y < 140 { // keep room for summary & signature
			break
		}

		if i%2 == 1 {
			gfx.WriteString("0.95 0.96 0.98 rg\n")
			gfx.WriteString(fmt.Sprintf("40 %.2f 515 %.2f re f\n", y-3, rowH))
			gfx.WriteString("0 0 0 rg\n")
		}

		pdfAt(&txt, 45, y+2, 9, "F1", fmt.Sprintf("%d", i+1))
		pdfAt(&txt, 75, y+2, 9, "F2", r.MatricNumber)
		pdfAt(&txt, 195, y+2, 9, "F1", r.FullName)
		pdfAt(&txt, 385, y+2, 9, "F1", fmt.Sprintf("%d", r.Level))

		st := strings.ToUpper(r.Status)
		pdfAt(&txt, 465, y+2, 9, "F2", st)

		y -= rowH
	}
	txt.WriteString("ET\n")

	// Summary block
	summaryY := y - 20
	if summaryY < 120 {
		summaryY = 120
	}

	gfx.WriteString("0.2 w\n")
	gfx.WriteString(fmt.Sprintf("40 %.2f 515 35 re S\n", summaryY))

	txt.WriteString("BT\n")
	pdfAt(&txt, 50, summaryY+20, 10, "F2", fmt.Sprintf("Summary: %d Registered  |  %d Present  |  %d Absent  |  %d Late  |  %d Excused", total, present, absent, late, excused))
	pdfAt(&txt, 50, summaryY+7, 10, "F4", fmt.Sprintf("Attendance Rate: %.1f%%", rate))

	// Signatures
	sigY := summaryY - 35
	pdfAt(&txt, 50, sigY, 10, "F1", "Class Rep Signature: _______________________")
	pdfAt(&txt, 340, sigY, 10, "F1", "Lecturer Signature: _______________________")

	pdfAt(&txt, 50, sigY-18, 9, "F1", "Date: ____________________")
	pdfAt(&txt, 340, sigY-18, 9, "F1", "Date: ____________________")

	pdfCentered(&txt, centerX, 30, 8, "F1", "Generated by ACES Zone System · Departmental Academic Records")
	txt.WriteString("ET\n")

	return gfx.String() + txt.String()
}
