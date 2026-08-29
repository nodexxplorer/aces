package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

// ──────────────────────────── Expense Tracking ────────────────────────────

type createExpenseRequest struct {
	Description string  `json:"description" binding:"required"`
	Amount      float64 `json:"amount" binding:"required"`
	Category    string  `json:"category" binding:"required"`
	ExpenseDate string  `json:"expense_date" binding:"required"`
	ReceiptURL  *string `json:"receipt_url"`
}

type updateExpenseStatusRequest struct {
	Status          string  `json:"status" binding:"required"`
	RejectionReason *string `json:"rejection_reason"`
}

func (server *Server) createExpense(ctx *gin.Context) {
	var req createExpenseRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	parsedDate, err := time.Parse("2006-01-02", req.ExpenseDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, expected YYYY-MM-DD"})
		return
	}

	amount := decimal.NewFromFloat(req.Amount)

	expenseDate := pgtype.Date{
		Time:  parsedDate,
		Valid: true,
	}

	queries := server.store.(*db.Queries)
	expense, err := queries.CreateExpense(ctx, db.CreateExpenseParams{
		Description: req.Description,
		Amount:      amount,
		Category:    req.Category,
		ExpenseDate: expenseDate,
		ReceiptUrl:  req.ReceiptURL,
		SubmittedBy: userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": expense})
}

func (server *Server) listExpenses(ctx *gin.Context) {
	statusFilter := ctx.Query("status")

	queries := server.store.(*db.Queries)
	expenses, err := queries.ListExpenses(ctx, statusFilter)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list expenses"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": expenses})
}

func (server *Server) getExpense(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid expense id"})
		return
	}

	queries := server.store.(*db.Queries)
	expense, err := queries.GetExpense(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "expense not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": expense})
}

func (server *Server) updateExpenseStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid expense id"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateExpenseStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "status must be 'approved' or 'rejected'"})
		return
	}

	queries := server.store.(*db.Queries)
	err = queries.UpdateExpenseStatus(ctx, db.UpdateExpenseStatusParams{
		ID:              id,
		Status:          db.ExpenseStatus(req.Status),
		ApprovedBy:      pgtype.UUID{Bytes: userID, Valid: true},
		RejectionReason: req.RejectionReason,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "expense status updated"})
}

func (server *Server) getExpenseSummary(ctx *gin.Context) {
	queries := server.store.(*db.Queries)
	summary, err := queries.GetExpenseSummary(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get expense summary"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": summary})
}

func (server *Server) getExpensesByCategory(ctx *gin.Context) {
	queries := server.store.(*db.Queries)
	categories, err := queries.GetExpenseByCategory(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get expenses by category"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": categories})
}

// ──────────────────────────── In-App Feedback ────────────────────────────

type createFeedbackRequest struct {
	FeedbackType  string  `json:"feedback_type" binding:"required"`
	Title         string  `json:"title" binding:"required"`
	Description   string  `json:"description" binding:"required"`
	Rating        *int32  `json:"rating"`
	ScreenshotURL *string `json:"screenshot_url"`
}

type updateFeedbackRequest struct {
	Status        string  `json:"status" binding:"required"`
	AdminResponse *string `json:"admin_response"`
}

func (server *Server) createFeedback(ctx *gin.Context) {
	var req createFeedbackRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries := server.store.(*db.Queries)
	feedback, err := queries.CreateFeedback(ctx, db.CreateFeedbackParams{
		UserID:        userID,
		FeedbackType:  db.FeedbackType(req.FeedbackType),
		Title:         req.Title,
		Description:   req.Description,
		Rating:        req.Rating,
		ScreenshotUrl: req.ScreenshotURL,
		DeviceInfo:    nil,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": feedback})
}

func (server *Server) listFeedback(ctx *gin.Context) {
	statusFilter := ctx.Query("status")

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	var feedbacks []db.ListFeedbackRow
	var err error

	if statusFilter != "" {
		feedbacks, err = queries.ListFeedback(ctx, statusFilter)
	} else {
		feedbacks, err = queries.ListAllFeedback(ctx)
	}
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list feedback"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": feedbacks})
}

func (server *Server) getFeedback(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback id"})
		return
	}

	queries := server.store.(*db.Queries)
	feedback, err := queries.GetFeedback(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "feedback not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": feedback})
}

func (server *Server) updateFeedbackStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid feedback id"})
		return
	}

	var req updateFeedbackRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries := server.store.(*db.Queries)
	err = queries.UpdateFeedbackStatus(ctx, db.UpdateFeedbackStatusParams{
		ID:            id,
		Status:        db.FeedbackStatus(req.Status),
		AdminResponse: req.AdminResponse,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "feedback status updated"})
}

// ──────────────────────────── Help Center ────────────────────────────

type createHelpArticleRequest struct {
	Category    string `json:"category" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Content     string `json:"content" binding:"required"`
	SortOrder   *int32 `json:"sort_order"`
	IsPublished *bool  `json:"is_published"`
}

func (server *Server) createHelpArticle(ctx *gin.Context) {
	var req createHelpArticleRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries := server.store.(*db.Queries)
	article, err := queries.CreateHelpArticle(ctx, db.CreateHelpArticleParams{
		Category:    req.Category,
		Title:       req.Title,
		Content:     req.Content,
		SortOrder:   req.SortOrder,
		IsPublished: req.IsPublished,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": article})
}

func (server *Server) listHelpArticles(ctx *gin.Context) {
	category := ctx.Query("category")

	queries := server.store.(*db.Queries)

	var articles []db.HelpArticle
	var err error

	if category != "" {
		articles, err = queries.ListHelpArticlesByCategory(ctx, category)
	} else {
		articles, err = queries.ListHelpArticles(ctx)
	}
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list help articles"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": articles})
}

func (server *Server) getHelpArticle(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id"})
		return
	}

	queries := server.store.(*db.Queries)

	if err := queries.IncrementHelpArticleViews(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update view count"})
		return
	}

	article, err := queries.GetHelpArticle(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": article})
}

func (server *Server) markHelpArticleHelpful(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid article id"})
		return
	}

	queries := server.store.(*db.Queries)
	if err := queries.MarkHelpArticleHelpful(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "article marked as helpful"})
}

// ──────────────────────────── GPA Calculator Scenarios ────────────────────────────

type createScenarioRequest struct {
	Name    string          `json:"name"`
	Courses json.RawMessage `json:"courses" binding:"required"`
}

type updateScenarioRequest struct {
	Name    string          `json:"name"`
	Courses json.RawMessage `json:"courses" binding:"required"`
}

func (server *Server) createGPAScenario(ctx *gin.Context) {
	var req createScenarioRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries := server.store.(*db.Queries)
	scenario, err := queries.CreateGPAScenario(ctx, db.CreateGPAScenarioParams{
		UserID:  userID,
		Name:    req.Name,
		Courses: req.Courses,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": scenario})
}

func (server *Server) listGPAScenarios(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries := server.store.(*db.Queries)
	scenarios, err := queries.ListGPAScenarios(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list scenarios"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": scenarios})
}

func (server *Server) getGPAScenario(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid scenario id"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries := server.store.(*db.Queries)
	scenario, err := queries.GetGPAScenario(ctx, db.GetGPAScenarioParams{
		ID:     id,
		UserID: userID,
	})
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "scenario not found"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": scenario})
}

func (server *Server) updateGPAScenario(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid scenario id"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req updateScenarioRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	queries := server.store.(*db.Queries)
	err = queries.UpdateGPAScenario(ctx, db.UpdateGPAScenarioParams{
		ID:      id,
		UserID:  userID,
		Name:    req.Name,
		Courses: req.Courses,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "scenario updated"})
}

func (server *Server) deleteGPAScenario(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid scenario id"})
		return
	}

	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries := server.store.(*db.Queries)
	err = queries.DeleteGPAScenario(ctx, db.DeleteGPAScenarioParams{
		ID:     id,
		UserID: userID,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": "scenario deleted"})
}

// ──────────────────────────── Universal Search ────────────────────────────

func (server *Server) universalSearch(ctx *gin.Context) {
	q := strings.TrimSpace(ctx.Query("q"))
	if q == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "search query is required"})
		return
	}

	queries := server.store.(*db.Queries)
	results, err := queries.UniversalSearch(ctx, db.UniversalSearchParams{
		Code:  "%" + q + "%",
		Limit: 20,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": results})
}

func (server *Server) listMyFeedback(ctx *gin.Context) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	feedback, err := queries.ListUserFeedback(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": feedback})
}

func (server *Server) searchHelpArticles(ctx *gin.Context) {
	q := ctx.Query("q")
	if q == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "query parameter q is required"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	articles, err := queries.SearchHelpArticles(ctx, db.SearchHelpArticlesParams{
		Title: "%" + q + "%",
		Limit: 20,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": articles})
}

func (server *Server) updateHelpArticle(ctx *gin.Context) {
	articleID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid article ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	existing, err := queries.GetHelpArticle(ctx, articleID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}

	var req struct {
		Category    *string `json:"category"`
		Title       *string `json:"title"`
		Content     *string `json:"content"`
		SortOrder   *int32  `json:"sort_order"`
		IsPublished *bool   `json:"is_published"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	category := existing.Category
	if req.Category != nil {
		category = *req.Category
	}
	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	}
	content := existing.Content
	if req.Content != nil {
		content = *req.Content
	}
	var sortOrder int32
	if existing.SortOrder != nil {
		sortOrder = *existing.SortOrder
	}
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	isPublished := true
	if existing.IsPublished != nil {
		isPublished = *existing.IsPublished
	}
	if req.IsPublished != nil {
		isPublished = *req.IsPublished
	}

	if err := queries.UpdateHelpArticle(ctx, db.UpdateHelpArticleParams{
		ID:          articleID,
		Category:    category,
		Title:       title,
		Content:     content,
		SortOrder:   &sortOrder,
		IsPublished: &isPublished,
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "article updated"})
}

func (server *Server) deleteHelpArticle(ctx *gin.Context) {
	articleID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid article ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.DeleteHelpArticle(ctx, articleID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "article deleted"})
}

// SeedHelpArticles inserts default help articles if the table is empty.
func SeedHelpArticles(ctx context.Context, store db.Querier) error {
	existing, err := store.ListHelpArticles(ctx)
	if err != nil || len(existing) > 0 {
		return err
	}
	q, ok := store.(*db.Queries)
	if !ok {
		return nil
	}
	t := true
	type art struct{ cat, title, content string; ord int32 }
	articles := []art{
		{"Getting Started", "How to log in to ACES Zone", "1. Go to the ACES Zone login page.\n2. Enter your matric number or email and password.\n3. Click Sign In.\n\nForgot password? Click the Forgot Password link on the login page for OTP reset.", 1},
		{"Getting Started", "Complete your onboarding profile", "After first login you are prompted to complete onboarding.\n1. Enter date of birth, phone number, admission mode, year admitted.\n2. Provide emergency contact name and phone.\n3. Enter home address.\n4. Click Submit.\nYou must complete onboarding before accessing all features.", 2},
		{"Getting Started", "Why is my account pending approval?", "New accounts require approval by a department admin or class representative.\nYou will be notified once approved.\nIf pending for over 48 hours, contact your class rep or HOD.", 3},
		{"Results", "How to view your academic results", "Navigate to Results in the sidebar.\nResults are grouped by session and semester.\nClick View on any row to expand the full course breakdown.\nClick Print to print a semester result slip.", 1},
		{"Results", "What do result statuses mean?", "Pending: submitted by lecturer, not yet approved.\nApproved: verified and official.\nRejected: rejected by HOD, lecturer must resubmit.\nYour CGPA only includes approved results.", 2},
		{"Payments", "How to pay your dues", "1. Go to Payments and Dues.\n2. Switch to the Cart tab.\n3. Click Add next to any unpaid due.\n4. Click Pay Dues to proceed to Paystack.\n5. Complete payment. You will be redirected back automatically.", 1},
		{"Payments", "What if my payment failed?", "Check your bank balance.\nReturn to Transactions and click Pay Now to retry the same payment.\nDo not pay multiple times for the same due. The system tracks your reference.", 2},
		{"Course Registration", "How to register for courses", "1. Go to Course Registration in the sidebar.\n2. Select session and semester.\n3. Add courses and review total credit units.\n4. Submit for review.\nYour class rep or HOD will approve your registration.", 1},
		{"Course Registration", "What is the credit unit limit?", "The maximum credit units per semester is set by your department. Typically 24 units per semester for undergraduates.\nRegistrations exceeding the limit will be flagged during review.", 2},
		{"Profile", "How to update your profile", "1. Go to Profile in the sidebar.\n2. Edit phone, address, emergency contact, or bio.\n3. Click Save.\nNote: Matric number, level, and academic standing can only be changed by the HOD.", 1},
		{"Profile", "How to change your password", "1. Go to Profile.\n2. Scroll to Security.\n3. Enter your current and new password.\n4. Click Update Password.\nIf you cannot log in, use Forgot Password on the login page.", 2},
		{"Study Planner", "How to use the Study Planner", "1. Navigate to Study Planner in the sidebar.\n2. Click New Task.\n3. Add a title, priority level, and optional due date.\n4. Click Start on a task to mark it In Progress.\n5. Click Complete when done.\nTasks are sorted by priority and due date automatically.", 1},
		{"Troubleshooting", "I cannot see my results", "1. Confirm your account is approved (check dashboard banner).\n2. Ask your lecturer if results have been submitted for your courses.\n3. Results require HOD approval before appearing.\n4. Refresh the page or log out and back in.\nContact your HOD if results remain missing after 24 hours.", 1},
		{"Troubleshooting", "The payment page is showing an error", "Common issues:\n- Cart empty error: Add a due first before checking out.\n- Paystack redirect failed: Check internet and try again.\n- Payment pending after 5 minutes: Wait for webhook to process, then refresh.\n\nContact support with your payment reference number if the problem persists after 10 minutes.", 2},
	}
	for _, a := range articles {
		ord := a.ord
		_, _ = q.CreateHelpArticle(ctx, db.CreateHelpArticleParams{
			Category:    a.cat,
			Title:       a.title,
			Content:     a.content,
			SortOrder:   &ord,
			IsPublished: &t,
		})
	}
	log.Printf("[startup] seeded %d help articles", len(articles))
	return nil
}
