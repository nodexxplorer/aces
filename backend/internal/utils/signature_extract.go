package utils

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	_ "image/jpeg"
	"image/png"
)

func ExtractSignature(imgBytes []byte) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(imgBytes))
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()
	out := image.NewNRGBA(bounds)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			// RGBA() returns 16-bit-scale components ([0,65535]); drop to 8-bit.
			r8, g8, b8 := float64(r>>8), float64(g>>8), float64(b>>8)

			// Standard luminance weighting — how "light" this pixel is.
			lum := 0.299*r8 + 0.587*g8 + 0.114*b8

			inkAlpha := 255 - lum
			if inkAlpha < 0 {
				inkAlpha = 0
			}
			origAlpha8 := float64(a >> 8)
			if origAlpha8 < inkAlpha {
				inkAlpha = origAlpha8
			}

			out.SetNRGBA(x, y, color.NRGBA{R: uint8(r8), G: uint8(g8), B: uint8(b8), A: uint8(inkAlpha)})
		}
	}

	
	crop := inkBoundingBox(out)
	cropped := image.NewNRGBA(image.Rect(0, 0, crop.Dx(), crop.Dy()))
	draw.Draw(cropped, cropped.Bounds(), out, crop.Min, draw.Src)

	var buf bytes.Buffer
	if err := png.Encode(&buf, cropped); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

const alphaThreshold = 80

func inkBoundingBox(img *image.NRGBA) image.Rectangle {
	bounds := img.Bounds()
	minX, minY := bounds.Max.X, bounds.Max.Y
	maxX, maxY := bounds.Min.X, bounds.Min.Y

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if img.NRGBAAt(x, y).A > alphaThreshold {
				if x < minX {
					minX = x
				}
				if x > maxX {
					maxX = x
				}
				if y < minY {
					minY = y
				}
				if y > maxY {
					maxY = y
				}
			}
		}
	}

	if minX > maxX || minY > maxY {
		return bounds
	}

	const pad = 4
	minX -= pad
	minY -= pad
	maxX += pad
	maxY += pad
	if minX < bounds.Min.X {
		minX = bounds.Min.X
	}
	if minY < bounds.Min.Y {
		minY = bounds.Min.Y
	}
	if maxX >= bounds.Max.X {
		maxX = bounds.Max.X - 1
	}
	if maxY >= bounds.Max.Y {
		maxY = bounds.Max.Y - 1
	}
	return image.Rect(minX, minY, maxX+1, maxY+1)
}
