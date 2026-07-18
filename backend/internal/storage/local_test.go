package storage

import (
	"os"
	"path/filepath"
	"testing"
)

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

func TestDeleteFile_NonExistent(t *testing.T) {
	dir := t.TempDir()
	ls, _ := NewLocalStorage(dir)

	err := ls.DeleteFile("nonexistent/file.txt")
	if err != nil {
		t.Errorf("deleting nonexistent file should not error, got: %v", err)
	}
}
