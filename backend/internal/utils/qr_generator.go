package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ManualQRPayloadInput struct {
	StudentID uuid.UUID `json:"student_id"`
	RegNo     string    `json:"reg_no"`
	ManualID  uuid.UUID `json:"manual_id"`
}

type manualQRClaims struct {
	Payload ManualQRPayloadInput `json:"payload"`
	Sig     string               `json:"sig"`
	Exp     int64                `json:"exp"`
}

func GenerateManualQRPayload(input ManualQRPayloadInput, secret []byte) (string, error) {
	claims := manualQRClaims{
		Payload: input,
		Exp:     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	data, err := json.Marshal(claims.Payload)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(data)
	claims.Sig = hex.EncodeToString(mac.Sum(nil))

	final, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(final), nil
}

func VerifyManualQRPayload(qrData string, secret []byte) (*ManualQRPayloadInput, error) {
	data, err := base64.URLEncoding.DecodeString(qrData)
	if err != nil {
		return nil, fmt.Errorf("invalid QR format")
	}
	var claims manualQRClaims
	if err := json.Unmarshal(data, &claims); err != nil {
		return nil, fmt.Errorf("invalid QR data")
	}

	payloadData, _ := json.Marshal(claims.Payload)
	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadData)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(claims.Sig)) {
		return nil, fmt.Errorf("invalid QR signature")
	}

	return &claims.Payload, nil
}
