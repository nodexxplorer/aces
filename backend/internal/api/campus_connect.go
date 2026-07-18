package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
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

type createGroupReq struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Category    string  `json:"category" binding:"required"`
	AvatarUrl   *string `json:"avatar_url"`
	MaxMembers  *int32  `json:"max_members"`
	IsPrivate   bool    `json:"is_private"`
}

type sendGroupMessageReq struct {
	Content string `json:"content" binding:"required"`
}

func (server *Server) sendConnectionRequest(ctx *gin.Context) {
	var req sendConnectionReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	requesterID := getUserID(ctx)

	connection, err := server.campusConnect.SendConnectionRequest(ctx, requesterID, req.ReceiverID, req.Message)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	var req respondConnectionReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	connection, err := server.campusConnect.RespondToConnection(ctx, id, req.Status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, connection)
}

func (server *Server) listConnections(ctx *gin.Context) {
	userID := getUserID(ctx)

	connections, err := server.campusConnect.ListConnections(ctx, userID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, connections)
}

func (server *Server) listPendingRequests(ctx *gin.Context) {
	userID := getUserID(ctx)

	requests, err := server.campusConnect.ListPendingRequests(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

func (server *Server) sendMessage(ctx *gin.Context) {
	var req sendMessageReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senderID := getUserID(ctx)

	message, err := server.campusConnect.SendMessage(ctx, senderID, req.ReceiverID, req.Content)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, messages)
}

func (server *Server) markMessageRead(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	message, err := server.campusConnect.MarkMessageRead(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, message)
}

func (server *Server) createGroup(ctx *gin.Context) {
	var req createGroupReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := getUserID(ctx)

	group, err := server.campusConnect.CreateGroup(ctx, db.CreateGroupParams{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		AvatarUrl:   req.AvatarUrl,
		MaxMembers:  req.MaxMembers,
		IsPrivate:   req.IsPrivate,
		CreatedBy:   createdBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, group)
}

func (server *Server) getGroup(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	group, err := server.campusConnect.GetGroup(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, group)
}

func (server *Server) listGroups(ctx *gin.Context) {
	groups, err := server.campusConnect.ListGroups(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, groups)
}

func (server *Server) listUserGroups(ctx *gin.Context) {
	userID := getUserID(ctx)

	groups, err := server.campusConnect.ListUserGroups(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, groups)
}

func (server *Server) joinGroup(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	userID := getUserID(ctx)

	member, err := server.campusConnect.JoinGroup(ctx, groupID, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, member)
}

func (server *Server) leaveGroup(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	userID := getUserID(ctx)

	if err := server.campusConnect.LeaveGroup(ctx, groupID, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "left group successfully"})
}

func (server *Server) listGroupMembers(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	members, err := server.campusConnect.ListGroupMembers(ctx, groupID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, members)
}

func (server *Server) sendGroupMessage(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	var req sendGroupMessageReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senderID := getUserID(ctx)

	message, err := server.campusConnect.SendGroupMessage(ctx, groupID, senderID, req.Content)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, message)
}

func (server *Server) listGroupMessages(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	messages, err := server.campusConnect.ListGroupMessages(ctx, groupID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, messages)
}

func (server *Server) getStudentDirectory(ctx *gin.Context) {
	directory, err := server.campusConnect.GetStudentDirectory(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, directory)
}

func (server *Server) getAlumniDirectory(ctx *gin.Context) {
	directory, err := server.campusConnect.GetAlumniDirectory(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, directory)
}
