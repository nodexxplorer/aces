package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ─── CRF signing ───
// The admin uploads each authorized signer's signature image; the student
// then uploads their own course registration form PDF, drags/aligns each
// signature onto it (the signing area differs per form version/year), checks
// the stamped preview, and approves. The server only stamps after approval,
// using the placements the student saved.

var crfSignatureKinds = map[string]bool{"hod": true, "exam_officer": true}

var signatureImageExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true}

// uploadCRFSignatureAsset POST /crf-signatures/:kind — hod/admin/delegated_admin.
// multipart/form-data: file (PNG/JPEG, background auto-removed).
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "a signature image is required"})
		return
	}
	defer file.Close()

	if !signatureImageExts[strings.ToLower(filepath.Ext(header.Filename))] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "signature must be a PNG or JPEG image"})
		return
	}

	rawBytes, err := io.ReadAll(file)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Strip the paper background, keeping the ink — see ExtractSignature.
	extracted, err := utils.ExtractSignature(rawBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "could not process this image — is it a valid PNG or JPEG?"})
		return
	}

	savedPath, err := server.storage.SaveBytes(extracted, "crf-signatures", ".png")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	asset, err := queries.UpsertCRFSignatureAsset(ctx, db.UpsertCRFSignatureAssetParams{
		Kind:       kind,
		FilePath:   savedPath,
		UploadedBy: getUserID(ctx),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, asset)
}

// deleteCRFSignatureAsset DELETE /crf-signatures/:kind — hod/admin/delegated_admin.
func (server *Server) deleteCRFSignatureAsset(ctx *gin.Context) {
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

	if err := queries.DeleteCRFSignatureAsset(ctx, kind); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "signature removed"})
}

// listCRFSignatureAssets GET /crf-signatures — public to authenticated users
// (students need the signature image URLs to render them on the placement
// canvas), but only the image path is exposed, never anything sensitive.
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

// uploadCRF POST /crf-signing/upload — student. Stores the raw PDF as a
// draft submission and returns the draft; signing happens client-side next.
func (server *Server) uploadCRF(ctx *gin.Context) {
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

	if student, err := server.store.GetStudentByUserId(ctx, userID); err == nil {
		if server.blockOnUnpaidDues(ctx, student, "your course form can be signed") {
			return
		}
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

	originalPath, err := server.storage.SaveFile(header, "crf-signing/original")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	submission, err := queries.CreateCRFSigningSubmission(ctx, userID, semester.ID, originalPath)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, submission)
}

// saveCRFPlacements PUT /crf-signing/:id/placements — student. Persists the
// per-signer alignment the student made on their own form.
func (server *Server) saveCRFPlacements(ctx *gin.Context) {
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

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	submission, err := queries.GetCRFSigningSubmission(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if submission.UserID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if submission.Status != "draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "this submission has already been approved"})
		return
	}

	var req struct {
		Placements db.CRFPlacements `json:"placements" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "placements is required"})
		return
	}

	// Every placement must reference a signature the admin has configured —
	// a student can't invent a signer kind.
	assets, err := queries.ListCRFSignatureAssets(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	known := map[string]bool{}
	for _, a := range assets {
		known[a.Kind] = true
	}
	for kind := range req.Placements {
		if !crfSignatureKinds[kind] || !known[kind] {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("no %s signature is configured yet", kind)})
			return
		}
		p := req.Placements[kind]
		if p.Page < 1 || p.X < 0 || p.Y < 0 || p.Width <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("%s placement is out of range", kind)})
			return
		}
	}

	updated, err := queries.SaveCRFPlacements(ctx, id, req.Placements)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, updated)
}

// listMyCRFDrafts GET /crf-signing/drafts — the student's unfinished
// submissions (current-semester draft plus any backlog drafts), so a saved
// alignment can be resumed after a reload.
func (server *Server) listMyCRFDrafts(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	drafts, err := queries.ListCRFDraftsForUser(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, drafts)
}

// previewCRFSubmission POST /crf-signing/:id/preview — student. Stamps the
// stored original with the SAVED placements and returns the PDF for review,
// WITHOUT persisting the signed copy or finalizing the submission. The
// student only approves after seeing this result.
func (server *Server) previewCRFSubmission(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	submission, err := queries.GetCRFSigningSubmission(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if submission.UserID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if len(submission.Placements) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "place at least one signature on your form first"})
		return
	}

	pdfBytes, err := os.ReadFile(server.storage.GetFullPath(submission.OriginalFilePath))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	placementsJSON, err := json.Marshal(submission.Placements)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stamped, err := server.stampCRFPDFWithPlacements(ctx, queries, pdfBytes, string(placementsJSON))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.Data(http.StatusOK, "application/pdf", stamped)
}

// approveCRF POST /crf-signing/:id/approve — student. Stamps the stored
// original with the saved placements, stores the signed copy, and finalizes
// the submission (one upload per semester).
func (server *Server) approveCRF(ctx *gin.Context) {
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

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	submission, err := queries.GetCRFSigningSubmission(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if submission.UserID != userID {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if submission.Status != "draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "this submission has already been approved"})
		return
	}
	if len(submission.Placements) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "place at least one signature on your form before approving"})
		return
	}

	// Re-check dues at approve time too — a student could have accrued new
	// unpaid dues between upload and approve.
	if student, err := server.store.GetStudentByUserId(ctx, userID); err == nil {
		if server.blockOnUnpaidDues(ctx, student, "your course form can be signed") {
			return
		}
	}

	pdfBytes, err := os.ReadFile(server.storage.GetFullPath(submission.OriginalFilePath))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	placementsJSON, err := json.Marshal(submission.Placements)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stamped, err := server.stampCRFPDFWithPlacements(ctx, queries, pdfBytes, string(placementsJSON))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	signedPath, err := server.storage.SaveBytes(stamped, "crf-signing/signed", ".pdf")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	final, err := queries.ApproveCRFSigningSubmission(ctx, id, signedPath)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, final)
}

// getMyCRFSubmission GET /crf-signing/mine — the student's current-semester
// submission if any (draft or completed); the page branches on status.
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

// getCRFOriginal GET /crf-signing/:id/original — the student's stored
// UNSTAMPED form PDF, streamed for the placement canvas (drafts have no
// signed copy to download yet).
func (server *Server) getCRFOriginal(ctx *gin.Context) {
	userID := getUserID(ctx)
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}

	submission, err := queries.GetCRFSigningSubmission(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	if submission.UserID != userID && !isStaffRole(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	pdfBytes, err := os.ReadFile(server.storage.GetFullPath(submission.OriginalFilePath))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// downloadCRFSubmission GET /crf-signing/:id/download — the submitting
// student, or hod/admin/delegated_admin.
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

	if submission.Status != "completed" || submission.SignedFilePath == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "this submission hasn't been approved yet"})
		return
	}

	ctx.Redirect(http.StatusFound, fmt.Sprintf("/uploads/%s", submission.SignedFilePath))
}

// Department stamp overlay sizing. The stamp is rendered as a 500x320 PNG
// and placed over each student-positioned signature at ~130pt wide
// (~83pt tall), slightly larger than the signature underneath it.
const (
	deptStampPxW      = 500
	deptStampPxH      = 320
	deptStampWidthPt  = 130.0
	deptStampHeightPt = 84.0
)

// stampCRFPDFWithPlacements applies each configured signature image at the
// placements the student chose. placementsJSON is the raw
// db.CRFPlacements JSON (already validated/owned by the caller where it
// matters); only kinds with an uploaded signature asset are stamped.
func (server *Server) stampCRFPDFWithPlacements(ctx context.Context, queries *db.Queries, pdfBytes []byte, placementsJSON string) ([]byte, error) {
	var placements db.CRFPlacements
	if err := json.Unmarshal([]byte(placementsJSON), &placements); err != nil {
		return nil, fmt.Errorf("invalid placements payload")
	}
	if len(placements) == 0 {
		return nil, fmt.Errorf("place at least one signature on your form before approving")
	}

	assets, err := queries.ListCRFSignatureAssets(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not load signature assets")
	}
	assetByKind := make(map[string]db.CRFSignatureAsset, len(assets))
	for _, a := range assets {
		assetByKind[a.Kind] = a
	}

	stamps := make([]utils.SignatureStamp, 0, len(placements))
	for kind, p := range placements {
		asset, ok := assetByKind[kind]
		if !ok {
			continue // configured after the draft was saved — skip silently
		}
		stamp := utils.SignatureStamp{
			ImagePath: server.storage.GetFullPath(asset.FilePath),
			Page:      int(p.Page),
			X:         p.X,
			Y:         p.Y,
			Width:     p.Width,
			MaxHeight: p.MaxHeight,
		}
		if p.ShowDate && p.DateX != nil && p.DateY != nil {
			stamp.ShowDate = true
			stamp.DateX = *p.DateX
			stamp.DateY = *p.DateY
			stamp.DateFontSize = p.DateFontSize
		}
		stamps = append(stamps, stamp)
	}
	if len(stamps) == 0 {
		return nil, fmt.Errorf("none of the placed signatures are configured anymore — contact the department office")
	}

	// Department stamp: rendered once in memory (blue, with the University
	// of Uyo logo in the middle) and layered on top of every placed
	// signature. pdfcpu draws a page's watermarks in the order they were
	// added, so appending these after the signature stamps puts the
	// department stamp above the signature ink.
	stampPNG, err := utils.DeptStampPNG(deptStampPxW, deptStampPxH, utils.DefaultConfig())
	if err != nil {
		return nil, fmt.Errorf("could not render department stamp")
	}
	sigCount := len(stamps)
	for i := 0; i < sigCount; i++ {
		sig := stamps[i]
		// Share the signature's bottom edge; centre over it when the
		// signature is wider than the stamp.
		stampX := sig.X
		if sig.Width > deptStampWidthPt {
			stampX = sig.X + (sig.Width-deptStampWidthPt)/2
		}
		stamps = append(stamps, utils.SignatureStamp{
			ImageData: stampPNG,
			Page:      sig.Page,
			X:         stampX,
			Y:         sig.Y,
			Width:     deptStampWidthPt,
			MaxHeight: deptStampHeightPt,
		})
	}

	stamped, err := utils.StampSignatures(pdfBytes, stamps)
	if err != nil {
		return nil, fmt.Errorf("could not sign this PDF — is it a valid, unencrypted file?")
	}
	return stamped, nil
}
