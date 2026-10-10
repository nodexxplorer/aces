package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/aces/backend/internal/tenant"
)

// The sign-in and sign-up look: one of three templates per department, and the
// hero image an admin uploads for the templates that use one. The web app and
// the mobile app both read it, from the public endpoints below, before anyone
// has signed in. Only admins change it. Storage and limits: migration 000013.

const (
	loginTemplateClassic  = "classic"
	loginTemplateSplit    = "split"
	loginTemplateCentered = "centered"
)

// loginTemplates lists the templates a department may choose. Classic is the
// default and needs no image; the others show the uploaded image, and fall
// back to the classic backdrop when none is uploaded.
var loginTemplates = map[string]bool{
	loginTemplateClassic:  true,
	loginTemplateSplit:    true,
	loginTemplateCentered: true,
}

// maxLoginImageBytes is the largest hero image accepted (4 MiB), matching the
// database limit. A little more is read so an oversized upload is detected.
const maxLoginImageBytes = 4 << 20

// loginImageTypes are the image types stored. The type is sniffed from the
// bytes, never taken from the file name. SVG is refused: an uploaded SVG can
// run script when opened.
var loginImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
}

// loginLook is a department's stored look. ImageType is empty when no image is
// uploaded.
type loginLook struct {
	Template  string
	ImageType string
	UpdatedAt time.Time
}

// loginLookResponse is what the sign-in pages, the mobile app and the Settings
// page read.
type loginLookResponse struct {
	Template string `json:"template"`
	// ImageURL is the API path of the hero image (with a version, so a replaced
	// image is not served from cache). Absent when no image is uploaded.
	ImageURL string `json:"imageUrl,omitempty"`
}

// readLoginLook returns the bound department's look. A department with no row
// has the classic template and no image.
func readLoginLook(ctx context.Context, db *tenant.DB) (loginLook, error) {
	look := loginLook{Template: loginTemplateClassic}
	err := db.QueryRow(ctx,
		`SELECT template, COALESCE(hero_type, ''), updated_at FROM department_login_looks`,
	).Scan(&look.Template, &look.ImageType, &look.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return look, nil
	}
	return look, err
}

// loginLookBody builds the response for a look, with the image path for the
// given department slug.
func loginLookBody(slug string, look loginLook) loginLookResponse {
	resp := loginLookResponse{Template: look.Template}
	if look.ImageType != "" {
		resp.ImageURL = fmt.Sprintf("/api/v1/tenants/%s/login-image?v=%d", slug, look.UpdatedAt.Unix())
	}
	return resp
}

// tenantLoginLook GET /tenants/:slug/login-look is public: the sign-in pages
// read it before anyone has signed in. An unknown or inactive department gets
// 404.
func (server *Server) tenantLoginLook(ctx *gin.Context) {
	slug := ctx.Param("slug")
	bound, err := server.bindTenantSlug(ctx.Request.Context(), slug)
	if errors.Is(err, tenant.ErrNotFound) || errors.Is(err, tenant.ErrInactive) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "unknown department"})
		return
	}
	if err != nil {
		log.Printf("[login-look] bind %q: %v", slug, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	look, err := readLoginLook(bound, server.dbPool)
	if err != nil {
		log.Printf("[login-look] read %q: %v", slug, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.Header("Cache-Control", "public, max-age=60")
	ctx.JSON(http.StatusOK, loginLookBody(slug, look))
}

// tenantLoginImage GET /tenants/:slug/login-image serves the hero image. Like
// the logo, it is public and carries no script: the image bytes only.
func (server *Server) tenantLoginImage(ctx *gin.Context) {
	slug := ctx.Param("slug")
	bound, err := server.bindTenantSlug(ctx.Request.Context(), slug)
	if errors.Is(err, tenant.ErrNotFound) || errors.Is(err, tenant.ErrInactive) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no image for this department"})
		return
	}
	if err != nil {
		log.Printf("[login-image] bind %q: %v", slug, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	var imageType string
	var data []byte
	err = server.dbPool.QueryRow(bound,
		`SELECT hero_type, hero FROM department_login_looks WHERE hero IS NOT NULL`,
	).Scan(&imageType, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no image for this department"})
		return
	}
	if err != nil {
		log.Printf("[login-image] read %q: %v", slug, err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	h := ctx.Writer.Header()
	h.Set("Cache-Control", "public, max-age=300")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	ctx.Data(http.StatusOK, imageType, data)
}

// myLoginLook GET /department/login-look is for any signed-in user: the
// Settings page reads the department's own look through it.
func (server *Server) myLoginLook(ctx *gin.Context) {
	look, err := readLoginLook(ctx.Request.Context(), server.dbPool)
	if err != nil {
		log.Printf("[login-look] read own: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	ctx.JSON(http.StatusOK, loginLookBody(tenantSlugOf(ctx), look))
}

// tenantSlugOf is the bound department's slug, or empty when none is bound.
func tenantSlugOf(ctx *gin.Context) string {
	t, ok := tenant.From(ctx.Request.Context())
	if !ok {
		return ""
	}
	return t.Slug
}

// updateLoginTemplate PUT /department/login-look (admin) sets the template.
// The image, if any, is kept: switching templates does not discard it.
func (server *Server) updateLoginTemplate(ctx *gin.Context) {
	var body struct {
		Template string `json:"template"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil || !loginTemplates[body.Template] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "template must be classic, split or centered"})
		return
	}
	reqCtx := ctx.Request.Context()
	_, err := server.dbPool.Exec(reqCtx,
		`INSERT INTO department_login_looks (template, updated_by, updated_at)
		 VALUES ($1, $2, now())
		 ON CONFLICT (tenant_id) DO UPDATE
		   SET template = EXCLUDED.template, updated_by = EXCLUDED.updated_by, updated_at = now()`,
		body.Template, getUserID(ctx),
	)
	if err != nil {
		log.Printf("[login-look] save template: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	server.myLoginLook(ctx)
}

// uploadLoginImage PUT /department/login-image (admin) stores the hero image
// from the multipart field "file". The type is sniffed from the bytes, and the
// size is limited to 4 MiB.
func (server *Server) uploadLoginImage(ctx *gin.Context) {
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, maxLoginImageBytes+64<<10)
	file, _, err := ctx.Request.FormFile("file")
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			ctx.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "the image must be 4 MB or smaller"})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "an image is required (PNG, JPEG or WebP, up to 4 MB)"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxLoginImageBytes+1))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "could not read the image"})
		return
	}
	if len(data) > maxLoginImageBytes {
		ctx.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "the image must be 4 MB or smaller"})
		return
	}
	imageType := http.DetectContentType(data)
	if !loginImageTypes[imageType] {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "the image must be a PNG, JPEG or WebP file"})
		return
	}

	_, err = server.dbPool.Exec(ctx.Request.Context(),
		`INSERT INTO department_login_looks (hero, hero_type, updated_by, updated_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (tenant_id) DO UPDATE
		   SET hero = EXCLUDED.hero, hero_type = EXCLUDED.hero_type,
		       updated_by = EXCLUDED.updated_by, updated_at = now()`,
		data, imageType, getUserID(ctx),
	)
	if err != nil {
		log.Printf("[login-look] save image: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	server.myLoginLook(ctx)
}

// removeLoginImage DELETE /department/login-image (admin) clears the image. The
// template is kept, so a template that needs an image falls back to classic.
func (server *Server) removeLoginImage(ctx *gin.Context) {
	_, err := server.dbPool.Exec(ctx.Request.Context(),
		`UPDATE department_login_looks
		    SET hero = NULL, hero_type = NULL, updated_by = $1, updated_at = now()`,
		getUserID(ctx),
	)
	if err != nil {
		log.Printf("[login-look] remove image: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	server.myLoginLook(ctx)
}
