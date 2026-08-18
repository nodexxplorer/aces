package api

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── CRF signing ────────────────────────────────────────────────────────────
// A standalone document-signing utility: an HOD/admin uploads and calibrates
// two signature images (HOD, Exam Officer); any student can then upload
// their own course registration form PDF, once per semester, and get back a
// copy with both signatures stamped on at the calibrated position. This has
// no connection to the app's own course-registration data — it only reads
// and stamps an already-generated PDF.

var crfSignatureKinds = map[string]bool{"hod": true, "exam_officer": true}

var signatureImageExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true}

// uploadCRFSignatureAsset POST /crf-signatures/:kind
// hod/admin/delegated_admin only. Uploads or replaces the signature image
// for the given kind, plus its calibrated placement on the page.
func (server *Server) uploadCRFSignatureAsset(ctx *gin.Context) {
	kind := ctx.Param("kind")
	if !crfSignatureKinds[kind] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature kind"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "signature image is required"})
		return
	}
	defer file.Close()

	if !signatureImageExts[strings.ToLower(filepath.Ext(header.Filename))] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "signature must be a PNG, JPEG, or WEBP image"})
		return
	}

	var req struct {
		PageNumber int32   `form:"page_number"`
		X          float64 `form:"x_pt" binding:"required"`
		Y          float64 `form:"y_pt" binding:"required"`
		Width      float64 `form:"width_pt" binding:"required"`
	}
	if err := ctx.ShouldBind(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "x_pt, y_pt, and width_pt are required"})
		return
	}
	if req.PageNumber <= 0 {
		req.PageNumber = 1
	}

	savedPath, err := server.storage.SaveFile(header, "crf-signatures")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	asset, err := queries.UpsertCRFSignatureAsset(ctx, kind, savedPath, req.PageNumber, req.X, req.Y, req.Width, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, asset)
}

// listCRFSignatureAssets GET /crf-signatures
// hod/admin/delegated_admin only.
func (server *Server) listCRFSignatureAssets(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	assets, err := queries.ListCRFSignatureAssets(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, assets)
}

// testStampCRF POST /crf-signatures/test-stamp
// hod/admin/delegated_admin only. Applies whatever signature assets are
// currently configured to a sample PDF and returns the stamped result
// directly — used to preview calibration before it goes live for students.
// Does not touch crf_signing_submissions, so it never counts against any
// student's one-per-semester slot.
func (server *Server) testStampCRF(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "sample PDF is required"})
		return
	}
	defer file.Close()

	if strings.ToLower(filepath.Ext(header.Filename)) != ".pdf" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file must be a PDF"})
		return
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stamped, err := server.stampCRFPDF(ctx, queries, pdfBytes)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.Data(http.StatusOK, "application/pdf", stamped)
}

// submitCRFForSigning POST /crf-signing/upload
// Any authenticated student — one submission per semester, enforced by the
// unique(user_id, semester_id) constraint on crf_signing_submissions.
func (server *Server) submitCRFForSigning(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	semester, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "no active semester"})
		return
	}

	if _, err := queries.GetCRFSubmissionForUserSemester(ctx, userID, semester.ID); err == nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "you've already uploaded your course form for this semester"})
		return
	}

	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "course form PDF is required"})
		return
	}
	defer file.Close()

	if strings.ToLower(filepath.Ext(header.Filename)) != ".pdf" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "file must be a PDF"})
		return
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stamped, err := server.stampCRFPDF(ctx, queries, pdfBytes)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// SaveFile opens its own fresh reader via header.Open() rather than
	// reusing `file`, so consuming `file` above into pdfBytes doesn't affect
	// this — safe to save the original after already having read it.
	originalPath, err := server.storage.SaveFile(header, "crf-signing/original")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	signedPath, err := server.storage.SaveBytes(stamped, "crf-signing/signed", ".pdf")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	submission, err := queries.CreateCRFSigningSubmission(ctx, userID, semester.ID, originalPath, signedPath)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, submission)
}

// getMyCRFSubmission GET /crf-signing/mine
// Returns the caller's submission for the active semester, if any.
func (server *Server) getMyCRFSubmission(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	semester, err := server.store.GetActiveSemester(ctx)
	if err != nil {
		ctx.JSON(http.StatusOK, nil)
		return
	}

	submission, err := queries.GetCRFSubmissionForUserSemester(ctx, userID, semester.ID)
	if err != nil {
		ctx.JSON(http.StatusOK, nil)
		return
	}

	ctx.JSON(http.StatusOK, submission)
}

// downloadCRFSubmission GET /crf-signing/:id/download
// The submitting student, or hod/admin/delegated_admin.
func (server *Server) downloadCRFSubmission(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	submission, err := queries.GetCRFSigningSubmission(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}

	if submission.UserID != getUserID(ctx) && !isStaffRole(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	ctx.Redirect(http.StatusFound, fmt.Sprintf("/uploads/%s", submission.SignedFilePath))
}

// stampCRFPDF loads the currently configured signature assets and stamps
// them all onto pdfBytes.
func (server *Server) stampCRFPDF(ctx *gin.Context, queries *db.Queries, pdfBytes []byte) ([]byte, error) {
	assets, err := queries.ListCRFSignatureAssets(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not load signature assets")
	}
	if len(assets) == 0 {
		return nil, fmt.Errorf("no signatures have been configured yet")
	}

	stamps := make([]utils.SignatureStamp, 0, len(assets))
	for _, a := range assets {
		stamps = append(stamps, utils.SignatureStamp{
			ImagePath: server.storage.GetFullPath(a.FilePath),
			Page:      int(a.PageNumber),
			X:         a.XPt,
			Y:         a.YPt,
			Width:     a.WidthPt,
		})
	}

	stamped, err := utils.StampSignatures(pdfBytes, stamps)
	if err != nil {
		return nil, fmt.Errorf("could not sign this PDF — is it a valid, unencrypted file?")
	}
	return stamped, nil
}
