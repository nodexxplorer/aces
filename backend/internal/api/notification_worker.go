package api

import (
	"context"
	"github.com/gin-gonic/gin"
	"log"
	"time"
)

func (server *Server) RunNotificationWorker(ctx context.Context) {
	run := func() { server.TriggerNotificationDelivery(ctx) }
	run()
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func (server *Server) TriggerNotificationDelivery(ctx context.Context) {
	server.forEachActiveTenant(ctx, "notification-delivery", func(bound context.Context) {
		work, cancel := context.WithTimeout(bound, 45*time.Second)
		defer cancel()
		if err := server.notificationsFull.ProcessPending(work, 10); err != nil && ctx.Err() == nil {
			log.Printf("[notification-delivery] batch failed: %v", err)
		}
	})
}
func (server *Server) triggerNotificationDelivery(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	server.TriggerNotificationDelivery(ctx)
	c.JSON(200, gin.H{"data": gin.H{"message": "Delivery pass finished; inspect channel job statuses for results."}})
}
