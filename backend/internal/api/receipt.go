package api

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/utils"
	"github.com/aces/backend/internal/tenant"
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

func sanitizeReceiptFileName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Dues Receipt"
	}
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, ":", "-")
	var sb strings.Builder
	for _, r := range name {
		if r == '"' || r == '*' || r == '?' || r == '<' || r == '>' || r == '|' {
			continue
		}
		sb.WriteRune(r)
	}
	res := strings.TrimSpace(sb.String())
	for strings.Contains(res, "  ") {
		res = strings.ReplaceAll(res, "  ", " ")
	}
	if res == "" {
		return "Dues Receipt"
	}
	return res
}

func receiptFileName(brand tenant.Brand, paymentID, kind string, number int32) string {
	prefix := "RECEIPT"
	if brand.Slug != "" {
		prefix = strings.ToUpper(brand.Slug)
	}
	return fmt.Sprintf("%s-%s-Receipt-%04d-%s.pdf", prefix, kind, number, paymentID[:8])
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

	if !isStaffRole(ctx, capManageFinance) {
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

	firstName := strings.TrimSpace(user.FirstName)
	if firstName == "" {
		fullName := derefStrPtr(user.FullName)
		if idx := strings.Index(fullName, "("); idx != -1 {
			fullName = fullName[:idx]
		}
		if idx := strings.Index(fullName, ","); idx != -1 {
			fullName = fullName[:idx]
		}
		parts := strings.Fields(fullName)
		if len(parts) > 0 {
			firstName = parts[0]
		}
	}

	brand := tenant.BrandFrom(ctx.Request.Context())
	deptName := strings.TrimSpace(brand.Name)
	if deptName == "" {
		deptName = "Department of Computer Engineering"
	} else if !strings.HasPrefix(strings.ToLower(deptName), "department of") {
		deptName = "Department of " + deptName
	}

	var hodSigBytes []byte
	if asset, err := queries.GetCRFSignatureAsset(ctx.Request.Context(), "hod"); err == nil && asset.FilePath != "" {
		if server.storage != nil {
			fullPath := server.storage.GetFullPath(asset.FilePath)
			if b, err := os.ReadFile(fullPath); err == nil && len(b) > 0 {
				hodSigBytes = b
			}
		}
	}

	var deptStampBytes []byte
	if stampCfg, err := utils.StampConfigFor(brand.Name); err == nil {
		if stampPNG, err := utils.DeptStampPNG(400, 260, stampCfg); err == nil {
			deptStampBytes = stampPNG
		}
	}

	data := utils.ReceiptData{
		Date:         dateStr,
		ReceivedFrom: receivedFrom,
		Of:           deptName,
		SumOf:        fmt.Sprintf("%s Naira, Only", nairaToWords(amount)),
		NairaWords:   nairaToWords(naira),
		KoboWords: func() string {
			if kobo.IsZero() {
				return "Zero"
			}
			return nairaToWords(kobo)
		}(),
		Being:            being,
		AmountNaira:      naira.StringFixed(0),
		AmountKobo:       kobo.StringFixed(0),
		RegNo:            matric,
		StudentSignature: firstName,
		CashierSignature: hodSigBytes,
		DepartmentStamp:  deptStampBytes,
	}
	org := utils.OrgFor(brand.Name, brand.Institution, brand.ContactEmail, server.departmentLogo(ctx.Request.Context(), brand))
	pdfBytes, err := utils.RenderReceiptPDF(org, kind, int(number), data)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not render receipt"})
		return
	}

	duesName := strings.TrimSpace(payment.ItemName)
	if duesName == "" {
		if kind == utils.ClassDues {
			duesName = "Class Dues"
		} else {
			duesName = "Department Dues"
		}
	}
	filename := sanitizeReceiptFileName(duesName) + ".pdf"

	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}
