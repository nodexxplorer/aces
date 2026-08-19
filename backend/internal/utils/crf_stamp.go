package utils

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"time"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

type SignatureStamp struct {
	ImagePath    string
	Page         int
	X, Y         float64
	Width        float64
	MaxHeight    float64
	ShowDate     bool
	DateX, DateY float64
	DateFontSize float64
}

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

		scale := s.Width / float64(cfg.Width)
		if s.MaxHeight > 0 && cfg.Height > 0 {
			scaleByHeight := s.MaxHeight / float64(cfg.Height)
			if scaleByHeight < scale {
				scale = scaleByHeight
			}
		}

		
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

		if s.ShowDate {
			fontSize := s.DateFontSize
			if fontSize <= 0 {
				fontSize = 10
			}
			dateText := time.Now().Format("02/01/2006")
			// scalefactor:1 abs neutralizes pdfcpu's default text-watermark
			// scaling (Scale: 0.5, relative to the page — meant for a big
			// diagonal "SAMPLE"-style stamp) which otherwise multiplies on
			// top of the points font size and renders it enormous.
			dateDesc := fmt.Sprintf("position:bl, offset:%.2f %.2f, points:%.0f, scalefactor:1 abs, rotation:0, color:0 0 0", s.DateX, s.DateY, fontSize)
			dateWM, err := api.TextWatermark(dateText, dateDesc, true, false, types.POINTS)
			if err != nil {
				return nil, fmt.Errorf("build date watermark: %w", err)
			}
			pageWatermarks[page] = append(pageWatermarks[page], dateWM)
		}
	}

	var out bytes.Buffer
	if err := api.AddWatermarksSliceMap(bytes.NewReader(pdfBytes), &out, pageWatermarks, nil); err != nil {
		return nil, fmt.Errorf("stamp pdf: %w", err)
	}

	return out.Bytes(), nil
}
