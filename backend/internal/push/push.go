package push

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
		log.Printf("[mock-push] simulated push; no provider request")
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
	var ticket struct {
		Data struct {
			Status  string `json:"status"`
			Details struct {
				Error string `json:"error"`
			} `json:"details"`
		} `json:"data"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&ticket) != nil {
		return fmt.Errorf("invalid Expo push response")
	}
	if ticket.Data.Status != "ok" {
		if ticket.Data.Details.Error == "DeviceNotRegistered" {
			return ErrUnregistered
		}
		return fmt.Errorf("Expo push rejected notification")
	}
	return nil
}

func (s *ExpoPushSender) Mock() bool { return s.useMock }
