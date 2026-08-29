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

// ─── CRF signing 

var crfSignatureKinds = map[string]bool{"hod": true, "exam_officer": true}


var signatureImageExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true}


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

	var req struct {
		PageNumber   int32    `form:"page_number"`
		X            float64  `form:"x_pt" binding:"required"`
		Y            float64  `form:"y_pt" binding:"required"`
		Width        float64  `form:"width_pt" binding:"required"`
		MaxHeight    float64  `form:"max_height_pt"`
		ShowDate     bool     `form:"show_date"`
		DateX        *float64 `form:"date_x_pt"`
		DateY        *float64 `form:"date_y_pt"`
		DateFontSize float64  `form:"date_font_size"`
	}
	if err := ctx.ShouldBind(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "x_pt, y_pt, and width_pt are required"})
		return
	}
	if req.PageNumber <= 0 {
		req.PageNumber = 1
	}
	if req.DateFontSize <= 0 {
		req.DateFontSize = 10
	}

	savedPath := ""
	file, header, err := ctx.Request.FormFile("file")
	if err == nil {
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

		
		extracted, err := utils.ExtractSignature(rawBytes)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "could not process this image — is it a valid PNG or JPEG?"})
			return
		}

		savedPath, err = server.storage.SaveBytes(extracted, "crf-signatures", ".png")
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
	} else {
		existing, existErr := queries.GetCRFSignatureAsset(ctx, kind)
		if existErr != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "a signature image is required the first time you configure this"})
			return
		}
		savedPath = existing.FilePath
	}

	asset, err := queries.UpsertCRFSignatureAsset(ctx, db.UpsertCRFSignatureAssetParams{
		Kind:         kind,
		FilePath:     savedPath,
		PageNumber:   req.PageNumber,
		XPt:          req.X,
		YPt:          req.Y,
		WidthPt:      req.Width,
		MaxHeightPt:  req.MaxHeight,
		ShowDate:     req.ShowDate,
		DateXPt:      req.DateX,
		DateYPt:      req.DateY,
		DateFontSize: req.DateFontSize,
		UploadedBy:   getUserID(ctx),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, asset)
}


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

	if student, err := server.store.GetStudentByUserId(ctx, userID); err == nil {
		if unpaid, err := unpaidRequiredDues(ctx, server.store, student.ID, student.Level); err == nil && len(unpaid) > 0 {
			ctx.JSON(http.StatusForbidden, gin.H{
				"error":       "you must pay your outstanding dues before your course form can be signed",
				"unpaid_dues": unpaid,
			})
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
		stamp := utils.SignatureStamp{
			ImagePath: server.storage.GetFullPath(a.FilePath),
			Page:      int(a.PageNumber),
			X:         a.XPt,
			Y:         a.YPt,
			Width:     a.WidthPt,
			MaxHeight: a.MaxHeightPt,
		}
		if a.ShowDate && a.DateXPt != nil && a.DateYPt != nil {
			stamp.ShowDate = true
			stamp.DateX = *a.DateXPt
			stamp.DateY = *a.DateYPt
			stamp.DateFontSize = a.DateFontSize
		}
		stamps = append(stamps, stamp)
	}

	stamped, err := utils.StampSignatures(pdfBytes, stamps)
	if err != nil {
		return nil, fmt.Errorf("could not sign this PDF — is it a valid, unencrypted file?")
	}
	return stamped, nil
}
