package connectmedia

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func picture(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, color.RGBA{uint8(x % 255), uint8(y % 255), 120, 255})
		}
	}
	var b bytes.Buffer
	if e := png.Encode(&b, img); e != nil {
		t.Fatal(e)
	}
	return b.Bytes()
}
func TestImageCompression(t *testing.T) {
	input := picture(t, 2000, 1000)
	out, e := Process(context.Background(), "image", input)
	if e != nil {
		t.Fatal(e)
	}
	if out.Width != 1600 || out.Height != 800 || out.Mime != "image/jpeg" {
		t.Fatalf("wrong output: %+v", out)
	}
	cfg, _, e := image.DecodeConfig(bytes.NewReader(out.Data))
	if e != nil || cfg.Width != 1600 {
		t.Fatal(e, cfg)
	}
	if bytes.Contains(out.Data, []byte("Exif")) {
		t.Fatal("metadata retained")
	}
}
func TestOrientation(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 3))
	src.Set(0, 0, color.RGBA{255, 0, 0, 255})
	redAt := map[int]image.Point{2: {1, 0}, 3: {1, 2}, 4: {0, 2}, 5: {0, 0}, 6: {2, 0}, 7: {2, 1}, 8: {0, 1}}
	for o := 2; o <= 8; o++ {
		out := orient(src, o)
		wantW, wantH := 2, 3
		if o >= 5 {
			wantW, wantH = 3, 2
		}
		if out.Bounds().Dx() != wantW || out.Bounds().Dy() != wantH {
			t.Fatal("orientation", o, out.Bounds())
		}
		at := redAt[o]
		r, g, b, _ := out.At(at.X, at.Y).RGBA()
		if r != 65535 || g != 0 || b != 0 {
			t.Fatal("orientation moved pixel incorrectly", o, at)
		}
	}
}
func TestRejectNonImagesAndOversize(t *testing.T) {
	for _, input := range [][]byte{[]byte("<svg onload='alert(1)'/>"), []byte("GIF89a"), []byte("video renamed .jpg"), make([]byte, MaxInput+1)} {
		if _, e := Process(context.Background(), "image", input); e != ErrInvalid {
			t.Fatal("invalid image accepted", e)
		}
	}
}
func TestJPEGMetadataStripped(t *testing.T) {
	var b bytes.Buffer
	_ = jpeg.Encode(&b, image.NewRGBA(image.Rect(0, 0, 10, 10)), nil)
	input := b.Bytes()
	segment := []byte{0xff, 0xe1, 0, 14, 'E', 'x', 'i', 'f', 0, 0, 't', 'e', 's', 't', 'x', 'x'}
	input = append(append(append([]byte{}, input[:2]...), segment...), input[2:]...)
	out, e := compressImage(input)
	if e != nil || bytes.Contains(out.Data, []byte("Exif")) {
		t.Fatal("metadata not stripped", e)
	}
}
func TestVoiceProcessingAndVideoRejection(t *testing.T) {
	if !VoiceAvailable() {
		t.Skip("ffmpeg/ffprobe not installed")
	}
	ctx := context.Background()
	dir := t.TempDir()
	audio := filepath.Join(dir, "recording.m4a")
	run := func(args ...string) {
		t.Helper()
		if b, e := exec.Command(executable("CONNECT_FFMPEG_PATH", "ffmpeg"), args...).CombinedOutput(); e != nil {
			t.Fatal(string(b), e)
		}
	}
	run("-v", "error", "-f", "lavfi", "-i", "sine=frequency=400:duration=2", "-c:a", "aac", "-y", audio)
	input, _ := os.ReadFile(audio)
	out, e := Process(ctx, "voice", input)
	if e != nil || out.Mime != "audio/mp4" || out.Duration < 1.9 || out.Duration > 2.5 || len(out.Data) > 30000 {
		t.Fatal("voice compression", e, out.Duration, len(out.Data))
	}
	for _, extension := range []string{"webm", "ogg"} {
		recording := filepath.Join(dir, "browser."+extension)
		run("-v", "error", "-f", "lavfi", "-i", "sine=duration=1", "-c:a", "libopus", "-b:a", "32k", "-y", recording)
		input, _ = os.ReadFile(recording)
		if _, e = Process(ctx, "voice", input); e != nil {
			t.Fatal("browser recording rejected", extension, e)
		}
	}
	video := filepath.Join(dir, "video.mp4")
	run("-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=32x32:d=1", "-f", "lavfi", "-i", "sine=duration=1", "-c:v", "mpeg4", "-c:a", "aac", "-y", video)
	input, _ = os.ReadFile(video)
	if _, e = Process(ctx, "voice", input); e != ErrInvalid {
		t.Fatal("video disguised as audio accepted", e)
	}
	long := filepath.Join(dir, "long.m4a")
	run("-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "302", "-c:a", "aac", "-b:a", "32k", "-y", long)
	input, _ = os.ReadFile(long)
	if _, e = Process(ctx, "voice", input); e != ErrInvalid {
		t.Fatal("overlong voice accepted", e)
	}
	if _, e = Process(ctx, "voice", []byte("file '/etc/passwd'\n")); e != ErrInvalid {
		t.Fatal("playlist accepted", e)
	}
}
