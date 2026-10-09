package api

import (
	"strings"
	"testing"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/uploads"
)

func newUploadLinkServer(t *testing.T) *Server {
	t.Helper()
	signer, err := uploads.NewSigner("test-secret-for-upload-links-0123456789", time.Hour)
	if err != nil {
		t.Fatalf("NewSigner: %v", err)
	}
	return &Server{uploads: signer}
}

func TestSignMaterialLinksSignsEachStoredPath(t *testing.T) {
	server := newUploadLinkServer(t)
	materials := []db.CourseMaterialWithCourse{
		{CourseMaterial: db.CourseMaterial{FileUrl: "course-materials/a.pdf"}},
		{CourseMaterial: db.CourseMaterial{FileUrl: ""}},
	}
	server.signMaterialLinks(materials)

	if !strings.HasPrefix(materials[0].FileUrl, "/uploads/course-materials/a.pdf?exp=") {
		t.Errorf("material link = %q", materials[0].FileUrl)
	}
	if materials[1].FileUrl != "" {
		t.Errorf("empty path became %q", materials[1].FileUrl)
	}
}

func TestSignAssetAndSubmissionLinksKeepEmptyPathsEmpty(t *testing.T) {
	server := newUploadLinkServer(t)

	asset := db.CRFSignatureAsset{FilePath: "crf-signatures/sig.png"}
	server.signAssetLinks(&asset)
	if !strings.HasPrefix(asset.FilePath, "/uploads/crf-signatures/sig.png?exp=") {
		t.Errorf("asset link = %q", asset.FilePath)
	}

	draft := db.CRFSigningSubmission{OriginalFilePath: "crf-signing/original/f.pdf"}
	server.signSubmissionLinks(&draft)
	if !strings.HasPrefix(draft.OriginalFilePath, "/uploads/crf-signing/original/f.pdf?exp=") {
		t.Errorf("original link = %q", draft.OriginalFilePath)
	}
	if draft.SignedFilePath != "" {
		t.Errorf("unsigned draft got a signed path: %q", draft.SignedFilePath)
	}
}

func TestSignedLinksVerifyAgainstTheServerSigner(t *testing.T) {
	server := newUploadLinkServer(t)
	link := server.uploads.SignStored("reports/r.pdf")
	path, query, found := strings.Cut(link, "?")
	if !found {
		t.Fatalf("no query in %q", link)
	}
	params := map[string]string{}
	for _, kv := range strings.Split(query, "&") {
		k, v, _ := strings.Cut(kv, "=")
		params[k] = v
	}
	if err := server.uploads.Verify(strings.TrimPrefix(path, uploads.Route), params["exp"], params["sig"]); err != nil {
		t.Errorf("server-issued link does not verify: %v", err)
	}
}

func TestServerWithoutSignerLeavesPathsUnsigned(t *testing.T) {
	server := &Server{}
	if got := server.uploads.SignStored("documents/d.pdf"); got != "/uploads/documents/d.pdf" {
		t.Errorf("no-signer link = %q", got)
	}
}
