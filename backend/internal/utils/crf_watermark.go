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

// BrownWatermarkColor is the rich warm brown ink used for the watermark QR code and text.
var BrownWatermarkColor = color.RGBA{R: 101, G: 56, B: 24, A: 130} // feint warm brown ink

// GenerateCRFStudentWatermarkPNG renders a compact white-and-brown QR code badge
// containing the student's name, matric number, and cryptographic/verification metadata.
// It is styled cleanly for feint watermarking onto student course forms.
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

	// Generate brown-on-white QR code
	qr, err := qrcode.New(qrPayload, qrcode.Medium)
	if err != nil {
		return nil, fmt.Errorf("generate qr: %w", err)
	}
	qr.ForegroundColor = BrownWatermarkColor
	qr.BackgroundColor = color.RGBA{R: 255, G: 255, B: 255, A: 200}

	const qrPx = 96
	qrImg := qr.Image(qrPx)

	// Badge canvas (150 x 170) - compact and clean
	const (
		cardW = 150
		cardH = 170
	)
	dc := gg.NewContext(cardW, cardH)

	// Draw rounded card background with subtle brown border
	dc.DrawRoundedRectangle(1.5, 1.5, cardW-3, cardH-3, 8)
	dc.SetColor(color.RGBA{R: 255, G: 255, B: 255, A: 215})
	dc.FillPreserve()
	dc.SetColor(color.RGBA{R: 101, G: 56, B: 24, A: 120})
	dc.SetLineWidth(1.8)
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

	// Sub-label: "AUTHENTIC FORM"
	_ = dc.LoadFontFace(FontRegularPath, 6.0)
	dc.SetColor(color.RGBA{R: 140, G: 85, B: 45, A: 255})
	dc.DrawStringAnchored("AUTHENTIC CRF", cardW/2, 158, 0.5, 0.5)

	var buf bytes.Buffer
	if err := png.Encode(&buf, dc.Image()); err != nil {
		return nil, fmt.Errorf("encode watermark png: %w", err)
	}

	return buf.Bytes(), nil
}
