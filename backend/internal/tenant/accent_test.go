package tenant

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math"
	"regexp"
	"strconv"
	"testing"
)

var accentFormat = regexp.MustCompile(`^#[0-9a-f]{6}$`)

// solidPNG returns a PNG of one colour.
func solidPNG(t *testing.T, w, h int, c color.NRGBA) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetNRGBA(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestAccentFromSolidLogoKeepsItsColour(t *testing.T) {
	// #1b65a7 is the accent the rule gives for a logo of hue 208. Logo colours
	// are already accents, so a logo of that colour gives it back.
	got, err := AccentFromLogo("image/png", solidPNG(t, 64, 64, color.NRGBA{0x1b, 0x65, 0xa7, 0xff}))
	if err != nil {
		t.Fatal(err)
	}
	if got != "#1b65a7" {
		t.Fatalf("accent = %s, want #1b65a7", got)
	}
}

func TestAccentIgnoresTransparentPixels(t *testing.T) {
	// The background is transparent red. Only the opaque blue block counts, so
	// the accent is blue.
	img := image.NewNRGBA(image.Rect(0, 0, 200, 200))
	for y := 0; y < 200; y++ {
		for x := 0; x < 200; x++ {
			img.SetNRGBA(x, y, color.NRGBA{0xff, 0x00, 0x00, 0x00})
		}
	}
	for y := 90; y < 110; y++ {
		for x := 90; x < 110; x++ {
			img.SetNRGBA(x, y, color.NRGBA{0x1b, 0x65, 0xa7, 0xff})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	got, err := AccentFromLogo("image/png", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if got != "#1b65a7" {
		t.Fatalf("accent = %s, want the blue of the opaque block, #1b65a7", got)
	}
}

func TestAccentJPEGIsRead(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			img.Set(x, y, color.RGBA{0x1b, 0x65, 0xa7, 0xff})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	got, err := AccentFromLogo("image/jpeg", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if !accentFormat.MatchString(got) {
		t.Fatalf("accent %q is not #rrggbb", got)
	}
	if got != "#1b65a7" {
		t.Logf("JPEG accent = %s (the PNG of the same colour gives #1b65a7)", got)
	}
	if h, _, _ := rgbToHSL(hexComponent(t, got, 0), hexComponent(t, got, 1), hexComponent(t, got, 2)); math.Abs(h-208) > 4 {
		t.Fatalf("JPEG accent %s has hue %.1f, want about 208", got, h)
	}
}

func TestAccentRuleIsTheLightestPassingLightness(t *testing.T) {
	for hue := 0.0; hue < 360; hue += 5 {
		// The lightest passing lightness, found by scanning down from the start.
		var want [3]uint8
		for pct := accentStartLightness; pct >= 0; pct-- {
			r, g, b := hslToRGB(hue, accentSaturation, float64(pct)/100)
			if contrastWithWhite(r, g, b) >= accentMinContrast {
				want = [3]uint8{r, g, b}
				break
			}
		}
		ar, ag, ab := accentRGB(hue)
		if got := [3]uint8{ar, ag, ab}; got != want {
			t.Fatalf("hue %.0f: accent %v, want the lightest passing %v", hue, got, want)
		}
		r, g, b := want[0], want[1], want[2]
		if c := contrastWithWhite(r, g, b); c < accentMinContrast {
			t.Fatalf("hue %.0f: accent %02x%02x%02x has contrast %.2f, want at least %.1f", hue, r, g, b, c, accentMinContrast)
		}
		h, s, _ := rgbToHSL(float64(r)/255, float64(g)/255, float64(b)/255)
		if d := circularDistance(h, hue); d > 3 {
			t.Fatalf("hue %.0f: accent hue is %.1f", hue, h)
		}
		if math.Abs(s-accentSaturation) > 0.02 {
			t.Fatalf("hue %.0f: accent saturation is %.3f, want %.2f", hue, s, accentSaturation)
		}
	}
}

func TestAccentRefusesLogosWithoutAnAccent(t *testing.T) {
	grey := solidPNG(t, 64, 64, color.NRGBA{0x80, 0x80, 0x80, 0xff})

	red := image.NewNRGBA(image.Rect(0, 0, 100, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			c := color.NRGBA{0xd0, 0x10, 0x10, 0xff}
			if x >= 50 {
				c = color.NRGBA{0x10, 0xd0, 0xd0, 0xff} // cyan: opposite hue, no single accent
			}
			red.SetNRGBA(x, y, c)
		}
	}
	var opposite bytes.Buffer
	if err := png.Encode(&opposite, red); err != nil {
		t.Fatal(err)
	}

	cases := map[string]struct {
		contentType string
		data        []byte
	}{
		"grey logo":        {"image/png", grey},
		"opposite hues":    {"image/png", opposite.Bytes()},
		"webp is not read": {"image/webp", grey},
		"not an image":     {"image/png", []byte("not a png")},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			got, err := AccentFromLogo(tc.contentType, tc.data)
			if err == nil {
				t.Fatalf("accent = %q, want no accent", got)
			}
			if name != "not an image" && !errors.Is(err, ErrNoAccent) {
				t.Fatalf("error %v does not wrap ErrNoAccent", err)
			}
		})
	}
}

func TestAccentRefusesAnImageTooLargeToRead(t *testing.T) {
	// 4.2 million pixels is over the limit. The size is read from the header,
	// before the pixels are decoded.
	data := solidPNG(t, 2100, 2000, color.NRGBA{0x1b, 0x65, 0xa7, 0xff})
	if _, err := AccentFromLogo("image/png", data); !errors.Is(err, ErrNoAccent) {
		t.Fatalf("error = %v, want ErrNoAccent for an image over %d pixels", err, accentMaxPixels)
	}
}

// hexComponent returns the i-th channel (0 red, 1 green, 2 blue) of a
// #rrggbb colour, scaled to [0, 1].
func hexComponent(t *testing.T, hex string, i int) float64 {
	t.Helper()
	v, err := strconv.ParseUint(hex[1+2*i:3+2*i], 16, 8)
	if err != nil {
		t.Fatalf("parse %s: %v", hex, err)
	}
	return float64(v) / 255
}

func circularDistance(a, b float64) float64 {
	d := math.Abs(a - b)
	if d > 180 {
		d = 360 - d
	}
	return d
}
