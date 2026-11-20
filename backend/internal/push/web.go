package push

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	webpush "github.com/SherClockHolmes/webpush-go"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var ErrUnregistered = errors.New("push device unregistered")

type WebSender struct {
	PublicKey, PrivateKey, Subject string
	Mock                           bool
}

func ValidSubscription(b []byte) bool {
	var s webpush.Subscription
	if len(b) > 8192 || json.Unmarshal(b, &s) != nil {
		return false
	}
	u, e := url.Parse(s.Endpoint)
	if e != nil || u.Scheme != "https" || u.User != nil || u.Fragment != "" || u.Port() != "" && u.Port() != "443" || len(s.Endpoint) > 4096 {
		return false
	}
	host := strings.ToLower(u.Hostname())
	allowed := host == "fcm.googleapis.com" || host == "updates.push.services.mozilla.com" || host == "web.push.apple.com" || host == "wns.windows.com" || strings.HasSuffix(host, ".notify.windows.com")
	if !allowed {
		return false
	}
	auth, e := base64.RawURLEncoding.DecodeString(strings.TrimRight(s.Keys.Auth, "="))
	if e != nil || len(auth) != 16 {
		return false
	}
	p, e := base64.RawURLEncoding.DecodeString(strings.TrimRight(s.Keys.P256dh, "="))
	return e == nil && len(p) == 65 && p[0] == 4
}
func (s *WebSender) Send(ctx context.Context, subscription []byte, title, body string, data map[string]interface{}) error {
	if !ValidSubscription(subscription) {
		return ErrUnregistered
	}
	if s.Mock {
		return nil
	}
	if s.PublicKey == "" || s.PrivateKey == "" {
		return errors.New("VAPID not configured")
	}
	var sub webpush.Subscription
	_ = json.Unmarshal(subscription, &sub)
	payload, _ := json.Marshal(map[string]interface{}{"title": title, "body": body, "data": data})
	client := &http.Client{Timeout: 12 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	r, e := webpush.SendNotificationWithContext(ctx, payload, &sub, &webpush.Options{HTTPClient: client, Subscriber: s.Subject, VAPIDPublicKey: s.PublicKey, VAPIDPrivateKey: s.PrivateKey, TTL: 3600})
	if e != nil {
		return e
	}
	defer r.Body.Close()
	if r.StatusCode == 404 || r.StatusCode == 410 {
		return ErrUnregistered
	}
	if r.StatusCode < 200 || r.StatusCode > 299 {
		return errors.New("web push provider rejected delivery")
	}
	return nil
}
