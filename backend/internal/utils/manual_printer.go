package utils

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/skip2/go-qrcode"
)

// CoverPageInput holds all data needed to generate a lab manual cover PDF.
type CoverPageInput struct {
	StudentName string
	RegNo       string
	Department  string
	Level       int
	CourseCode  string
	CourseTitle string
	Session     string // e.g. "2025/2026"
	Semester    string // e.g. "Second Semester"
	QRCodeData  *string
}

// GenerateManualCover produces a PDF/1.4 A4 cover page matching the physical
// University of Uyo lab manual cover used by the Dept. of Computer Engineering.
func GenerateManualCover(input CoverPageInput) ([]byte, error) {
	sessionLabel := input.Session
	if sessionLabel == "" {
		sessionLabel = "2025/2026"
	}
	semesterLabel := input.Semester
	if semesterLabel == "" {
		semesterLabel = "Second Semester"
	}
	// Use plain ASCII separator to avoid encoding issues with Type1 fonts
	sessionSemester := sessionLabel + " - " + semesterLabel

	// ── Generate QR bitmap ([][]bool) ──────────────────────────────────────
	var qrMatrix [][]bool
	if input.QRCodeData != nil && *input.QRCodeData != "" {
		qc, err := qrcode.New(*input.QRCodeData, qrcode.Medium)
		if err == nil {
			qrMatrix = qc.Bitmap()
		}
	}

	// ── Build page content stream ──────────────────────────────────────────
	content := buildCoverContent(input, sessionSemester, qrMatrix)

	// ── Assemble PDF objects ───────────────────────────────────────────────
	var buf bytes.Buffer
	objs := []string{}

	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")                                                                                                        // 1
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")                                                                                                // 2
	addObj(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>"))    // 3
	addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))                                                              // 4
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")                                                        // 5
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")                                                   // 6

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

func buildCoverContent(input CoverPageInput, sessionSemester string, qrMatrix [][]bool) string {
	var txt strings.Builder // BT...ET text block
	var gfx strings.Builder // graphics operators (outside BT/ET)

	const (
		pageW      = 595.0
		centerX    = pageW / 2
		leftMargin = 72.0
		rightEdge  = 523.0
	)

	// ── Logo circle ─────────────────────────────────────────────────────────
	{
		cx, cy, r := centerX, 800.0, 20.0
		k := 0.5523 * r
		gfx.WriteString("0.5 w\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", cx, cy+r))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f %.2f %.2f c\n", cx+k, cy+r, cx+r, cy+k, cx+r, cy))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f %.2f %.2f c\n", cx+r, cy-k, cx+k, cy-r, cx, cy-r))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f %.2f %.2f c\n", cx-k, cy-r, cx-r, cy-k, cx-r, cy))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f %.2f %.2f c\n", cx-r, cy+k, cx-k, cy+r, cx, cy+r))
		gfx.WriteString("S\n")
	}

	// ── Text block ──────────────────────────────────────────────────────────
	txt.WriteString("BT\n")

	// University header
	y := 762.0
	pdfCentered(&txt, centerX, y, 14, "F2", "UNIVERSITY OF UYO")
	y -= 17
	pdfCentered(&txt, centerX, y, 9, "F1", "FACULTY OF ENGINEERING")
	y -= 14
	pdfCentered(&txt, centerX, y, 10, "F2", "DEPARTMENT OF COMPUTER ENGINEERING")

	// Horizontal rule drawn in graphics — record y for later
	headerRuleY := y - 8

	// "Laboratory Manual For"
	y -= 38
	pdfCentered(&txt, centerX, y, 9, "F1", "LABORATORY MANUAL FOR")

	// Course code — big and bold
	y -= 44
	pdfCentered(&txt, centerX, y, 32, "F2", pdfSafe(input.CourseCode))

	// Course title
	y -= 30
	pdfCentered(&txt, centerX, y, 13, "F2", pdfSafe(strings.ToUpper(input.CourseTitle)))

	// Gap then "STUDENT'S IDENTIFICATION"
	y -= 52
	pdfCentered(&txt, centerX, y, 10, "F1", "STUDENT'S IDENTIFICATION")

	// ── QR code geometry ────────────────────────────────────────────────────
	// QR box sits on the right: x=370..490, aligned with the three field rows.
	const (
		qrBoxX = 370.0
		qrBoxW = 120.0
		qrBoxH = 110.0
	)

	// ── Form fields ─────────────────────────────────────────────────────────
	fieldLabelX := leftMargin
	fieldValueX := 160.0
	fieldUnderW := 270.0 // underline stops before QR box (leave ~30pt gap)

	nameY := y - 28
	regY := nameY - 34
	deptY := regY - 34
	qrBoxY := deptY + 3 // bottom of QR box aligns with bottom of DEPT line

	pdfAt(&txt, fieldLabelX, nameY, 10, "F2", "NAME:")
	pdfAt(&txt, fieldValueX, nameY, 10, "F1", pdfSafe(input.StudentName))

	pdfAt(&txt, fieldLabelX, regY, 10, "F2", "REG. NO:")
	pdfAt(&txt, fieldValueX, regY, 10, "F1", pdfSafe(input.RegNo))

	pdfAt(&txt, fieldLabelX, deptY, 10, "F2", "DEPARTMENT:")
	pdfAt(&txt, fieldValueX, deptY, 10, "F1", pdfSafe(input.Department))

	// Session / Semester
	sessionY := deptY - 40
	pdfAt(&txt, fieldLabelX, sessionY, 10, "F2", "SESSION-SEMESTER:")
	pdfAt(&txt, fieldLabelX, sessionY-16, 12, "F2", pdfSafe(sessionSemester))

	// QR caption labels (below QR box)
	qrCaptionY := qrBoxY - 12
	qrCenterX := qrBoxX + qrBoxW/2
	pdfCenteredBetween(&txt, qrBoxX, qrBoxX+qrBoxW, qrCaptionY, 8, "F2", "Scan to Verify")
	pdfCenteredBetween(&txt, qrBoxX, qrBoxX+qrBoxW, qrCaptionY-11, 7, "F1", "Submission - Payment - Identity")

	txt.WriteString("ET\n")

	// ── Graphics: field underlines ──────────────────────────────────────────
	gfx.WriteString("0.4 w\n")
	for _, fy := range []float64{nameY, regY, deptY} {
		ly := fy - 4
		gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", fieldLabelX, ly))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f l\n", fieldLabelX+fieldUnderW, ly))
		gfx.WriteString("S\n")
	}

	// ── Graphics: header rule ───────────────────────────────────────────────
	gfx.WriteString("0.3 w\n")
	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, headerRuleY))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\n", rightEdge, headerRuleY))
	gfx.WriteString("S\n")

	// ── Graphics: session rule ──────────────────────────────────────────────
	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, sessionY+14))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\n", rightEdge, sessionY+14))
	gfx.WriteString("S\n")

	// ── Graphics: QR code as vector grid ────────────────────────────────────
	if qrMatrix != nil && len(qrMatrix) > 0 {
		size := len(qrMatrix)
		// Draw a white background first
		gfx.WriteString("1 g\n") // white fill
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re f\n", qrBoxX, qrBoxY, qrBoxW, qrBoxH))
		gfx.WriteString("0 g\n") // back to black fill

		// go-qrcode Bitmap() includes quiet zone; skip outer 4-module quiet zone
		quietZone := 4
		modules := size - 2*quietZone
		if modules < 1 {
			quietZone = 0
			modules = size
		}
		cellSize := qrBoxW / float64(modules)

		for row := 0; row < modules; row++ {
			for col := 0; col < modules; col++ {
				srcRow := row + quietZone
				srcCol := col + quietZone
				if srcRow >= size || srcCol >= size {
					continue
				}
				if qrMatrix[srcRow][srcCol] {
					// PDF y-axis is bottom-up; QR row 0 is top
					px := qrBoxX + float64(col)*cellSize
					py := qrBoxY + float64(modules-1-row)*cellSize
					gfx.WriteString(fmt.Sprintf("%.3f %.3f %.3f %.3f re f\n",
						px, py, cellSize, cellSize))
				}
			}
		}

		// Thin border around QR box
		gfx.WriteString("0 g\n")
		gfx.WriteString("0.4 w\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\n", qrBoxX, qrBoxY, qrBoxW, qrBoxH))
		gfx.WriteString("S\n")
	} else {
		// Fallback: empty bordered box
		gfx.WriteString("0.5 w\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\n", qrBoxX, qrBoxY, qrBoxW, qrBoxH))
		gfx.WriteString("S\n")
	}

	_ = qrCenterX  // used for caption centering calculations above
	_ = qrBoxY     // suppress unused warning (used in qrCaptionY calculation above)

	return txt.String() + gfx.String()
}

// pdfSafe escapes PDF string literal special characters.
func pdfSafe(s string) string {
	// Remove non-Latin-1 characters that Helvetica WinAnsiEncoding can't render
	var b strings.Builder
	for _, r := range s {
		if r < 128 {
			switch r {
			case '(':
				b.WriteString("\\(")
			case ')':
				b.WriteString("\\)")
			case '\\':
				b.WriteString("\\\\")
			default:
				b.WriteRune(r)
			}
		} else if r == '\u00b7' || r == '\u2022' {
			b.WriteByte('-') // replace bullet/middle-dot with hyphen
		} else if r < 256 {
			// Latin-1 supplement — write as octal escape
			b.WriteString(fmt.Sprintf("\\%03o", r))
		}
		// Drop anything above Latin-1
	}
	return b.String()
}

// pdfCentered places text centered horizontally at centerX.
func pdfCentered(b *strings.Builder, centerX, y, size float64, font, text string) {
	approxW := float64(len(text)) * size * 0.52
	x := centerX - approxW/2
	pdfAt(b, x, y, size, font, text)
}

// pdfCenteredBetween centers text between x1 and x2.
func pdfCenteredBetween(b *strings.Builder, x1, x2, y, size float64, font, text string) {
	approxW := float64(len(text)) * size * 0.52
	cx := (x1 + x2) / 2
	pdfAt(b, cx-approxW/2, y, size, font, text)
}

// pdfAt emits PDF operators to render text at absolute position (x, y).
func pdfAt(b *strings.Builder, x, y, size float64, font, text string) {
	b.WriteString(fmt.Sprintf("/%s %g Tf\n", font, size))
	b.WriteString(fmt.Sprintf("1 0 0 1 %.2f %.2f Tm\n", x, y))
	b.WriteString(fmt.Sprintf("(%s) Tj\n", text))
}
