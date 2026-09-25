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
	if err := dc.LoadFontFace(FontBoldPath, float64(height)/21); err != nil {
		log.Printf("warning: could not load bold font (%v); falling back to default", err)
	}
	drawArcText(dc, cfg.CompanyName, cx, cy, nameRX, nameRY,
		degToRad(218), degToRad(322), false)

	// Stars at the two ends of the top curve, matching the reference image.
	dc.SetColor(StampBlue)
	starRadiusX := (outerRX - doubleGapX) * 0.97
	starRadiusY := (outerRY - doubleGapY) * 0.97
	drawStarAt(dc, cx, cy, starRadiusX, starRadiusY, degToRad(213), 8)
	drawStarAt(dc, cx, cy, starRadiusX, starRadiusY, degToRad(327), 8)

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
	if err := dc.LoadFontFace(FontRegularPath, float64(height)/24); err != nil {
		log.Printf("warning: could not load regular font (%v)", err)
	}
	drawArcText(dc, cfg.AddressLine, cx, cy, textRX, textRY,
		degToRad(142), degToRad(38), true)

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

// drawArcText draws text following an elliptical arc, walking directly
// from startAngle to endAngle (radians, 0 = +x axis, increasing = clockwise,
// since image coordinates have y pointing down). Choose startAngle/endAngle
// so the *direct* interpolation between them already passes through the
// side of the ellipse you want (e.g. 218°->322° sweeps across the top;
// 142°->38° sweeps across the bottom) — the function does not wrap around
// the long way.
//
// If flip is true, each glyph is additionally rotated 180° so text that
// runs along the *bottom* of the ellipse still reads left-to-right and
// right-side up instead of upside down.
func drawArcText(dc *gg.Context, text string, cx, cy, rx, ry, startAngle, endAngle float64, flip bool) {
	runes := []rune(text)
	n := len(runes)
	if n == 0 {
		return
	}

	step := (endAngle - startAngle) / float64(n)

	angle := startAngle + step/2 // center each glyph within its slice
	for _, r := range runes {
		x := cx + rx*math.Cos(angle)
		y := cy + ry*math.Sin(angle)

		dc.Push()
		dc.Translate(x, y)
		rot := angle + math.Pi/2
		if flip {
			rot += math.Pi
		}
		dc.DrawStringAnchored(string(r), 0, 0, 0.5, 0.5)
		dc.Pop()

		angle += step
	}
}

// drawStarAt places a small 5-point star on the ellipse at the given angle.
func drawStarAt(dc *gg.Context, cx, cy, rx, ry, angle, size float64) {
	x := cx + rx*math.Cos(angle)
	y := cy + ry*math.Sin(angle)
	drawStar(dc, x, y, size, size/2.2, 5, angle+math.Pi/2)
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
