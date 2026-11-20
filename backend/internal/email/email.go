package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// DefaultFromName is the display name for mail that names no department.
const DefaultFromName = "Admin Pack"

// EmailSender defines the interface for sending emails
type EmailSender interface {
	// SendEmail sends from the platform's default sender name.
	SendEmail(to []string, subject, body string, isHTML bool) error
	// SendEmailFrom sends with fromName as the display name, so a department's
	// mail shows the department's name.
	SendEmailFrom(fromName string, to []string, subject, body string, isHTML bool) error
}

// SMTPSender implements EmailSender using standard SMTP
type SMTPSender struct {
	host     string
	port     int
	username string
	password string
	from     string
	useMock  bool
}

// NewSMTPSender creates a new SMTPSender
func NewSMTPSender(host string, port int, username, password, from string, useMock bool) *SMTPSender {
	return &SMTPSender{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		useMock:  useMock,
	}
}

// SendEmail sends an email to the specified recipients
func (s *SMTPSender) SendEmail(to []string, subject, body string, isHTML bool) error {
	return s.SendEmailFrom(DefaultFromName, to, subject, body, isHTML)
}

// SendEmailFrom sends an email to the specified recipients, with fromName as
// the display name in the From header.
func (s *SMTPSender) SendEmailFrom(fromName string, to []string, subject, body string, isHTML bool) error {
	if s.useMock {
		log.Print("[mock-email] simulated email; no SMTP request")
		return nil
	}

	header := make(map[string]string)

	header["From"] = formatFrom(fromName, s.from)
	header["To"] = strings.Join(to, ", ")
	header["Subject"] = mime.QEncoding.Encode("utf-8", strings.NewReplacer("\r", " ", "\n", " ").Replace(subject))
	if isHTML {
		header["MIME-Version"] = "1.0"
		header["Content-Type"] = "text/html; charset=\"utf-8\""
	} else {
		header["Content-Type"] = "text/plain; charset=\"utf-8\""
	}

	message := ""
	for k, v := range header {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + body

	var auth smtp.Auth
	if s.username != "" {
		auth = smtp.PlainAuth("", s.username, s.password, s.host)
	}
	addr := fmt.Sprintf("%s:%d", s.host, s.port)

	// Bound all SMTP operations below the delivery lease. A worker restart
	// can retry an ambiguous SMTP acceptance; SMTP is at-least-once, not exactly-once.
	dialer := &net.Dialer{Timeout: 8 * time.Second}
	var conn net.Conn
	var err error
	if s.port == 465 {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{MinVersion: tls.VersionTLS12, ServerName: s.host})
	} else {
		conn, err = dialer.Dial("tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("SMTP connection failed: %w", err)
	}
	defer conn.Close()
	if err = conn.SetDeadline(time.Now().Add(15 * time.Second)); err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return err
	}
	defer client.Close()
	if s.port != 465 {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err = client.StartTLS(&tls.Config{MinVersion: tls.VersionTLS12, ServerName: s.host}); err != nil {
				return err
			}
		} else if s.host != "localhost" && s.host != "127.0.0.1" {
			return fmt.Errorf("SMTP server must support TLS")
		}
	}
	if auth != nil {
		if err = client.Auth(auth); err != nil {
			return err
		}
	}
	if err = client.Mail(s.from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err = client.Rcpt(recipient); err != nil {
			return err
		}
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write([]byte(message)); err != nil {
		return err
	}
	if err = w.Close(); err != nil {
		return err
	}
	return client.Quit()

}

// quotedNameEscaper escapes a display name for use inside a quoted-string.
var quotedNameEscaper = strings.NewReplacer(`\`, `\\`, `"`, `\"`)

// formatFrom builds a From header value. The display name is quoted, and it is
// RFC 2047-encoded when it is not ASCII.
func formatFrom(name, addr string) string {
	name = strings.TrimSpace(strings.NewReplacer("\r", " ", "\n", " ").Replace(name))
	if name == "" {
		name = DefaultFromName
	}
	for i := 0; i < len(name); i++ {
		if name[i] >= 0x80 {
			return mime.QEncoding.Encode("utf-8", name) + " <" + addr + ">"
		}
	}
	return "\"" + quotedNameEscaper.Replace(name) + "\" <" + addr + ">"
}

// Mock lets delivery reporting distinguish simulation from SMTP acceptance.
func (s *SMTPSender) Mock() bool { return s.useMock }
