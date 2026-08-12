package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

const MaxUploadSize = 50 << 20 // 50 MB

type LocalStorage struct {
	basePath string
}

func NewLocalStorage(basePath string) (*LocalStorage, error) {
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base upload directory: %w", err)
	}
	return &LocalStorage{basePath: basePath}, nil
}

func (s *LocalStorage) SaveFile(fileHeader *multipart.FileHeader, subDir string) (string, error) {
	if fileHeader.Size > MaxUploadSize {
		return "", fmt.Errorf("file size exceeds maximum allowed size of %d bytes", MaxUploadSize)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open upload file: %w", err)
	}
	defer file.Close()

	// Read first 512 bytes for content-type sniffing.
	buf := make([]byte, 512)
	n, _ := io.ReadAtLeast(file, buf, 1)
	contentType := http.DetectContentType(buf[:n])

	// Reset read position for full copy.
	if seeker, ok := file.(io.Seeker); ok {
		_, _ = seeker.Seek(0, io.SeekStart)
	}

	allowedTypes := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true,
		"application/pdf": true,
		"application/msword": true, "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"application/vnd.ms-excel": true, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		"application/vnd.ms-powerpoint": true, "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
		"text/plain": true,
	}
	// Modern Office formats (.docx/.xlsx/.pptx) are ZIP archives internally —
	// http.DetectContentType has no OOXML-specific signature, so it sniffs
	// them as "application/zip" (or "application/octet-stream") no matter
	// what their real MIME type is. Every such upload was silently rejected
	// here. Fall back to the file extension for exactly those two generic
	// sniffed types instead of trusting content-sniffing alone.
	allowedOfficeExt := map[string]bool{
		".docx": true, ".xlsx": true, ".pptx": true,
	}
	isGenericBinary := contentType == "application/zip" || contentType == "application/octet-stream"
	if n > 0 && !allowedTypes[contentType] {
		if !(isGenericBinary && allowedOfficeExt[filepath.Ext(fileHeader.Filename)]) {
			return "", fmt.Errorf("file type %s is not allowed", contentType)
		}
	}

	targetDir := filepath.Join(s.basePath, subDir)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create upload sub-directory: %w", err)
	}

	ext := filepath.Ext(fileHeader.Filename)
	uniqueName := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	targetPath := filepath.Join(targetDir, uniqueName)

	out, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create target file: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", fmt.Errorf("failed to copy file content: %w", err)
	}

	return filepath.Join(subDir, uniqueName), nil
}

func (s *LocalStorage) GetFullPath(relativePath string) string {
	return filepath.Join(s.basePath, relativePath)
}

func (s *LocalStorage) DeleteFile(relativePath string) error {
	fullPath := s.GetFullPath(relativePath)
	cleanBasePath, err := filepath.Abs(s.basePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute base path: %w", err)
	}

	cleanFullPath, err := filepath.Abs(fullPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute target path: %w", err)
	}

	if !filepath.HasPrefix(cleanFullPath, cleanBasePath) {
		return fmt.Errorf("unauthorized path access: path traversal detected")
	}

	if err := os.Remove(cleanFullPath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
