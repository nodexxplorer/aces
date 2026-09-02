package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createGroupReq struct {
	Name        string      `json:"name" binding:"required"`
	Description *string     `json:"description"`
	Category    string      `json:"category"`
	IsPrivate   bool        `json:"is_private"`
	MemberIDs   []uuid.UUID `json:"member_ids"`
}

func (server *Server) createGroup(ctx *gin.Context) {
	var req createGroupReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}
	if req.Category == "" {
		req.Category = "study"
	}

	userID := getUserID(ctx)
	group, err := server.campusConnect.CreateGroup(ctx, db.CreateGroupParams{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		IsPrivate:   req.IsPrivate,
		CreatedBy:   userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// The creator needs to start receiving live group messages immediately,
	// not just after their next page reload / WS reconnect.
	if server.wsHub != nil {
		server.wsHub.JoinGroup(group.ID, userID)
	}

	for _, memberID := range req.MemberIDs {
		if memberID == userID {
			continue
		}
		if _, err := server.campusConnect.AddMember(ctx, group.ID, memberID); err == nil && server.wsHub != nil {
			server.wsHub.JoinGroup(group.ID, memberID)
		}
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": group})
}

// listPublicGroups GET /groups — public groups browsable for anyone to
// discover and join, regardless of whether they're already a member.
func (server *Server) listPublicGroups(ctx *gin.Context) {
	groups, err := server.campusConnect.ListPublicGroups(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if groups == nil {
		groups = []db.ListGroupsRow{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": groups})
}

type addGroupMemberReq struct {
	UserID uuid.UUID `json:"user_id" binding:"required"`
}

// addGroupMember POST /groups/:id/members — an existing admin/moderator
// adding someone else directly, as opposed to joinGroup (self-service).
func (server *Server) addGroupMember(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	var req addGroupMemberReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	role, rerr := server.campusConnect.GetGroupMemberRole(ctx, groupID, userID)
	if rerr != nil || (role != "admin" && role != "moderator") {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "only a group admin or moderator can add members"})
		return
	}

	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, req.UserID); isMember {
		ctx.JSON(http.StatusConflict, gin.H{"error": "this user is already a member of the group"})
		return
	}

	member, err := server.campusConnect.AddMember(ctx, groupID, req.UserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if server.wsHub != nil {
		server.wsHub.JoinGroup(groupID, req.UserID)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": member})
}

// listMyGroupConversations GET /groups/mine — groups list with a last-message
// preview, for the Connect page's chat list panel.
func (server *Server) listMyGroupConversations(ctx *gin.Context) {
	userID := getUserID(ctx)
	groups, err := server.campusConnect.ListGroupConversations(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if groups == nil {
		groups = []db.GroupConversationRow{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": groups})
}

func (server *Server) getGroup(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	group, err := server.campusConnect.GetGroup(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": group})
}

// getGroupInviteCode GET /groups/:id/invite-code — any current member can
// fetch (and lazily generate) the group's short share code, for a "Copy
// invite link" action.
func (server *Server) getGroupInviteCode(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID := getUserID(ctx)
	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, userID); !isMember {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this group"})
		return
	}

	code, err := server.campusConnect.EnsureGroupInviteCode(ctx, groupID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"invite_code": code}})
}

// getGroupByInviteCode GET /groups/join/:code — resolves a short invite
// code to a group preview, deliberately with NO membership check (that's
// the point of an invite link: it needs to work for people who aren't
// members yet).
func (server *Server) getGroupByInviteCode(ctx *gin.Context) {
	code := ctx.Param("code")
	group, err := server.campusConnect.GetGroupByInviteCode(ctx, code)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "invite link is invalid or has expired"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": group})
}

func (server *Server) joinGroup(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID := getUserID(ctx)

	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, userID); isMember {
		ctx.JSON(http.StatusConflict, gin.H{"error": "you are already a member of this group"})
		return
	}

	member, err := server.campusConnect.JoinGroup(ctx, groupID, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if server.wsHub != nil {
		server.wsHub.JoinGroup(groupID, userID)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": member})
}

func (server *Server) leaveGroup(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID := getUserID(ctx)

	if err := server.campusConnect.LeaveGroup(ctx, groupID, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if server.wsHub != nil {
		server.wsHub.LeaveGroup(groupID, userID)
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "left group"})
}

func (server *Server) listGroupMembers(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID := getUserID(ctx)
	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, userID); !isMember {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this group"})
		return
	}

	members, err := server.campusConnect.ListGroupMembers(ctx, groupID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if members == nil {
		members = []db.ListGroupMembersRow{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": members})
}

type sendGroupMessageReq struct {
	Content string `json:"content" binding:"required"`
}

func (server *Server) sendGroupMessage(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	var req sendGroupMessageReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, userID); !isMember {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this group"})
		return
	}

	message, err := server.campusConnect.SendGroupMessage(ctx, groupID, userID, req.Content)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// db.GroupMessage carries no sender name/avatar, unlike ListGroupMessagesRow
	// (which joins users for the initial load) — a group thread needs to show
	// who sent each message, so enrich the live push to match that shape
	// rather than leaving the frontend to special-case a thinner payload.
	payload := db.ListGroupMessagesRow{
		ID:        message.ID,
		GroupID:   message.GroupID,
		SenderID:  message.SenderID,
		Content:   message.Content,
		CreatedAt: message.CreatedAt,
	}
	if sender, serr := server.store.GetUser(ctx, userID); serr == nil {
		payload.FullName = sender.FullName
		payload.AvatarUrl = sender.AvatarUrl
	}

	if server.wsHub != nil {
		server.wsHub.SendToGroup(groupID, ws.TypeGroupChat, payload)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": payload})
}

func (server *Server) listGroupMessages(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	userID := getUserID(ctx)
	if isMember, _ := server.campusConnect.CheckGroupMembership(ctx, groupID, userID); !isMember {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this group"})
		return
	}

	messages, err := server.campusConnect.ListGroupMessages(ctx, groupID, 200, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if messages == nil {
		messages = []db.ListGroupMessagesRow{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": messages})
}

// listMyDMConversations GET /campus-connect/conversations — accepted
// connections with a last-message preview, for the Connect page's DM list
// panel (replaces client-side "fetch connections + fetch unread counts +
// merge" with one call that also carries the message snippet/timestamp).
func (server *Server) listMyDMConversations(ctx *gin.Context) {
	userID := getUserID(ctx)
	conversations, err := server.campusConnect.ListDMConversations(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if conversations == nil {
		conversations = []db.DMConversationRow{}
	}
	ctx.JSON(http.StatusOK, gin.H{"data": conversations})
}
