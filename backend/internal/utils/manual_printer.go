package utils

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"strings"

	"github.com/skip2/go-qrcode"
)

// uniuyoLogoPNG is the University of Uyo crest, rasterized once from the
// official SVG (download.svg -> assets/uniuyo_logo.png @ 400x400, white bg)
// and baked into the binary. Re-generate with:
//
//	rsvg-convert -w 400 -h 400 -b white download.svg -o assets/uniuyo_logo.png
//
//go:embed assets/uniuyo_logo.png
var uniuyoLogoPNG []byte

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
	sessionSemester := sessionLabel + " \u00b7 " + semesterLabel

	// ── Generate QR bitmap ([][]bool) ──────────────────────────────────────
	var qrMatrix [][]bool
	if input.QRCodeData != nil && *input.QRCodeData != "" {
		qc, err := qrcode.New(*input.QRCodeData, qrcode.Medium)
		if err == nil {
			qrMatrix = qc.Bitmap()
		}
	}

	// ── Prepare logo as a JPEG-encoded Image XObject ───────────────────────
	logoW, logoH, logoJPEG, err := encodeLogoJPEG()
	if err != nil {
		return nil, fmt.Errorf("encode logo: %w", err)
	}

	// ── Build page content stream ──────────────────────────────────────────
	content := buildCoverContent(input, sessionSemester, qrMatrix)

	// ── Assemble PDF objects ───────────────────────────────────────────────
	var buf bytes.Buffer
	objs := []string{}

	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")         // 1
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>") // 2
	pageObjIdx := addObj("")                            // 3 (patched below, needs child obj numbers)
	contentObjIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content)) // 4
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")            // 5  F1
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")       // 6  F2
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>")          // 7  F3
	addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>")           // 8  F4
	imageObjIdx := addObj(fmt.Sprintf(
		"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
		logoW, logoH, len(logoJPEG), string(logoJPEG),
	)) // 9

	objs[pageObjIdx-1] = fmt.Sprintf(
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> /XObject << /Im1 %d 0 R >> >> >>",
		contentObjIdx, imageObjIdx,
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

// encodeLogoJPEG decodes the embedded PNG crest and re-encodes it as JPEG
// (DCTDecode), which PDF viewers can embed as an Image XObject with no
// extra decode filters needed.
func encodeLogoJPEG() (w, h int, data []byte, err error) {
	img, _, decErr := image.Decode(bytes.NewReader(uniuyoLogoPNG))
	if decErr != nil {
		return 0, 0, nil, decErr
	}
	var buf bytes.Buffer
	if encErr := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 92}); encErr != nil {
		return 0, 0, nil, encErr
	}
	b := img.Bounds()
	return b.Dx(), b.Dy(), buf.Bytes(), nil
}

// mm converts millimeters to PDF points (1mm = 2.83465pt), matching the
// spec's measurements exactly rather than eyeballed point values.
func mm(v float64) float64 { return v * 2.83465 }

func buildCoverContent(input CoverPageInput, sessionSemester string, qrMatrix [][]bool) string {
	var txt strings.Builder // BT...ET text block
	var gfx strings.Builder // graphics operators (outside BT/ET)

	const (
		pageW   = 595.0
		pageH   = 842.0
		centerX = pageW / 2
	)

	leftMargin := mm(22)        // spec: left margin 22mm
	rightEdge := pageW - mm(22) // spec: right margin 22mm

	// gapScale stretches the header/title cascade (logo through the NAME
	// field) so the content fills more of the page instead of leaving a
	// large blank strip at the bottom. It deliberately does NOT apply to the
	// NAME/REG.NO/DEPARTMENT/SESSION field spacing below — those are meant
	// to stay as tight, literal 12mm/4mm form-field gaps per spec; scaling
	// them too pushed "2025/2026 · Second Semester" completely off the page.
	const gapScale = 2.26
	g := func(v float64) float64 { return mm(v * gapScale) }

	// ── Logo: 23mm square, 9mm below the top margin ─────────────────────────
	logoSize := mm(23)
	logoTop := pageH - mm(9)
	logoBottom := logoTop - logoSize
	{
		logoX := centerX - logoSize/2
		gfx.WriteString("q\n")
		gfx.WriteString(fmt.Sprintf("%.2f 0 0 %.2f %.2f %.2f cm\n", logoSize, logoSize, logoX, logoBottom))
		gfx.WriteString("/Im1 Do\n")
		gfx.WriteString("Q\n")
	}

	// ── Vertical cascade — header/title gaps scaled, field gaps literal ────
	uniY := logoBottom - g(5)              // logo -> university name: 5mm (scaled)
	facultyY := uniY - g(3)                // university -> faculty: 3mm (scaled)
	deptY := facultyY - g(5)               // faculty -> department: 5mm (scaled)
	labManualY := deptY - g(17)            // department -> "laboratory manual for": 17mm (scaled)
	courseCodeY := labManualY - g(14)      // -> course code: 14mm (scaled)
	courseTitleY := courseCodeY - g(2.5)   // -> course title: 2.5mm (scaled)
	studentIDY := courseTitleY - g(22)     // -> "student's identification": 22mm (scaled)
	nameY := studentIDY - g(14)            // -> NAME field: 14mm (scaled)
	regY := nameY - mm(12)                 // NAME -> REG. NO: 12mm (literal)
	deptFieldY := regY - mm(12)            // REG. NO -> DEPARTMENT: 12mm (literal)
	sessionLabelY := deptFieldY - mm(12)   // DEPARTMENT -> SESSION-SEMESTER: 12mm (literal)
	sessionValueY := sessionLabelY - mm(4) // label -> value: 4mm (literal)

	txt.WriteString("BT\n")

	pdfCentered(&txt, centerX, uniY, 19, "F4", "UNIVERSITY OF UYO")               // Times-Bold 19pt
	pdfCentered(&txt, centerX, facultyY, 10.5, "F3", "FACULTY OF ENGINEERING")    // Times-Roman 10.5pt
	pdfCentered(&txt, centerX, deptY, 14.5, "F4", "DEPARTMENT OF COMPUTER ENGINEERING") // Times-Bold 14.5pt

	pdfCentered(&txt, centerX, labManualY, 11.5, "F1", "LABORATORY MANUAL FOR")   // Arial (Helvetica) 11.5pt
	pdfCentered(&txt, centerX, courseCodeY, 30, "F4", input.CourseCode)  // Times-Bold 30pt
	pdfCentered(&txt, centerX, courseTitleY, 14.5, "F2", strings.ToUpper(input.CourseTitle)) // Arial Bold 14.5pt

	pdfCentered(&txt, centerX, studentIDY, 11.5, "F3", "STUDENT'S IDENTIFICATION") // Times-Roman 11.5pt

	// ── Two-column split begins here ────────────────────────────────────────
	// QR block: 34mm square + reg-no + verification text inside one bordered
	// box, right-aligned to the right margin. Left column's field lines stop
	// ~22mm short of it (spec: "left info block -> QR block: 20-25mm").
	qrSize := mm(34)
	outerBoxW := qrSize + mm(5) // small padding either side of the QR square
	outerBoxX := rightEdge - outerBoxW
	fieldUnderW := outerBoxX - mm(28) - leftMargin // line stops ~22mm before the box

	fieldLabelX := leftMargin
	fieldValueX := leftMargin + mm(28)

	pdfAt(&txt, fieldLabelX, nameY, 10.5, "F2", "NAME:")
	pdfAt(&txt, fieldValueX, nameY, 10.5, "F1", input.StudentName)

	pdfAt(&txt, fieldLabelX, regY, 10.5, "F2", "REG. NO:")
	pdfAt(&txt, fieldValueX, regY, 10.5, "F1", input.RegNo)

	pdfAt(&txt, fieldLabelX, deptFieldY, 10.5, "F2", "DEPARTMENT:")
	pdfAt(&txt, fieldValueX, deptFieldY, 10.5, "F1", input.Department)

	// Session/Semester — no line, just label then value directly underneath.
	pdfAt(&txt, fieldLabelX, sessionLabelY, 10.5, "F2", "SESSION\u00b7SEMESTER:")
	pdfAt(&txt, fieldLabelX, sessionValueY, 12, "F1", sessionSemester)

	// ── QR box internal layout (top to bottom): reg-no, QR, verification ───
	outerBoxTop := nameY + mm(6)
	regNoBaseline := outerBoxTop - mm(6) - 6.8 // padding + ascent for 8.5pt text
	qrTop := regNoBaseline - 2 - mm(2)
	qrBottom := qrTop - qrSize
	verif1Y := qrBottom - mm(2) - 6
	verif2Y := verif1Y - 9
	outerBoxBottom := verif2Y - 2 - mm(3)
	outerBoxH := outerBoxTop - outerBoxBottom

	// Registration number, right-aligned within the box (spec: "Right
	// aligned within the QR section").
	regNoText := input.RegNo
	regNoW := textWidth(regNoText, "F1", 8.5)
	pdfAt(&txt, outerBoxX+outerBoxW-mm(2)-regNoW, regNoBaseline, 8.5, "F1", regNoText)

	// Verification text, centered under the QR.
	pdfCenteredBetween(&txt, outerBoxX, outerBoxX+outerBoxW, verif1Y, 7.5, "F1", "Scan to Verify")
	pdfCenteredBetween(&txt, outerBoxX, outerBoxX+outerBoxW, verif2Y, 7.5, "F1", "Submission \u00b7 Payment \u00b7 Identity")

	txt.WriteString("ET\n")

	// ── Graphics: field underlines (0.6pt, spec) ────────────────────────────
	gfx.WriteString("0.6 w\n")
	for _, fy := range []float64{nameY, regY, deptFieldY} {
		ly := fy - 4
		gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", fieldLabelX, ly))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f l\n", fieldLabelX+fieldUnderW, ly))
		gfx.WriteString("S\n")
	}

	// ── Graphics: single border enclosing reg-no + QR + verification text ──
	gfx.WriteString("0.6 w\n")
	gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\nS\n", outerBoxX, outerBoxBottom, outerBoxW, outerBoxH))

	// ── Graphics: QR code as vector grid, centered in the box ───────────────
	qrX := outerBoxX + (outerBoxW-qrSize)/2
	if qrMatrix != nil && len(qrMatrix) > 0 {
		size := len(qrMatrix)
		gfx.WriteString("1 g\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re f\n", qrX, qrBottom, qrSize, qrSize))
		gfx.WriteString("0 g\n")

		quietZone := 4
		modules := size - 2*quietZone
		if modules < 1 {
			quietZone = 0
			modules = size
		}
		cellSize := qrSize / float64(modules)

		for row := 0; row < modules; row++ {
			for col := 0; col < modules; col++ {
				srcRow := row + quietZone
				srcCol := col + quietZone
				if srcRow >= size || srcCol >= size {
					continue
				}
				if qrMatrix[srcRow][srcCol] {
					px := qrX + float64(col)*cellSize
					py := qrBottom + float64(modules-1-row)*cellSize
					gfx.WriteString(fmt.Sprintf("%.3f %.3f %.3f %.3f re f\n",
						px, py, cellSize, cellSize))
				}
			}
		}
	} else {
		gfx.WriteString("0.6 w\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\nS\n", qrX, qrBottom, qrSize, qrSize))
	}

	return gfx.String() + txt.String()
}

// pdfSafe escapes PDF string literal special characters.
func pdfSafe(s string) string {
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
		} else if r < 256 {
			// Latin-1 supplement (includes middle dot U+00B7) — octal escape
			b.WriteString(fmt.Sprintf("\\%03o", r))
		}
	}
	return b.String()
}

// pdfCentered places text centered horizontally at centerX, using real
// Helvetica/Helvetica-Bold glyph metrics (not a rough per-character guess)
// so headings land dead-center instead of drifting.
func pdfCentered(b *strings.Builder, centerX, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	x := centerX - w/2
	pdfAt(b, x, y, size, font, text)
}

// pdfCenteredBetween centers text between x1 and x2.
func pdfCenteredBetween(b *strings.Builder, x1, x2, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	cx := (x1 + x2) / 2
	pdfAt(b, cx-w/2, y, size, font, text)
}

// pdfAt emits PDF operators to render text at absolute position (x, y).
// Escaping is applied here, once, so callers (and width calculations done
// by pdfCentered/pdfCenteredBetween) always work with the real text.
func pdfAt(b *strings.Builder, x, y, size float64, font, text string) {
	b.WriteString(fmt.Sprintf("/%s %g Tf\n", font, size))
	b.WriteString(fmt.Sprintf("1 0 0 1 %.2f %.2f Tm\n", x, y))
	b.WriteString(fmt.Sprintf("(%s) Tj\n", pdfSafe(text)))
}

// textWidth computes the rendered width (in points) of text set in the
// given font ("F1"=Helvetica, "F2"=Helvetica-Bold, "F3"=Times-Roman,
// "F4"=Times-Bold) at the given size, using standard AFM glyph widths
// (per 1000 em units).
func textWidth(text string, font string, size float64) float64 {
	var widths map[rune]float64
	switch font {
	case "F2":
		widths = helveticaBoldWidths
	case "F3":
		widths = timesRomanWidths
	case "F4":
		widths = timesBoldWidths
	default:
		widths = helveticaWidths
	}
	total := 0.0
	for _, r := range text {
		w, ok := widths[r]
		if !ok {
			w = 500
		}
		total += w
	}
	return total / 1000.0 * size
}

// Standard Times-Roman AFM widths (per 1000 em units).
var timesRomanWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, '\'': 180,
	'(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
	'@': 921,
	'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722, 'H': 722,
	'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722, 'P': 556,
	'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944, 'X': 722,
	'Y': 722, 'Z': 611,
	'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 333, 'g': 500, 'h': 500,
	'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500, 'p': 500,
	'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '\u00b7': 250,
}

// Standard Times-Bold AFM widths (per 1000 em units).
var timesBoldWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 555, '#': 500, '$': 500, '%': 1000, '&': 833, '\'': 278,
	'(': 333, ')': 333, '*': 500, '+': 570, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 333, ';': 333, '<': 570, '=': 570, '>': 570, '?': 500,
	'@': 930,
	'A': 722, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 778,
	'I': 389, 'J': 500, 'K': 778, 'L': 667, 'M': 944, 'N': 722, 'O': 778, 'P': 611,
	'Q': 778, 'R': 722, 'S': 556, 'T': 667, 'U': 722, 'V': 722, 'W': 1000, 'X': 722,
	'Y': 722, 'Z': 667,
	'a': 500, 'b': 556, 'c': 444, 'd': 556, 'e': 444, 'f': 333, 'g': 500, 'h': 556,
	'i': 278, 'j': 333, 'k': 556, 'l': 278, 'm': 833, 'n': 556, 'o': 500, 'p': 556,
	'q': 556, 'r': 444, 's': 389, 't': 333, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '\u00b7': 250,
}

// Standard Helvetica AFM widths (per 1000 em units).
var helveticaWidths = map[rune]float64{
	' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, '\'': 191,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
	'@': 1015,
	'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556,
	'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
	'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 500,
}

// Standard Helvetica-Bold AFM widths (per 1000 em units).
var helveticaBoldWidths = map[rune]float64{
	' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, '\'': 238,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611,
	'@': 975,
	'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611, 'h': 611,
	'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611, 'p': 611,
	'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556, 'w': 778, 'x': 556,
	'y': 556, 'z': 500,
}