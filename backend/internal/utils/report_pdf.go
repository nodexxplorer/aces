package utils

import (
	"bytes"

	"github.com/go-pdf/fpdf"
)

// ReportTableInput is a simple title + table of strings — every report
// type this feature supports reduces its real, already-computed query
// results down to this before rendering, so there's exactly one PDF layout
// to get right rather than one per report type.
type ReportTableInput struct {
	Title   string
	Headers []string
	Rows    [][]string
}

// GenerateTablePDF renders a one-page-per-overflow title + table report.
func GenerateTablePDF(input ReportTableInput) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(0, 10, input.Title, "", 1, "L", false, 0, "")
	pdf.Ln(4)

	if len(input.Headers) == 0 {
		pdf.SetFont("Arial", "", 11)
		pdf.CellFormat(0, 8, "No data available for this report.", "", 1, "L", false, 0, "")
	} else {
		colWidth := 190.0 / float64(len(input.Headers))

		pdf.SetFont("Arial", "B", 10)
		pdf.SetFillColor(230, 230, 230)
		for _, h := range input.Headers {
			pdf.CellFormat(colWidth, 8, h, "1", 0, "L", true, 0, "")
		}
		pdf.Ln(-1)

		pdf.SetFont("Arial", "", 9)
		for _, row := range input.Rows {
			for i, cell := range row {
				if i >= len(input.Headers) {
					break
				}
				pdf.CellFormat(colWidth, 7, cell, "1", 0, "L", false, 0, "")
			}
			pdf.Ln(-1)
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
