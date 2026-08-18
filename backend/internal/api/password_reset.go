package api

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// passwordResetOTPEmailHTML renders a minimal branded email carrying the raw
// OTP digits — deliberately simpler than notification_service_full.go's
// buildNotificationEmailHTML (no CTA button, no unsubscribe footer): this is
// a security-critical transactional message sent before the user has a
// session or any notification preferences to speak of, not a notification.
func passwordResetOTPEmailHTML(otp string) string {
	return fmt.Sprintf(`
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #eef2f6; padding: 32px 16px; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
	<tr>
		<td align="center">
			<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
				<tr>
					<td style="background: linear-gradient(135deg, #0066CC 0%%, #003d7a 100%%); padding: 28px 40px;" align="center">
						<div style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 0.3px;">ACES Zone</div>
					</td>
				</tr>
				<tr>
					<td style="padding: 32px 40px;" align="center">
						<h1 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Reset Your Password</h1>
						<p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
							Use this code to reset your password. It expires in 15 minutes.
						</p>
						<div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0066CC; background-color: #eef2f6; border-radius: 12px; padding: 16px 24px; display: inline-block;">
							%s
						</div>
						<p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
							If you didn't request this, you can safely ignore this email.
						</p>
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>`, otp)
}

type otpRequest struct {
	Email   string `json:"email" binding:"required,email"`
	Channel string `json:"channel"` // email or sms
}

type verifyOTPRequest struct {
	Email string `json:"email" binding:"required"`
	OTP   string `json:"otp" binding:"required"`
}

type resetWithOTPRequest struct {
	Email    string `json:"email" binding:"required"`
	OTP      string `json:"otp" binding:"required"`
	Password string `json:"password" binding:"required,min=6,max=72"`
}

// maxOTPAttempts caps guesses against a single issued code before it's
// locked out — closes the gap where the only throttle was a global
// per-IP rate limit shared across all of /auth/*, with no counter tied to
// the account actually being reset.
const maxOTPAttempts = 5

// checkAndTrackOTP validates otp against the user's active password-reset
// row, incrementing that row's attempts counter on every wrong guess so a
// distributed attacker can't just spread guesses across IPs to dodge the
// per-IP rate limit.
func (server *Server) checkAndTrackOTP(ctx *gin.Context, queries *db.Queries, user db.User, otp string) (db.PasswordReset, bool) {
	active, err := queries.GetPasswordResetByUser(ctx, user.ID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired OTP"})
		return db.PasswordReset{}, false
	}
	if active.Attempts >= maxOTPAttempts {
		ctx.JSON(http.StatusTooManyRequests, gin.H{"error": "too many attempts — request a new code"})
		return db.PasswordReset{}, false
	}
	if active.OtpCode != otp {
		_ = queries.IncrementResetAttempts(ctx, active.ID)
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired OTP"})
		return db.PasswordReset{}, false
	}
	return active, true
}

func generateOTP() (string, error) {
	code := ""
	for i := 0; i < 6; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code, nil
}

func (server *Server) requestPasswordReset(ctx *gin.Context) {
	var req otpRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	user, err := server.store.GetUserByEmail(ctx, strings.ToLower(req.Email))
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"message": "if the email exists, an OTP has been sent"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	otp, err := generateOTP()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate OTP"})
		return
	}

	channel := db.ResetChannelEmail
	if req.Channel == "sms" {
		channel = db.ResetChannelSms
	}

	_, _ = queries.CreatePasswordReset(ctx, db.CreatePasswordResetParams{
		UserID:    user.ID,
		Channel:   channel,
		OtpCode:   otp,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(15 * time.Minute), Valid: true},
	})

	// SMS isn't wired to any provider yet, so only the email channel can
	// actually be delivered right now — silently a no-op otherwise, same
	// as it's always been for that channel.
	if channel == db.ResetChannelEmail && server.emailSender != nil {
		go func(to, otpCode string) {
			body := passwordResetOTPEmailHTML(otpCode)
			if err := server.emailSender.SendEmail([]string{to}, "Your ACES Zone password reset code", body, true); err != nil {
				log.Printf("[password-reset] failed to send OTP email to %s: %v", to, err)
			}
		}(user.Email, otp)
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "if the email exists, an OTP has been sent"})
}

func (server *Server) verifyPasswordResetOTP(ctx *gin.Context) {
	var req verifyOTPRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	user, err := server.store.GetUserByEmail(ctx, strings.ToLower(req.Email))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	reset, valid := server.checkAndTrackOTP(ctx, queries, user, req.OTP)
	if !valid {
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "OTP verified", "token": reset.ID.String()})
}

func (server *Server) resetPasswordWithOTP(ctx *gin.Context) {
	var req resetWithOTPRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	user, err := server.store.GetUserByEmail(ctx, strings.ToLower(req.Email))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	reset, valid := server.checkAndTrackOTP(ctx, queries, user, req.OTP)
	if !valid {
		return
	}

	hashed, err := util.HashPassword(req.Password)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	if err := queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		PasswordHash: hashed,
		ID:           user.ID,
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	_ = queries.UsePasswordReset(ctx, reset.ID)

	ctx.JSON(http.StatusOK, gin.H{"message": "password reset successful"})
}

func (server *Server) changePassword(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=6,max=72"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	user, err := server.auth.GetUserByID(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := util.CheckPassword(req.CurrentPassword, user.PasswordHash); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "current password is incorrect"})
		return
	}

	hashed, err := util.HashPassword(req.NewPassword)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		PasswordHash: hashed,
		ID:           userID,
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "password changed successfully"})
}
