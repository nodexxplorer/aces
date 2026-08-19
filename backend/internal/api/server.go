package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/auth"
	"github.com/aces/backend/internal/cache"
	"github.com/aces/backend/internal/config"
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/email"
	"github.com/aces/backend/internal/push"
	"github.com/aces/backend/internal/middleware"
	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/storage"
	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" {
			trimmedOrigin := strings.TrimSuffix(strings.TrimSpace(origin), "/")
			matched := false
			for _, allowed := range allowedOrigins {
				// No "*" match-anything path, deliberately — this middleware
				// reflects the caller's Origin with Access-Control-Allow-
				// Credentials: true, so a wildcard here would mean full
				// credentialed cross-origin access for every user the moment
				// ALLOWED_ORIGINS=* was ever set, e.g. mid-debugging.
				trimmedAllowed := strings.TrimSuffix(strings.TrimSpace(allowed), "/")
				if strings.EqualFold(trimmedOrigin, trimmedAllowed) {
					matched = true
					break
				}
			}

			if matched {
				c.Header("Access-Control-Allow-Origin", origin)
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		reqHeaders := c.Request.Header.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			c.Header("Access-Control-Allow-Headers", reqHeaders)
		} else {
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With")
		}

		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

type Server struct {
	store        db.Querier
	dbPool       *pgxpool.Pool
	router       *gin.Engine
	tokenManager *auth.TokenManager
	config       *config.Config

	auth              *service.AuthService
	users             *service.UserService
	students          *service.StudentService
	courses           *service.CourseService
	results           *service.ResultService
	sessions          *service.SessionService
	semesters         *service.SemesterService
	complaints        *service.ComplaintService
	announcements     *service.AnnouncementService
	notifications     *service.NotificationService
	notificationsFull *service.NotificationServiceFull
	transcripts       *service.TranscriptService
	analytics         *service.AnalyticsService
	cgpa              *service.CGPAService
	timetables        *service.TimetableService
	roles             *service.RoleService
	manuals           *service.ManualService
	campusConnect     *service.CampusConnectService
	alumni            *service.AlumniService
	ai                *service.AIService
	wsHub             *ws.Hub
	storage           *storage.LocalStorage
	redisCache        *cache.RedisCache
	emailSender       email.EmailSender
}

func NewServer(store db.Querier, dbPool *pgxpool.Pool, cfg *config.Config) *Server {
	tm := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTAccessDuration, cfg.JWTRefreshDuration)
	hub := ws.NewHub()
	go hub.Run()

	emailSender := email.NewSMTPSender(
		cfg.SMTPHost,
		cfg.SMTPPort,
		cfg.SMTPUsername,
		cfg.SMTPPassword,
		cfg.SMTPFrom,
		cfg.SMTPMock,
	)
	pushSender := push.NewExpoPushSender(cfg.PushMock)

	server := &Server{
		store:        store,
		dbPool:       dbPool,
		tokenManager: tm,
		config:       cfg,

		auth:              service.NewAuthService(store),
		users:             service.NewUserService(store),
		students:          service.NewStudentService(store),
		courses:           service.NewCourseService(store),
		results:           service.NewResultService(store),
		sessions:          service.NewSessionService(store),
		semesters:         service.NewSemesterService(store),
		complaints:        service.NewComplaintService(store),
		announcements:     service.NewAnnouncementService(store),
		notifications:     service.NewNotificationService(store),
		notificationsFull: service.NewNotificationServiceFull(db.New(dbPool), hub, emailSender, pushSender, cfg.FrontendPublicURL),
		transcripts:       service.NewTranscriptService(store),
		analytics:         service.NewAnalyticsService(store),
		cgpa:              service.NewCGPAService(store),
		timetables:        service.NewTimetableService(store),
		roles:             service.NewRoleService(store),
		manuals:           service.NewManualService(store),
		campusConnect:     service.NewCampusConnectService(store),
		alumni:            service.NewAlumniService(store),
		ai:                service.NewAIService(store, cfg),
		wsHub:             hub,
		emailSender:       emailSender,
	}

	// Initialize local storage
	ls, _ := storage.NewLocalStorage(cfg.StorageLocalPath)
	server.storage = ls

	// Wire raw-socket chat persistence so messages sent via the WS channel
	// (as opposed to the REST sendMessage endpoint) are saved the same way,
	// not just relayed live and lost if the recipient is offline.
	hub.PersistChat = func(from, to uuid.UUID, content string) (json.RawMessage, error) {
		msg, err := server.campusConnect.SendMessage(context.Background(), from, to, content)
		if err != nil {
			return nil, err
		}
		return json.Marshal(msg)
	}
	hub.PersistGroupChat = func(from, groupID uuid.UUID, content string) (json.RawMessage, error) {
		msg, err := server.campusConnect.SendGroupMessage(context.Background(), groupID, from, content)
		if err != nil {
			return nil, err
		}
		return json.Marshal(msg)
	}

	// Initialize Redis cache (optional — gracefully falls back to in-memory)
	var rc *cache.RedisCache
	if cfg.RedisAddress != "" {
		rc = cache.NewRedisCache(cfg.RedisAddress, cfg.RedisPassword)
		if err := rc.Ping(context.Background()); err == nil {
			server.redisCache = rc
		}
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.ResponseNormalizer())
	router.Use(middleware.RequestLogger())
	router.Use(corsMiddleware(cfg.AllowedOrigins))
	if rc != nil && server.redisCache != nil {
		router.Use(middleware.RedisRateLimit(server.redisCache, 100, time.Minute))
	} else {
		router.Use(middleware.RateLimit(100, time.Minute))
	}
	router.Use(middleware.BodySizeLimit(10 << 20))
	router.Use(middleware.CSRFProtect())
	router.MaxMultipartMemory = 32 << 20

	// Serve uploaded files
	router.Static("/uploads", cfg.StorageLocalPath)

	// Per-route rate limiters: prefer Redis, fall back to in-memory
	var rl, authRL gin.HandlerFunc
	if server.redisCache != nil {
		rl = middleware.RedisRateLimit(server.redisCache, 10, time.Minute)
		authRL = middleware.RedisRateLimit(server.redisCache, 60, time.Minute)
	} else {
		rl = middleware.RateLimit(10, time.Minute)
		authRL = middleware.RateLimit(60, time.Minute)
	}

	router.GET("/health", server.healthCheck)

	v1 := router.Group("/api/v1")

	authProtected := v1.Group("/auth")
	authProtected.Use(middleware.JWTAuth(tm))
	{
		authProtected.GET("/me", server.getMe)
		authProtected.POST("/logout", server.logout)
		authProtected.POST("/onboarding", server.studentOnboarding)
		authProtected.POST("/change-password", server.changePassword)
	}

	authPublic := v1.Group("/auth")
	{
		authPublic.POST("/signup/student", rl, server.studentSignup)
		authPublic.POST("/signup/lecturer", rl, server.lecturerSignup)
		authPublic.POST("/login", authRL, server.login)
		authPublic.POST("/refresh", authRL, server.refreshToken)
		authPublic.POST("/request-otp", authRL, server.requestPasswordReset)
		authPublic.POST("/verify-otp", authRL, server.verifyPasswordResetOTP)
		authPublic.POST("/reset-with-otp", authRL, server.resetPasswordWithOTP)
	}

	v1.POST("/payments/webhook/paystack", server.handlePaystackWebhook)

	// Public — calendar clients (Google/Apple/Outlook "subscribe by URL")
	// fetch subscription URLs with no auth headers, so this can't sit
	// behind JWTAuth; the token in the path is the only credential.
	v1.GET("/calendar/feed/:token", server.getCalendarFeed)

	// Public — the "Unsubscribe" link in outbound notification emails is
	// opened directly from a mail client with no auth headers, so the
	// token in the path is the only credential.
	v1.GET("/notifications/unsubscribe/:token", server.unsubscribeFromEmails)

	api := v1.Group("")
	api.Use(middleware.JWTAuth(tm))

	api.GET("/ws", server.handleWebSocket)

	sessions := api.Group("/sessions")
	{
		sessions.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createSession)
		sessions.GET("", server.listSessions)
		sessions.GET("/:id", server.getSession)
		sessions.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateSession)
		sessions.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteSession)
	}

	semesters := api.Group("/semesters")
	{
		semesters.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createSemester)
		semesters.GET("/session/:session_id", server.listSessionSemesters)
		semesters.GET("/:id", server.getSemester)
		semesters.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateSemester)
		semesters.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteSemester)
	}

	staff := api.Group("/staff")
	{
		staff.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createStaff)
		staff.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listStaff)
		staff.GET("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getStaff)
		staff.GET("/user/:user_id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getStaffByUserID)
		staff.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateStaff)
		staff.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteStaff)
	}

	users := api.Group("/users")
	{
		users.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createUser)
		users.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listUsers)
		users.GET("/pending-approvals", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingApprovals)
		users.PATCH("/me", server.updateMe)
		users.GET("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getUser)
		users.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateUser)
		users.POST("/:id/approve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.approveSignup)
		users.POST("/:id/reject", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.rejectSignup)
		users.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteUser)
	}

	// Student profile editing
	profileEdit := api.Group("/profile-edit")
	{
		profileEdit.PUT("/basic-info", middleware.RequireRoles("student"), server.updateStudentBasicInfo)
		profileEdit.POST("/photo", middleware.RequireRoles("student"), server.uploadProfilePhoto)
		profileEdit.GET("/documents", middleware.RequireRoles("student"), server.listStudentDocuments)
		profileEdit.POST("/documents", middleware.RequireRoles("student"), server.uploadStudentDocument)
	}

	// HOD student management
	hodStudents := api.Group("/hod/students")
	{
		hodStudents.GET("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getStudentFullProfile)
		hodStudents.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.hodEditStudent)
		hodStudents.GET("/:id/audit-logs", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getStudentAuditLogs)
		hodStudents.POST("/bulk-update", middleware.RequireRoles("hod"), server.bulkUpdateStudents)
	}

	// Document management (HOD)
	documents := api.Group("/documents")
	{
		documents.GET("/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingDocuments)
		documents.POST("/:id/verify", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.verifyDocument)
		documents.POST("/:id/reject", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.rejectDocument)
	}

	// Audit logs
	auditLogs := api.Group("/audit-logs")
	{
		auditLogs.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getAllAuditLogs)
	}

	approvals := api.Group("/approvals")
	{
		approvals.GET("/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingApprovals)
		approvals.GET("/status", server.getApprovalStatus)
		approvals.POST("/:id/approve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.approveSignup)
		approvals.POST("/:id/reject", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.rejectSignup)
	}

	cgpa := api.Group("/cgpa")
	{
		cgpa.GET("/calculate/:studentId", server.calculateCgpa)
		cgpa.GET("/settings", server.getCgpaSettings)
		cgpa.PUT("/settings", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCgpaSettings)
		cgpa.GET("/my-results", middleware.RequireRoles("student"), server.getMyApprovedResults)
		cgpa.POST("/simulate", middleware.RequireRoles("student"), server.simulateCgpa)
	}

	api.POST("/students", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createStudent)

	calendarSync := api.Group("/calendar")
	{
		calendarSync.GET("/token", server.getCalendarToken)
		calendarSync.POST("/token/regenerate", server.regenerateCalendarToken)
	}

	attendance := api.Group("/attendance")
	{
		attendance.POST("", middleware.RequireRoles("class_rep", "hod", "delegated_admin"), server.createAttendanceSheet)
		attendance.GET("/registered-students/:course_id", server.getRegisteredStudentsForAttendance)
		attendance.POST("/sessions/:id/submit", middleware.RequireRoles("class_rep", "hod", "delegated_admin"), server.submitAttendanceSession)
		attendance.GET("/sessions/:id/pdf", middleware.RequireRoles("class_rep", "lecturer", "hod", "admin", "delegated_admin"), server.downloadAttendancePDF)
		attendance.POST("/sessions/:id/review", middleware.RequireRoles("lecturer", "hod", "admin"), server.reviewAttendanceSession)
		attendance.GET("/course", middleware.RequireRoles("lecturer", "hod", "admin", "delegated_admin", "class_rep"), server.listCourseAttendanceSheets)
		attendance.GET("/student", server.listStudentAttendance)
		attendance.GET("/summary", server.getAttendanceSummary)
		attendance.GET("/my-overview", middleware.RequireRoles("student"), server.getStudentAttendanceOverview)
		attendance.GET("/my-courses/:course_id", middleware.RequireRoles("student"), server.getStudentCourseAttendanceDetail)
		attendance.GET("/:id", server.getAttendanceSheet)
		attendance.PUT("/:id", middleware.RequireRoles("class_rep", "hod", "delegated_admin"), server.updateAttendanceSheet)
		attendance.POST("/:id/finalize", middleware.RequireRoles("class_rep", "hod", "delegated_admin"), server.finalizeAttendanceSheet)
		attendance.DELETE("/:id", middleware.RequireRoles("class_rep", "hod", "admin", "delegated_admin"), server.deleteAttendanceSheet)
	}

	courses := api.Group("/courses")
	{
		courses.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createCourse)
		courses.GET("", server.listCourses)
		courses.GET("/filter", server.listCoursesByLevelAndSemester)
		courses.GET("/count", server.countCourses)
		courses.GET("/:id", server.getCourse)
		courses.GET("/:id/class-list", server.getCourseClassList)
		courses.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCourse)
		courses.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCourse)
	}

	assignments := api.Group("/assignments")
	{
		assignments.POST("", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.createAssignment)
		assignments.GET("/course/:course_id/session/:session_id", server.listCourseAssignments)
		assignments.GET("/:id", server.getAssignment)
		assignments.PUT("/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.updateAssignment)
		assignments.DELETE("/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.deleteAssignment)
		assignments.POST("/grades", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.createAssignmentGrade)
		assignments.GET("/grades/lookup", server.getAssignmentGrade)
		assignments.GET("/:id/grades", server.listAssignmentGrades)
		assignments.GET("/grades/student/:student_id", server.listStudentAssignmentGrades)
		assignments.PUT("/grades/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.updateAssignmentGrade)
		assignments.DELETE("/grades/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.deleteAssignmentGrade)
	}

	courseMaterials := api.Group("/course-materials")
	{
		courseMaterials.POST("", middleware.RequireRoles("lecturer", "hod", "admin", "delegated_admin"), server.uploadCourseMaterial)
		courseMaterials.GET("/course/:course_id", server.listCourseMaterialsByCourse)
		courseMaterials.GET("/mine", middleware.RequireRoles("lecturer", "hod", "admin", "delegated_admin"), server.listMyCourseMaterials)
		courseMaterials.GET("/:id/download", server.downloadCourseMaterial)
		courseMaterials.DELETE("/:id", middleware.RequireRoles("lecturer", "hod", "admin", "delegated_admin"), server.deleteCourseMaterial)
	}

	courseRegistrations := api.Group("/course-registrations")
	{
		courseRegistrations.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createCourseRegistration)
		courseRegistrations.POST("/submit", middleware.RequireRoles("student"), server.submitRegistration)
		courseRegistrations.GET("/my-course-ids", middleware.RequireRoles("student"), server.listMyRegisteredCourseIDs)
		courseRegistrations.GET("/student/:student_id", server.listStudentCourseRegistrations)
		courseRegistrations.GET("/:id", server.getCourseRegistration)
		courseRegistrations.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin", "class_rep"), server.updateCourseRegistration)
		courseRegistrations.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCourseRegistration)
		courseRegistrations.POST("/:id/courses", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createRegisteredCourse)
		courseRegistrations.GET("/:id/courses", server.listRegisteredCourses)
		courseRegistrations.PUT("/:id/courses/:registered_course_id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateRegisteredCourse)
		courseRegistrations.DELETE("/:id/courses/:registered_course_id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteRegisteredCourse)
	}

	results := api.Group("/results")
	{
		results.GET("", middleware.RequireRoles("lecturer", "hod", "admin", "delegated_admin"), server.listAllResults)
		results.POST("", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.createResult)
		results.GET("/slip", server.downloadResultSlip)
		results.GET("/:id", server.getResult)
		results.GET("/student/:student_id", server.listStudentResults)
		results.GET("/course/:course_id/session/:session_id", server.listCourseResults)
		results.PUT("/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.updateResult)
		results.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateResultStatus)
		results.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteResult)
		results.POST("/:id/audit-logs", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createResultAuditLog)
		results.GET("/:id/audit-logs", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listResultAuditLogs)
	}

	carryovers := api.Group("/carryovers")
	{
		carryovers.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createCarryoverCourse)
		carryovers.GET("/:id", server.getCarryoverCourse)
		carryovers.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCarryoverCourse)
		carryovers.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCarryoverCourse)
		carryovers.GET("/student/:student_id", server.listStudentCarryoverCourses)
		carryovers.GET("/student/:student_id/detailed", server.listStudentCarryoverCoursesDetailed)
	}

	notifications := api.Group("/notifications")
	{
		notifications.GET("/unread-count", server.getMyUnreadCount)
		notifications.GET("/unread-by-category", server.getMyUnreadByCategory)
		notifications.GET("/me", server.listMyNotifications)
		notifications.PUT("/:id/read", server.markNotificationAsRead)
		notifications.POST("/read-all", server.markAllAsRead)
		notifications.DELETE("/:id", server.deleteNotification)
		notifications.GET("/preferences", server.getMyNotificationPreferences)
		notifications.PUT("/preferences", server.updateMyNotificationPreferences)
		notifications.PUT("/push-token", server.updateMyPushToken)
		notifications.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin", "class_rep"), server.createNotification)
	}

	timetables := api.Group("/timetable")
	{
		timetables.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createTimetableEntry)
		timetables.GET("", server.listTimetableEntries)
		timetables.GET("/conflicts", server.checkTimetableConflicts)
		timetables.GET("/:id", server.getTimetableEntry)
		timetables.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateTimetableEntry)
		timetables.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteTimetableEntry)
		timetables.POST("/publish", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.publishTimetable)
		timetables.DELETE("/bulk", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.bulkDeleteTimetable)
	}

	payments := api.Group("/payments")
	{
		payments.POST("/dues", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.createDue)
		payments.GET("/dues", server.listDues)
		payments.GET("/dues/level", server.listDuesByLevel)
		payments.GET("/dues/:id", server.getDue)
		payments.PUT("/dues/:id", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.updateDue)
		payments.DELETE("/dues/:id", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.deleteDue)

		payments.POST("/cart", middleware.RequireRoles("student"), server.addToCart)
		payments.GET("/cart/me", middleware.RequireRoles("student"), server.listStudentCart)
		payments.DELETE("/cart/me", middleware.RequireRoles("student"), server.clearStudentCart)
		payments.DELETE("/cart/:id", middleware.RequireRoles("student"), server.removeFromCart)

		payments.POST("/batches", middleware.RequireRoles("student"), server.createPaymentBatch)
		payments.GET("/batches/student/:student_id", server.listStudentPaymentBatches)
		payments.GET("/batches/:id", server.getPaymentBatch)
		payments.GET("/batches/:id/payments", server.listBatchPayments)
		payments.PUT("/batches/:id/status", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.updatePaymentBatchStatus)

		payments.POST("", middleware.RequireRoles("student"), server.createPayment)
		payments.POST("/checkout", middleware.RequireRoles("student"), server.initializeCheckout)
		payments.POST("/checkout-cart", middleware.RequireRoles("student"), server.checkoutCart)
		payments.GET("/student/:student_id", server.listStudentPayments)
		payments.GET("/summary/:student_id", server.getStudentPaymentSummary)
		payments.GET("/check-paid", server.checkDuePaid)
		payments.GET("/my-reference", middleware.RequireRoles("student"), server.getMyPaymentByReference)
		payments.POST("/confirm", middleware.RequireRoles("student"), server.confirmMyPaymentByReference)
		payments.GET("/by-reference", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.getPaymentByReference)
		payments.GET("/defaulters", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.listDefaulters)
		payments.GET("/recent-verified", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.listRecentVerifiedPayments)
		payments.GET("", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.listAllPayments)
		payments.GET("/:id", server.getPayment)
		payments.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.updatePaymentStatus)
		payments.POST("/:id/verify", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.verifyPayment)
	}

	transcripts := api.Group("/transcript-requests")
	{
		transcripts.POST("", middleware.RequireRoles("student"), server.createTranscriptRequest)
		transcripts.GET("/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingTranscriptRequests)
		transcripts.GET("/student/:student_id", server.listStudentTranscriptRequests)
		transcripts.GET("/:id", server.getTranscriptRequest)
		transcripts.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateTranscriptRequest)
		transcripts.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteTranscriptRequest)
	}

	profileUpdates := api.Group("/profile-update-requests")
	{
		profileUpdates.POST("", middleware.RequireRoles("student"), server.createProfileUpdateRequest)
		profileUpdates.GET("/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingProfileUpdateRequests)
		profileUpdates.GET("/student/:student_id", server.listStudentProfileUpdateRequests)
		profileUpdates.GET("/:id", server.getProfileUpdateRequest)
		profileUpdates.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateProfileUpdateRequestStatus)
		profileUpdates.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteProfileUpdateRequest)
	}

	adminPermissions := api.Group("/admin-permissions")
	{
		adminPermissions.POST("", middleware.RequireRoles("hod"), server.grantAdminPermission)
		adminPermissions.GET("", middleware.RequireRoles("hod"), server.listAdminPermissions)
		adminPermissions.GET("/:user_id", middleware.RequireRoles("hod"), server.getAdminPermission)
		adminPermissions.PUT("/:user_id", middleware.RequireRoles("hod"), server.updateAdminPermission)
		adminPermissions.DELETE("/:user_id", middleware.RequireRoles("hod"), server.revokeAdminPermission)
	}

	analytics := api.Group("/analytics")
	{
		analytics.GET("/dashboard", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getDashboardStats)
		analytics.GET("/users", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getRecentUsers)
		analytics.GET("/activity", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getRecentActivity)
		analytics.GET("/performance", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getPerformanceTrend)
		analytics.GET("/overview", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getAnalyticsOverview)
		analytics.GET("/trend", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getAnalyticsTrend)
	}

	api.POST("/complaints", middleware.RequireRoles("student"), server.createComplaint)
	api.GET("/complaints/my", middleware.RequireRoles("student"), server.listMyComplaints)
	api.GET("/complaints", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listComplaints)
	api.GET("/complaints/:id", server.getComplaint)
	api.PUT("/complaints/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateComplaint)
	api.DELETE("/complaints/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteComplaint)
	api.POST("/complaints/:id/assign", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.assignComplaint)
	api.POST("/complaints/:id/resolve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.resolveComplaint)
	api.GET("/complaints/:id/history", server.listComplaintHistory)

	// ── Roles ──
	rolesGroup := api.Group("/roles")
	{
		rolesGroup.GET("", server.listRoles)
		rolesGroup.POST("", middleware.RequireRoles("hod", "admin"), server.createRole)
		rolesGroup.POST("/assign", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.assignUserRole)
		rolesGroup.POST("/revoke", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.revokeUserRole)
		rolesGroup.GET("/user/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listUserRoles)
		rolesGroup.GET("/user/:id/names", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listUserRolesByName)
		rolesGroup.GET("/students", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.searchStudentsForRoleManagement)
		rolesGroup.GET("/logs", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listRoleAssignmentLogs)
		rolesGroup.GET("/logs/user/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listRoleLogsByUser)
		rolesGroup.GET("/additional-count", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.countStudentsWithAdditionalRoles)
		rolesGroup.POST("/promote", middleware.RequireRoles("hod", "admin"), server.promoteUser)
		rolesGroup.GET("/promotions", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPromotions)
		rolesGroup.GET("/promotable-students", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPromotableStudents)
	}

	// ── Manuals ──
	manualsGroup := api.Group("/manuals")
	{
		// Catalog
		manualsGroup.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin", "lecturer"), server.createManual)
		manualsGroup.GET("", server.listManuals)
		manualsGroup.GET("/:id", server.getManual)
		manualsGroup.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateManual)
		manualsGroup.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteManual)

		// Student purchase flow
		manualsGroup.POST("/:id/checkout", middleware.RequireRoles("student"), server.createManualPayment)
		manualsGroup.POST("/purchase", middleware.RequireRoles("student"), server.purchaseManual)
		manualsGroup.GET("/my-purchases", middleware.RequireRoles("student"), server.listMyPurchases)
		manualsGroup.GET("/:id/cover", server.downloadManualCover)
		manualsGroup.GET("/purchases/:id/receipt", server.downloadManualReceipt)

		// Admin: bought list & print queue
		manualsGroup.GET("/:id/purchases", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.listManualPurchasesByManual)
		manualsGroup.GET("/:id/covers/bulk", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.bulkDownloadManualCovers)
		manualsGroup.POST("/purchases/:id/collect", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.markManualCollected)

		// QR scan & enrollment
		manualsGroup.POST("/qr-verify", middleware.RequireRoles("student"), server.verifyManualQR)
		manualsGroup.POST("/practical/enroll", middleware.RequireRoles("student"), server.enrollPractical)
		manualsGroup.GET("/practicals", middleware.RequireRoles("student"), server.listMyPracticalEnrollments)
	}

	// ── Campus Connect ──
	connect := api.Group("/campus-connect")
	{
		connect.POST("/connections", server.sendConnectionRequest)
		connect.PUT("/connections/:id", server.respondToConnection)
		connect.GET("/connections", server.listConnections)
		connect.GET("/connections/pending", server.listPendingRequests)
		connect.GET("/connections/user-ids", server.getAllConnectionUserIds)
		connect.GET("/messages/unread", server.getUnreadCounts)
		connect.POST("/messages", server.sendMessage)
		connect.GET("/messages/:id", server.listConversation)
		connect.PUT("/messages/:id/read", server.markMessageRead)
		connect.GET("/directory", server.getStudentDirectory)
	}

	// ── Backups ──
	backups := api.Group("/backups")
	{
		backups.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listBackups)
		backups.GET("/summary", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getBackupSummary)
		backups.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createBackup)
		backups.POST("/:id/restore", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.restoreBackup)
	}

	// ── Alumni ──
	alumniGroup := api.Group("/alumni")
	{
		alumniGroup.GET("/status/my", server.getMyAlumniStatus)
		alumniGroup.PUT("/profile", server.updateMyAlumniProfile)
		alumniGroup.PUT("/profile/full", server.updateMyAlumniProfileFull)
		alumniGroup.GET("/dashboard/stats", server.getAlumniDashboardStats)
		alumniGroup.GET("/my-stats", server.getAlumniMyStats)
		alumniGroup.GET("/directory", server.searchAlumniDirectory)
		alumniGroup.GET("/mentors", server.listMentors)
		alumniGroup.POST("/mentorship/requests", middleware.RequireRoles("student", "class_rep", "project_coordinator", "event_coordinator", "alumni_rep"), server.requestMentorship)
		alumniGroup.GET("/mentorship/my", server.listMyMentorshipRequests)
		alumniGroup.PUT("/mentorship/requests/:id", middleware.RequireRoles("alumni", "hod", "admin", "delegated_admin"), server.updateMentorshipStatus)
		alumniGroup.POST("/status", server.createAlumniStatus)
		alumniGroup.GET("/status/:id", server.getAlumniStatus)
		alumniGroup.GET("", server.listAlumni)
		alumniGroup.PUT("/status/:id", server.updateAlumniStatus)
		alumniGroup.POST("/verify/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.verifyAlumni)
		alumniGroup.GET("/verifications/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingAlumniVerifications)
		alumniGroup.POST("/jobs", middleware.RequireRoles("alumni", "hod", "admin", "delegated_admin"), server.createJobPost)
		alumniGroup.GET("/jobs", server.listJobPosts)
		alumniGroup.GET("/jobs/:id", server.getJobPost)
		alumniGroup.PUT("/jobs/:id", server.updateJobPost)
		alumniGroup.GET("/jobs/user/:id", server.listUserJobPosts)
		alumniGroup.POST("/jobs/:id/apply", server.applyForJob)
		alumniGroup.GET("/jobs/:id/applications", server.listJobApplications)
		alumniGroup.PUT("/jobs/applications/:id", server.updateJobApplicationStatus)
		alumniGroup.GET("/jobs/applications/mine", server.listStudentJobApplications)
		alumniGroup.POST("/jobs/:id/view", server.incrementJobViews)
		alumniGroup.DELETE("/jobs/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteJobPost)
		alumniGroup.POST("/events", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createAlumniEvent)
		alumniGroup.GET("/events", server.listAlumniEvents)
		alumniGroup.POST("/events/:id/register", server.registerForAlumniEvent)
		alumniGroup.GET("/events/:id/attendees", server.listAlumniEventAttendees)
		alumniGroup.POST("/donations", server.createDonation)
		alumniGroup.GET("/donations", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listDonations)
		alumniGroup.GET("/donations/mine", server.listMyDonations)
		alumniGroup.GET("/donations/stats", server.getDonationStats)
	}

	// ── Student Dashboard ──
	api.GET("/dashboard/student", middleware.RequireRoles("student"), server.getStudentDashboard)

	// ── Class Representative Management ──
	classRep := api.Group("/class-rep")
	{
		classRep.GET("/class-list", middleware.RequireRoles("class_rep", "student", "admin", "delegated_admin", "hod"), server.getClassRepClassList)
		classRep.GET("/pending-registrations", middleware.RequireRoles("class_rep", "student", "admin", "delegated_admin", "hod"), server.listPendingCourseRegistrations)
		classRep.GET("/pending-student-registrations", middleware.RequireRoles("class_rep", "student", "admin", "delegated_admin", "hod"), server.listPendingStudentRegistrations)
		classRep.POST("/pending-student-registrations/:id/approve", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.approveStudentRegistration)
		classRep.POST("/appoint", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.appointClassRep)
		classRep.GET("/list", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listClassReps)
		classRep.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deactivateClassRep)

		classRep.GET("/timetable", server.getClassRepTimetable)

		// Attendance sessions — class_rep/staff only; "student" is deliberately
		// excluded here (unlike /checkin below, which is legitimate self-service).
		// A plain student must never be able to create, open, close, or view the
		// roster of an attendance session — only the assigned class rep or staff.
		classRep.POST("/attendance-sessions", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.createAttendanceSession)
		classRep.PUT("/attendance-sessions/:id/open", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.openAttendanceSession)
		classRep.PUT("/attendance-sessions/:id/close", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.closeAttendanceSession)
		classRep.GET("/attendance-sessions/mine", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.listMyAttendanceSessions)
		classRep.GET("/attendance-sessions/:id/checkins", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.listAttendanceSessionCheckins)
		classRep.POST("/checkin", middleware.RequireRoles("class_rep", "student", "admin", "delegated_admin", "hod"), server.checkInStudent)

		// Reports
		classRep.POST("/reports", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.submitClassRepReport)
		classRep.GET("/reports", middleware.RequireRoles("class_rep", "admin", "delegated_admin", "hod"), server.listClassRepReports)
		classRep.GET("/reports/all", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listAllClassRepReports)
		classRep.PUT("/reports/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateClassRepReportStatus)

		// Performance reviews
		classRep.POST("/performance", middleware.RequireRoles("hod", "admin"), server.createPerformanceReview)
		classRep.GET("/performance", server.listPerformanceReviews)
	}

	// ── Lecturer Management ──
	lecturers := api.Group("/lecturers")
	{
		lecturers.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listLecturers)
		lecturers.GET("/attendance/pending", middleware.RequireRoles("lecturer", "hod", "admin"), server.getLecturerPendingAttendanceReviews)
		lecturers.GET("/attendance/overview", middleware.RequireRoles("lecturer", "hod", "admin"), server.getLecturerCourseAttendanceOverview)
		lecturers.GET("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin", "lecturer"), server.getLecturerProfile)
		lecturers.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateLecturerProfile)
		lecturers.POST("/assign-course", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.assignCourseToLecturer)
		lecturers.GET("/:id/assignments", middleware.RequireRoles("hod", "admin", "delegated_admin", "lecturer"), server.listLecturerAssignments)
		lecturers.DELETE("/assignments/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.removeCourseAssignment)

		// Leave
		lecturers.POST("/leave", middleware.RequireRoles("lecturer"), server.createLeaveRequestHandler)
		lecturers.GET("/leave/mine", middleware.RequireRoles("lecturer"), server.listMyLeaveRequests)
		lecturers.GET("/leave", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listAllLeaveRequests)
		lecturers.PUT("/leave/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateLeaveStatusHandler)

		// Dashboard
		lecturers.GET("/dashboard/stats", middleware.RequireRoles("lecturer"), server.getLecturerDashboardStats)
	}

	// ── Bursar Dashboard ──
	bursar := api.Group("/bursar")
	{
		bursar.GET("/dashboard", middleware.RequireRoles("bursar_class", "bursar_dept", "hod", "delegated_admin"), server.getBursarDashboardStats)
		bursar.POST("/record-payment", middleware.RequireRoles("bursar_class", "bursar_dept", "hod", "delegated_admin"), server.recordManualPayment)
	}

	// ── AI Integration ──
	aiServer := NewAIServer(server.ai)
	ai := api.Group("/ai")
	{
		ai.POST("/chat", aiServer.Chat)
		ai.GET("/quick-actions", aiServer.GetQuickActions)
		ai.POST("/feedback", aiServer.Feedback)
		ai.GET("/history", aiServer.GetHistory)
		ai.GET("/settings", aiServer.GetSettings)
		ai.PUT("/settings", aiServer.UpdateSettings)
	}

	// ── AI Predictions ──
	predictions := api.Group("/predictions")
	{
		predictions.GET("/gpa", middleware.RequireRoles("student"), server.getStudentGPAPrediction)
		predictions.GET("/at-risk", middleware.RequireRoles("hod", "delegated_admin", "admin", "class_rep"), server.getAtRiskStudents)
		predictions.GET("/revenue", middleware.RequireRoles("hod", "delegated_admin", "admin", "bursar_class", "bursar_dept"), server.getRevenueForecast)
		predictions.GET("/grade-distribution", middleware.RequireRoles("hod", "delegated_admin", "admin", "lecturer"), server.getGradeDistribution)
		predictions.GET("/pass-rate/:id", middleware.RequireRoles("hod", "delegated_admin", "admin", "lecturer"), server.getCoursePassRate)
		predictions.POST("/store", middleware.RequireRoles("hod", "delegated_admin", "admin"), server.storeAIPrediction)
	}

	// ── Exportable Reports ──
	reports := api.Group("/reports")
	reports.Use(middleware.RequireRoles("hod", "delegated_admin", "admin"))
	{
		reports.POST("", server.generateReport)
		reports.GET("", server.listReports)
	}

	// ── CRF signing: auto-stamp a pre-authorized signature onto students'
	// uploaded course registration forms. Standalone document-signing
	// utility, unrelated to the course-registration data elsewhere in the app.
	crfSignatures := api.Group("/crf-signatures")
	crfSignatures.Use(middleware.RequireRoles("hod", "delegated_admin", "admin"))
	{
		crfSignatures.POST("/test-stamp", server.testStampCRF)
		crfSignatures.POST("/:kind", server.uploadCRFSignatureAsset)
		crfSignatures.GET("", server.listCRFSignatureAssets)
		crfSignatures.DELETE("/:kind", server.deleteCRFSignatureAsset)
	}

	crfSigning := api.Group("/crf-signing")
	{
		crfSigning.POST("/upload", server.submitCRFForSigning)
		crfSigning.GET("/mine", server.getMyCRFSubmission)
		crfSigning.GET("/:id/download", server.downloadCRFSubmission)
	}

	// ── Security: Sessions ──
	sessionsAPI := api.Group("/sessions/security")
	{
		sessionsAPI.GET("", server.getMyActiveSessions)
		sessionsAPI.DELETE("/:id", server.revokeSession)
		sessionsAPI.DELETE("", server.revokeAllSessions)
	}

	// ── Grade Appeals ──
	appeals := api.Group("/grade-appeals")
	{
		appeals.POST("", middleware.RequireRoles("student"), server.createGradeAppeal)
		appeals.GET("/my", middleware.RequireRoles("student"), server.listMyAppeals)
		appeals.GET("/pending", middleware.RequireRoles("hod", "admin", "lecturer", "delegated_admin"), server.listPendingAppeals)
		appeals.GET("/:id", server.getGradeAppeal)
		appeals.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "lecturer", "delegated_admin"), server.updateAppealStatus)
	}

	// ── Study Planner ──
	studyTasks := api.Group("/study-tasks")
	{
		studyTasks.POST("", server.createStudyTask)
		studyTasks.GET("", server.listMyStudyTasks)
		studyTasks.GET("/upcoming", server.getUpcomingTasks)
		studyTasks.GET("/ai-plan", server.getAIStudyPlan)
		studyTasks.GET("/:id", server.getStudyTask)
		studyTasks.PUT("/:id", server.updateStudyTask)
		studyTasks.DELETE("/:id", server.deleteStudyTask)
	}

	// ── Class Notice Board ──
	notices := api.Group("/class-notices")
	{
		notices.POST("", middleware.RequireRoles("class_rep", "hod", "admin"), server.createClassNotice)
		notices.GET("", server.listClassNotices)
		notices.GET("/:id", server.getClassNotice)
		notices.PUT("/:id", middleware.RequireRoles("class_rep", "hod", "admin"), server.updateClassNotice)
		notices.DELETE("/:id", middleware.RequireRoles("class_rep", "hod", "admin"), server.deleteClassNotice)
		notices.POST("/:id/comments", server.createNoticeComment)
		notices.GET("/:id/comments", server.listNoticeComments)
	}

	// ── Departmental Calendar ──
	calendar := api.Group("/calendar")
	{
		calendar.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createDepartmentalEvent)
		calendar.GET("", server.listDepartmentalEvents)
		calendar.GET("/:id/ics", server.downloadDepartmentalEventICS)
		calendar.GET("/:id", server.getDepartmentalEvent)
		calendar.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateDepartmentalEvent)
		calendar.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteDepartmentalEvent)
	}

	// ── Expenses ──
	expenses := api.Group("/expenses")
	{
		expenses.POST("", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.createExpense)
		expenses.GET("", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.listExpenses)
		expenses.GET("/summary", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.getExpenseSummary)
		expenses.GET("/by-category", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.getExpensesByCategory)
		expenses.GET("/:id", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.getExpense)
		expenses.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateExpenseStatus)
	}

	// ── In-App Feedback ──
	feedback := api.Group("/feedback")
	{
		feedback.POST("", server.createFeedback)
		feedback.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listFeedback)
		feedback.GET("/my", server.listMyFeedback)
		feedback.GET("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getFeedback)
		feedback.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateFeedbackStatus)
	}

	// ── Help Center ──
	help := api.Group("/help")
	{
		help.GET("", server.listHelpArticles)
		help.GET("/search", server.searchHelpArticles)
		help.GET("/:id", server.getHelpArticle)
		help.POST("/:id/helpful", server.markHelpArticleHelpful)
		help.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createHelpArticle)
		help.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateHelpArticle)
		help.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteHelpArticle)
	}

	// ── Feature Flags ──
	featureFlags := api.Group("/feature-flags")
	{
		featureFlags.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listFeatureFlags)
		featureFlags.POST("", middleware.RequireRoles("hod", "admin"), server.createFeatureFlag)
		featureFlags.GET("/:name", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getFeatureFlag)
		featureFlags.PUT("/:name", middleware.RequireRoles("hod", "admin"), server.updateFeatureFlag)
		featureFlags.PATCH("/:name/toggle", middleware.RequireRoles("hod", "admin"), server.toggleFeatureFlag)
		featureFlags.DELETE("/:name", middleware.RequireRoles("hod", "admin"), server.deleteFeatureFlag)
	}

	// ── GPA Calculator Scenarios ──
	gpaScenarios := api.Group("/gpa-scenarios")
	{
		gpaScenarios.POST("", server.createGPAScenario)
		gpaScenarios.GET("", server.listGPAScenarios)
		gpaScenarios.GET("/:id", server.getGPAScenario)
		gpaScenarios.PUT("/:id", server.updateGPAScenario)
		gpaScenarios.DELETE("/:id", server.deleteGPAScenario)
	}

	// ── Universal Search ──
	api.GET("/search", server.universalSearch)

	// ── Campus Connect V2: Feed & Social ──
	feed := api.Group("/feed")
	{
		feed.POST("", server.createFeedPost)
		feed.GET("", server.listFeedPosts)
		feed.GET("/suggestions", server.getConnectionSuggestions)
		feed.GET("/bookmarks", server.listUserBookmarks)
		feed.GET("/search", server.searchPeople)
		feed.GET("/:id", server.getFeedPost)
		feed.DELETE("/:id", server.deleteFeedPost)
		feed.POST("/:id/hide", server.hideFeedPost)
		feed.POST("/:id/react", server.togglePostReaction)
		feed.GET("/:id/reactions", server.listPostReactions)
		feed.POST("/:id/comments", server.createPostComment)
		feed.GET("/:id/comments", server.listPostComments)
		feed.POST("/:id/bookmark", server.togglePostBookmark)
	}

	// ── Campus Connect V2: Profiles ──
	campusProfile := api.Group("/campus-profile")
	{
		campusProfile.POST("", server.upsertCampusProfile)
		campusProfile.GET("/:user_id", server.getCampusProfile)
	}

	// ── Campus Connect V2: Message Reactions ──
	api.POST("/messages/:id/react", server.toggleMessageReaction)

	// ── Campus Connect V2: Group Files ──
	api.POST("/groups/:id/files", server.uploadGroupFile)
	api.GET("/groups/:id/files", server.listGroupFiles)

	// ── Campus Connect V2: Moderation ──
	api.POST("/reports/campus", server.createCampusReport)
	api.GET("/reports/campus", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listCampusReports)
	api.PUT("/reports/campus/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCampusReportStatus)
	api.POST("/strikes", middleware.RequireRoles("hod", "admin"), server.createConnectionStrikeHandler)

	api.DELETE("/comments/:id", server.deletePostComment)

	// ── Verification & Onboarding V2 ──
	verification := api.Group("/verification")
	verification.Use(middleware.RequireRoles("hod", "admin", "delegated_admin"))
	{
		verification.POST("/bulk-upload", server.bulkUploadVerificationRecords)
		verification.GET("/records", server.listVerificationRecords)
		verification.PUT("/records/:id", server.updateVerificationRecord)
		verification.GET("/unverified", server.listUnverifiedStudents)
	}

	// ── Student Onboarding V2 ──
	api.POST("/onboarding", server.createStudentOnboarding)
	api.GET("/onboarding/status", server.getStudentOnboarding)
	api.GET("/onboarding/admin/list", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listStudentOnboardings)
	api.GET("/onboarding/admin/counts", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.countStudentOnboardingsByStatus)
	api.PUT("/onboarding/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateStudentOnboardingStatus)
	api.POST("/onboarding/bulk-approve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.bulkApproveStudentOnboardings)

	// ── Enhanced Announcements V2 ──
	announcementsV2 := api.Group("/announcements")
	{
		announcementsV2.GET("/feed", server.listStudentAnnouncements)
		announcementsV2.GET("/search", server.searchStudentAnnouncements)
		announcementsV2.GET("/templates", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listAnnouncementTemplatesHandler)
		announcementsV2.POST("/templates", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createAnnouncementTemplateHandler)
	}
	adminAnn := api.Group("/announcements")
	adminAnn.Use(middleware.RequireRoles("hod", "admin", "delegated_admin"))
	{
		adminAnn.POST("", server.createAnnouncementV2)
		adminAnn.GET("/admin", server.listAdminAnnouncements)
		adminAnn.GET("/stats", server.getAnnouncementStats)
	}
	api.GET("/announcements/:id", server.getAnnouncementV2)
	api.PUT("/announcements/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateAnnouncementV2)
	api.DELETE("/announcements/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteAnnouncementV2)
	api.POST("/announcements/:id/publish", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.publishAnnouncement)
	api.POST("/announcements/:id/archive", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.archiveAnnouncement)

	// ── Announcement Read Receipts ──
	api.POST("/announcements/:id/read", server.markAnnouncementRead)
	api.POST("/announcements/:id/acknowledge", server.acknowledgeAnnouncement)
	api.GET("/announcements/:id/read-status", server.getAnnouncementReadStatus)
	api.GET("/announcements/:id/receipts", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listAnnouncementReceipts)
	api.GET("/announcements/:id/unacknowledged", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listUnacknowledgedStudentsHandler)
	api.GET("/announcements/:id/receipt-stats", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.getReceiptStats)

	// ── Announcement Comments ──
	api.POST("/announcements/:id/comments", server.createAnnouncementCommentHandler)
	api.GET("/announcements/:id/comments", server.listAnnouncementCommentsHandler)
	api.DELETE("/announcements/comments/:id", server.deleteAnnouncementCommentHandler)

	server.router = router
	return server
}

func (server *Server) Router() *gin.Engine {
	return server.router
}

func (server *Server) healthCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	dbOK := true
	if err := server.dbPool.Ping(ctx); err != nil {
		dbOK = false
	}

	status := http.StatusOK
	if !dbOK {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"status": map[bool]string{true: "healthy", false: "degraded"}[dbOK],
		"checks": gin.H{
			"database": map[string]interface{}{
				"status": map[bool]string{true: "up", false: "down"}[dbOK],
			},
		},
	})
}
