package utils

import (
	"fmt"
	"strings"
)

// pdfCentered places text centered horizontally at centerX, using real
// Helvetica/Helvetica-Bold glyph metrics (not a rough per-character guess)
// so headings land dead-center instead of drifting.
func pdfCentered(b *strings.Builder, centerX, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	x := centerX - w/2
	pdfAt(b, x, y, size, font, text)
}

// pdfCenteredBetween centers text between x1 and x2.
func pdfCenteredBetween(b *strings.Builder, x1, x2, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	cx := (x1 + x2) / 2
	pdfAt(b, cx-w/2, y, size, font, text)
}

// pdfAt emits PDF operators to render text at absolute position (x, y).
// Escaping is applied here, once, so callers (and width calculations done
// by pdfCentered/pdfCenteredBetween) always work with the real text.
func pdfAt(b *strings.Builder, x, y, size float64, font, text string) {
	b.WriteString(fmt.Sprintf("/%s %g Tf\n", font, size))
	b.WriteString(fmt.Sprintf("1 0 0 1 %.2f %.2f Tm\n", x, y))
	b.WriteString(fmt.Sprintf("(%s) Tj\n", pdfSafe(text)))
}

// pdfSafe escapes PDF string literal special characters.
func pdfSafe(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r < 128 {
			switch r {
			case '(':
				b.WriteString("\\(")
			case ')':
				b.WriteString("\\)")
			case '\\':
				b.WriteString("\\\\")
			default:
				b.WriteRune(r)
			}
		} else if r < 256 {
			// Latin-1 supplement (includes middle dot U+00B7) — octal escape
			b.WriteString(fmt.Sprintf("\\%03o", r))
		}
	}
	return b.String()
}

// mm converts millimeters to PDF points (1mm = 2.83465pt).
func mm(v float64) float64 { return v * 2.83465 }

// textWidth computes the rendered width (in points) of text set in the
// given font ("F1"=Helvetica, "F2"=Helvetica-Bold, "F3"=Times-Roman,
// "F4"=Times-Bold) at the given size, using standard AFM glyph widths
// (per 1000 em units).
func textWidth(text string, font string, size float64) float64 {
	var widths map[rune]float64
	switch font {
	case "F2":
		widths = helveticaBoldWidths
	case "F3":
		widths = timesRomanWidths
	case "F4":
		widths = timesBoldWidths
	default:
		widths = helveticaWidths
	}
	total := 0.0
	for _, r := range text {
		w, ok := widths[r]
		if !ok {
			w = 500
		}
		total += w
	}
	return total / 1000.0 * size
}

// Standard Times-Roman AFM widths (per 1000 em units).
var timesRomanWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, '\'': 180,
	'(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
	'@': 921,
	'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722, 'H': 722,
	'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722, 'P': 556,
	'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944, 'X': 722,
	'Y': 722, 'Z': 611,
	'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 333, 'g': 500, 'h': 500,
	'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500, 'p': 500,
	'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '·': 250,
}

// Standard Times-Bold AFM widths (per 1000 em units).
var timesBoldWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 555, '#': 500, '$': 500, '%': 1000, '&': 833, '\'': 278,
	'(': 333, ')': 333, '*': 500, '+': 570, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 333, ';': 333, '<': 570, '=': 570, '>': 570, '?': 500,
	'@': 930,
	'A': 722, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 778,
	'I': 389, 'J': 500, 'K': 778, 'L': 667, 'M': 944, 'N': 722, 'O': 778, 'P': 611,
	'Q': 778, 'R': 722, 'S': 556, 'T': 667, 'U': 722, 'V': 722, 'W': 1000, 'X': 722,
	'Y': 722, 'Z': 667,
	'a': 500, 'b': 556, 'c': 444, 'd': 556, 'e': 444, 'f': 333, 'g': 500, 'h': 556,
	'i': 278, 'j': 333, 'k': 556, 'l': 278, 'm': 833, 'n': 556, 'o': 500, 'p': 556,
	'q': 556, 'r': 444, 's': 389, 't': 333, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '·': 250,
}

// Standard Helvetica AFM widths (per 1000 em units).
var helveticaWidths = map[rune]float64{
	' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, '\'': 191,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
	'@': 1015,
	'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556,
	'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
	'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 500,
}

// Standard Helvetica-Bold AFM widths (per 1000 em units).
var helveticaBoldWidths = map[rune]float64{
	' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, '\'': 238,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611,
	'@': 975,
	'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611, 'h': 611,
	'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611, 'p': 611,
	'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556, 'w': 778, 'x': 556,
	'y': 556, 'z': 500,
}
