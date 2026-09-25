package utils

import (
	"bytes"
	"image"
	"image/color"
	_ "image/png"
	"testing"
)

// TestDeptStampRendersBlueWithLogo checks that the department stamp renders,
// is transparent-backed, contains blue ink, and that the University of Uyo
// logo actually made it onto the canvas.
func TestDeptStampRendersBlueWithLogo(t *testing.T) {
	pngBytes, err := DeptStampPNG(500, 320, DefaultConfig())
	if err != nil {
		t.Fatalf("DeptStampPNG: %v", err)
	}

	img, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		t.Fatalf("decode rendered stamp: %v", err)
	}
	b := img.Bounds()

	// Corners must stay transparent (no white background box).
	for _, pt := range []image.Point{
		{X: b.Min.X + 2, Y: b.Min.Y + 2},
		{X: b.Max.X - 3, Y: b.Min.Y + 2},
		{X: b.Min.X + 2, Y: b.Max.Y - 3},
		{X: b.Max.X - 3, Y: b.Max.Y - 3},
	} {
		_, _, _, a := img.At(pt.X, pt.Y).RGBA()
		if a != 0 {
			t.Fatalf("corner %v not transparent: alpha=%d", pt, a)
		}
	}

	// Scan the canvas: expect the stamp's blue ink and enough
	// non-blue, saturated pixels to prove the (multi-colour) University
	// of Uyo logo was drawn — pure stamp artwork is almost entirely
	// stamp-blue, while the logo adds distinct hues.
	sawBlue := false
	logoPixels := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r8, g8, bl8, a := img.At(x, y).RGBA()
			if a == 0 {
				continue
			}
			r, g, bl := uint8(r8>>8), uint8(g8>>8), uint8(bl8>>8)
			if colorEqual(r, g, bl, StampBlue) {
				sawBlue = true
				continue
			}
			maxc := max(r, max(g, bl))
			minc := min(r, min(g, bl))
			sat := int(maxc) - int(minc)
			dist := int(r)-int(StampBlue.R) + int(g)-int(StampBlue.G) + int(bl)-int(StampBlue.B)
			if dist < 0 {
				dist = -dist
			}
			if sat > 30 && dist > 120 {
				logoPixels++
			}
		}
	}
	if !sawBlue {
		t.Fatal("stamp does not contain the expected blue ink")
	}
	if logoPixels < 400 {
		t.Fatalf("expected visible uniuyo logo pixels, found only %d", logoPixels)
	}
}

func colorEqual(r, g, b uint8, want color.RGBA) bool {
	const tol = 30
	diff := func(a, c uint8) int {
		d := int(a) - int(c)
		if d < 0 {
			return -d
		}
		return d
	}
	return diff(r, want.R) <= tol && diff(g, want.G) <= tol && diff(b, want.B) <= tol
}

// TestStampLogoLoads guards the embedded asset pipeline directly.
func TestStampLogoLoads(t *testing.T) {
	img, err := stampLogo()
	if err != nil {
		t.Fatalf("stampLogo: %v", err)
	}
	if img.Bounds().Dx() == 0 || img.Bounds().Dy() == 0 {
		t.Fatal("logo decoded to an empty image")
	}
}
