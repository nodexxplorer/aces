package api

import (
	"net/http"
	"strconv"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type createAlumniStatusReq struct {
	GraduationYear       int32   `json:"graduation_year" binding:"required"`
	GraduationClass      *string `json:"graduation_class"`
	IsMentorAvailable    bool    `json:"is_mentor_available"`
	MentorSpecialization *string `json:"mentor_specialization"`
	CurrentCompany       *string `json:"current_company"`
	CurrentPosition      *string `json:"current_position"`
	LinkedInURL          *string `json:"linkedin_url"`
	Bio                  *string `json:"bio"`
}

type updateAlumniStatusReq struct {
	IsMentorAvailable    bool    `json:"is_mentor_available"`
	MentorSpecialization *string `json:"mentor_specialization"`
	CurrentCompany       *string `json:"current_company"`
	CurrentPosition      *string `json:"current_position"`
	LinkedInURL          *string `json:"linkedin_url"`
	Bio                  *string `json:"bio"`
}

type verifyAlumniReq struct {
	Status string `json:"status" binding:"required"`
}

type requestMentorshipReq struct {
	MentorID uuid.UUID `json:"mentor_id" binding:"required"`
	Topic    string    `json:"topic" binding:"required"`
	Message  *string   `json:"message"`
}

type updateMentorshipReq struct {
	Status string `json:"status" binding:"required"`
}

type createJobPostReq struct {
	Title          string  `json:"title" binding:"required"`
	Company        string  `json:"company" binding:"required"`
	Location       *string `json:"location"`
	JobType        string  `json:"job_type" binding:"required"`
	Industry       *string `json:"industry"`
	Description    string  `json:"description" binding:"required"`
	Requirements   *string `json:"requirements"`
	Responsibilities *string `json:"responsibilities"`
	SalaryRange    *string `json:"salary_range"`
	ApplicationUrl *string `json:"application_url"`
}

type applyJobReq struct {
	ResumeUrl   *string `json:"resume_url"`
	CoverLetter *string `json:"cover_letter"`
}

type updateApplicationStatusReq struct {
	Status string `json:"status" binding:"required"`
}

type createAlumniEventReq struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	EventType   string  `json:"event_type" binding:"required"`
	Location    *string `json:"location"`
	IsVirtual   bool    `json:"is_virtual"`
	VirtualLink *string `json:"virtual_link"`
	StartDate   string  `json:"start_date" binding:"required"`
	EndDate     string  `json:"end_date" binding:"required"`
}

type createDonationReq struct {
	Channel     string  `json:"channel" binding:"required"`
	Amount      float64 `json:"amount" binding:"required"`
	Currency    *string `json:"currency"`
	Message     *string `json:"message"`
	IsAnonymous bool    `json:"is_anonymous"`
}

type updateAlumniProfileReq struct {
	Location         *string `json:"location"`
	PortfolioURL     *string `json:"portfolio_url"`
	Bio              *string `json:"bio"`
	LinkedInURL      *string `json:"linkedin_url"`
	IsMentorAvailable *bool  `json:"is_mentor_available"`
	MentorTopics     *string `json:"mentorship_topics"`
	Skills           *string `json:"skills"`
	WillingToSpeak   *bool  `json:"willing_to_speak"`
	EventInterests   *string `json:"event_interests"`
	PrivacyLevel     *string `json:"privacy_level"`
	Industry         *string `json:"industry"`
	JobTitle         *string `json:"job_title"`
	CurrentCompany   *string `json:"current_company"`
}

func (server *Server) createAlumniStatus(ctx *gin.Context) {
	var req createAlumniStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := getUserID(ctx)

	status, err := server.alumni.CreateStatus(ctx, db.CreateAlumniStatusParams{
		UserID:               userID,
		GraduationYear:       req.GraduationYear,
		GraduationClass:      req.GraduationClass,
		IsMentorAvailable:    req.IsMentorAvailable,
		MentorSpecialization: req.MentorSpecialization,
		CurrentCompany:       req.CurrentCompany,
		CurrentPosition:      req.CurrentPosition,
		LinkedinUrl:          req.LinkedInURL,
		Bio:                  req.Bio,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, status)
}

func (server *Server) getAlumniStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	status, err := server.alumni.GetStatus(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, status)
}

func (server *Server) listAlumni(ctx *gin.Context) {
	alumniList, err := server.alumni.ListAlumni(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, alumniList)
}

func (server *Server) updateAlumniStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateAlumniStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, err := server.alumni.UpdateStatus(ctx, db.UpdateAlumniStatusParams{
		UserID:               id,
		IsMentorAvailable:    req.IsMentorAvailable,
		MentorSpecialization: req.MentorSpecialization,
		CurrentCompany:       req.CurrentCompany,
		CurrentPosition:      req.CurrentPosition,
		LinkedinUrl:          req.LinkedInURL,
		Bio:                  req.Bio,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, status)
}

func (server *Server) verifyAlumni(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req verifyAlumniReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	verifiedBy := getUserID(ctx)

	status, err := server.alumni.Verify(ctx, id, req.Status, verifiedBy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, status)
}

func (server *Server) listPendingAlumniVerifications(ctx *gin.Context) {
	pending, err := server.alumni.ListPendingVerifications(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, pending)
}

func (server *Server) requestMentorship(ctx *gin.Context) {
	var req requestMentorshipReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	studentID := getUserID(ctx)

	request, err := server.alumni.RequestMentorship(ctx, db.CreateMentorshipRequestParams{
		StudentID: studentID,
		MentorID:  req.MentorID,
		Topic:     req.Topic,
		Message:   req.Message,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, request)
}

func (server *Server) listStudentMentorshipRequests(ctx *gin.Context) {
	studentID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid student ID"})
		return
	}

	requests, err := server.alumni.ListStudentMentorships(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

func (server *Server) listMentorMentorshipRequests(ctx *gin.Context) {
	mentorID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid mentor ID"})
		return
	}

	requests, err := server.alumni.ListMentorRequests(ctx, mentorID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, requests)
}

func (server *Server) updateMentorshipStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateMentorshipReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	request, err := server.alumni.UpdateMentorshipStatus(ctx, id, req.Status)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, request)
}

func (server *Server) createJobPost(ctx *gin.Context) {
	var req createJobPostReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postedBy := getUserID(ctx)

	job, err := server.alumni.CreateJobPost(ctx, db.CreateJobPostParams{
		PostedBy:       postedBy,
		Title:          req.Title,
		Company:        req.Company,
		Location:       req.Location,
		JobType:        db.JobType(req.JobType),
		Description:    req.Description,
		Requirements:   req.Requirements,
		SalaryRange:    req.SalaryRange,
		ApplicationUrl: req.ApplicationUrl,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, job)
}

func (server *Server) getJobPost(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	job, err := server.alumni.GetJobPost(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, job)
}

func (server *Server) listJobPosts(ctx *gin.Context) {
	jobs, err := server.alumni.ListJobPosts(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, jobs)
}

func (server *Server) listUserJobPosts(ctx *gin.Context) {
	userID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	jobs, err := server.alumni.ListUserJobPosts(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, jobs)
}

func (server *Server) applyForJob(ctx *gin.Context) {
	jobID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid job ID"})
		return
	}

	var req applyJobReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	applicantID := getUserID(ctx)

	application, err := server.alumni.ApplyForJob(ctx, db.CreateJobApplicationParams{
		JobID:       jobID,
		ApplicantID: applicantID,
		ResumeUrl:   req.ResumeUrl,
		CoverLetter: req.CoverLetter,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, application)
}

func (server *Server) listJobApplications(ctx *gin.Context) {
	jobID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid job ID"})
		return
	}

	applications, err := server.alumni.ListJobApplications(ctx, jobID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, applications)
}

func (server *Server) updateJobApplicationStatus(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateApplicationStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reviewedBy := getUserID(ctx)

	application, err := server.alumni.UpdateApplicationStatus(ctx, id, req.Status, reviewedBy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, application)
}

func (server *Server) listStudentJobApplications(ctx *gin.Context) {
	applicantID := getUserID(ctx)

	applications, err := server.alumni.ListStudentJobApplications(ctx, applicantID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, applications)
}

func (server *Server) deleteJobPost(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid job post ID"})
		return
	}

	if err := server.alumni.DeleteJobPost(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "job post deactivated"})
}

func (server *Server) createAlumniEvent(ctx *gin.Context) {
	var req createAlumniEventReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date format, use RFC3339"})
		return
	}
	endTime, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date format, use RFC3339"})
		return
	}

	event, err := server.alumni.CreateEvent(ctx, db.CreateAlumniEventParams{
		Title:       req.Title,
		Description: req.Description,
		EventType:   req.EventType,
		Location:    req.Location,
		IsVirtual:   req.IsVirtual,
		VirtualLink: req.VirtualLink,
		StartDate:   pgtype.Timestamptz{Time: startTime, Valid: true},
		EndDate:     pgtype.Timestamptz{Time: endTime, Valid: true},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, event)
}

func (server *Server) listAlumniEvents(ctx *gin.Context) {
	events, err := server.alumni.ListEvents(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, events)
}

func (server *Server) registerForAlumniEvent(ctx *gin.Context) {
	eventID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid event ID"})
		return
	}

	userID := getUserID(ctx)

	attendee, err := server.alumni.RegisterForEvent(ctx, eventID, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, attendee)
}

func (server *Server) listAlumniEventAttendees(ctx *gin.Context) {
	eventID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid event ID"})
		return
	}

	attendees, err := server.alumni.ListEventAttendees(ctx, eventID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, attendees)
}

// ─── Enhanced Alumni Endpoints ──────────────────────────────────────

func (server *Server) getMyAlumniStatus(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	status, err := queries.GetMyAlumniStatus(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "alumni status not found"})
		return
	}

	ctx.JSON(http.StatusOK, status)
}

func (server *Server) listMentors(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	mentors, err := queries.ListAvailableMentors(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, mentors)
}

func (server *Server) listMyMentorshipRequests(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	items, err := queries.ListMyMentorshipRequests(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, items)
}

func (server *Server) updateMyAlumniProfile(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req updateAlumniStatusReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err := queries.UpdateAlumniProfile(ctx, userID, &req.IsMentorAvailable, req.MentorSpecialization, req.CurrentCompany, req.CurrentPosition, req.LinkedInURL, req.Bio)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

func (server *Server) getAlumniDashboardStats(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	stats, err := queries.GetAlumniDashboardStats(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, stats)
}

func (server *Server) getAlumniMyStats(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	stats, err := queries.GetAlumniMyStats(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, stats)
}

func (server *Server) searchAlumniDirectory(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	search := ctx.Query("search")
	yearFromStr := ctx.Query("year_from")
	yearToStr := ctx.Query("year_to")
	industry := ctx.Query("industry")
	location := ctx.Query("location")
	mentorStr := ctx.Query("mentor_only")

	var yearFrom, yearTo int32
	if v, err := strconv.Atoi(yearFromStr); err == nil {
		yearFrom = int32(v)
	}
	if v, err := strconv.Atoi(yearToStr); err == nil {
		yearTo = int32(v)
	}

	var mentorOnly bool
	if mentorStr == "true" {
		mentorOnly = true
	}

	items, err := queries.SearchAlumniDirectory(ctx, db.SearchAlumniDirectoryParams{
		Column1: search,
		Column2: yearFrom,
		Column3: yearTo,
		Column4: industry,
		Column5: location,
		Column6: mentorOnly,
		Limit:   50,
		Offset:  0,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, items)
}

func (server *Server) updateMyAlumniProfileFull(ctx *gin.Context) {
	userID := getUserID(ctx)

	var req updateAlumniProfileReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	err := queries.UpdateAlumniProfileFull(ctx, userID,
		req.Location, req.PortfolioURL, req.Bio, req.LinkedInURL,
		req.IsMentorAvailable, nil, nil,
		req.WillingToSpeak, nil, req.PrivacyLevel,
		req.Industry, req.JobTitle, req.CurrentCompany)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

func (server *Server) createDonation(ctx *gin.Context) {
	var req createDonationReq
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Amount < 1000 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "minimum donation is ₦1,000"})
		return
	}

	donorID := getUserID(ctx)

	currency := "NGN"
	if req.Currency != nil {
		currency = *req.Currency
	}

	tier := "none"
	switch {
	case req.Amount >= 500000:
		tier = "platinum"
	case req.Amount >= 100000:
		tier = "gold"
	case req.Amount >= 50000:
		tier = "silver"
	case req.Amount >= 10000:
		tier = "bronze"
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	donation, err := queries.CreateDonation(ctx, db.CreateDonationParams{
		DonorID:        donorID,
		Channel:        db.DonationChannel(req.Channel),
		Amount:         decimal.NewFromFloat(req.Amount),
		Currency:       currency,
		Message:        req.Message,
		IsAnonymous:    req.IsAnonymous,
		RecognizedTier: db.DonationTier(tier),
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = donation

	ctx.JSON(http.StatusOK, gin.H{
		"message":    "donation recorded successfully",
		"tier":       tier,
		"amount":     req.Amount,
		"channel":    req.Channel,
	})
}

func (server *Server) listDonations(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	donations, err := queries.ListAllDonations(ctx, db.ListAllDonationsParams{Limit: 50, Offset: 0})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, donations)
}

func (server *Server) listMyDonations(ctx *gin.Context) {
	userID := getUserID(ctx)

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	donations, err := queries.ListDonorDonations(ctx, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, donations)
}

func (server *Server) getDonationStats(ctx *gin.Context) {
	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	stats, err := queries.GetDonationStats(ctx)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, stats)
}

func (server *Server) incrementJobViews(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid job ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	if err := queries.IncrementJobViews(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "view tracked"})
}
