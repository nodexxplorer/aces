package api

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// getUserID extracts the userID from gin context.
func getUserID(ctx *gin.Context) uuid.UUID {
	val, exists := ctx.Get("userID")
	if !exists {
		return uuid.Nil
	}
	switch v := val.(type) {
	case uuid.UUID:
		return v
	case string:
		if parsed, err := uuid.Parse(v); err == nil {
			return parsed
		}
	}
	return uuid.Nil
}

func decimalFromFloat64(f float64) decimal.Decimal {
	return decimal.NewFromFloat(f)
}

func pgUUIDToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}
