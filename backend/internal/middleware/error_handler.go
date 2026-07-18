package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type AppError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

var (
	ErrUnauthorized = &AppError{Code: http.StatusUnauthorized, Message: "unauthorized"}
	ErrForbidden    = &AppError{Code: http.StatusForbidden, Message: "forbidden"}
	ErrNotFound     = &AppError{Code: http.StatusNotFound, Message: "resource not found"}
	ErrBadRequest   = &AppError{Code: http.StatusBadRequest, Message: "bad request"}
	ErrInternal     = &AppError{Code: http.StatusInternalServerError, Message: "internal server error"}
	ErrConflict     = &AppError{Code: http.StatusConflict, Message: "resource already exists"}
	ErrTooManyReqs  = &AppError{Code: http.StatusTooManyRequests, Message: "rate limit exceeded"}
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Detail  string `json:"detail,omitempty"`
	RequestID string `json:"requestId,omitempty"`
}

func RespondError(c *gin.Context, err error) {
	code := http.StatusInternalServerError
	message := "internal server error"
	detail := ""

	if appErr, ok := err.(*AppError); ok {
		code = appErr.Code
		message = appErr.Message
		detail = appErr.Detail
	} else {
		message = err.Error()
	}

	resp := ErrorResponse{
		Error:   message,
		Detail:  detail,
		RequestID: GetRequestID(c),
	}

	c.JSON(code, resp)
}

func RespondErrorWithCode(c *gin.Context, code int, message string) {
	c.JSON(code, ErrorResponse{
		Error:     message,
		RequestID: GetRequestID(c),
	})
}

func RespondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}
