package service

import (
	"context"
	"fmt"
	"html"
	"log"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/email"
	"github.com/aces/backend/internal/notify"
	"github.com/aces/backend/internal/push"
	"github.com/aces/backend/internal/tenant"
	"github.com/aces/backend/internal/ws"
	"github.com/google/uuid"
)

type NotificationServiceFull struct {
	queries     *db.Queries
	wsHub       *ws.Hub
	emailSender email.EmailSender
	pushSender  push.PushSender
	webPush     *push.WebSender
	frontendURL string
	// tenants finds a recipient's department, for its name and logo in emails.
	tenants TenantDirectory
	// apiURL is where the API is reachable, for the logo link in emails.
	apiURL string
}

// TenantDirectory finds a department by ID. *tenant.Manager implements it.
type TenantDirectory interface {
	ByID(ctx context.Context, id uuid.UUID) (tenant.Tenant, error)
}

func NewNotificationServiceFull(queries *db.Queries, wsHub *ws.Hub, emailSender email.EmailSender, pushSender push.PushSender, frontendURL string, tenants TenantDirectory, apiURL string) *NotificationServiceFull {
	return &NotificationServiceFull{
		queries:     queries,
		wsHub:       wsHub,
		emailSender: emailSender,
		pushSender:  pushSender,
		frontendURL: strings.TrimRight(frontendURL, "/"),
		tenants:     tenants,
		apiURL:      strings.TrimRight(apiURL, "/"),
	}
}

func (s *NotificationServiceFull) CreateAndPush(
	ctx context.Context,
	userID uuid.UUID,
	notifType, category, priority, title, message, actionURL, actionLabel string,
	senderID *uuid.UUID, entityType *string, entityID *uuid.UUID,
	metadata map[string]interface{},
) (db.NotificationFull, error) {
	pool, ok := s.queries.GetDB().(notify.Beginner)
	if !ok {
		return db.NotificationFull{}, fmt.Errorf("notification storage cannot begin transaction")
	}
	key := ""
	if metadata != nil {
		key, _ = metadata["event_key"].(string)
	}
	return notify.Enqueue(ctx, pool, notify.Event{UserID: userID, Key: key, Type: notifType, Category: category, Priority: priority, Title: title, Message: message, ActionURL: actionURL, ActionLabel: actionLabel, SenderID: senderID, EntityType: entityType, EntityID: entityID, Metadata: metadata})
}
func (s *NotificationServiceFull) SetWebPush(sender *push.WebSender) { s.webPush = sender }

// brandFor returns the brand of a department, or the platform brand when the
// department cannot be found.
func (s *NotificationServiceFull) brandFor(ctx context.Context, tenantID uuid.UUID) tenant.Brand {
	if s.tenants == nil || tenantID == uuid.Nil {
		return tenant.PlatformBrand()
	}
	t, err := s.tenants.ByID(ctx, tenantID)
	if err != nil {
		log.Printf("[email-notif] no department %s for its brand: %v", tenantID, err)
		return tenant.PlatformBrand()
	}
	return tenant.BrandOf(t)
}

func (s *NotificationServiceFull) buildNotificationEmailHTML(brand tenant.Brand, title, message, actionURL, actionLabel, unsubscribeURL string) string {
	logoURL := tenant.LogoURL(s.apiURL, brand)

	resolvedActionURL := actionURL
	if resolvedActionURL != "" && strings.HasPrefix(resolvedActionURL, "/") {
		resolvedActionURL = s.frontendURL + resolvedActionURL
	}

	ctaBlock := ""
	if resolvedActionURL != "" {
		label := actionLabel
		if label == "" {
			label = "View in " + brand.Name
		}
		ctaBlock = fmt.Sprintf(`
			<tr>
				<td style="padding: 8px 40px 32px 40px;" align="center">
					<a href="%s" target="_blank" rel="noopener noreferrer"
						style="display: inline-block; background-color: #0066CC; color: #ffffff; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
						%s
					</a>
				</td>
			</tr>`, html.EscapeString(resolvedActionURL), html.EscapeString(label))
	}

	nameEsc := html.EscapeString(brand.Name)
	subtitleEsc := html.EscapeString(brand.Institution)
	footerLine := nameEsc
	if brand.Institution != "" {
		footerLine += " &mdash; " + subtitleEsc
	}
	headerCell := ""
	if logoURL != "" {
		headerCell = fmt.Sprintf(`<td width="56" style="vertical-align: middle;"><img src="%s" alt="%s" width="48" height="48" style="display: block; border-radius: 8px; background-color: #1e293b;" /></td>`, html.EscapeString(logoURL), nameEsc)
	}
	year := time.Now().Year()

	unsubscribeBlock := ""
	if unsubscribeURL != "" {
		unsubscribeBlock = fmt.Sprintf(`<br /><a href="%s" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: underline;">Unsubscribe from email notifications</a>`, html.EscapeString(unsubscribeURL))
	}

	return fmt.Sprintf(`
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 48px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
	<tr>
		<td align="center">
			<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);">
				<!-- Header Section -->
				<tr>
					<td style="background: linear-gradient(135deg, #0066CC 0%%, #003d7a 100%%); padding: 32px 40px; border-bottom: 4px solid #0369a1;" align="left">
						<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
							<tr>
								%s
								<td style="padding-left: 16px; vertical-align: middle;">
									<div style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2;">%s</div>
									<div style="color: #94a3b8; font-size: 12px; margin-top: 2px; font-weight: 500;">%s</div>
								</td>
							</tr>
						</table>
					</td>
				</tr>
				
				<!-- Main Body Content Section -->
				<tr>
					<td style="padding: 40px 40px 16px 40px;">
						<h1 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.3;">%s</h1>
						<div style="margin: 0; color: #334155; font-size: 15px; line-height: 1.7; font-weight: 400;">
							%s
						</div>
					</td>
				</tr>
				
				<!-- Call to Action / Custom Block Injection Area -->
				%s
				
				<!-- Closing Context Area -->
				<tr>
					<td style="padding: 16px 40px 32px 40px;">
						<p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
							If you have any immediate technical questions or need further clarification regarding this update, please message the support or lodge a complaints.
						</p>
					</td>
				</tr>
				
				<!-- Footer Section -->
				<tr>
					<td style="padding: 32px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
						<p style="margin: 0 0 12px 0; color: #64748b; font-size: 12px; line-height: 1.6; text-align: center;">
							This is an automated message from %s. Direct replies to this tracking address are unmonitored.
						</p>
						<p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6; text-align: center; font-weight: 500;">
							&copy; %d %s.%s
						</p>
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>`, headerCell, nameEsc, subtitleEsc, html.EscapeString(title), html.EscapeString(message), ctaBlock, nameEsc, year, footerLine, unsubscribeBlock)
}

func (s *NotificationServiceFull) List(ctx context.Context, userID uuid.UUID, category, status string, limit, offset int32) ([]db.NotificationFull, error) {
	return s.queries.ListUserNotificationsFull(ctx, userID, category, status, limit, offset)
}

func (s *NotificationServiceFull) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.queries.CountUnreadNotifications(ctx, userID)
}

func (s *NotificationServiceFull) GetUnreadByCategory(ctx context.Context, userID uuid.UUID) ([]db.CategoryCount, error) {
	return s.queries.CountUnreadByCategory(ctx, userID)
}

func (s *NotificationServiceFull) MarkAsRead(ctx context.Context, id, userID uuid.UUID) (db.NotificationFull, error) {
	return s.queries.MarkNotificationAsReadFull(ctx, id, userID)
}

func (s *NotificationServiceFull) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return s.queries.MarkAllNotificationsAsRead(ctx, userID)
}

func (s *NotificationServiceFull) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.queries.DeleteNotificationFull(ctx, id, userID)
}

func (s *NotificationServiceFull) GetPreferences(ctx context.Context, userID uuid.UUID) (db.NotificationPreferenceView, error) {
	return s.queries.GetNotificationPreferences(ctx, userID)
}

func (s *NotificationServiceFull) UpdatePreferences(ctx context.Context, arg db.UpsertNotificationPreferencesParams) (db.NotificationPreferenceView, error) {
	return s.queries.UpsertNotificationPreferences(ctx, arg)
}

func (s *NotificationServiceFull) BroadcastNotification(
	ctx context.Context,
	title, message, category, priority string,
	targetAudience string,
	targetRoles []string,
	targetLevel int32,
	senderID *uuid.UUID,
) (int, error) {
	var userIDs []uuid.UUID
	var err error

	switch targetAudience {
	case "role":
		userIDs, err = s.queries.ListUsersByRole(ctx, targetRoles)
	case "level":
		userIDs, err = s.queries.ListStudentUserIDsByLevel(ctx, targetLevel)
	default:
		userIDs, err = s.queries.ListAllActiveUserIDs(ctx)
	}
	if err != nil {
		return 0, err
	}

	count := 0
	for _, uid := range userIDs {
		_, err := s.CreateAndPush(ctx, uid,
			string(db.NotificationTypeGeneral),
			category,
			priority,
			title,
			message,
			"",
			"",
			senderID,
			nil,
			nil,
			nil,
		)
		if err != nil {
			log.Printf("[notification] broadcast to user %s failed: %v", uid, err)
			continue
		}
		count++
	}

	return count, nil
}
