package api

import (
	"encoding/json"
	"fmt"
	"github.com/aces/backend/internal/notify"
	"github.com/aces/backend/internal/push"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"regexp"
)

var expoTokenPattern = regexp.MustCompile(`^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$`)

func validExpoToken(token string) bool { return expoTokenPattern.MatchString(token) }
func (server *Server) saveNotificationDevice(c *gin.Context, platform, address string, subscription []byte) error {
	ctx := c.Request.Context()
	tx, err := server.dbPool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, tenantIDOf(c).String()+":notification-device:"+getUserID(c).String()); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `INSERT INTO notification_devices(tenant_id,user_id,platform,address,subscription) SELECT $1,$2,$3,$4,$5 WHERE (SELECT count(*) FROM notification_devices WHERE tenant_id=$1 AND user_id=$2 AND active)<20 OR EXISTS(SELECT 1 FROM notification_devices WHERE tenant_id=$1 AND address=$4) ON CONFLICT(tenant_id,address)DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,subscription=EXCLUDED.subscription,active=true,updated_at=now()`, tenantIDOf(c), getUserID(c), platform, address, subscription)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("device limit reached")
	}
	return tx.Commit(ctx)
}

func (server *Server) registerNotificationDevice(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 12<<10)
	var req struct {
		Platform     string          `json:"platform"`
		Token        string          `json:"token"`
		Subscription json.RawMessage `json:"subscription"`
	}
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(400, gin.H{"error": "invalid device"})
		return
	}
	address := req.Token
	if req.Platform == "web" {
		if !push.ValidSubscription(req.Subscription) {
			c.JSON(400, gin.H{"error": "unsupported or invalid browser push subscription"})
			return
		}
		var s struct {
			Endpoint string `json:"endpoint"`
		}
		_ = json.Unmarshal(req.Subscription, &s)
		address = s.Endpoint
	} else if req.Platform != "expo" || !validExpoToken(address) {
		c.JSON(400, gin.H{"error": "invalid push device"})
		return
	}
	if err := server.saveNotificationDevice(c, req.Platform, address, req.Subscription); err != nil {
		c.JSON(500, gin.H{"error": "device registration failed"})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"registered": true}})
}
func (server *Server) unregisterNotificationDevice(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 8<<10)
	var req struct {
		Address string `json:"address"`
	}
	if c.ShouldBindJSON(&req) != nil || len(req.Address) > 4096 || req.Address == "" {
		c.JSON(400, gin.H{"error": "invalid device address"})
		return
	}
	if _, err := server.dbPool.Exec(c.Request.Context(), `UPDATE notification_devices SET active=false,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND address=$3`, tenantIDOf(c), getUserID(c), req.Address); err != nil {
		c.JSON(500, gin.H{"error": "could not remove device"})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"removed": true}})
}
func (server *Server) notificationDeliveryStatus(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	var web, expo int
	err := server.dbPool.QueryRow(c.Request.Context(), `SELECT count(*)FILTER(WHERE platform='web'),count(*)FILTER(WHERE platform='expo') FROM notification_devices WHERE tenant_id=$1 AND user_id=$2 AND active AND updated_at>now()-interval '30 days'`, tenantIDOf(c), getUserID(c)).Scan(&web, &expo)
	if err != nil {
		c.JSON(500, gin.H{"error": "could not load device status"})
		return
	}
	c.JSON(200, gin.H{"data": gin.H{"email_mode": mode(server.config.SMTPMock, server.config.SMTPHost != "" && server.config.SMTPFrom != ""), "push_mode": mode(server.config.PushMock, true), "web_push_configured": server.config.VAPIDPublicKey != "" && server.config.VAPIDPrivateKey != "", "vapid_public_key": server.config.VAPIDPublicKey, "web_devices": web, "mobile_devices": expo, "quiet_hours_timezone": "Africa/Lagos"}})
}
func mode(mock, configured bool) string {
	if mock {
		return "simulated"
	}
	if !configured {
		return "unconfigured"
	}
	return "live"
}
func (server *Server) testNotification(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	var req struct {
		ID uuid.UUID `json:"id"`
	}
	if c.ShouldBindJSON(&req) != nil || req.ID == uuid.Nil {
		c.JSON(400, gin.H{"error": "test id required"})
		return
	}
	ctx := c.Request.Context()
	tx, err := server.dbPool.Begin(ctx)
	if err != nil {
		c.Status(500)
		return
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, tenantIDOf(c).String()+":notification-test:"+getUserID(c).String())
	if err != nil {
		c.Status(500)
		return
	}
	var count int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM notification_events WHERE tenant_id=$1 AND user_id=$2 AND event_key LIKE 'test:%' AND event_key<>$3 AND created_at>now()-interval '10 minutes'`, tenantIDOf(c), getUserID(c), "test:"+req.ID.String()).Scan(&count); err != nil {
		c.Status(500)
		return
	}
	if count >= 5 {
		c.JSON(429, gin.H{"error": "maximum five tests per ten minutes"})
		return
	}
	_, err = notify.EnqueueTx(ctx, tx, notify.Event{UserID: getUserID(c), Key: "test:" + req.ID.String(), Type: "general", Category: "system", Title: "Notification delivery test", Message: "This is a real notification test requested in your settings.", ActionURL: "/notifications", ActionLabel: "View notifications"})
	if err != nil {
		c.JSON(500, gin.H{"error": "could not queue test"})
		return
	}
	if err = tx.Commit(ctx); err != nil {
		c.Status(500)
		return
	}
	c.JSON(202, gin.H{"data": gin.H{"id": req.ID, "status": "queued", "message": "Test queued. Disabled channels/topics are not sent. Provider acceptance is not delivery confirmation."}})
}
func (server *Server) notificationTestStatus(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.Status(400)
		return
	}
	var report []byte
	err = server.dbPool.QueryRow(c.Request.Context(), `SELECT jsonb_build_object('exists',true,'channels',COALESCE((SELECT jsonb_agg(jsonb_build_object('channel',d.channel,'status',d.status,'attempts',d.attempts,'next_attempt_at',d.next_attempt_at,'detail',CASE WHEN d.last_error LIKE 'deferred:%' THEN d.last_error ELSE NULL END)) FROM notification_deliveries d WHERE d.tenant_id=e.tenant_id AND d.event_id=e.id),'[]')) FROM notification_events e WHERE e.tenant_id=$1 AND e.user_id=$2 AND e.event_key=$3`, tenantIDOf(c), getUserID(c), "test:"+id.String()).Scan(&report)
	if err != nil {
		c.Status(404)
		return
	}
	c.JSON(200, gin.H{"data": json.RawMessage(report)})
}
