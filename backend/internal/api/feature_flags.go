package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/aces/backend/internal/db/sql"
)

type createFeatureFlagRequest struct {
	Name         string   `json:"name" binding:"required"`
	Description  *string  `json:"description"`
	IsEnabled    bool     `json:"is_enabled"`
	TargetRoles  []string `json:"target_roles"`
	TargetLevels []int32  `json:"target_levels"`
	Percentage   *float64 `json:"percentage"`
}

type updateFeatureFlagRequest struct {
	Description  *string  `json:"description"`
	IsEnabled    *bool    `json:"is_enabled"`
	TargetRoles  []string `json:"target_roles"`
	TargetLevels []int32  `json:"target_levels"`
	Percentage   *float64 `json:"percentage"`
}

type featureFlagResponse struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  *string  `json:"description"`
	IsEnabled    bool     `json:"is_enabled"`
	TargetRoles  []string `json:"target_roles"`
	TargetLevels []int32  `json:"target_levels"`
	Percentage   *float64 `json:"percentage"`
	CreatedBy    *string  `json:"created_by"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

func marshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func decodeFeatureFlag(flag db.FeatureFlag) featureFlagResponse {
	var roles []string
	if len(flag.TargetRoles) > 0 {
		json.Unmarshal(flag.TargetRoles, &roles)
	}
	var levels []int32
	if len(flag.TargetLevels) > 0 {
		json.Unmarshal(flag.TargetLevels, &levels)
	}
	var createdBy *string
	if flag.CreatedBy.Valid {
		u, err := uuid.FromBytes(flag.CreatedBy.Bytes[:])
		if err == nil {
			s := u.String()
			createdBy = &s
		}
	}
	var createdAt, updatedAt string
	if flag.CreatedAt.Valid {
		createdAt = flag.CreatedAt.Time.Format("2006-01-02T15:04:05Z")
	}
	if flag.UpdatedAt.Valid {
		updatedAt = flag.UpdatedAt.Time.Format("2006-01-02T15:04:05Z")
	}
	return featureFlagResponse{
		ID:           flag.ID.String(),
		Name:         flag.Name,
		Description:  flag.Description,
		IsEnabled:    flag.IsEnabled,
		TargetRoles:  roles,
		TargetLevels: levels,
		Percentage:   flag.Percentage,
		CreatedBy:    createdBy,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}
}

func (server *Server) listFeatureFlags(ctx *gin.Context) {
	queries := server.store.(*db.Queries)
	flags, err := queries.ListFeatureFlags(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list feature flags"})
		return
	}
	result := make([]featureFlagResponse, len(flags))
	for i, f := range flags {
		result[i] = decodeFeatureFlag(f)
	}
	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

func (server *Server) createFeatureFlag(ctx *gin.Context) {
	var req createFeatureFlagRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	queries := server.store.(*db.Queries)

	roles := marshalJSON(req.TargetRoles)
	levels := marshalJSON(req.TargetLevels)

	flag, err := queries.CreateFeatureFlag(ctx, db.CreateFeatureFlagParams{
		Name:         req.Name,
		Description:  req.Description,
		IsEnabled:    req.IsEnabled,
		TargetRoles:  roles,
		TargetLevels: levels,
		Percentage:   req.Percentage,
		CreatedBy: pgtype.UUID{
			Bytes: userID,
			Valid: userID != uuid.Nil,
		},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": decodeFeatureFlag(flag)})
}

func (server *Server) toggleFeatureFlag(ctx *gin.Context) {
	name := ctx.Param("name")
	var req struct {
		IsEnabled bool `json:"is_enabled"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries := server.store.(*db.Queries)
	err := queries.ToggleFeatureFlag(ctx, db.ToggleFeatureFlagParams{
		Name:      name,
		IsEnabled: req.IsEnabled,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to toggle feature flag"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "feature flag toggled"})
}

func (server *Server) updateFeatureFlag(ctx *gin.Context) {
	name := ctx.Param("name")
	var req updateFeatureFlagRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries := server.store.(*db.Queries)

	existing, err := queries.GetFeatureFlag(ctx, name)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "feature flag not found"})
		return
	}

	isEnabled := existing.IsEnabled
	if req.IsEnabled != nil {
		isEnabled = *req.IsEnabled
	}
	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}
	targetRoles := existing.TargetRoles
	if req.TargetRoles != nil {
		targetRoles = marshalJSON(req.TargetRoles)
	}
	targetLevels := existing.TargetLevels
	if req.TargetLevels != nil {
		targetLevels = marshalJSON(req.TargetLevels)
	}
	percentage := existing.Percentage
	if req.Percentage != nil {
		percentage = req.Percentage
	}

	err = queries.UpdateFeatureFlag(ctx, db.UpdateFeatureFlagParams{
		Name:         name,
		Description:  description,
		IsEnabled:    isEnabled,
		TargetRoles:  targetRoles,
		TargetLevels: targetLevels,
		Percentage:   percentage,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "feature flag updated"})
}

func (server *Server) deleteFeatureFlag(ctx *gin.Context) {
	name := ctx.Param("name")
	queries := server.store.(*db.Queries)
	err := queries.DeleteFeatureFlag(ctx, name)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete feature flag"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "feature flag deleted"})
}

func (server *Server) getFeatureFlag(ctx *gin.Context) {
	name := ctx.Param("name")
	queries := server.store.(*db.Queries)
	flag, err := queries.GetFeatureFlag(ctx, name)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "feature flag not found"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": decodeFeatureFlag(flag)})
}
