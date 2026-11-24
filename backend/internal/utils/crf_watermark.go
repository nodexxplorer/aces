package utils

import (
	"bytes"
	"fmt"
	"image/color"
	"image/png"
	"strings"

	"github.com/fogleman/gg"
	"github.com/skip2/go-qrcode"
)

// BrownWatermarkColor is the delicate feint warm brown ink used for the watermark QR code and text.
// Designed to be very light and blend gracefully with the course form.
var BrownWatermarkColor = color.RGBA{R: 110, G: 65, B: 30, A: 120}

// GenerateCRFStudentWatermarkPNG renders a feint, transparent-backed QR code badge
// containing the student's name, matric number, and verification metadata.
// It uses a transparent background and delicate lines so it blends seamlessly into the course form
// text and table lines without masking content or creating an opaque patch.
func GenerateCRFStudentWatermarkPNG(studentName, matricNumber, submissionID string) ([]byte, error) {
	name := strings.TrimSpace(studentName)
	if name == "" {
		name = "STUDENT"
	}
	name = strings.ToUpper(name)

	matric := strings.TrimSpace(matricNumber)
	if matric == "" {
		matric = "OFFICIAL"
	}
	matric = strings.ToUpper(matric)

	// QR code data payload
	qrPayload := fmt.Sprintf("ACES OFFICIAL COURSE FORM\nStudent: %s\nMatric: %s\nRef: %s\nVerified: AUTHENTIC", name, matric, submissionID)

	// Generate brown QR code with completely transparent background
	qr, err := qrcode.New(qrPayload, qrcode.Medium)
	if err != nil {
		return nil, fmt.Errorf("generate qr: %w", err)
	}
	qr.ForegroundColor = BrownWatermarkColor
	qr.BackgroundColor = color.RGBA{R: 255, G: 255, B: 255, A: 0} // Transparent background so form content shows through

	const qrPx = 96
	qrImg := qr.Image(qrPx)

	// Badge canvas (150 x 170) - compact and clean
	const (
		cardW = 150
		cardH = 170
	)
	dc := gg.NewContext(cardW, cardH)

	// Draw rounded card border only (no opaque white fill, purely transparent interior)
	dc.DrawRoundedRectangle(1.5, 1.5, cardW-3, cardH-3, 8)
	dc.SetColor(color.RGBA{R: 110, G: 65, B: 30, A: 60}) // Very soft subtle border
	dc.SetLineWidth(1.0)
	dc.Stroke()

	// Header: "ACES VERIFIED"
	_ = dc.LoadFontFace(FontBoldPath, 7.5)
	dc.SetColor(BrownWatermarkColor)
	dc.DrawStringAnchored("ACES VERIFIED", cardW/2, 13, 0.5, 0.5)

	// Draw QR Code centered
	qrX := (cardW - qrPx) / 2
	dc.DrawImage(qrImg, qrX, 21)

	// Student Name (adjust font size based on length)
	nameFontSize := 8.0
	if len(name) > 22 {
		nameFontSize = 6.5
	} else if len(name) > 16 {
		nameFontSize = 7.0
	}
	_ = dc.LoadFontFace(FontBoldPath, nameFontSize)
	dc.SetColor(BrownWatermarkColor)
	dc.DrawStringAnchored(name, cardW/2, 130, 0.5, 0.5)

	// Matric Number
	_ = dc.LoadFontFace(FontRegularPath, 7.2)
	dc.SetColor(BrownWatermarkColor)
	dc.DrawStringAnchored(matric, cardW/2, 145, 0.5, 0.5)

	// Sub-label: "AUTHENTIC CRF"
	_ = dc.LoadFontFace(FontRegularPath, 6.0)
	dc.SetColor(color.RGBA{R: 110, G: 65, B: 30, A: 100})
	dc.DrawStringAnchored("AUTHENTIC CRF", cardW/2, 158, 0.5, 0.5)

	var buf bytes.Buffer
	if err := png.Encode(&buf, dc.Image()); err != nil {
		return nil, fmt.Errorf("encode watermark png: %w", err)
	}

	return buf.Bytes(), nil
}
