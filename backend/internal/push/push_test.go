package push

import (
	"bytes"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"
)

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestExpoTicketValidation(t *testing.T) {
	for _, tc := range []struct {
		body         string
		wantError    bool
		unregistered bool
	}{{`{"data":{"status":"ok","id":"ticket"}}`, false, false}, {`{"data":{"status":"error","details":{"error":"DeviceNotRegistered"}}}`, true, true}, {`{"data":{"status":"error","details":{"error":"MessageRateExceeded"}}}`, true, false}, {`{}`, true, false}, {`not json`, true, false}} {
		sender := NewExpoPushSender(false)
		sender.client = &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewBufferString(tc.body))}, nil
		})}
		err := sender.SendPush("ExpoPushToken[abcdefghijklm]", "title", "body", nil)
		if (err != nil) != tc.wantError || errors.Is(err, ErrUnregistered) != tc.unregistered {
			t.Fatal(tc.body, err)
		}
	}
}
func TestWebPushEndpointSafety(t *testing.T) {
	key, _ := ecdh.P256().GenerateKey(rand.Reader)
	enc := base64.RawURLEncoding.EncodeToString
	for _, endpoint := range []string{"https://fcm.googleapis.com/fcm/send/opaque", "https://updates.push.services.mozilla.com/wpush/v2/opaque", "http://127.0.0.1/private", "https://169.254.169.254/metadata", "https://fcm.googleapis.com.attacker.example/", "https://user:pass@fcm.googleapis.com/", "https://fcm.googleapis.com:444/"} {
		sub, _ := json.Marshal(map[string]interface{}{"endpoint": endpoint, "keys": map[string]string{"auth": enc(make([]byte, 16)), "p256dh": enc(key.PublicKey().Bytes())}})
		want := endpoint == "https://fcm.googleapis.com/fcm/send/opaque" || endpoint == "https://updates.push.services.mozilla.com/wpush/v2/opaque"
		if ValidSubscription(sub) != want {
			t.Fatal("unsafe subscription validation", endpoint)
		}
	}
}
