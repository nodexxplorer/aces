package api

import (
	"fmt"
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createComplaintRequest struct {
	Category    string `json:"category" binding:"required"`
	Subject     string `json:"subject" binding:"required"`
	Body        string `json:"body"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
}

func (r *createComplaintRequest) GetBody() string {
	if r.Body != "" {
		return r.Body
	}
	return r.Description
}

type updateComplaintRequest struct {
	Status string `json:"status"`
}

type assignComplaintRequest struct {
	AssignedTo string `json:"assignedTo" binding:"required"`
}

type resolveComplaintRequest struct {
	Resolution string `json:"resolution" binding:"required"`
}

func (server *Server) createComplaint(ctx *gin.Context) {
	var req createComplaintRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userIDStr := ctx.GetString("userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	complaint, err := server.complaints.Create(ctx, userID, service.CreateComplaintInput{
		Category: req.Category,
		Subject:  req.Subject,
		Body:     req.GetBody(),
		Priority: req.Priority,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": complaint})
}

func (server *Server) listComplaints(ctx *gin.Context) {
	complaints, err := server.complaints.ListAll(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list complaints"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": complaints})
}

func (server *Server) getComplaint(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	complaint, err := server.complaints.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "complaint not found"})
		return
	}

	if !requireOwnershipOrStaff(ctx, server.store, complaint.StudentID) {
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": complaint})
}

func (server *Server) updateComplaint(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	var req updateComplaintRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	complaint, err := server.complaints.UpdateStatus(ctx, id, req.Status, getUserID(ctx), getUserRole(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about complaint status change
	if student, err := server.store.GetStudent(ctx, complaint.StudentID); err == nil {
		eType := "complaint"
		eID := complaint.ID
		server.notifyUser(
			ctx,
			student.UserID,
			"general",
			"system",
			"normal",
			"Complaint Status Updated",
			fmt.Sprintf("Your complaint \"%s\" status has been updated to %s.", complaint.Subject, complaint.Status),
			"/complaints",
			"View Complaints",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": complaint})
}

func (server *Server) deleteComplaint(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	if err := server.complaints.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete complaint"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "complaint deleted"})
}

func (server *Server) assignComplaint(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	var req assignComplaintRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	assignedTo, err := uuid.Parse(req.AssignedTo)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid assigned user id"})
		return
	}

	complaint, err := server.complaints.Assign(ctx, id, assignedTo, getUserID(ctx), getUserRole(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": complaint})
}

func (server *Server) resolveComplaint(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	var req resolveComplaintRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	complaint, err := server.complaints.Resolve(ctx, id, req.Resolution, getUserID(ctx), getUserRole(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Notify the student about complaint resolution
	if student, err := server.store.GetStudent(ctx, complaint.StudentID); err == nil {
		eType := "complaint"
		eID := complaint.ID
		server.notifyUser(
			ctx,
			student.UserID,
			"general",
			"system",
			"high",
			"Complaint Resolved",
			fmt.Sprintf("Your complaint \"%s\" has been resolved.", complaint.Subject),
			"/complaints",
			"View Complaints",
			&eType,
			&eID,
		)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": complaint})
}

// listComplaintHistory GET /complaints/:id/history — the resolution
// pipeline's timeline, so a student can see where their complaint stands.
func (server *Server) listComplaintHistory(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid complaint id"})
		return
	}

	complaint, err := server.complaints.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "complaint not found"})
		return
	}
	if !requireOwnershipOrStaff(ctx, server.store, complaint.StudentID) {
		return
	}

	history, err := server.complaints.History(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": history})
}

func (server *Server) listMyComplaints(ctx *gin.Context) {
	userIDStr := ctx.GetString("userID")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	student, err := server.store.GetStudentByUserId(ctx, userID)
	if err != nil {
		// Fallback: try using userID directly as student_id
		complaints, cErr := server.complaints.ListByStudent(ctx, userID)
		if cErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list complaints"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"data": complaints})
		return
	}

	complaints, err := server.complaints.ListByStudent(ctx, student.ID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list complaints"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": complaints})
}
