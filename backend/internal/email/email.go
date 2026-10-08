package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"strings"
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
		log.Printf("[mock-email] Sending email to %v\nSubject: %s\nBody: %s", to, subject, body)
		return nil
	}

	header := make(map[string]string)

	header["From"] = formatFrom(fromName, s.from)
	header["To"] = strings.Join(to, ", ")
	header["Subject"] = subject
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

	// Since ports like 465 require implicit TLS:
	if s.port == 465 {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         s.host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to dial implicit TLS: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("failed to authenticate SMTP client: %w", err)
		}

		for _, addr := range to {
			if err = client.Mail(s.from); err != nil {
				return err
			}
			if err = client.Rcpt(addr); err != nil {
				return err
			}
			w, err := client.Data()
			if err != nil {
				return err
			}
			_, err = w.Write([]byte(message))
			if err != nil {
				return err
			}
			err = w.Close()
			if err != nil {
				return err
			}
		}
		return nil
	}

	// Standard SMTP send for other ports (587, 25)
	err := smtp.SendMail(addr, auth, s.from, to, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// quotedNameEscaper escapes a display name for use inside a quoted-string.
var quotedNameEscaper = strings.NewReplacer(`\`, `\\`, `"`, `\"`)

// formatFrom builds a From header value. The display name is quoted, and it is
// RFC 2047-encoded when it is not ASCII.
func formatFrom(name, addr string) string {
	name = strings.TrimSpace(name)
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
