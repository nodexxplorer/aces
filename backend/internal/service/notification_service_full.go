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
	"github.com/aces/backend/internal/push"
	"github.com/aces/backend/internal/ws"
	"github.com/google/uuid"
)

type NotificationServiceFull struct {
	queries     *db.Queries
	wsHub       *ws.Hub
	emailSender email.EmailSender
	pushSender  push.PushSender
	frontendURL string
}

func NewNotificationServiceFull(queries *db.Queries, wsHub *ws.Hub, emailSender email.EmailSender, pushSender push.PushSender, frontendURL string) *NotificationServiceFull {
	return &NotificationServiceFull{
		queries:     queries,
		wsHub:       wsHub,
		emailSender: emailSender,
		pushSender:  pushSender,
		frontendURL: strings.TrimRight(frontendURL, "/"),
	}
}

func (s *NotificationServiceFull) CreateAndPush(
	ctx context.Context,
	userID uuid.UUID,
	notifType, category, priority, title, message, actionURL, actionLabel string,
	senderID *uuid.UUID, entityType *string, entityID *uuid.UUID,
	metadata map[string]interface{},
) (db.NotificationFull, error) {
	prefs, prefsErr := s.queries.GetNotificationPreferences(ctx, userID)
	hasPrefs := prefsErr == nil
	inAppAllowed := !hasPrefs || prefs.InAppEnabled

	// Respecting "In-App Notifications: off" means never creating the row in
	// the first place — ListUserNotificationsFull reads straight from this
	// table with no preference filtering of its own, so a row that exists
	// here will show up in the user's notification list regardless of what
	// their toggle says. Previously this only gated the live WebSocket push,
	// so turning the toggle off didn't actually stop anything; the
	// notification just silently reappeared the next time they opened the
	// list. Email/push remain independently gated below either way.
	var notif db.NotificationFull
	if inAppAllowed {
		var err error
		notif, err = s.queries.CreateNotificationFull(ctx, db.CreateNotificationFullParams{
			UserID:      userID,
			Type:        notifType,
			Title:       title,
			Message:     message,
			Category:    category,
			Priority:    priority,
			SenderID:    senderID,
			EntityType:  entityType,
			EntityID:    entityID,
			ActionLabel: &actionLabel,
			Metadata:    metadata,
		})
		if err != nil {
			return db.NotificationFull{}, err
		}

		if actionURL != "" {
			notif.ActionUrl = &actionURL
		}
		if actionLabel != "" {
			notif.ActionLabel = &actionLabel
		}

		if s.wsHub != nil {
			s.wsHub.SendToUser(userID, ws.TypeNotification, notif)
		}
	}

	if s.emailSender != nil && (!hasPrefs || (prefs.EmailEnabled && categoryEmailAllowed(prefs, category))) {
		go func(uID uuid.UUID, notifTitle, notifMsg, notifActionURL, notifActionLabel string) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			user, err := s.queries.GetUser(bgCtx, uID)
			if err != nil || user.Email == "" {
				return
			}

			unsubscribeToken, err := s.queries.GetOrCreateNotificationUnsubscribeToken(bgCtx, uID)
			if err != nil {
				log.Printf("[email-notif] failed to get unsubscribe token for %s: %v", user.Email, err)
			}
			unsubscribeURL := ""
			if unsubscribeToken != "" {
				unsubscribeURL = s.frontendURL + "/notifications/unsubscribe/" + unsubscribeToken
			}

			body := s.buildNotificationEmailHTML(notifTitle, notifMsg, notifActionURL, notifActionLabel, unsubscribeURL)

			if err := s.emailSender.SendEmail([]string{user.Email}, notifTitle, body, true); err != nil {
				log.Printf("[email-notif] failed to send email to %s: %v", user.Email, err)
			}
		}(userID, title, message, actionURL, actionLabel)
	}

	if s.pushSender != nil && hasPrefs && prefs.PushEnabled && categoryPushAllowed(prefs, category) && prefs.PushToken != nil && *prefs.PushToken != "" {
		go func(token, notifTitle, notifMsg, notifActionURL string) {
			var data map[string]interface{}
			if notifActionURL != "" {
				data = map[string]interface{}{"action_url": notifActionURL}
			}
			if err := s.pushSender.SendPush(token, notifTitle, notifMsg, data); err != nil {
				log.Printf("[push-notif] failed to send push: %v", err)
			}
		}(*prefs.PushToken, title, message, actionURL)
	}

	return notif, nil
}
func (s *NotificationServiceFull) buildNotificationEmailHTML(title, message, actionURL, actionLabel, unsubscribeURL string) string {
	logoURL := s.frontendURL + "/aces-logo.png"

	resolvedActionURL := actionURL
	if resolvedActionURL != "" && strings.HasPrefix(resolvedActionURL, "/") {
		resolvedActionURL = s.frontendURL + resolvedActionURL
	}

	ctaBlock := ""
	if resolvedActionURL != "" {
		label := actionLabel
		if label == "" {
			label = "View in ACES Zone"
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
								<td width="56" style="vertical-align: middle;">
									<img src="%s" alt="ACES Zone" width="48" height="48" style="display: block; border-radius: 8px; background-color: #1e293b;" />
								</td>
								<td style="padding-left: 16px; vertical-align: middle;">
									<div style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2;">ACES Zone</div>
									<div style="color: #94a3b8; font-size: 12px; margin-top: 2px; font-weight: 500;">Association of Computer Engineering Students &middot; Uniuyo</div>
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
							This is an automated operational broadcast from the ACES Zone engine. Direct replies to this tracking address are unmonitored.
						</p>
						<p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6; text-align: center; font-weight: 500;">
							&copy; %d ACES Zone &mdash; Department of Computer Engineering, University of Uyo.%s
						</p>
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>`, logoURL, html.EscapeString(title), html.EscapeString(message), ctaBlock, year, unsubscribeBlock)
}


func categoryEmailAllowed(prefs db.NotificationPreference, category string) bool {
	switch category {
	case "auth":
		return prefs.EmailAuth
	case "results":
		return prefs.EmailResults
	case "dues":
		return prefs.EmailDues
	case "messages":
		return prefs.EmailMessages
	case "connect":
		return prefs.EmailConnect
	case "skills":
		return prefs.EmailSkills
	case "alumni":
		return prefs.EmailAlumni
	case "system":
		return prefs.EmailSystem
	default:
		return true
	}
}

func categoryPushAllowed(prefs db.NotificationPreference, category string) bool {
	switch category {
	case "auth":
		return prefs.PushAuth
	case "results":
		return prefs.PushResults
	case "dues":
		return prefs.PushDues
	case "messages":
		return prefs.PushMessages
	case "connect":
		return prefs.PushConnect
	case "skills":
		return prefs.PushSkills
	case "alumni":
		return prefs.PushAlumni
	case "system":
		return prefs.PushSystem
	default:
		return true
	}
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

func (s *NotificationServiceFull) GetPreferences(ctx context.Context, userID uuid.UUID) (db.NotificationPreference, error) {
	return s.queries.GetNotificationPreferences(ctx, userID)
}

func (s *NotificationServiceFull) UpdatePreferences(ctx context.Context, arg db.UpsertNotificationPreferencesParams) (db.NotificationPreference, error) {
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
