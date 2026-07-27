package api

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"testing"
)

func signPayload(payload []byte, secret string) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyPaystackSignature_ValidSignature(t *testing.T) {
	payload := []byte(`{"event":"charge.success","data":{"reference":"ref_123"}}`)
	secret := "sk_test_mysecretkey1234567890"

	sig := signPayload(payload, secret)
	if !verifyPaystackSignature(payload, sig, secret) {
		t.Error("valid signature should be accepted")
	}
}

func TestVerifyPaystackSignature_InvalidSignature(t *testing.T) {
	payload := []byte(`{"event":"charge.success","data":{"reference":"ref_123"}}`)
	secret := "sk_test_mysecretkey1234567890"

	if verifyPaystackSignature(payload, "bad_signature_hex", secret) {
		t.Error("invalid signature should be rejected")
	}
}

func TestVerifyPaystackSignature_EmptySecret(t *testing.T) {
	payload := []byte(`{"event":"charge.success"}`)
	sig := signPayload(payload, "any-secret")

	if verifyPaystackSignature(payload, sig, "") {
		t.Error("empty secret key must fail closed")
	}
}

func TestVerifyPaystackSignature_TamperedPayload(t *testing.T) {
	original := []byte(`{"event":"charge.success"}`)
	tampered := []byte(`{"event":"charge.failed"}`)
	secret := "sk_test_mysecretkey1234567890"

	sig := signPayload(original, secret)
	if verifyPaystackSignature(tampered, sig, secret) {
		t.Error("tampered payload with original signature should be rejected")
	}
}

func TestVerifyPaystackSignature_WrongSecret(t *testing.T) {
	payload := []byte(`{"event":"charge.success"}`)
	sig := signPayload(payload, "correct-secret")

	if verifyPaystackSignature(payload, sig, "wrong-secret") {
		t.Error("wrong secret should reject the signature")
	}
}

func TestVerifyPaystackSignature_EmptyPayload(t *testing.T) {
	secret := "sk_test_mysecretkey1234567890"
	sig := signPayload([]byte{}, secret)

	if !verifyPaystackSignature([]byte{}, sig, secret) {
		t.Error("empty payload with correct signature should pass")
	}
}
