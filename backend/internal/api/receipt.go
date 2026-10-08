package api

import (
	"fmt"
	"net/http"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// ─── Dues Receipts ────────────────────────────────────────────────────────────
//
// Official receipts for department/class dues payments, rendered with the
// association's letterhead (see internal/utils/duesreceipt.go). 
func paymentToReceiptKind(t db.PaymentType) (utils.ReceiptKind, bool) {
	switch t {
	case db.PaymentTypeDeptDues:
		return utils.DepartmentDues, true
	case db.PaymentTypeClassDues:
		return utils.ClassDues, true
	default:
		return "", false
	}
}

func nairaToWords(amount decimal.Decimal) string {
	if amount.Sign() < 0 {
		return "Negative " + nairaToWords(amount.Neg())
	}

	ones := []string{
		"Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
		"Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
		"Sixteen", "Seventeen", "Eighteen", "Nineteen",
	}
	tens := []string{
		"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
		"Eighty", "Ninety",
	}

	var belowThousand func(int) string
	belowThousand = func(n int) string {
		switch {
		case n < 20:
			return ones[n]
		case n < 100:
			t := tens[n/10]
			if r := n % 10; r != 0 {
				return t + "-" + ones[r]
			}
			return t
		default:
			h := ones[n/100] + " Hundred"
			if r := n % 100; r != 0 {
				return h + " " + belowThousand(r)
			}
			return h
		}
	}

	whole := amount.Round(0).IntPart()
	if whole == 0 {
		return "Zero"
	}

	billions := whole / 1_000_000_000
	whole %= 1_000_000_000
	millions := whole / 1_000_000
	whole %= 1_000_000
	thousands := whole / 1_000
	whole %= 1_000

	var out []string
	if billions > 0 {
		out = append(out, belowThousand(int(billions))+" Billion")
	}
	if millions > 0 {
		out = append(out, belowThousand(int(millions))+" Million")
	}
	if thousands > 0 {
		out = append(out, belowThousand(int(thousands))+" Thousand")
	}
	if whole > 0 {
		out = append(out, belowThousand(int(whole)))
	}
	return strings.Join(out, " ")
}

func receiptFileName(paymentID, kind string, number int32) string {
	return fmt.Sprintf("ACES-%s-Receipt-%04d-%s.pdf", kind, number, paymentID[:8])
}


func (server *Server) getDuesPaymentReceipt(ctx *gin.Context) {
	paymentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	payment, err := server.store.GetPayment(ctx, paymentID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}

	if !isStaffRole(ctx) {
		studentID, err := server.getStudentIDFromUser(ctx)
		if err != nil || payment.StudentID != studentID {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
	}

	kind, ok := paymentToReceiptKind(payment.Type)
	if !ok {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "receipts are only issued for department or class dues"})
		return
	}
	if payment.Status != db.PaymentStatusCompleted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "receipt is only available once the payment is completed"})
		return
	}

	// Allocate (or reuse) the permanent receipt number for this payment.
	// AssignReceiptNumber is a hand-written query, not part of the generated
	// Querier interface, so it goes through the concrete *db.Queries — the
	// same pattern the alumni handlers use for their custom queries.
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	number, err := queries.AssignReceiptNumber(ctx, payment.ID, payment.Type)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	student, err := server.store.GetStudent(ctx, payment.StudentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var user db.User
	user, err = server.store.GetUser(ctx, student.UserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	matric := derefStrPtr(student.MatricNumber)

	// The "Of:" line — who the money was received from.
	receivedFrom := derefStrPtr(user.FullName)
	if matric != "" {
		receivedFrom = fmt.Sprintf("%s (%s)", receivedFrom, matric)
	}

	// "Being" line — what the payment was for.
	being := fmt.Sprintf("Payment of %s dues", payment.ItemName)

	amount := payment.Amount
	naira := amount.Round(0)
	kobo := amount.Sub(naira).Mul(decimal.NewFromInt(100)).Round(0)

	paidAt := payment.PaidAt
	if !paidAt.Valid {
		paidAt = payment.CreatedAt
	}
	dateStr := paidAt.Time.Format("02/01/2006")

	data := utils.ReceiptData{
		Date:         dateStr,
		ReceivedFrom: receivedFrom,
		Of:           receivedFrom,
		SumOf:        fmt.Sprintf("%s Naira, Only", nairaToWords(amount)),
		NairaWords:   nairaToWords(naira),
		KoboWords: func() string {
			if kobo.IsZero() {
				return "Zero"
			}
			return nairaToWords(kobo)
		}(),
		Being:       being,
		AmountNaira: naira.StringFixed(0),
		AmountKobo:  kobo.StringFixed(0),
		RegNo:       matric,
	}

	pdfBytes, err := utils.RenderReceiptPDF(utils.DefaultOrg, kind, int(number), data)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not render receipt"})
		return
	}

	kindLabel := "Department-Dues"
	if kind == utils.ClassDues {
		kindLabel = "Class-Dues"
	}
	filename := receiptFileName(payment.ID.String(), kindLabel, number)

	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}
