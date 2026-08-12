package utils

import (
	"bytes"
	"fmt"
	"strings"
)

// ReceiptInput holds everything needed to render a simple proof-of-purchase
// receipt — unlike the manual cover page, this carries no QR code and isn't
// meant for printing/collection, just a record the student can keep.
type ReceiptInput struct {
	StudentName string
	RegNo       string
	ItemName    string
	Amount      string // pre-formatted, e.g. "2,000.00"
	Reference   string
	Date        string // pre-formatted, e.g. "8 Aug 2026"
}

// GenerateReceipt produces a single-page PDF/1.4 payment receipt. Built with
// the same minimal hand-rolled PDF object approach as manual_printer.go
// (no external PDF library in this codebase) but far simpler: one page, one
// content stream, no QR/image beyond the shared crest.
func GenerateReceipt(input ReceiptInput) ([]byte, error) {
	logoW, logoH, logoJPEG, err := encodeLogoJPEG()
	if err != nil {
		return nil, fmt.Errorf("encode logo: %w", err)
	}

	content := buildReceiptContent(input)

	var buf bytes.Buffer
	objs := []string{}
	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	pageIdx := addObj("")
	contentIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))
	f1Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	f2Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
	imageIdx := addObj(fmt.Sprintf(
		"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
		logoW, logoH, len(logoJPEG), string(logoJPEG),
	))

	objs[pageIdx-1] = fmt.Sprintf(
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> /XObject << /Im1 %d 0 R >> >> >>",
		contentIdx, f1Idx, f2Idx, imageIdx,
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

func buildReceiptContent(input ReceiptInput) string {
	var txt strings.Builder
	var gfx strings.Builder

	const (
		pageW   = 595.0
		pageH   = 842.0
		centerX = pageW / 2
	)
	leftMargin := mm(25)
	rightEdge := pageW - mm(25)

	logoSize := mm(22)
	logoTop := pageH - mm(30)
	logoBottom := logoTop - logoSize
	logoX := centerX - logoSize/2
	gfx.WriteString("q\n")
	gfx.WriteString(fmt.Sprintf("%.2f 0 0 %.2f %.2f %.2f cm\n", logoSize, logoSize, logoX, logoBottom))
	gfx.WriteString("/Im1 Do\nQ\n")

	titleY := logoBottom - mm(12)
	subtitleY := titleY - mm(8)
	paidBadgeY := subtitleY - mm(14)

	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, titleY, 18, "F2", "ACES Zone")
	pdfCentered(&txt, centerX, subtitleY, 11, "F1", "Payment Receipt")
	pdfCentered(&txt, centerX, paidBadgeY, 13, "F2", "PAID")
	txt.WriteString("ET\n")

	gfx.WriteString("0.6 w\n")
	lineY := paidBadgeY - mm(8)
	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, lineY))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\nS\n", rightEdge, lineY))

	fields := []struct{ label, value string }{
		{"Item", input.ItemName},
		{"Amount", "NGN " + input.Amount},
		{"Reference", input.Reference},
		{"Date", input.Date},
		{"Student", input.StudentName},
		{"Reg. No.", input.RegNo},
	}

	rowY := lineY - mm(12)
	txt.WriteString("BT\n")
	for _, f := range fields {
		pdfAt(&txt, leftMargin, rowY, 11, "F2", f.label+":")
		pdfAt(&txt, leftMargin+mm(35), rowY, 11, "F1", f.value)
		rowY -= mm(9)
	}
	txt.WriteString("ET\n")

	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, rowY-mm(4)))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\nS\n", rightEdge, rowY-mm(4)))

	footerY := rowY - mm(14)
	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, footerY, 9, "F1", "This is a computer-generated receipt from ACES Zone.")
	txt.WriteString("ET\n")

	return gfx.String() + txt.String()
}
