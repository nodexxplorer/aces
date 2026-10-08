package utils

import (
	"bytes"
	"embed"
	"fmt"
	"image"
	"image/color"
	_ "image/png"
	"log"
	"math"
	"sync"

	"github.com/fogleman/gg"
)

// ---- Tweak these to match your fonts / branding -------------------------

const (
	FontBoldPath    = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
	FontRegularPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
)

// StampBlue is the official stamp ink colour used for every element of the
// department stamp (borders, text, stars and logo tinting).
var StampBlue = color.RGBA{R: 0x1B, G: 0x4B, B: 0x93, A: 0xFF}

//go:embed assets/uniuyo_logo.png
var stampAssets embed.FS

var (
	stampLogoOnce sync.Once
	stampLogoImg  image.Image
	stampLogoErr  error
)

// stampLogo decodes the embedded University of Uyo logo (once) and returns
// it as an image whose near-white background has been made transparent so
// the logo sits cleanly inside the stamp instead of an opaque white box.
func stampLogo() (image.Image, error) {
	stampLogoOnce.Do(func() {
		raw, err := stampAssets.ReadFile("assets/uniuyo_logo.png")
		if err != nil {
			stampLogoErr = fmt.Errorf("read embedded uniuyo logo: %w", err)
			return
		}
		src, _, err := image.Decode(bytes.NewReader(raw))
		if err != nil {
			stampLogoErr = fmt.Errorf("decode uniuyo logo: %w", err)
			return
		}
		stampLogoImg, stampLogoErr = whitenToTransparent(src), nil
	})
	return stampLogoImg, stampLogoErr
}

// whitenToTransparent returns a copy of src where pixels that are
// (near-)white become fully transparent, so a logo exported on a white
// background blends into whatever it is drawn over.
func whitenToTransparent(src image.Image) image.Image {
	b := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			r, g, bl, _ := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
			r8, g8, b8 := uint8(r>>8), uint8(g>>8), uint8(bl>>8)
			alpha := uint8(0xFF)
			if r8 > 240 && g8 > 240 && b8 > 240 {
				alpha = 0x00
			}
			dst.SetNRGBA(x, y, color.NRGBA{R: r8, G: g8, B: b8, A: alpha})
		}
	}
	return dst
}

// StampConfig holds all the text that gets drawn onto the stamp.
type StampConfig struct {
	CompanyName string // curved text along the top, e.g. "DEPARTMENT OF ..."
	DateLabel   string // e.g. "Date:"
	SignLabel   string // e.g. "Sign:"
	AddressLine string // curved text along the bottom
}

// DefaultConfig reproduces the department stamp's text exactly. The
// University of Uyo logo is always drawn in the middle; there is no longer
// a "Contact here" line.
func DefaultConfig() StampConfig {
	return StampConfig{
		CompanyName: "DEPARTMENT OF COMPUTER ENGINEERING",
		DateLabel:   "Date:",
		SignLabel:   "Sign:",
		AddressLine: "FACULTY OF ENGINEERING UNIUYO",
	}
}

// GenerateStamp renders the stamp at the given pixel size and returns the
// gg.Context so the caller can save it, encode it, or write it to an
// http.ResponseWriter. The background is transparent.
func GenerateStamp(width, height int, cfg StampConfig) *gg.Context {
	dc := gg.NewContext(width, height)

	dc.SetColor(StampBlue)
	dc.SetLineWidth(2)

	cx := float64(width) / 2
	cy := float64(height) / 2

	outerRX, outerRY := float64(width)*0.46, float64(height)*0.46
	// Smaller inner ellipse widens the band between the borders so the
	// department name can carry visible padding above and below it.
	innerRX, innerRY := outerRX*0.80, outerRY*0.80

	// --- Outer border: drawn DOUBLE (two closely-spaced lines) ---
	doubleGapX, doubleGapY := outerRX*0.025, outerRY*0.025
	dc.SetLineWidth(1.6)
	dc.DrawEllipse(cx, cy, outerRX, outerRY)
	dc.Stroke()
	dc.DrawEllipse(cx, cy, outerRX-doubleGapX, outerRY-doubleGapY)
	dc.Stroke()

	// --- Inner border: single line, as before ---
	dc.SetLineWidth(2)
	dc.DrawEllipse(cx, cy, innerRX, innerRY)
	dc.Stroke()

	// Radius for curved text sits between the (inner edge of the double)
	// outer border and the inner border, pulled in a bit further so the
	// company-name text has clear padding and doesn't hug the border.
	bandRX := (outerRX - doubleGapX) - innerRX
	bandRY := (outerRY - doubleGapY) - innerRY
	nameRX := (outerRX - doubleGapX) - bandRX*0.49
	nameRY := (outerRY - doubleGapY) - bandRY*0.49

	// The bottom curved text keeps sitting on the natural midpoint band.
	textRX := (outerRX - doubleGapX + innerRX) / 2
	textRY := (outerRY - doubleGapY + innerRY) / 2

	// --- Top curved text: "DEPARTMENT OF COMPUTER ENGINEERING" ---
	topFontSize := float64(height) / 17 // was height/21
	if err := dc.LoadFontFace(FontBoldPath, topFontSize); err != nil {
		log.Printf("warning: could not load bold font (%v); falling back to default", err)
	}
	// Centered on 270° (12 o'clock), running clockwise (left to right).
	drawArcText(dc, cfg.CompanyName, cx, cy, nameRX, nameRY,
		degToRad(270), true, 0)

	// Stars at the far left (9 o'clock) and far right (3 o'clock) of the
	// oval, where the curve is tightest. They sit on the middle of the band
	// between the outer and inner borders so they touch neither line.
	dc.SetColor(StampBlue)
	drawStarAt(dc, cx, cy, textRX, textRY, math.Pi, 9)
	drawStarAt(dc, cx, cy, textRX, textRY, 0, 9)

	// --- Padding gap between the curved name / stars and the content below ---
	const contentTopPad = 0.50 // fraction of innerRY reserved as breathing room

	// --- University of Uyo logo (replaces the old "Contact here" line) ---
	logoH := innerRY * 0.52
	placeholderY := cy - innerRY*contentTopPad + innerRY*0.21
	logo, err := stampLogo()
	if err != nil {
		log.Printf("warning: uniuyo logo unavailable (%v); stamp will omit it", err)
	} else {
		b := logo.Bounds()
		if b.Dx() > 0 && b.Dy() > 0 {
			aspect := float64(b.Dx()) / float64(b.Dy())
			logoW := logoH * aspect
			// Keep the logo clear of the curved address text below.
			if maxW := innerRX * 0.55; logoW > maxW {
				logoW = maxW
				logoH = logoW / aspect
			}
			// Draw scaled: the embedded PNG is 400x400, far larger than the
			// stamp, so shrink it around the anchor point before drawing.
			scale := logoH / float64(b.Dy())
			dc.Push()
			dc.ScaleAbout(scale, scale, cx, placeholderY)
			dc.DrawImageAnchored(logo, int(cx), int(placeholderY), 0.5, 0.5)
			dc.Pop()
		}
	}

	// --- Date / Sign rows, each with a dotted fill-in line ---
	rowFontSize := float64(height) / 15
	if err := dc.LoadFontFace(FontRegularPath, rowFontSize); err != nil {
		log.Printf("warning: could not load regular font (%v)", err)
	}
	lineHalfWidth := innerRX * 0.72
	leftX := cx - lineHalfWidth
	rightX := cx + lineHalfWidth

	rowsTop := placeholderY + logoH/2 + innerRY*0.10
	dateY := rowsTop
	signY := rowsTop + innerRY*0.24

	drawLabelWithDottedLine(dc, cfg.DateLabel, leftX, rightX, dateY, rowFontSize)
	drawLabelWithDottedLine(dc, cfg.SignLabel, leftX, rightX, signY, rowFontSize)

	// --- Bottom curved text: "FACULTY OF ENGINEERING UNIUYO" ---
	bottomFontSize := float64(height) / 16 // was height/24
	if err := dc.LoadFontFace(FontRegularPath, bottomFontSize); err != nil {
		log.Printf("warning: could not load regular font (%v)", err)
	}
	// Centered on 90° (6 o'clock), running counter-clockwise so it still
	// reads left to right and right-side up. A little extra letter spacing
	// keeps the lighter font from looking cramped.
	drawArcText(dc, cfg.AddressLine, cx, cy, textRX, textRY,
		degToRad(90), false, bottomFontSize*0.1)

	return dc
}

// DeptStampPNG renders the department stamp at its standard size and
// returns the PNG bytes (transparent background) ready to be stamped onto
// a PDF, e.g. on top of a student's placed signature.
func DeptStampPNG(width, height int, cfg StampConfig) ([]byte, error) {
	dc := GenerateStamp(width, height, cfg)
	var buf bytes.Buffer
	if err := dc.EncodePNG(&buf); err != nil {
		return nil, fmt.Errorf("encode stamp png: %w", err)
	}
	return buf.Bytes(), nil
}

// drawArcText draws text along an elliptical arc, centered on centerAngle
// (radians, 0 = +x axis, increasing = clockwise, since image coordinates
// have y pointing down). Use 270° for the top of the ellipse and 90° for
// the bottom.
//
// Letters are placed by real arc length using each glyph's measured width,
// so spacing stays even and letters never overlap, even on an ellipse
// where equal angle steps would bunch them up near the sides. Each glyph
// is rotated to the tangent of the ellipse so the text follows the curve.
//
// clockwise = true  -> text travels in the direction of increasing angle
//                      (left to right across the top).
// clockwise = false -> text travels in the direction of decreasing angle
//                      (left to right across the bottom, right-side up).
// tracking is extra spacing in pixels added between letters.
func drawArcText(dc *gg.Context, text string, cx, cy, rx, ry, centerAngle float64, clockwise bool, tracking float64) {
	runes := []rune(text)
	n := len(runes)
	if n == 0 {
		return
	}

	dir := 1.0
	if !clockwise {
		dir = -1.0
	}

	// Measure every glyph and the total text length.
	widths := make([]float64, n)
	total := 0.0
	for i, r := range runes {
		w, _ := dc.MeasureString(string(r))
		widths[i] = w
		total += w
	}
	total += tracking * float64(n-1)

	pos := 0.0 // distance from the start of the text to the current glyph's left edge
	for i, r := range runes {
		// Offset of this glyph's centre from the middle of the text,
		// measured along the direction of travel.
		offset := pos + widths[i]/2 - total/2
		pos += widths[i] + tracking

		var angle float64
		if offset >= 0 {
			angle = angleAtArcDistance(rx, ry, centerAngle, offset, dir)
		} else {
			angle = angleAtArcDistance(rx, ry, centerAngle, -offset, -dir)
		}

		x := cx + rx*math.Cos(angle)
		y := cy + ry*math.Sin(angle)

		// Tangent of the ellipse at this point, in the direction of
		// increasing angle. For a circle this reduces to angle + π/2.
		rot := math.Atan2(ry*math.Cos(angle), -rx*math.Sin(angle))
		if !clockwise {
			rot += math.Pi // travelling the other way round
		}

		dc.Push()
		dc.Translate(x, y)
		dc.Rotate(rot)
		dc.DrawStringAnchored(string(r), 0, 0, 0.5, 0.5)
		dc.Pop()
	}
}

// angleAtArcDistance walks along the ellipse from angle `from`, in
// direction dir (+1 = increasing angle, -1 = decreasing), until it has
// covered `dist` pixels of arc, and returns the angle it ends up at.
func angleAtArcDistance(rx, ry, from, dist, dir float64) float64 {
	const dTheta = 0.0005
	a := from
	covered := 0.0
	for covered < dist {
		ds := math.Hypot(rx*math.Sin(a), ry*math.Cos(a)) * dTheta
		if ds <= 0 {
			break
		}
		if covered+ds >= dist {
			a += dir * dTheta * (dist - covered) / ds
			break
		}
		covered += ds
		a += dir * dTheta
	}
	return a
}

// drawStarAt places a small upright 5-point star on the ellipse at the
// given angle.
func drawStarAt(dc *gg.Context, cx, cy, rx, ry, angle, size float64) {
	x := cx + rx*math.Cos(angle)
	y := cy + ry*math.Sin(angle)
	drawStar(dc, x, y, size, size/2.2, 5, 0)
}

// drawStar draws a filled 5-point star centered at (cx, cy). rotation=0
// points the top spike straight up.
func drawStar(dc *gg.Context, cx, cy, outerR, innerR float64, points int, rotation float64) {
	dc.NewSubPath()
	total := points * 2
	for i := 0; i < total; i++ {
		r := outerR
		if i%2 == 1 {
			r = innerR
		}
		a := rotation + float64(i)*math.Pi/float64(points)
		x := cx + r*math.Sin(a)
		y := cy - r*math.Cos(a)
		if i == 0 {
			dc.MoveTo(x, y)
		} else {
			dc.LineTo(x, y)
		}
	}
	dc.ClosePath()
	dc.Fill()
}

// drawLabelWithDottedLine draws e.g. "Date:" at leftX, then a dotted line
// filling the remaining space up to rightX, all vertically centered on y.
func drawLabelWithDottedLine(dc *gg.Context, label string, leftX, rightX, y, fontSize float64) {
	dc.DrawStringAnchored(label, leftX, y, 0, 0.5)
	w, _ := dc.MeasureString(label)

	dotStartX := leftX + w + fontSize*0.3
	dotSpacing := fontSize * 0.28
	dotRadius := fontSize * 0.035

	for x := dotStartX; x < rightX; x += dotSpacing {
		dc.DrawPoint(x, y+fontSize*0.05, dotRadius)
		dc.Fill()
	}
}

func degToRad(d float64) float64 {
	return d * math.Pi / 180
}