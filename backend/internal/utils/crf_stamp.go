package utils

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

// SignatureStamp describes one image to overlay onto an existing PDF page.
// X/Y are the point coordinates (PDF origin: bottom-left of the page) of the
// image's lower-left corner; Width is the desired rendered width in points —
// height follows the image's own aspect ratio, computed from its actual
// pixel dimensions so the stored Width is honored exactly regardless of the
// source image's resolution.
type SignatureStamp struct {
	ImagePath string
	Page      int
	X, Y      float64
	Width     float64
}

// StampSignatures overlays each stamp's image onto its page of an existing
// PDF (read from pdfBytes) and returns the resulting PDF bytes. Every
// student's uploaded course form gets the exact same calibrated stamps —
// see crf_signature_assets, whose page/x/y/width columns feed this function,
// calibrated once and reused because every CRF uses the same template.
func StampSignatures(pdfBytes []byte, stamps []SignatureStamp) ([]byte, error) {
	pageWatermarks := map[int][]*model.Watermark{}

	for _, s := range stamps {
		imgBytes, err := os.ReadFile(s.ImagePath)
		if err != nil {
			return nil, fmt.Errorf("read signature image %s: %w", s.ImagePath, err)
		}

		cfg, _, err := image.DecodeConfig(bytes.NewReader(imgBytes))
		if err != nil {
			return nil, fmt.Errorf("decode signature image %s: %w", s.ImagePath, err)
		}
		if cfg.Width <= 0 {
			return nil, fmt.Errorf("signature image %s has zero width", s.ImagePath)
		}
		// pdfcpu's "abs" scale factor is a multiplier of the image's own
		// pixel width, not a literal point value — back-solve for the
		// multiplier that renders at exactly the calibrated Width.
		scale := s.Width / float64(cfg.Width)

		// rotation:0 overrides pdfcpu's default diagonal watermark placement
		// (DiagonalLLToUR) — a signature has to sit flat, not at an angle.
		desc := fmt.Sprintf("position:bl, offset:%.2f %.2f, scalefactor:%.6f abs, opacity:1, rotation:0", s.X, s.Y, scale)
		wm, err := api.ImageWatermarkForReader(bytes.NewReader(imgBytes), desc, true, false, types.POINTS)
		if err != nil {
			return nil, fmt.Errorf("build watermark for %s: %w", s.ImagePath, err)
		}

		page := s.Page
		if page <= 0 {
			page = 1
		}
		pageWatermarks[page] = append(pageWatermarks[page], wm)
	}

	var out bytes.Buffer
	if err := api.AddWatermarksSliceMap(bytes.NewReader(pdfBytes), &out, pageWatermarks, nil); err != nil {
		return nil, fmt.Errorf("stamp pdf: %w", err)
	}

	return out.Bytes(), nil
}
