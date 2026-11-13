// Package connectmedia stores private, conversation-bound images/voice notes.
package connectmedia

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const MaxInput = 8 << 20

var (
	ErrInvalid     = errors.New("only JPEG/PNG/WebP images or in-app voice recordings up to five minutes are supported; video and other files are disabled")
	ErrForbidden   = errors.New("not authorized for this conversation or attachment")
	ErrConflict    = errors.New("media is processing, already attached, or this retry differs from the original message")
	ErrQuota       = errors.New("Connect media upload limit reached; retry later")
	ErrUnavailable = errors.New("voice processing is unavailable; please try again later")
)

type Processed struct {
	Data          []byte
	Mime          string
	Width, Height int
	Duration      float64
}

var processingSlots = make(chan struct{}, 2)

func Process(ctx context.Context, kind string, input []byte) (Processed, error) {
	if len(input) == 0 || len(input) > MaxInput {
		return Processed{}, ErrInvalid
	}
	select {
	case processingSlots <- struct{}{}:
		defer func() { <-processingSlots }()
	case <-ctx.Done():
		return Processed{}, ctx.Err()
	}
	if kind == "image" {
		return compressImage(input)
	}
	if kind == "voice" {
		return compressVoice(ctx, input)
	}
	return Processed{}, ErrInvalid
}
func compressImage(input []byte) (Processed, error) {
	var out Processed
	cfg, format, err := image.DecodeConfig(bytes.NewReader(input))
	if err != nil || (format != "jpeg" && format != "png" && format != "webp") || cfg.Width < 1 || cfg.Height < 1 || int64(cfg.Width)*int64(cfg.Height) > 12_000_000 || cfg.Width > 12000 || cfg.Height > 12000 {
		return out, ErrInvalid
	}
	img, _, err := image.Decode(bytes.NewReader(input))
	if err != nil {
		return out, ErrInvalid
	}
	img = orient(img, jpegOrientation(input))
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	if w > 1600 || h > 1600 {
		if w >= h {
			h = max(1, h*1600/w)
			w = 1600
		} else {
			w = max(1, w*1600/h)
			h = 1600
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
	var b bytes.Buffer
	if err = jpeg.Encode(&b, dst, &jpeg.Options{Quality: 88}); err != nil {
		return out, err
	}
	if b.Len() > 3<<20 {
		return out, ErrInvalid
	}
	return Processed{Data: b.Bytes(), Mime: "image/jpeg", Width: w, Height: h}, nil
}

// Read the bounded EXIF orientation tag before stripping all metadata on output.
func jpegOrientation(b []byte) int {
	if len(b) < 4 || b[0] != 0xff || b[1] != 0xd8 {
		return 1
	}
	at := 2
	for at+4 <= len(b) {
		if b[at] != 0xff {
			return 1
		}
		marker := b[at+1]
		if marker == 0xda || marker == 0xd9 {
			return 1
		}
		n := int(binary.BigEndian.Uint16(b[at+2 : at+4]))
		if n < 2 || at+2+n > len(b) {
			return 1
		}
		p := b[at+4 : at+2+n]
		at += n + 2
		if marker != 0xe1 || len(p) < 14 || string(p[:6]) != "Exif\x00\x00" {
			continue
		}
		p = p[6:]
		var order binary.ByteOrder
		if string(p[:2]) == "II" {
			order = binary.LittleEndian
		} else if string(p[:2]) == "MM" {
			order = binary.BigEndian
		} else {
			return 1
		}
		off := int(order.Uint32(p[4:8]))
		if off < 8 || off+2 > len(p) {
			return 1
		}
		count := int(order.Uint16(p[off : off+2]))
		for i := 0; i < count; i++ {
			j := off + 2 + i*12
			if j+12 > len(p) {
				return 1
			}
			if order.Uint16(p[j:j+2]) == 0x112 && order.Uint16(p[j+2:j+4]) == 3 && order.Uint32(p[j+4:j+8]) == 1 {
				o := int(order.Uint16(p[j+8 : j+10]))
				if o >= 1 && o <= 8 {
					return o
				}
			}
		}
		return 1
	}
	return 1
}
func orient(src image.Image, o int) image.Image {
	if o < 2 || o > 8 {
		return src
	}
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dw, dh := w, h
	if o >= 5 {
		dw, dh = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		for x := 0; x < dw; x++ {
			sx, sy := x, y
			switch o {
			case 2:
				sx = w - 1 - x
			case 3:
				sx, sy = w-1-x, h-1-y
			case 4:
				sy = h - 1 - y
			case 5:
				sx, sy = y, x
			case 6:
				sx, sy = y, h-1-x
			case 7:
				sx, sy = w-1-y, h-1-x
			case 8:
				sx, sy = w-1-y, x
			}
			dst.Set(x, y, src.At(src.Bounds().Min.X+sx, src.Bounds().Min.Y+sy))
		}
	}
	return dst
}
func executable(key, name string) string {
	if p := os.Getenv(key); p != "" {
		return p
	}
	return name
}
func VoiceAvailable() bool {
	_, a := exec.LookPath(executable("CONNECT_FFMPEG_PATH", "ffmpeg"))
	_, b := exec.LookPath(executable("CONNECT_FFPROBE_PATH", "ffprobe"))
	return a == nil && b == nil
}

type probeData struct {
	Streams []struct {
		Type string `json:"codec_type"`
	} `json:"streams"`
	Format struct {
		Duration string `json:"duration"`
		Name     string `json:"format_name"`
	} `json:"format"`
}

func probe(ctx context.Context, path string) (probeData, error) {
	var p probeData
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	b, err := exec.CommandContext(ctx, executable("CONNECT_FFPROBE_PATH", "ffprobe"), "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "stream=codec_type:format=duration,format_name", "-of", "json", path).Output()
	if err != nil || len(b) > 64<<10 {
		return p, ErrInvalid
	}
	if json.Unmarshal(b, &p) != nil || len(p.Streams) != 1 || p.Streams[0].Type != "audio" {
		return p, ErrInvalid
	}
	return p, nil
}
func compressVoice(ctx context.Context, input []byte) (Processed, error) {
	var out Processed
	if !(len(input) >= 12 && ((bytes.Equal(input[:4], []byte{0x1a, 0x45, 0xdf, 0xa3})) || string(input[:4]) == "OggS" || string(input[4:8]) == "ftyp")) {
		return out, ErrInvalid
	}
	if !VoiceAvailable() {
		return out, ErrUnavailable
	}
	dir, err := os.MkdirTemp("", "aces-voice-")
	if err != nil {
		return out, err
	}
	defer os.RemoveAll(dir)
	in, dest := filepath.Join(dir, "recording"), filepath.Join(dir, "voice.m4a")
	if err = os.WriteFile(in, input, 0600); err != nil {
		return out, err
	}
	p, err := probe(ctx, in)
	if err != nil {
		return out, err
	}
	if d, e := strconv.ParseFloat(p.Format.Duration, 64); e == nil && (d <= 0 || d > 300.5) {
		return out, ErrInvalid
	}
	work, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(work, executable("CONNECT_FFMPEG_PATH", "ffmpeg"), "-nostdin", "-v", "error", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", in, "-map", "0:a:0", "-vn", "-sn", "-dn", "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k", "-map_metadata", "-1", "-t", "301", "-movflags", "+faststart", "-y", dest)
	if err = cmd.Run(); err != nil {
		return out, ErrInvalid
	}
	p, err = probe(ctx, dest)
	if err != nil {
		return out, err
	}
	duration, err := strconv.ParseFloat(p.Format.Duration, 64)
	if err != nil || duration <= 0 || duration > 300.5 {
		return out, ErrInvalid
	}
	f, err := os.Open(dest)
	if err != nil {
		return out, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 2<<20))
	if err != nil || len(data) >= 2<<20 {
		return out, ErrInvalid
	}
	return Processed{Data: data, Mime: "audio/mp4", Duration: duration}, nil
}
