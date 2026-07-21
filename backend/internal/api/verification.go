package api

import (
	"net/http"
	"strconv"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func levenshteinDistance(a, b string) int {
	la := len(a)
	lb := len(b)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}
	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			curr[j] = min(curr[j-1]+1, min(prev[j]+1, prev[j-1]+cost))
		}
		prev, curr = curr, prev
	}
	return prev[lb]
}

func stringSimilarity(a, b string) float32 {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	if a == b {
		return 1.0
	}
	maxLen := len(a)
	if len(b) > maxLen {
		maxLen = len(b)
	}
	if maxLen == 0 {
		return 1.0
	}
	dist := levenshteinDistance(a, b)
	return float32(1.0-float64(dist)/float64(maxLen))
}

func (s *Server) lookupMatric(ctx *gin.Context) {
	var req struct {
		MatricNumber string `json:"matric_number" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "matric_number is required"})
		return
	}

	queries := s.store.(*db.Queries)
	record, err := queries.GetVerificationRecordByMatric(ctx, req.MatricNumber)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "verification record not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"record": record})
}

func (s *Server) verifyMatricForSignup(ctx *gin.Context) {
	var req struct {
		MatricNumber string `json:"matric_number" binding:"required"`
		FullName     string `json:"full_name" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "matric_number and full_name are required"})
		return
	}

	queries := s.store.(*db.Queries)
	record, err := queries.GetVerificationRecordByMatric(ctx, req.MatricNumber)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "verification record not found"})
		return
	}

	matchConfidence := stringSimilarity(record.FullName, req.FullName)

	ctx.JSON(http.StatusOK, gin.H{
		"match_confidence":  matchConfidence,
		"verification_id":   record.ID,
		"verified_name":     record.FullName,
		"matric_number":     record.MatricNumber,
		"department":        record.Department,
		"level":             record.Level,
		"entry_session":     record.EntrySession,
	})
}

func (s *Server) bulkUploadVerificationRecords(ctx *gin.Context) {
	var req struct {
		Records []struct {
			MatricNumber string `json:"matric_number" binding:"required"`
			FullName     string `json:"full_name" binding:"required"`
			Level        int32  `json:"level" binding:"required"`
			EntrySession string `json:"entry_session" binding:"required"`
			Department   string `json:"department" binding:"required"`
			Status       string `json:"status"`
		} `json:"records" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "records array is required"})
		return
	}

	if len(req.Records) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "records array cannot be empty"})
		return
	}

	matricNumbers := make([]string, len(req.Records))
	fullNames := make([]string, len(req.Records))
	levels := make([]int32, len(req.Records))
	entrySessions := make([]string, len(req.Records))
	departments := make([]string, len(req.Records))
	statuses := make([]string, len(req.Records))

	for i, r := range req.Records {
		matricNumbers[i] = r.MatricNumber
		fullNames[i] = r.FullName
		levels[i] = r.Level
		entrySessions[i] = r.EntrySession
		departments[i] = r.Department
		if r.Status == "" {
			statuses[i] = "pending"
		} else {
			statuses[i] = r.Status
		}
	}

	queries := s.store.(*db.Queries)
	err := queries.BulkCreateVerificationRecords(ctx, db.BulkCreateVerificationRecordsParams{
		Column1: matricNumbers,
		Column2: fullNames,
		Column3: levels,
		Column4: entrySessions,
		Column5: departments,
		Column6: statuses,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to bulk create records"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"records_created": len(matricNumbers)})
}

func (s *Server) listVerificationRecords(ctx *gin.Context) {
	search := ctx.Query("search")
	levelStr := ctx.Query("level")
	status := ctx.Query("status")
	limitStr := ctx.DefaultQuery("limit", "50")
	offsetStr := ctx.DefaultQuery("offset", "0")

	var level int32
	if levelStr != "" {
		if l, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			level = int32(l)
		}
	}

	limit, err := strconv.ParseInt(limitStr, 10, 32)
	if err != nil {
		limit = 50
	}
	offset, err := strconv.ParseInt(offsetStr, 10, 32)
	if err != nil {
		offset = 0
	}

	queries := s.store.(*db.Queries)
	records, err := queries.ListVerificationRecords(ctx, db.ListVerificationRecordsParams{
		Column1: search,
		Column2: level,
		Column3: status,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list records"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"records": records})
}

func (s *Server) updateVerificationRecord(ctx *gin.Context) {
	idStr := ctx.Param("id")
	recordID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid record id"})
		return
	}

	var req struct {
		FullName     *string `json:"full_name"`
		Level        *int32  `json:"level"`
		EntrySession *string `json:"entry_session"`
		Status       *string `json:"status"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	queries := s.store.(*db.Queries)
	existing, err := queries.GetVerificationRecordByMatric(ctx, "")
	if err != nil {
		existing.FullName = ""
	}

	fullName := ""
	if req.FullName != nil {
		fullName = *req.FullName
	} else {
		fullName = existing.FullName
	}
	level := existing.Level
	if req.Level != nil {
		level = *req.Level
	}
	entrySession := existing.EntrySession
	if req.EntrySession != nil {
		entrySession = *req.EntrySession
	}
	statusVal := existing.Status
	if req.Status != nil {
		statusVal = *req.Status
	}

	err = queries.UpdateVerificationRecord(ctx, db.UpdateVerificationRecordParams{
		ID:           recordID,
		FullName:     fullName,
		Level:        level,
		EntrySession: entrySession,
		Status:       statusVal,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update record"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "record updated"})
}

func (s *Server) listUnverifiedStudents(ctx *gin.Context) {
	queries := s.store.(*db.Queries)
	students, err := queries.GetUnverifiedStudents(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch unverified students"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"students": students})
}

func (s *Server) createStudentOnboarding(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req struct {
		MatricNumber string  `json:"matric_number" binding:"required"`
		Email        *string `json:"email"`
		Phone        *string `json:"phone"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "matric_number is required"})
		return
	}

	queries := s.store.(*db.Queries)

	verificationRecord, err := queries.GetVerificationRecordByMatric(ctx, req.MatricNumber)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "matric number not found in verification records"})
		return
	}

	verificationRecordID := pgtype.UUID{
		Bytes: verificationRecord.ID,
		Valid: true,
	}

	matchConfidence := float32(1.0)

	onboarding, err := queries.CreateStudentOnboarding(ctx, db.CreateStudentOnboardingParams{
		UserID:               userID,
		MatricNumber:         req.MatricNumber,
		VerificationRecordID: verificationRecordID,
		MatchConfidence:      &matchConfidence,
		SubmittedEmail:       req.Email,
		SubmittedPhone:       req.Phone,
		Status:               "pending",
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create onboarding request"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"onboarding": onboarding})
}

func (s *Server) getStudentOnboarding(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries := s.store.(*db.Queries)
	onboarding, err := queries.GetStudentOnboardingByUserID(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "onboarding record not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"onboarding": onboarding})
}

func (s *Server) listStudentOnboardings(ctx *gin.Context) {
	status := ctx.Query("status")
	levelStr := ctx.Query("level")
	limitStr := ctx.DefaultQuery("limit", "50")
	offsetStr := ctx.DefaultQuery("offset", "0")

	var statusVal *string
	if status != "" {
		statusVal = &status
	}

	var level int32
	if levelStr != "" {
		if l, err := strconv.ParseInt(levelStr, 10, 32); err == nil {
			level = int32(l)
		}
	}

	limit, err := strconv.ParseInt(limitStr, 10, 32)
	if err != nil {
		limit = 50
	}
	offset, err := strconv.ParseInt(offsetStr, 10, 32)
	if err != nil {
		offset = 0
	}

	queries := s.store.(*db.Queries)
	onboardings, err := queries.ListStudentOnboardings(ctx, db.ListStudentOnboardingsParams{
		Column1: statusVal,
		Column2: level,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list onboardings"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"onboardings": onboardings})
}

func (s *Server) updateStudentOnboardingStatus(ctx *gin.Context) {
	idStr := ctx.Param("id")
	onboardingID, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid onboarding id"})
		return
	}

	reviewerID := getUserID(ctx)

	var req struct {
		Status          string  `json:"status" binding:"required"`
		RejectionReason *string `json:"rejection_reason"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}

	queries := s.store.(*db.Queries)
	err = queries.UpdateStudentOnboardingStatus(ctx, db.UpdateStudentOnboardingStatusParams{
		ID:              onboardingID,
		Status:          req.Status,
		ReviewedBy:      pgtype.UUID{Bytes: reviewerID, Valid: true},
		RejectionReason: req.RejectionReason,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update onboarding status"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "onboarding status updated"})
}

func (s *Server) countStudentOnboardingsByStatus(ctx *gin.Context) {
	queries := s.store.(*db.Queries)
	counts, err := queries.CountStudentOnboardingsByStatus(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count onboardings"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"counts": counts})
}

func (s *Server) bulkApproveStudentOnboardings(ctx *gin.Context) {
	reviewerID := getUserID(ctx)

	var req struct {
		IDs []string `json:"ids" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ids array is required"})
		return
	}

	if len(req.IDs) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ids array cannot be empty"})
		return
	}

	ids := make([]uuid.UUID, len(req.IDs))
	for i, idStr := range req.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id: " + idStr})
			return
		}
		ids[i] = id
	}

	queries := s.store.(*db.Queries)
	err := queries.BulkApproveStudentOnboardings(ctx, db.BulkApproveStudentOnboardingsParams{
		Column1:    ids,
		ReviewedBy: pgtype.UUID{Bytes: reviewerID, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to bulk approve onboardings"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "onboardings approved successfully"})
}
