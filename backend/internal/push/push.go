package push

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type PushSender interface {
	SendPush(token, title, body string, data map[string]interface{}) error
}


type ExpoPushSender struct {
	client  *http.Client
	useMock bool
}

func NewExpoPushSender(useMock bool) *ExpoPushSender {
	return &ExpoPushSender{
		client:  &http.Client{Timeout: 10 * time.Second},
		useMock: useMock,
	}
}

type expoPushMessage struct {
	To    string                 `json:"to"`
	Title string                 `json:"title"`
	Body  string                 `json:"body"`
	Data  map[string]interface{} `json:"data,omitempty"`
	Sound string                 `json:"sound,omitempty"`
}

func (s *ExpoPushSender) SendPush(token, title, body string, data map[string]interface{}) error {
	if s.useMock {
		log.Printf("[mock-push] Sending push to %s\nTitle: %s\nBody: %s", token, title, body)
		return nil
	}

	msg := expoPushMessage{To: token, Title: title, Body: body, Data: data, Sound: "default"}
	payload, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to encode push payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to build push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to reach Expo push service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expo push service returned status %d", resp.StatusCode)
	}
	return nil
}
