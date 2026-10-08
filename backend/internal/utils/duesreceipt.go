// duesreceipt.go

package utils

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"log"
	"math"
	"os"
	"strings"
	"sync"

	"github.com/fogleman/gg"
	"github.com/go-pdf/fpdf"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
)

// ---- Fonts (embedded so the receipt renders identically everywhere,
// ---- including the Alpine production container which ships no fonts) ------

//go:embed assets/fonts/*.ttf
var receiptFonts embed.FS

var (
	fontOnce sync.Once
	fontMap  map[string]*truetype.Font
	fontErr  error
)

// embeddedFont parses one of the bundled TTFs once and caches the result.
func embeddedFont(name string) (*truetype.Font, error) {
	fontOnce.Do(func() {
		fontMap = map[string]*truetype.Font{}
		names := []string{
			"DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "DejaVuSerif.ttf",
			"DejaVuSerif-Bold.ttf", "DejaVuSansMono-Bold.ttf",
		}
		for _, n := range names {
			raw, err := receiptFonts.ReadFile("assets/fonts/" + n)
			if err != nil {
				fontErr = fmt.Errorf("read embedded font %s: %w", n, err)
				return
			}
			f, err := truetype.Parse(raw)
			if err != nil {
				fontErr = fmt.Errorf("parse embedded font %s: %w", n, err)
				return
			}
			fontMap[n] = f
		}
	})
	if fontErr != nil {
		return nil, fontErr
	}
	f, ok := fontMap[name]
	if !ok {
		return nil, fmt.Errorf("embedded font %q not found", name)
	}
	return f, nil
}

// decodePNGBytes decodes PNG image bytes (for embedded logos).
func decodePNGBytes(b []byte) (image.Image, error) {
	// Any registered format: PNG, JPEG or WebP, as the logo folder allows.
	img, _, err := image.Decode(bytes.NewReader(b))
	return img, err
}

// fontFace builds a gg font.Face from an embedded TTF at the given size.
func fontFace(name string, size float64) (font.Face, error) {
	f, err := embeddedFont(name)
	if err != nil {
		return nil, err
	}
	// Hinting: full — these faces are only used at fixed pixel sizes.
	return truetype.NewFace(f, &truetype.Options{Size: size, DPI: 72, Hinting: font.HintingFull}), nil
}

// Font family names used across the receipt layout. Each maps to one of the
// embedded TTFs via fontFace.
const (
	FontTitle     = "DejaVuSans-Bold.ttf"
	FontSans      = "DejaVuSans.ttf"
	FontSerif     = "DejaVuSerif.ttf"
	FontSerifBold = "DejaVuSerif-Bold.ttf"
	FontMono      = "DejaVuSansMono-Bold.ttf"
)

// ---- Receipt numbering ---------------------------------------------------

const (
	CounterFile      = "receipt_counter.json"
	MaxReceiptNumber = 9999

	// false: Department Dues and Class Dues each have their OWN counter
	//        (like two separate receipt books).
	// true : one shared counter for both.
	SharedCounter = false
)

// Counter hands out receipt numbers and remembers the last one on disk.
type Counter struct {
	mu   sync.Mutex
	Path string
}

var receiptCounter = &Counter{Path: CounterFile}

// Next returns the next number for key: 1, 2, ... 9999, then 1 again.
func (c *Counter) Next(key string) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	state := map[string]int{}
	b, err := os.ReadFile(c.Path)
	switch {
	case err == nil:
		if err := json.Unmarshal(b, &state); err != nil {
			return 0, fmt.Errorf("counter file %s is corrupt: %w", c.Path, err)
		}
	case !os.IsNotExist(err):
		return 0, err
	}

	n := state[key] + 1
	if n > MaxReceiptNumber || n < 1 {
		n = 1
	}
	state[key] = n

	out, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return 0, err
	}
	tmp := c.Path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o644); err != nil {
		return 0, err
	}
	if err := os.Rename(tmp, c.Path); err != nil {
		return 0, err
	}
	return n, nil
}

// ---- Receipt types -------------------------------------------------------

type ReceiptKind string

const (
	DepartmentDues ReceiptKind = "DEPARTMENT DUES"
	ClassDues      ReceiptKind = "CLASS DUES"
)

func (k ReceiptKind) counterKey() string {
	if SharedCounter {
		return "receipt"
	}
	if k == ClassDues {
		return "class"
	}
	return "department"
}

// Org is the letterhead. LogoLeft/LogoRight are raw image bytes (PNG);
// empty = dashed placeholder box.
type Org struct {
	Name1, Name2 string
	Chapter      string
	Email, Motto string
	LogoLeft     []byte // e.g. University of Uyo crest
	LogoRight    []byte // e.g. ACES logo
}

//go:embed assets/uniuyo_logo.png
var uniuyoLogoPNG []byte

//go:embed assets/aces-logo.png
var acesLogoPNG []byte

var DefaultOrg = Org{
	Name1:   "ASSOCIATION OF COMPUTER",
	Name2:   "ENGINEERING STUDENTS (ACES)",
	Chapter: "UNIVERSITY OF UYO CHAPTER AKWA IBOM STATE",
	Email:   "Email: acesuniuyo112@gmail.com",
	Motto:   "Motto: Intelligence that rules the world",
	// Left: the University of Uyo crest; right: the ACES logo. Swap or
	// reorder by changing these two fields.
	LogoLeft:  uniuyoLogoPNG,
	LogoRight: acesLogoPNG,
}

// ReceiptData holds optional pre-filled values. Empty = blank line.
type ReceiptData struct {
	Date         string
	ReceivedFrom string
	Of           string
	SumOf        string // "The Sum Of:" line
	NairaWords   string // line before "Naira"
	KoboWords    string // line before "Kobo"
	Being        string
	BeingCont    string // second "Being" line
	AmountNaira  string // inside the  ₦ [ ] K  box
	AmountKobo   string
	RegNo        string
}

// ---- Layout --------------------------------------------------------------

const (
	receiptW = 1400
	receiptH = 1050
	margin   = 50
)

var (
	blue = color.RGBA{0x1F, 0x4E, 0xC4, 0xFF}
	ink  = color.RGBA{0x1A, 0x1F, 0x33, 0xFF}
)

func setFont(dc *gg.Context, name string, size float64) {
	face, err := fontFace(name, size)
	if err != nil {
		log.Printf("warning: font %s: %v", name, err)
		return
	}
	dc.SetFontFace(face)
}

// fitFont loads name at up to maxSize, shrinking so every text fits maxWidth.
func fitFont(dc *gg.Context, name string, maxSize, maxWidth float64, texts ...string) float64 {
	setFont(dc, name, maxSize)
	widest := 0.0
	for _, t := range texts {
		if w, _ := dc.MeasureString(t); w > widest {
			widest = w
		}
	}
	size := maxSize
	if widest > maxWidth {
		size = maxSize * maxWidth / widest
		setFont(dc, name, size)
	}
	return size
}

// RenderReceipt draws one receipt with the given number (no numbering
// happens here, so re-rendering an old receipt never burns a new number).
func RenderReceipt(org Org, kind ReceiptKind, number int, d ReceiptData) *gg.Context {
	dc := gg.NewContext(receiptW, receiptH)
	dc.SetColor(color.White)
	dc.Clear()

	cx := float64(receiptW) / 2
	left, right := float64(margin), float64(receiptW-margin)

	// ---------- Letterhead: logos + organisation name ----------
	logo := 190.0
	drawLogo(dc, org.LogoLeft, left+logo/2, 40+logo/2, logo)
	drawLogo(dc, org.LogoRight, right-logo/2, 40+logo/2, logo)

	textW := float64(receiptW) - 2*(margin+logo+25)
	dc.SetColor(blue)
	fitFont(dc, FontTitle, 60, textW, org.Name1, org.Name2)
	dc.DrawStringAnchored(org.Name1, cx, 72, 0.5, 0.5)
	dc.DrawStringAnchored(org.Name2, cx, 132, 0.5, 0.5)

	setFont(dc, FontSans, 25)
	dc.DrawStringAnchored(org.Chapter, cx, 182, 0.5, 0.5)
	setFont(dc, FontTitle, 25)
	dc.DrawStringAnchored(org.Email, cx, 212, 0.5, 0.5)
	setFont(dc, FontSans, 25)
	dc.DrawStringAnchored(org.Motto, cx, 242, 0.5, 0.5)

	// ---------- Topic banner: DEPARTMENT DUES / CLASS DUES ----------
	setFont(dc, FontTitle, 36)
	tw, _ := dc.MeasureString(string(kind))
	bw, bh := tw+110, 56.0
	by := 275.0
	dc.SetColor(blue)
	dc.SetLineWidth(3)
	dc.DrawRoundedRectangle(cx-bw/2, by, bw, bh, bh/2)
	dc.Stroke()
	dc.DrawStringAnchored(string(kind), cx, by+bh/2, 0.5, 0.35)

	// ---------- OFFICIAL RECEIPT  NO. 0000          Date: ____ ----------
	ry := 355.0
	rh := 54.0
	setFont(dc, FontTitle, 32)
	dc.SetColor(blue)
	dc.DrawRoundedRectangle(left, ry, 330, rh, 14)
	dc.Fill()
	dc.SetColor(color.White)
	dc.DrawStringAnchored("OFFICIAL RECEIPT", left+165, ry+rh/2, 0.5, 0.35)

	dc.SetColor(blue)
	setFont(dc, FontTitle, 36)
	dc.DrawStringAnchored("NO.", left+350, ry+rh/2, 0, 0.35)
	setFont(dc, FontMono, 40)
	dc.SetColor(ink)
	dc.DrawStringAnchored(fmt.Sprintf("%04d", number), left+425, ry+rh/2, 0, 0.35)

	drawField(dc, "Date:", right-400, right, ry+rh-4, d.Date, true)

	// ---------- Handwriting lines ----------
	rows := []float64{485, 557, 629, 701, 773, 833}
	drawField(dc, "Received from:", left, right, rows[0], d.ReceivedFrom, false)
	drawField(dc, "Of:", left, right, rows[1], d.Of, false)
	drawField(dc, "The Sum Of:", left, right, rows[2], d.SumOf, false)

	// ____ Naira ____ Kobo
	dc.SetLineWidth(1.8)
	drawLineWithText(dc, left, 900, rows[3], d.NairaWords)
	setFont(dc, FontSerif, 30)
	dc.SetColor(blue)
	dc.DrawStringAnchored("Naira", 908, rows[3]-8, 0, 0)
	drawLineWithText(dc, 1000, right-90, rows[3], d.KoboWords)
	setFont(dc, FontSerif, 30)
	dc.SetColor(blue)
	dc.DrawStringAnchored("Kobo", right-82, rows[3]-8, 0, 0)

	drawField(dc, "Being", left, right, rows[4], d.Being, false)
	drawLineWithText(dc, left, right, rows[5], d.BeingCont)

	// ---------- Amount box  ₦ [ ... ] K   and   REG. NO. box ----------
	boxY, boxH := 868.0, 68.0
	dc.SetColor(blue)
	dc.SetLineWidth(2)
	dc.DrawRoundedRectangle(left, boxY, 360, boxH, 14)
	dc.Stroke()
	setFont(dc, FontSerifBold, 38)
	dc.DrawStringAnchored("₦", left+16, boxY+boxH/2, 0, 0.35)
	dc.DrawStringAnchored("K", left+360-16, boxY+boxH/2, 1, 0.35)
	setFont(dc, FontSans, 32)
	dc.SetColor(ink)
	dc.DrawStringAnchored(d.AmountNaira, left+66, boxY+boxH/2, 0, 0.35)
	dc.DrawStringAnchored(d.AmountKobo, left+360-56, boxY+boxH/2, 1, 0.35)

	regX := right - 410
	dc.SetColor(blue)
	dc.DrawRoundedRectangle(regX, boxY, 410, boxH, 14)
	dc.Stroke()
	setFont(dc, FontSerifBold, 30)
	dc.DrawStringAnchored("REG. NO.", regX+16, boxY+boxH/2, 0, 0.35)
	rw, _ := dc.MeasureString("REG. NO.")
	setFont(dc, FontSans, 30)
	dc.SetColor(ink)
	dc.DrawStringAnchored(d.RegNo, regX+16+rw+14, boxY+boxH/2, 0, 0.35)

	// ---------- Signatures ----------
	sigY := 992.0
	dc.SetColor(blue)
	dc.SetLineWidth(1.8)
	dc.DrawLine(left, sigY, left+360, sigY)
	dc.Stroke()
	dc.DrawLine(right-360, sigY, right, sigY)
	dc.Stroke()
	setFont(dc, FontSerif, 28)
	dc.DrawStringAnchored("Student's Signature", left+180, sigY+22, 0.5, 0.5)
	dc.DrawStringAnchored("Cashier Signature", right-180, sigY+22, 0.5, 0.5)

	return dc
}

// IssueReceipt takes the next number for this receipt type and renders it.
func IssueReceipt(org Org, kind ReceiptKind, d ReceiptData) (*gg.Context, int, error) {
	n, err := receiptCounter.Next(kind.counterKey())
	if err != nil {
		return nil, 0, err
	}
	return RenderReceipt(org, kind, n, d), n, nil
}

// ---- Drawing helpers -----------------------------------------------------

// drawField draws "Label: ______" with the underline running to x1.
func drawField(dc *gg.Context, label string, x0, x1, y float64, value string, boldLabel bool) {
	font := FontSerif
	if boldLabel {
		font = FontSerifBold
	}
	setFont(dc, font, 30)
	dc.SetColor(blue)
	dc.DrawStringAnchored(label, x0, y-8, 0, 0)
	w, _ := dc.MeasureString(label)
	drawLineWithText(dc, x0+w+8, x1, y, value)
}

// drawLineWithText draws an underline from x0 to x1 with optional text on it.
func drawLineWithText(dc *gg.Context, x0, x1, y float64, text string) {
	dc.SetColor(blue)
	dc.SetLineWidth(1.8)
	dc.DrawLine(x0, y, x1, y)
	dc.Stroke()
	if text != "" {
		setFont(dc, FontSans, 30)
		dc.SetColor(ink)
		dc.DrawStringAnchored(text, x0+10, y-9, 0, 0)
	}
}

// tintImage returns a single-colour copy of src in colour c. Each pixel's
// darkness becomes its opacity, so white/transparent areas stay empty, black
// areas become solid c, and greys become lighter shades of c. This keeps the
// logo's detail while making it match the rest of the receipt.
func tintImage(src image.Image, c color.RGBA) image.Image {
	b := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			// RGBA() returns alpha-premultiplied 16-bit values.
			r, g, bl, a := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
			if a == 0 {
				continue // fully transparent, leave empty
			}
			// Luminance of the un-premultiplied colour, 0..1.
			lum := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(bl)) / float64(a)
			if lum > 1 {
				lum = 1
			}
			alpha := (1 - lum) * float64(a) / 65535
			dst.SetNRGBA(x, y, color.NRGBA{
				R: c.R, G: c.G, B: c.B,
				A: uint8(alpha*255 + 0.5),
			})
		}
	}
	return dst
}

// drawLogo draws the PNG bytes fitted into a size×size slot centred on
// (cx, cy), tinted to the receipt blue. Empty bytes (or an undecodable
// image) = dashed placeholder box.
func drawLogo(dc *gg.Context, pngBytes []byte, cx, cy, size float64) {
	if len(pngBytes) > 0 {
		img, err := decodePNGBytes(pngBytes)
		if err == nil {
			img = tintImage(img, blue)
			b := img.Bounds()
			s := math.Min(size/float64(b.Dx()), size/float64(b.Dy()))
			dc.Push()
			dc.Translate(cx, cy)
			dc.Scale(s, s)
			dc.DrawImageAnchored(img, 0, 0, 0.5, 0.5)
			dc.Pop()
			return
		}
		log.Printf("warning: logo decode: %v (showing placeholder)", err)
	}
	drawImagePlaceholder(dc, cx, cy, size, size, blue)
}

// drawImagePlaceholder: dashed box with a small "picture" icon.
func drawImagePlaceholder(dc *gg.Context, cx, cy, w, h float64, col color.Color) {
	dc.Push()
	dc.SetColor(col)
	dc.SetLineWidth(1.6)
	dc.SetDash(8, 6)
	dc.DrawRectangle(cx-w/2, cy-h/2, w, h)
	dc.Stroke()
	dc.SetDash()

	iw := math.Min(w, h) * 0.45
	ih := iw * 0.72
	x0, y0 := cx-iw/2, cy-ih/2
	dc.SetLineWidth(1.6)
	dc.DrawRectangle(x0, y0, iw, ih)
	dc.Stroke()
	dc.DrawCircle(x0+iw*0.25, y0+ih*0.30, ih*0.12)
	dc.Fill()
	dc.NewSubPath()
	dc.MoveTo(x0, y0+ih*0.88)
	dc.LineTo(x0+iw*0.33, y0+ih*0.48)
	dc.LineTo(x0+iw*0.53, y0+ih*0.68)
	dc.LineTo(x0+iw*0.72, y0+ih*0.34)
	dc.LineTo(x0+iw, y0+ih*0.88)
	dc.ClosePath()
	dc.Fill()
	dc.Pop()
}

// ---- PDF output ----------------------------------------------------------

// RenderReceiptPDF rasterizes the receipt face and wraps it in a single-page
// A4 PDF (receipt scaled to fill the page minus a small margin). PDF is what
// students expect for a downloadable receipt — it prints at a predictable
// size and can't be casually edited the way a PNG can.
func RenderReceiptPDF(org Org, kind ReceiptKind, number int, d ReceiptData) ([]byte, error) {
	dc := RenderReceipt(org, kind, number, d)

	var pngBuf bytes.Buffer
	if err := dc.EncodePNG(&pngBuf); err != nil {
		return nil, fmt.Errorf("encode receipt png: %w", err)
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	// RegisterImageReader keeps the raw PNG out of a temp file; the image is
	// decoded once here and embedded into the PDF stream.
	info := pdf.RegisterImageReader("receipt", "png", bytes.NewReader(pngBuf.Bytes()))
	if info == nil {
		return nil, fmt.Errorf("register receipt image")
	}
	pdf.Image("receipt", 0, 0, 210, 0, false, "png", 0, "")

	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, fmt.Errorf("write receipt pdf: %w", err)
	}
	return out.Bytes(), nil
}

// OrgFor returns the letterhead for a department's dues receipts. The University
// crest stays on the left. The department's name, institution, contact email
// and logo take the association's place. A nil logo leaves that side blank.
func OrgFor(name, institution, contactEmail string, logo []byte) Org {
	name1, name2 := splitBrandName(strings.ToUpper(strings.TrimSpace(name)))
	org := Org{
		Name1:     name1,
		Name2:     name2,
		Chapter:   strings.ToUpper(strings.TrimSpace(institution)),
		LogoLeft:  uniuyoLogoPNG,
		LogoRight: logo,
	}
	if contactEmail != "" {
		org.Email = "Email: " + contactEmail
	}
	return org
}

// splitBrandName breaks a name over two lines, as near the middle as a word
// boundary allows. A one-word name stays on the first line.
func splitBrandName(name string) (string, string) {
	words := strings.Fields(name)
	if len(words) < 2 {
		return name, ""
	}
	total := len(name)
	best, bestGap := 1, -1
	for i := 1; i < len(words); i++ {
		gap := len(strings.Join(words[:i], " "))*2 - total
		if gap < 0 {
			gap = -gap
		}
		if bestGap < 0 || gap < bestGap {
			best, bestGap = i, gap
		}
	}
	return strings.Join(words[:best], " "), strings.Join(words[best:], " ")
}
