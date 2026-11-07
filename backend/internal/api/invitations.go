package api

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/aces/backend/internal/invitation"
	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (server *Server) invitationService() *invitation.Service {
	return &invitation.Service{Pool: server.dbPool, Sender: server.emailSender, FrontendURL: server.config.FrontendPublicURL}
}
func invitationError(ctx *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "invitation service unavailable"
	switch {
	case errors.Is(err, invitation.ErrInvalid):
		status = http.StatusBadRequest
		message = invitation.ErrInvalid.Error()
	case errors.Is(err, invitation.ErrForbidden):
		status = http.StatusForbidden
		message = invitation.ErrForbidden.Error()
	case errors.Is(err, invitation.ErrConflict):
		status = http.StatusConflict
		message = invitation.ErrConflict.Error()
	case errors.Is(err, invitation.ErrRateLimit):
		status = http.StatusTooManyRequests
		message = invitation.ErrRateLimit.Error()
	case errors.Is(err, invitation.ErrSignIn):
		status = http.StatusUnauthorized
		message = invitation.ErrSignIn.Error()
	}
	if status == http.StatusInternalServerError {
		log.Printf("[invitations] %v", err)
	}
	ctx.JSON(status, gin.H{"error": message})
}
func (server *Server) listAccessInvitations(ctx *gin.Context) {
	items, err := server.invitationService().List(ctx.Request.Context(), getUserID(ctx))
	if err != nil {
		invitationError(ctx, err)
		return
	}
	ctx.Header("Cache-Control", "no-store")
	ctx.JSON(http.StatusOK, gin.H{"data": items})
}
func (server *Server) createAccessInvitation(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	var req invitation.Request
	if err := ctx.ShouldBindJSON(&req); err != nil {
		invitationError(ctx, invitation.ErrInvalid)
		return
	}
	i, err := server.invitationService().Create(ctx.Request.Context(), getUserID(ctx), req)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": i})
}
func (server *Server) actOnAccessInvitation(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		invitationError(ctx, invitation.ErrInvalid)
		return
	}
	i, err := server.invitationService().Act(ctx.Request.Context(), getUserID(ctx), id, ctx.Param("action"))
	if err != nil {
		invitationError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": i})
}
func (server *Server) accessInvitationHistory(ctx *gin.Context) {
	// First check live invitation-management authority through the same service.
	if _, err := server.invitationService().List(ctx.Request.Context(), getUserID(ctx)); err != nil {
		invitationError(ctx, err)
		return
	}
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		invitationError(ctx, invitation.ErrInvalid)
		return
	}
	rows, err := server.dbPool.Query(ctx.Request.Context(), `SELECT action,actor_id,created_at FROM access_invitation_events WHERE invitation_id=$1 AND tenant_id=app_current_tenant() ORDER BY created_at,id`, id)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	defer rows.Close()
	type entry struct {
		Action    string     `json:"action"`
		ActorID   *uuid.UUID `json:"actorId"`
		CreatedAt time.Time  `json:"createdAt"`
	}
	result := []entry{}
	for rows.Next() {
		var e entry
		if err = rows.Scan(&e.Action, &e.ActorID, &e.CreatedAt); err != nil {
			invitationError(ctx, err)
			return
		}
		result = append(result, e)
	}
	if err = rows.Err(); err != nil {
		invitationError(ctx, err)
		return
	}
	ctx.Header("Cache-Control", "no-store")
	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

type inspectAccessInvitationRequest struct {
	Token  string `json:"token" binding:"required,len=64"`
	Tenant string `json:"tenant" binding:"required,max=64"`
}

func (server *Server) inspectAccessInvitation(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	ctx.Header("Referrer-Policy", "no-referrer")
	var r inspectAccessInvitationRequest
	if err := ctx.ShouldBindJSON(&r); err != nil {
		invitationError(ctx, invitation.ErrInvalid)
		return
	}
	if !server.bindTenant(ctx, r.Tenant) {
		return
	}
	p, err := server.invitationService().Inspect(ctx.Request.Context(), r.Token)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": p})
}
func (server *Server) acceptAccessInvitation(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-store")
	if isMobileClient(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Accept staff invitations on the website, not the student mobile app."})
		return
	}
	var req struct {
		invitation.AcceptRequest
		Tenant string `json:"tenant" binding:"required,max=64"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		invitationError(ctx, invitation.ErrInvalid)
		return
	}
	if !server.bindTenant(ctx, req.Tenant) {
		return
	}
	var actor *uuid.UUID
	if token := server.getTokenFromRequest(ctx); token != "" {
		claims, err := server.tokenManager.Verify(token)
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "sign in again or sign out before accepting"})
			return
		}
		t, _ := tenant.From(ctx.Request.Context())
		tid, ok := tenant.ClaimID(claims.TenantID)
		if !ok || tid != t.ID {
			invitationError(ctx, invitation.ErrForbidden)
			return
		}
		id, err := uuid.Parse(claims.UserID)
		if err != nil {
			invitationError(ctx, invitation.ErrForbidden)
			return
		}
		actor = &id
	}
	id, err := server.invitationService().Accept(ctx.Request.Context(), actor, req.AcceptRequest)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	user, err := server.store.GetUser(ctx, id)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	roles, err := server.roles.ListUserRolesByName(ctx, id)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	resp, err := server.generateAuthResponse(ctx, user, true, roles)
	if err != nil {
		invitationError(ctx, err)
		return
	}
	resp.Tokens.CsrfToken = server.setTokenCookies(ctx, &resp.Tokens)
	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}
