package tenant

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg" // decoders for the formats an accent is read from
	_ "image/png"
	"math"
)

// ErrNoAccent means a logo cannot give its department an accent: it has no
// clear colour, or its format is one this package does not read. The
// department then uses the platform colour. Errors wrap it with the reason.
var ErrNoAccent = errors.New("no accent colour")

// An accent is one hue per department, read from its logo. Its saturation is
// fixed, so every department's accent is about equally strong. Its lightness
// is the lightest value, scanning down from accentStartLightness, at which
// white text still has accentMinContrast against it. The rule is recorded in
// docs/multi-tenancy.md; the web app derives the lighter and darker shades
// from the accent.
const (
	accentSaturation     = 0.72
	accentMinContrast    = 6.0
	accentStartLightness = 45 // in hundredths, so the scan steps are exact
)

// Only some pixels say anything about a logo's colour: opaque ones that are
// clearly coloured and neither very dark nor very light.
const (
	accentMinPixelSaturation = 0.35
	accentMinPixelLightness  = 0.20
	accentMaxPixelLightness  = 0.80
)

// Limits. A logo is at most 256 KiB, but a small file can declare a very large
// image, so the size is checked before the pixels are decoded. The colour
// sample is capped as well.
const (
	accentMaxSide    = 4000
	accentMaxPixels  = 4_000_000
	accentSamplePix  = 250_000
	accentMinSamples = 50
	// accentMinAgreement is the mean resultant length of the hues, from 0 to 1.
	// Below it the colours point in different directions, so there is no
	// single hue to take, and the logo gets no accent.
	accentMinAgreement = 0.5
)

// AccentFromLogo returns the accent colour of a logo as "#rrggbb". contentType
// is the logo's MIME type. Only PNG and JPEG logos are read; a WebP logo, a
// logo with no clear colour, or an image too large to read gives an error that
// wraps ErrNoAccent.
func AccentFromLogo(contentType string, data []byte) (string, error) {
	if contentType != "image/png" && contentType != "image/jpeg" {
		return "", fmt.Errorf("%w (%s logos are not read; use PNG or JPEG)", ErrNoAccent, contentType)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("read logo: %w", err)
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > accentMaxSide || cfg.Height > accentMaxSide || cfg.Width*cfg.Height > accentMaxPixels {
		return "", fmt.Errorf("%w (the logo is %dx%d pixels; accents are read from logos up to %d pixels)", ErrNoAccent, cfg.Width, cfg.Height, accentMaxPixels)
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("read logo: %w", err)
	}
	hue, ok := logoHue(img)
	if !ok {
		return "", fmt.Errorf("%w (the logo has no clear colour)", ErrNoAccent)
	}
	r, g, b := accentRGB(hue)
	return fmt.Sprintf("#%02x%02x%02x", r, g, b), nil
}

// logoHue returns the hue, in degrees, that the logo's clear colours share. It
// is the saturation-weighted circular mean of their hues. It reports false when
// too few pixels are clearly coloured, or when their hues disagree.
func logoHue(img image.Image) (float64, bool) {
	b := img.Bounds()
	step := 1
	for (b.Dx()/step)*(b.Dy()/step) > accentSamplePix {
		step++
	}

	var sumX, sumY, sumW float64
	samples := 0
	for y := b.Min.Y; y < b.Max.Y; y += step {
		for x := b.Min.X; x < b.Max.X; x += step {
			r, g, bl, a := img.At(x, y).RGBA()
			if a != 0xffff {
				continue // transparent or partly transparent: background or an edge
			}
			hue, sat, light := rgbToHSL(float64(r)/0xffff, float64(g)/0xffff, float64(bl)/0xffff)
			if sat < accentMinPixelSaturation || light < accentMinPixelLightness || light > accentMaxPixelLightness {
				continue
			}
			rad := hue * math.Pi / 180
			sumX += sat * math.Cos(rad)
			sumY += sat * math.Sin(rad)
			sumW += sat
			samples++
		}
	}
	if samples < accentMinSamples || sumW == 0 {
		return 0, false
	}
	if math.Hypot(sumX, sumY)/sumW < accentMinAgreement {
		return 0, false
	}
	hue := math.Atan2(sumY, sumX) * 180 / math.Pi
	if hue < 0 {
		hue += 360
	}
	return hue, true
}

// accentRGB returns the accent for a hue: the fixed saturation, and the
// lightest lightness that gives white text accentMinContrast.
func accentRGB(hue float64) (uint8, uint8, uint8) {
	for pct := accentStartLightness; pct >= 0; pct-- {
		r, g, b := hslToRGB(hue, accentSaturation, float64(pct)/100)
		if contrastWithWhite(r, g, b) >= accentMinContrast {
			return r, g, b
		}
	}
	return 0, 0, 0 // unreachable: black gives white text 21:1
}

// rgbToHSL converts components in [0, 1] to hue in degrees [0, 360), saturation
// and lightness in [0, 1].
func rgbToHSL(r, g, b float64) (hue, sat, light float64) {
	maxC := math.Max(r, math.Max(g, b))
	minC := math.Min(r, math.Min(g, b))
	light = (maxC + minC) / 2
	d := maxC - minC
	if d == 0 {
		return 0, 0, light
	}
	sat = d / (1 - math.Abs(2*light-1))
	switch maxC {
	case r:
		hue = math.Mod((g-b)/d, 6)
	case g:
		hue = (b-r)/d + 2
	default:
		hue = (r-g)/d + 4
	}
	hue *= 60
	if hue < 0 {
		hue += 360
	}
	return hue, sat, light
}

// hslToRGB converts hue in degrees, saturation and lightness in [0, 1] to 8-bit
// components.
func hslToRGB(hue, sat, light float64) (uint8, uint8, uint8) {
	c := (1 - math.Abs(2*light-1)) * sat
	hp := hue / 60
	x := c * (1 - math.Abs(math.Mod(hp, 2)-1))
	var r, g, b float64
	switch {
	case hp < 1:
		r, g, b = c, x, 0
	case hp < 2:
		r, g, b = x, c, 0
	case hp < 3:
		r, g, b = 0, c, x
	case hp < 4:
		r, g, b = 0, x, c
	case hp < 5:
		r, g, b = x, 0, c
	default:
		r, g, b = c, 0, x
	}
	m := light - c/2
	return to8bit(r + m), to8bit(g + m), to8bit(b + m)
}

func to8bit(v float64) uint8 {
	v = math.Max(0, math.Min(1, v))
	return uint8(math.Round(v * 255))
}

// contrastWithWhite is the WCAG contrast ratio between white and the colour.
func contrastWithWhite(r, g, b uint8) float64 {
	return 1.05 / (relativeLuminance(r, g, b) + 0.05)
}

func relativeLuminance(r, g, b uint8) float64 {
	return 0.2126*linearChannel(r) + 0.7152*linearChannel(g) + 0.0722*linearChannel(b)
}

func linearChannel(v uint8) float64 {
	c := float64(v) / 255
	if c <= 0.03928 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}
