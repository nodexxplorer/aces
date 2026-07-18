package api

import (
	"log"
	"net/http"
	"strings"

	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func (server *Server) handleWebSocket(ctx *gin.Context) {
	userID := getUserID(ctx)

	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required for WebSocket"})
		return
	}

	origin := ctx.Request.Header.Get("Origin")
	allowed := false
	for _, o := range server.config.AllowedOrigins {
		if strings.EqualFold(origin, o) {
			allowed = true
			break
		}
	}
	if !allowed {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "origin not allowed"})
		return
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			orig := r.Header.Get("Origin")
			for _, o := range server.config.AllowedOrigins {
				if strings.EqualFold(orig, o) {
					return true
				}
			}
			return false
		},
	}

	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Printf("[ws] upgrade failed for user %s: %v", userID, err)
		return
	}

	client := ws.NewClient(server.wsHub, conn, userID)
	server.wsHub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
