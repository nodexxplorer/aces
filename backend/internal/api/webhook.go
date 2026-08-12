package api

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
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

		result, err := server.completePaymentsForReference(ctx, reference, eventJSON.Data.Amount)
		if err != nil {
			log.Printf("[paystack-webhook] %v", err)
			ctx.JSON(http.StatusOK, gin.H{"status": "payment not found"})
			return
		}
		log.Printf("[paystack-webhook] %s", result)
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "event processed successfully"})
}

// completePaymentsForReference marks every payment sharing a Paystack
// reference as completed, and the parent batch too once all its payments are
// done. Shared by the Paystack webhook (server-to-server, authoritative but
// unreachable on localhost and occasionally delayed/missed even in
// production) and the student-facing redirect confirmation endpoint (fires
// reliably since it's the browser coming back from Paystack, but only has a
// reference — the caller must have already fetched paidAmountKobo from a
// trusted source, i.e. the webhook payload or a Paystack verify-transaction
// call, never from the client).
func (server *Server) completePaymentsForReference(ctx *gin.Context, reference string, paidAmountKobo int64) (string, error) {
	payment, err := server.store.GetPaymentByReference(ctx, &reference)
	if err != nil {
		return "", fmt.Errorf("no payment found for reference %s: %w", reference, err)
	}

	if string(payment.Status) == "completed" {
		return fmt.Sprintf("payment %s already completed, skipping", reference), nil
	}

	// A cart checkout stamps the SAME Paystack reference onto every payment in
	// the batch, since one charge covers the whole cart — so completing "the"
	// payment for this reference actually means completing every payment that
	// shares it. Collect those siblings before touching anything.
	paymentsToComplete := []db.Payment{{
		ID: payment.ID, StudentID: payment.StudentID, BatchID: payment.BatchID, DueID: payment.DueID,
		Type: payment.Type, ItemName: payment.ItemName, Amount: payment.Amount,
		PaystackReference: payment.PaystackReference, Status: payment.Status,
	}}
	expectedAmount := payment.Amount
	if payment.BatchID.Valid {
		if batch, err := server.store.GetPaymentBatch(ctx, payment.BatchID.Bytes); err == nil {
			expectedAmount = batch.TotalAmount
		}
		if batchPayments, err := server.store.ListBatchPayments(ctx, payment.BatchID); err == nil {
			paymentsToComplete = paymentsToComplete[:0]
			for _, bp := range batchPayments {
				if bp.PaystackReference != nil && *bp.PaystackReference == reference {
					paymentsToComplete = append(paymentsToComplete, bp)
				}
			}
		}
	}

	// Cross-check the amount Paystack says it actually collected against what
	// was owed, before crediting anything — never trust status=="success" alone.
	expectedKobo := expectedAmount.Mul(decimal.NewFromInt(100)).IntPart()
	if paidAmountKobo < expectedKobo {
		return "", fmt.Errorf("amount mismatch for reference %s: paid %d kobo, expected %d kobo — refusing to mark completed", reference, paidAmountKobo, expectedKobo)
	}

	for _, p := range paymentsToComplete {
		if string(p.Status) == "completed" {
			continue
		}
		if _, err := server.store.UpdatePaymentStatus(ctx, db.UpdatePaymentStatusParams{
			ID:     p.ID,
			Status: db.PaymentStatus("completed"),
			PaidAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		}); err != nil {
			log.Printf("[payment-confirm] Failed to update payment %s: %v", p.ID, err)
			continue
		}

		if student, err := server.store.GetStudent(ctx, p.StudentID); err == nil {
			eType := "payment"
			eID := p.ID
			server.notifyUser(
				ctx,
				student.UserID,
				"payment",
				"dues",
				"high",
				"Payment Completed",
				fmt.Sprintf("Your payment of ₦%s for %s has been completed successfully.", p.Amount.String(), p.ItemName),
				"/payments",
				"View Dues",
				&eType,
				&eID,
			)
		}
	}

	// If payment is part of a batch, check if all batch payments are now completed
	if payment.BatchID.Valid {
		batch, err := server.store.GetPaymentBatch(ctx, payment.BatchID.Bytes)
		if err == nil && string(batch.Status) != "completed" {
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
					log.Printf("[payment-confirm] Batch %s marked as completed", uuid.UUID(payment.BatchID.Bytes).String())
				}
			}
		}
	}

	return fmt.Sprintf("payment(s) for reference %s marked as completed", reference), nil
}

func verifyPaystackSignature(payload []byte, signature string, secretKey string) bool {
	if secretKey == "" {
		return false // fail closed — no secret configured means no request is trusted
	}

	mac := hmac.New(sha512.New, []byte(secretKey))
	mac.Write(payload)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}
