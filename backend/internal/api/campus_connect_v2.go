package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ==================== CAMPUS PROFILES ====================

func (server *Server) upsertCampusProfile(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Bio                *string         `json:"bio"`
		Interests          json.RawMessage `json:"interests"`
		Skills             json.RawMessage `json:"skills"`
		AvailabilityStatus *string         `json:"availability_status"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Interests == nil {
		req.Interests = json.RawMessage("[]")
	}
	if req.Skills == nil {
		req.Skills = json.RawMessage("[]")
	}
	status := "offline"
	if req.AvailabilityStatus != nil {
		status = *req.AvailabilityStatus
	}

	profile, err := queries.UpsertCampusProfile(ctx, db.UpsertCampusProfileParams{
		UserID:             userID,
		Bio:                req.Bio,
		Interests:          req.Interests,
		Skills:             req.Skills,
		AvailabilityStatus: status,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": profile})
}

func (server *Server) getCampusProfile(ctx *gin.Context) {
	targetUserID, err := uuid.Parse(ctx.Param("user_id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	profile, err := queries.GetCampusProfile(ctx, targetUserID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": profile})
}

// ==================== FEED POSTS ====================

func (server *Server) createFeedPost(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Content        string          `json:"content" binding:"required"`
		PostType       string          `json:"post_type"`
		MediaUrls      json.RawMessage `json:"media_urls"`
		TargetAudience string          `json:"target_audience"`
		GroupID        *string         `json:"group_id"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postType := "text"
	if req.PostType != "" {
		postType = req.PostType
	}
	audience := "public"
	if req.TargetAudience != "" {
		audience = req.TargetAudience
	}
	if req.MediaUrls == nil {
		req.MediaUrls = json.RawMessage("[]")
	}

	var groupID pgtype.UUID
	if req.GroupID != nil {
		gid, err := uuid.Parse(*req.GroupID)
		if err == nil {
			groupID = pgtype.UUID{Bytes: gid, Valid: true}
		}
	}

	post, err := queries.CreateFeedPost(ctx, db.CreateFeedPostParams{
		AuthorID:       userID,
		PostType:       postType,
		Content:        req.Content,
		MediaUrls:      req.MediaUrls,
		TargetAudience: audience,
		GroupID:        groupID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = queries.IncrementProfilePostCount(ctx, userID)

	ctx.JSON(http.StatusCreated, gin.H{"data": post})
}

func (server *Server) listFeedPosts(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	limit := int32(20)
	offset := int32(0)
	if l := ctx.Query("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil {
			limit = int32(v)
		}
	}
	if o := ctx.Query("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil {
			offset = int32(v)
		}
	}

	posts, err := queries.ListFeedPosts(ctx, db.ListFeedPostsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": posts})
}

func (server *Server) getFeedPost(ctx *gin.Context) {
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	post, err := queries.GetFeedPost(ctx, postID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": post})
}

func (server *Server) deleteFeedPost(ctx *gin.Context) {
	userID := getUserID(ctx)
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeleteFeedPost(ctx, db.DeleteFeedPostParams{ID: postID, AuthorID: userID}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "post deleted"})
}

func (server *Server) hideFeedPost(ctx *gin.Context) {
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.HideFeedPost(ctx, postID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "post hidden"})
}

// ==================== POST REACTIONS ====================

func (server *Server) togglePostReaction(ctx *gin.Context) {
	userID := getUserID(ctx)
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		ReactionType string `json:"reaction_type"`
	}
	_ = ctx.ShouldBindJSON(&req)

	reactionType := "like"
	if req.ReactionType != "" {
		reactionType = req.ReactionType
	}

	existing, err := queries.GetPostReaction(ctx, db.GetPostReactionParams{PostID: postID, UserID: userID})
	if err == nil && existing.ID != uuid.Nil {
		_ = queries.RemovePostReaction(ctx, db.RemovePostReactionParams{PostID: postID, UserID: userID})
		_ = queries.DecrementPostLikeCount(ctx, postID)
		ctx.JSON(http.StatusOK, gin.H{"data": nil, "message": "reaction removed"})
		return
	}

	_, err = queries.CreatePostReaction(ctx, db.CreatePostReactionParams{
		PostID:       postID,
		UserID:       userID,
		ReactionType: reactionType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = queries.IncrementPostLikeCount(ctx, postID)

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"reaction_type": reactionType}, "message": "reaction added"})
}

func (server *Server) listPostReactions(ctx *gin.Context) {
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	reactions, _ := queries.ListPostReactions(ctx, postID)
	counts, _ := queries.GetPostReactionCounts(ctx, postID)

	ctx.JSON(http.StatusOK, gin.H{"data": reactions, "counts": counts})
}

// ==================== POST COMMENTS ====================

func (server *Server) createPostComment(ctx *gin.Context) {
	userID := getUserID(ctx)
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Content         string  `json:"content" binding:"required"`
		ParentCommentID *string `json:"parent_comment_id"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var parentID pgtype.UUID
	if req.ParentCommentID != nil {
		pid, err := uuid.Parse(*req.ParentCommentID)
		if err == nil {
			parentID = pgtype.UUID{Bytes: pid, Valid: true}
		}
	}

	comment, err := queries.CreatePostComment(ctx, db.CreatePostCommentParams{
		PostID:          postID,
		AuthorID:        userID,
		ParentCommentID: parentID,
		Content:         req.Content,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = queries.IncrementPostCommentCount(ctx, postID)

	ctx.JSON(http.StatusCreated, gin.H{"data": comment})
}

func (server *Server) listPostComments(ctx *gin.Context) {
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	comments, err := queries.ListPostComments(ctx, db.ListPostCommentsParams{PostID: postID, Limit: 50, Offset: 0})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": comments})
}

func (server *Server) deletePostComment(ctx *gin.Context) {
	userID := getUserID(ctx)
	commentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid comment ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeletePostComment(ctx, db.DeletePostCommentParams{ID: commentID, AuthorID: userID}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

// ==================== MESSAGE REACTIONS ====================

func (server *Server) toggleMessageReaction(ctx *gin.Context) {
	userID := getUserID(ctx)
	messageID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid message ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		ReactionType string `json:"reaction_type"`
	}
	_ = ctx.ShouldBindJSON(&req)

	reactionType := "like"
	if req.ReactionType != "" {
		reactionType = req.ReactionType
	}

	reaction, err := queries.GetMessageReaction(ctx, db.GetMessageReactionParams{MessageID: messageID, UserID: userID})
	if err == nil && reaction.ID != uuid.Nil {
		_ = queries.RemoveMessageReaction(ctx, db.RemoveMessageReactionParams{MessageID: messageID, UserID: userID})
		ctx.JSON(http.StatusOK, gin.H{"data": nil, "message": "reaction removed"})
		return
	}

	_, err = queries.CreateMessageReaction(ctx, db.CreateMessageReactionParams{
		MessageID:    messageID,
		UserID:       userID,
		ReactionType: reactionType,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": gin.H{"reaction_type": reactionType}, "message": "reaction added"})
}

// ==================== GROUP FILES ====================

func (server *Server) uploadGroupFile(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		FileName string `json:"file_name" binding:"required"`
		FileURL  string `json:"file_url" binding:"required"`
		FileType string `json:"file_type"`
		FileSize int64  `json:"file_size"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file, err := queries.CreateGroupFile(ctx, db.CreateGroupFileParams{
		GroupID:    groupID,
		UploadedBy: userID,
		FileName:   req.FileName,
		FileUrl:    req.FileURL,
		FileType:   &req.FileType,
		FileSize:   &req.FileSize,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": file})
}

func (server *Server) listGroupFiles(ctx *gin.Context) {
	groupID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	files, err := queries.ListGroupFiles(ctx, groupID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": files})
}

// ==================== CONNECTION SUGGESTIONS ====================

func (server *Server) getConnectionSuggestions(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	suggestions, err := queries.GetConnectionSuggestions(ctx, db.GetConnectionSuggestionsParams{
		RequesterID: userID,
		Limit:       20,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": suggestions})
}

func (server *Server) searchPeople(ctx *gin.Context) {
	q := ctx.Query("q")
	if q == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "query parameter q is required"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	people, err := queries.SearchPeople(ctx, db.SearchPeopleParams{
		Column1: &q,
		Limit:   20,
		Offset:  0,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": people})
}

// ==================== REPORTS & MODERATION ====================

func (server *Server) createCampusReport(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		TargetType  string  `json:"target_type" binding:"required"`
		TargetID    string  `json:"target_id" binding:"required"`
		Reason      string  `json:"reason" binding:"required"`
		Description *string `json:"description"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetID, err := uuid.Parse(req.TargetID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid target ID"})
		return
	}

	report, err := queries.CreateCampusReport(ctx, db.CreateCampusReportParams{
		ReporterID:  userID,
		TargetType:  req.TargetType,
		TargetID:    targetID,
		Reason:      req.Reason,
		Description: req.Description,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": report})
}

func (server *Server) listCampusReports(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	statusFilter := ctx.Query("status")

	reports, err := queries.ListCampusReports(ctx, &statusFilter)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": reports})
}

func (server *Server) updateCampusReportStatus(ctx *gin.Context) {
	reportID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var req struct {
		Status      string  `json:"status" binding:"required"`
		ActionTaken *string `json:"action_taken"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reviewedByUUID := pgtype.UUID{Bytes: userID, Valid: true}

	if err := queries.UpdateCampusReportStatus(ctx, db.UpdateCampusReportStatusParams{
		ID:          reportID,
		Status:      db.ReportStatus(req.Status),
		ReviewedBy:  reviewedByUUID,
		ActionTaken: req.ActionTaken,
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "report updated"})
}

func (server *Server) createConnectionStrikeHandler(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	userID := getUserID(ctx)

	var req struct {
		TargetUserID string `json:"target_user_id" binding:"required"`
		Reason       string `json:"reason" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetID, err := uuid.Parse(req.TargetUserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	strikeCount, _ := queries.GetUserStrikeCount(ctx, targetID)
	newStrikeNum := strikeCount + 1

	_, err = queries.CreateConnectionStrike(ctx, db.CreateConnectionStrikeParams{
		UserID:       targetID,
		Reason:       req.Reason,
		StrikeNumber: int32(newStrikeNum),
		IssuedBy:     pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"message": "strike issued", "strike_number": newStrikeNum})
}

// ==================== POST BOOKMARKS ====================

func (server *Server) togglePostBookmark(ctx *gin.Context) {
	userID := getUserID(ctx)
	postID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid post ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	bookmarked, _ := queries.IsPostBookmarked(ctx, db.IsPostBookmarkedParams{UserID: userID, PostID: postID})
	if bookmarked {
		_ = queries.RemovePostBookmark(ctx, db.RemovePostBookmarkParams{UserID: userID, PostID: postID})
		ctx.JSON(http.StatusOK, gin.H{"bookmarked": false})
		return
	}

	_ = queries.CreatePostBookmark(ctx, db.CreatePostBookmarkParams{UserID: userID, PostID: postID})
	ctx.JSON(http.StatusOK, gin.H{"bookmarked": true})
}

func (server *Server) listUserBookmarks(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	posts, err := queries.ListUserBookmarks(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": posts})
}
