package api

import (
	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
)

// Server serves HTTP requests for the backend service.
type Server struct {
	store  db.Querier
	router *gin.Engine
}

// NewServer creates a new HTTP server and sets up routing.
func NewServer(store db.Querier) *Server {
	server := &Server{store: store}
	router := gin.Default()

	// Users routes
	router.POST("/users", server.createUser)

	// Students routes
	router.POST("/students", server.createStudent)

	server.router = router
	return server
}

// Start runs the HTTP server on a specific address.
func (server *Server) Start(address string) error {
	return server.router.Run(address)
}
