package api

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type PaystackWebhookEvent struct {
	Event string `json:"event"`
	Data  struct {
		Reference string                 `json:"reference"`
		Status    string                 `json:"status"`
		Amount    int64                  `json:"amount"`
		Metadata  map[string]interface{} `json:"metadata"`
	} `json:"data"`
}

func (server *Server) handlePaystackWebhook(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	signature := ctx.GetHeader("x-paystack-signature")
	if signature == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}

	if !verifyPaystackSignature(body, signature, server.config.PaystackSecretKey) {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var eventJSON PaystackWebhookEvent
	if err := json.Unmarshal(body, &eventJSON); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse event payload"})
		return
	}

	log.Printf("[paystack-webhook] Received event: %s, reference: %s, status: %s", eventJSON.Event, eventJSON.Data.Reference, eventJSON.Data.Status)

	if eventJSON.Event == "charge.success" && eventJSON.Data.Status == "success" {
		reference := eventJSON.Data.Reference
		if reference == "" {
			log.Printf("[paystack-webhook] charge.success with empty reference, skipping")
			ctx.JSON(http.StatusOK, gin.H{"status": "no reference"})
			return
		}

		donation, err := server.store.GetDonationByReference(ctx, &reference)
		if err == nil {
			if string(donation.Status) == "completed" {
				log.Printf("[paystack-webhook] Donation %s already completed, skipping", reference)
				ctx.JSON(http.StatusOK, gin.H{"status": "already completed"})
				return
			}

			if err := server.store.UpdateDonationStatus(ctx, db.UpdateDonationStatusParams{
				ID:     donation.ID,
				Status: "completed",
			}); err != nil {
				log.Printf("[paystack-webhook] Failed to update donation %s: %v", reference, err)
			} else {
				log.Printf("[paystack-webhook] Donation %s marked as completed", reference)
			}
			ctx.JSON(http.StatusOK, gin.H{"status": "donation updated"})
			return
		}

		payment, err := server.store.GetPaymentByReference(ctx, &reference)
		if err != nil {
			log.Printf("[paystack-webhook] No payment found for reference %s: %v", reference, err)
			ctx.JSON(http.StatusOK, gin.H{"status": "payment not found"})
			return
		}

		if string(payment.Status) == "completed" {
			log.Printf("[paystack-webhook] Payment %s already completed, skipping", reference)
			ctx.JSON(http.StatusOK, gin.H{"status": "already completed"})
			return
		}

		// Update payment to completed
		_, err = server.store.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
			ID:     payment.ID,
			Status: db.PaymentStatus("completed"),
			PaidAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		})
		if err != nil {
			log.Printf("[paystack-webhook] Failed to update payment %s: %v", reference, err)
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update payment"})
			return
		}

		// If payment is part of a batch, check if all batch payments are now completed
		if payment.BatchID.Valid {
			batch, err := server.store.GetPaymentBatch(ctx, payment.BatchID.Bytes)
			if err == nil && string(batch.Status) != "completed" {
				// Check if all payments in batch are completed
				batchPayments, err := server.store.ListBatchPayments(ctx, payment.BatchID)
				if err == nil {
					allCompleted := true
					for _, bp := range batchPayments {
						if string(bp.Status) != "completed" {
							allCompleted = false
							break
						}
					}
					if allCompleted {
						_, _ = server.store.UpdatePaymentBatchStatus(ctx, db.UpdatePaymentBatchStatusParams{
							ID:     payment.BatchID.Bytes,
							Status: db.PaymentStatus("completed"),
							PaidAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
						})
						log.Printf("[paystack-webhook] Batch %s marked as completed", uuid.UUID(payment.BatchID.Bytes).String())
					}
				}
			}
		}

		log.Printf("[paystack-webhook] Payment %s marked as completed", reference)
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "event processed successfully"})
}

func verifyPaystackSignature(payload []byte, signature string, secretKey string) bool {
	if secretKey == "" {
		return true
	}

	mac := hmac.New(sha512.New, []byte(secretKey))
	mac.Write(payload)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}
