package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// ErrWallpaperNotConfigured means the server has no Gemini key, so no wallpaper
// can be created.
var ErrWallpaperNotConfigured = errors.New("wallpaper generation is not configured")

// maxWallpaperBytes caps the decoded image the server will pass on.
const maxWallpaperBytes = 8 << 20

// wallpaperPromptFrame wraps the person's description so the picture suits a
// sign-in background: wide, calm, with no text, logos or faces to fight the form.
const wallpaperPromptFrame = "Create a wide, calm background image for a university sign-in page. " +
	"No text, no logos, no people's faces. Subject: %s"

// GeneratedWallpaper is an image the model made, base64-encoded.
type GeneratedWallpaper struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

// WallpaperService asks Gemini's image model for a wallpaper. The key stays on
// the server; callers only see the picture.
type WallpaperService struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

// NewWallpaperService builds the service. With no key it is still returned, but
// Generate reports ErrWallpaperNotConfigured.
func NewWallpaperService(apiKey, model string) *WallpaperService {
	return &WallpaperService{
		apiKey:  apiKey,
		model:   model,
		baseURL: "https://generativelanguage.googleapis.com",
		client:  &http.Client{Timeout: 90 * time.Second},
	}
}

// Configured reports whether a Gemini key is set.
func (s *WallpaperService) Configured() bool {
	return s != nil && s.apiKey != "" && s.model != ""
}

type wallpaperRequest struct {
	Contents []struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		ResponseModalities []string `json:"responseModalities"`
	} `json:"generationConfig"`
}

type wallpaperResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				InlineData *struct {
					MimeType string `json:"mimeType"`
					Data     string `json:"data"`
				} `json:"inlineData,omitempty"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Generate asks the model for one wallpaper described by prompt. Any failure
// (no key, network, a refusal, an unexpected or oversized image) is returned as
// an error; the caller decides what to tell the person.
func (s *WallpaperService) Generate(ctx context.Context, prompt string) (*GeneratedWallpaper, error) {
	if !s.Configured() {
		return nil, ErrWallpaperNotConfigured
	}
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return nil, errors.New("empty wallpaper prompt")
	}

	var body wallpaperRequest
	body.Contents = make([]struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}, 1)
	body.Contents[0].Parts = []struct {
		Text string `json:"text"`
	}{{Text: fmt.Sprintf(wallpaperPromptFrame, prompt)}}
	body.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent", s.baseURL, s.model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("wallpaper request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, fmt.Errorf("wallpaper response unreadable: %w", err)
	}

	var parsed wallpaperResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("wallpaper response not JSON (status %d)", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		msg := "no message"
		if parsed.Error != nil {
			msg = parsed.Error.Message
		}
		return nil, fmt.Errorf("wallpaper request returned %d: %s", resp.StatusCode, msg)
	}

	for _, candidate := range parsed.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData == nil {
				continue
			}
			return checkWallpaper(part.InlineData.MimeType, part.InlineData.Data)
		}
	}
	log.Printf("[wallpaper] no image in the model reply (status %d)", resp.StatusCode)
	return nil, errors.New("the model returned no image")
}

// checkWallpaper accepts only the image types the sign-in page can show, and
// only images of a sensible size.
func checkWallpaper(mimeType, data string) (*GeneratedWallpaper, error) {
	switch mimeType {
	case "image/png", "image/jpeg", "image/webp":
	default:
		return nil, fmt.Errorf("unexpected image type %q", mimeType)
	}
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil, errors.New("image data is not base64")
	}
	if len(decoded) == 0 || len(decoded) > maxWallpaperBytes {
		return nil, fmt.Errorf("image size %d bytes is out of range", len(decoded))
	}
	return &GeneratedWallpaper{MimeType: mimeType, Data: data}, nil
}
