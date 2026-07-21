package api

import (
	"net/http"

	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AIServer struct {
	aiService *service.AIService
}

func NewAIServer(aiService *service.AIService) *AIServer {
	return &AIServer{aiService: aiService}
}

type chatRequest struct {
	Message   string `json:"message" binding:"required"`
	SessionID string `json:"session_id"`
}

type feedbackRequest struct {
	InteractionID string `json:"interaction_id" binding:"required"`
	Feedback      string `json:"feedback" binding:"required,oneof=positive negative neutral"`
	WasAccurate   *bool  `json:"was_accurate"`
}

type settingsRequest struct {
	ChatbotEnabled         *bool   `json:"chatbot_enabled"`
	PersonalizationEnabled *bool   `json:"personalization_enabled"`
	FaceRecognitionEnabled *bool   `json:"face_recognition_enabled"`
	DataCollectionConsent  *bool   `json:"data_collection_consent"`
	PreferredLanguage      *string `json:"preferred_language"`
}

func (s *AIServer) Chat(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req chatRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := s.aiService.Chat(ctx.Request.Context(), userID, req.Message, req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, resp)
}

func (s *AIServer) GetQuickActions(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, s.aiService.GetQuickActions())
}

func (s *AIServer) Feedback(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req feedbackRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	interactionID, err := uuid.Parse(req.InteractionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid interaction_id"})
		return
	}

	if err := s.aiService.Feedback(ctx.Request.Context(), interactionID, req.Feedback, req.WasAccurate); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "feedback recorded"})
}

func (s *AIServer) GetHistory(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	sessionID := ctx.Query("session_id")
	history, err := s.aiService.GetHistory(ctx.Request.Context(), userID, sessionID, 50)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, history)
}

func (s *AIServer) GetSettings(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	settings, err := s.aiService.GetSettings(ctx.Request.Context(), userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, settings)
}

func (s *AIServer) UpdateSettings(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req settingsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.aiService.UpdateSettings(ctx.Request.Context(), userID,
		req.ChatbotEnabled, req.PersonalizationEnabled,
		req.FaceRecognitionEnabled, req.DataCollectionConsent,
		req.PreferredLanguage); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "settings updated"})
}
