package storage

import (
	"fmt"
	"io"
	"mime/multipart"
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
