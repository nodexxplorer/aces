package utils

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/skip2/go-qrcode"
)

func GenerateQRCodeImage(data string) (string, error) {
	pngBytes, err := qrcode.Encode(data, qrcode.Medium, 512)
	if err != nil {
		return "", fmt.Errorf("failed to generate QR code: %w", err)
	}
	b64 := base64.StdEncoding.EncodeToString(pngBytes)
	return "data:image/png;base64," + b64, nil
}

func GenerateQRCodePNG(data string, size int) ([]byte, error) {
	if size <= 0 {
		size = 256
	}
	return qrcode.Encode(data, qrcode.Medium, size)
}

func StripDataURLPrefix(dataURL string) string {
	if idx := strings.Index(dataURL, ","); idx != -1 {
		return dataURL[idx+1:]
	}
	return dataURL
}
