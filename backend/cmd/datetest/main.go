package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"bytes"
	"os"

	"github.com/aces/backend/internal/utils"
	"github.com/go-pdf/fpdf"
)

func main() {
	tmp := "/tmp/claude-1000/-home-nodexxplorer-Desktop-Aces-here/4767cb22-e14d-412d-915b-e19d4cc88c12/scratchpad/crf-test"

	pdf := fpdf.New("P", "pt", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetXY(200, 760)
	pdf.CellFormat(150, 20, "HOD's Sign/Date", "1", 0, "L", false, 0, "")
	pdfPath := tmp + "/date_form.pdf"
	pdf.OutputFileAndClose(pdfPath)
	pdfBytes, _ := os.ReadFile(pdfPath)

	w, h := 300, 100
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := color.RGBA{255, 255, 255, 0}
			if (x+y)%30 < 5 {
				c = color.RGBA{10, 10, 10, 255}
			}
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	png.Encode(&buf, img)
	sigPath := tmp + "/date_sig.png"
	os.WriteFile(sigPath, buf.Bytes(), 0644)

	// Signature on the left of the box, live date on the right.
	stamps := []utils.SignatureStamp{
		{
			ImagePath: sigPath, Page: 1, X: 205, Y: 64, Width: 60, MaxHeight: 16,
			ShowDate: true, DateX: 275, DateY: 66, DateFontSize: 9,
		},
	}
	out, err := utils.StampSignatures(pdfBytes, stamps)
	if err != nil {
		fmt.Println("FAILED:", err)
		os.Exit(1)
	}
	os.WriteFile(tmp+"/date_form_signed.pdf", out, 0644)
	fmt.Println("OK, wrote date_form_signed.pdf")
}
