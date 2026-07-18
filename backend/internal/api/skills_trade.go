package api

import (
	"net/http"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createSkillCategoryRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Icon        *string `json:"icon"`
}

type createSkillListingRequest struct {
	CategoryID        uuid.UUID  `json:"category_id" binding:"required"`
	Title             string     `json:"title" binding:"required"`
	Description       *string    `json:"description"`
	SkillLevel        string     `json:"skill_level" binding:"required"`
	Price             *float64   `json:"price"`
	IsFree            bool       `json:"is_free"`
	BarterAvailable   bool       `json:"barter_available"`
	BarterDescription *string    `json:"barter_description"`
	PortfolioUrl      *string    `json:"portfolio_url"`
}

type updateSkillListingRequest struct {
	Title             string   `json:"title" binding:"required"`
	Description       *string  `json:"description"`
	SkillLevel        string   `json:"skill_level" binding:"required"`
	Price             *float64 `json:"price"`
	IsFree            bool     `json:"is_free"`
	BarterAvailable   bool     `json:"barter_available"`
	BarterDescription *string  `json:"barter_description"`
	PortfolioUrl      *string  `json:"portfolio_url"`
	IsActive          bool     `json:"is_active"`
}

type createTradeOfferRequest struct {
	ToUserID         uuid.UUID  `json:"to_user_id" binding:"required"`
	OfferedSkillID   uuid.UUID  `json:"offered_skill_id" binding:"required"`
	RequestedSkillID *uuid.UUID `json:"requested_skill_id"`
	Message          *string    `json:"message"`
	PriceOffered     *float64   `json:"price_offered"`
	IsBarter         bool       `json:"is_barter"`
}

type updateTradeStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type rateTradeRequest struct {
	TradeID     uuid.UUID `json:"trade_id" binding:"required"`
	RatedUserID uuid.UUID `json:"rated_user_id" binding:"required"`
	Rating      int32     `json:"rating" binding:"required,min=1,max=5"`
	Review      *string   `json:"review"`
}

func (server *Server) listSkillCategories(ctx *gin.Context) {
	categories, err := server.skillsTrade.ListCategories(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, categories)
}

func (server *Server) createSkillCategory(ctx *gin.Context) {
	var req createSkillCategoryRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	category, err := server.skillsTrade.CreateCategory(ctx, db.CreateSkillCategoryParams{
		Name:        req.Name,
		Description: req.Description,
		Icon:        req.Icon,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, category)
}

func (server *Server) createSkillListing(ctx *gin.Context) {
	var req createSkillListingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(ctx)

	var price pgtype.Numeric
	if req.Price != nil {
		price.Int.SetInt64(int64(*req.Price * 100))
		price.Exp = -2
		price.Valid = true
	}

	listing, err := server.skillsTrade.CreateListing(ctx, db.CreateSkillListingParams{
		UserID:            userID,
		CategoryID:        req.CategoryID,
		Title:             req.Title,
		Description:       req.Description,
		SkillLevel:        db.SkillLevel(req.SkillLevel),
		Price:             price,
		IsFree:            req.IsFree,
		BarterAvailable:   req.BarterAvailable,
		BarterDescription: req.BarterDescription,
		PortfolioUrl:      req.PortfolioUrl,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, listing)
}

func (server *Server) getSkillListing(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	listing, err := server.skillsTrade.GetListing(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, listing)
}

func (server *Server) listSkillListings(ctx *gin.Context) {
	listings, err := server.skillsTrade.ListListings(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, listings)
}

func (server *Server) listUserSkillListings(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	listings, err := server.skillsTrade.ListUserListings(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, listings)
}

func (server *Server) updateSkillListing(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateSkillListingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var price pgtype.Numeric
	if req.Price != nil {
		price.Int.SetInt64(int64(*req.Price * 100))
		price.Exp = -2
		price.Valid = true
	}

	listing, err := server.skillsTrade.UpdateListing(ctx, db.UpdateSkillListingParams{
		ID:                id,
		Title:             req.Title,
		Description:       req.Description,
		SkillLevel:        db.SkillLevel(req.SkillLevel),
		Price:             price,
		IsFree:            req.IsFree,
		BarterAvailable:   req.BarterAvailable,
		BarterDescription: req.BarterDescription,
		PortfolioUrl:      req.PortfolioUrl,
		IsActive:          req.IsActive,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, listing)
}

func (server *Server) deleteSkillListing(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	if err := server.skillsTrade.DeleteListing(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "listing deleted successfully"})
}

func (server *Server) createTradeOffer(ctx *gin.Context) {
	var req createTradeOfferRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fromUserID := getUserID(ctx)

	var requestedSkill pgtype.UUID
	if req.RequestedSkillID != nil {
		requestedSkill = pgtype.UUID{Bytes: *req.RequestedSkillID, Valid: true}
	}

	var price pgtype.Numeric
	if req.PriceOffered != nil {
		price.Int.SetInt64(int64(*req.PriceOffered * 100))
		price.Exp = -2
		price.Valid = true
	}

	offer, err := server.skillsTrade.CreateTradeOffer(ctx, db.CreateTradeOfferParams{
		FromUserID:       fromUserID,
		ToUserID:         req.ToUserID,
		OfferedSkillID:   req.OfferedSkillID,
		RequestedSkillID: requestedSkill,
		Message:          req.Message,
		PriceOffered:     price,
		IsBarter:         req.IsBarter,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, offer)
}

func (server *Server) getTradeOffer(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	offer, err := server.skillsTrade.GetTradeOffer(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, offer)
}

func (server *Server) listUserTrades(ctx *gin.Context) {
	userID := getUserID(ctx)

	trades, err := server.skillsTrade.ListUserTrades(ctx, userID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, trades)
}

func (server *Server) updateTradeStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateTradeStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	offer, err := server.skillsTrade.UpdateTradeStatus(ctx, id, req.Status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, offer)
}

func (server *Server) rateTrade(ctx *gin.Context) {
	var req rateTradeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	raterID := getUserID(ctx)

	rating, err := server.skillsTrade.RateTrade(ctx, db.CreateSkillRatingParams{
		TradeID:     req.TradeID,
		RaterID:     raterID,
		RatedUserID: req.RatedUserID,
		Rating:      req.Rating,
		Review:      req.Review,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, rating)
}

func (server *Server) listUserRatings(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	ratings, err := server.skillsTrade.ListUserRatings(ctx, userID, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, ratings)
}

func (server *Server) getUserReputation(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	reputation, err := server.skillsTrade.GetReputation(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, reputation)
}
