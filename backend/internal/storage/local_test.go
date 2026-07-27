package storage

import (
	"bytes"
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"
)

func makeFileHeader(data []byte, filename string) *multipart.FileHeader {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, _ := writer.CreateFormFile("file", filename)
	part.Write(data)
	writer.Close()

	// Parse the multipart body to get a proper FileHeader
	reader := multipart.NewReader(&buf, writer.Boundary())
	form, _ := reader.ReadForm(1 << 20)
	return form.File["file"][0]
}

func TestSaveFile_AllowedImage(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	// PNG header: 8-byte magic bytes
	png := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0}
	fh := makeFileHeader(png, "test.png")

	path, err := ls.SaveFile(fh, "images")
	if err != nil {
		t.Errorf("PNG should be allowed, got error: %v", err)
	}
	if path == "" {
		t.Error("expected non-empty path")
	}
}

func TestSaveFile_AllowPDF(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	pdf := []byte{0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34} // %PDF-1.4
	fh := makeFileHeader(pdf, "doc.pdf")

	path, err := ls.SaveFile(fh, "docs")
	if err != nil {
		t.Errorf("PDF should be allowed, got error: %v", err)
	}
	if path == "" {
		t.Error("expected non-empty path")
	}
}

func TestSaveFile_RejectExe(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	exe := []byte{0x4D, 0x5A, 0x90, 0x00} // MZ header (PE executable)
	fh := makeFileHeader(exe, "malware.exe")

	_, err := ls.SaveFile(fh, "uploads")
	if err == nil {
		t.Error("executable file should be rejected")
	}
}

func TestSaveFile_RejectScript(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	script := []byte("#!/bin/bash\necho hacked")
	fh := makeFileHeader(script, "evil.sh")

	_, err := ls.SaveFile(fh, "uploads")
	if err == nil {
		t.Error("shell script should be rejected")
	}
}

func TestNewLocalStorage(t *testing.T) {
	dir := t.TempDir()
	ls, err := NewLocalStorage(filepath.Join(dir, "uploads"))
	if err != nil {
		t.Fatalf("NewLocalStorage failed: %v", err)
	}

	info, err := os.Stat(filepath.Join(dir, "uploads"))
	if err != nil {
		t.Fatalf("upload dir should exist: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("upload path should be a directory")
	}

	if ls.basePath != filepath.Join(dir, "uploads") {
		t.Errorf("basePath mismatch: %s", ls.basePath)
	}
}

func TestGetFullPath(t *testing.T) {
	ls := &LocalStorage{basePath: "/uploads"}
	full := ls.GetFullPath("avatars/test.jpg")
	expected := filepath.Join("/uploads", "avatars/test.jpg")
	if full != expected {
		t.Errorf("expected %s, got %s", expected, full)
	}
}

func TestDeleteFile_PathTraversal(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	err := ls.DeleteFile("../../../etc/passwd")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestDeleteFile_NonExexistent(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	err := ls.DeleteFile("nonexistent/file.txt")
	if err != nil {
		t.Errorf("deleting nonexistent file should not error, got: %v", err)
	}
}
