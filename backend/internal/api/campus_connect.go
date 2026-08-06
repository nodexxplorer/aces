package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type sendConnectionReq struct {
	ReceiverID uuid.UUID `json:"receiver_id" binding:"required"`
	Message    *string   `json:"message"`
}

type respondConnectionReq struct {
	Status string `json:"status" binding:"required"`
}

type sendMessageReq struct {
	ReceiverID uuid.UUID `json:"receiver_id" binding:"required"`
	Content    string    `json:"content" binding:"required"`
}


func (server *Server) sendConnectionRequest(ctx *gin.Context) {
	var req sendConnectionReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	requesterID := getUserID(ctx)

	connection, err := server.campusConnect.SendConnectionRequest(ctx, requesterID, req.ReceiverID, req.Message)
	if err != nil {
		errMsg := err.Error()
		status := http.StatusInternalServerError
		if errMsg == "cannot send a connection request to yourself" || errMsg == "a connection request already exists between you and this user" {
			status = http.StatusConflict
		}
		ctx.JSON(status, gin.H{"error": errMsg})
		return
	}

	ctx.JSON(http.StatusOK, connection)
}

func (server *Server) respondToConnection(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	userID := getUserID(ctx)

	// Only the receiver may accept/reject a connection request.
	if q, ok := server.store.(*db.Queries); ok {
		conn, err := q.GetConnection(ctx, id)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "connection not found"})
			return
		}
		if conn.ReceiverID != userID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "only the receiver can respond to this connection"})
			return
		}
	}

	var req respondConnectionReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	connection, err := server.campusConnect.RespondToConnection(ctx, id, req.Status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, connection)
}

func (server *Server) listConnections(ctx *gin.Context) {
	userID := getUserID(ctx)

	connections, err := server.campusConnect.ListConnections(ctx, userID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if connections == nil {
		connections = []db.ListUserConnectionsRow{}
	}

	ctx.JSON(http.StatusOK, connections)
}

func (server *Server) listPendingRequests(ctx *gin.Context) {
	userID := getUserID(ctx)

	requests, err := server.campusConnect.ListPendingRequests(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if requests == nil {
		requests = []db.ListPendingConnectionRequestsRow{}
	}

	ctx.JSON(http.StatusOK, requests)
}

func (server *Server) getUnreadCounts(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	counts, err := queries.CountUnreadBySender(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	result := map[string]int32{}
	for _, c := range counts {
		result[c.SenderID.String()] = c.UnreadCount
	}

	ctx.JSON(http.StatusOK, result)
}

func (server *Server) sendMessage(ctx *gin.Context) {
	var req sendMessageReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	senderID := getUserID(ctx)

	message, err := server.campusConnect.SendMessage(ctx, senderID, req.ReceiverID, req.Content)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if server.wsHub != nil {
		server.wsHub.SendToUser(req.ReceiverID, ws.TypeChat, message)
	}

	ctx.JSON(http.StatusOK, message)
}

func (server *Server) listConversation(ctx *gin.Context) {
	otherID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	userID := getUserID(ctx)

	messages, err := server.campusConnect.ListConversation(ctx, userID, otherID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if messages == nil {
		messages = []db.Message{}
	}

	ctx.JSON(http.StatusOK, messages)
}

func (server *Server) markMessageRead(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	userID := getUserID(ctx)

	// Verify the caller is the receiver of this message before marking read.
	if q, ok := server.store.(*db.Queries); ok {
		var receiverID uuid.UUID
		err := q.GetDB().QueryRow(ctx,
			"SELECT receiver_id FROM messages WHERE id = $1", id,
		).Scan(&receiverID)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
			return
		}
		if receiverID != userID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "only the receiver can mark a message as read"})
			return
		}
	}

	message, err := server.campusConnect.MarkMessageRead(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, message)
}



func (server *Server) getStudentDirectory(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	directory, err := server.campusConnect.GetStudentDirectory(ctx, userID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if directory == nil {
		directory = []db.GetStudentDirectoryRow{}
	}

	ctx.JSON(http.StatusOK, directory)
}

func (server *Server) getAllConnectionUserIds(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ids, err := server.campusConnect.GetAllConnectionUserIds(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}

	ctx.JSON(http.StatusOK, ids)
}

func (server *Server) getAlumniDirectory(ctx *gin.Context) {
	directory, err := server.campusConnect.GetAlumniDirectory(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if directory == nil {
		directory = []db.GetAlumniDirectoryRow{}
	}

	ctx.JSON(http.StatusOK, directory)
}
