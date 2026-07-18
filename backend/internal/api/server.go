package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/aces/backend/internal/auth"
	"github.com/aces/backend/internal/config"
	"github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/middleware"
	"github.com/aces/backend/internal/service"
	"github.com/aces/backend/internal/storage"
	"github.com/aces/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		for _, allowed := range allowedOrigins {
			if strings.EqualFold(origin, allowed) {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
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

	auth          *service.AuthService
	users         *service.UserService
	students      *service.StudentService
	courses       *service.CourseService
	results       *service.ResultService
	sessions      *service.SessionService
	semesters     *service.SemesterService
	complaints    *service.ComplaintService
	announcements *service.AnnouncementService
	notifications *service.NotificationService
	transcripts   *service.TranscriptService
	analytics     *service.AnalyticsService
	cgpa          *service.CGPAService
	timetables    *service.TimetableService
	roles         *service.RoleService
	manuals       *service.ManualService
	campusConnect *service.CampusConnectService
	skillsTrade   *service.SkillsTradeService
	alumni        *service.AlumniService
	wsHub         *ws.Hub
	storage       *storage.LocalStorage
}

func NewServer(store db.Querier, dbPool *pgxpool.Pool, cfg *config.Config) *Server {
	tm := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTAccessDuration, cfg.JWTRefreshDuration)
	hub := ws.NewHub()
	go hub.Run()

	server := &Server{
		store:        store,
		dbPool:       dbPool,
		tokenManager: tm,
		config:       cfg,

		auth:          service.NewAuthService(store),
		users:         service.NewUserService(store),
		students:      service.NewStudentService(store),
		courses:       service.NewCourseService(store),
		results:       service.NewResultService(store),
		sessions:      service.NewSessionService(store),
		semesters:     service.NewSemesterService(store),
		complaints:    service.NewComplaintService(store),
		announcements: service.NewAnnouncementService(store),
		notifications: service.NewNotificationService(store),
		transcripts:   service.NewTranscriptService(store),
		analytics:     service.NewAnalyticsService(store),
		cgpa:          service.NewCGPAService(store),
		timetables:    service.NewTimetableService(store),
		roles:         service.NewRoleService(store),
		manuals:       service.NewManualService(store),
		campusConnect: service.NewCampusConnectService(store),
		skillsTrade:   service.NewSkillsTradeService(store),
		alumni:        service.NewAlumniService(store),
		wsHub:         hub,
	}

	// Initialize local storage
	ls, _ := storage.NewLocalStorage(cfg.StorageLocalPath)
	server.storage = ls

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.ResponseNormalizer())
	router.Use(middleware.RequestLogger())
	router.Use(corsMiddleware(cfg.AllowedOrigins))
	router.Use(middleware.RateLimit(100, time.Minute))
	router.Use(middleware.BodySizeLimit(10 << 20))
	router.MaxMultipartMemory = 32 << 20

	rl := middleware.RateLimit(10, time.Minute)
	authRL := middleware.RateLimit(60, time.Minute)

	router.GET("/health", server.healthCheck)

	v1 := router.Group("/api/v1")

	authProtected := v1.Group("/auth")
	authProtected.Use(middleware.JWTAuth(tm))
	{
		authProtected.GET("/me", server.getMe)
		authProtected.POST("/logout", server.logout)
		authProtected.POST("/onboarding", server.studentOnboarding)
	}

	authPublic := v1.Group("/auth")
	{
		authPublic.POST("/signup/student", rl, server.studentSignup)
		authPublic.POST("/signup/lecturer", rl, server.lecturerSignup)
		authPublic.POST("/login", authRL, server.login)
		authPublic.POST("/refresh", authRL, server.refreshToken)
		authPublic.POST("/forgot-password", authRL, server.forgotPassword)
		authPublic.POST("/reset-password", authRL, server.resetPassword)
	}

	v1.POST("/signup/onboarding", server.studentOnboarding)
	v1.POST("/payments/webhook/paystack", server.handlePaystackWebhook)

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
		staff.GET("/:id", server.getStaff)
		staff.GET("/user/:user_id", server.getStaffByUserID)
		staff.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateStaff)
		staff.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteStaff)
	}

	users := api.Group("/users")
	{
		users.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createUser)
		users.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listUsers)
		users.GET("/pending-approvals", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingApprovals)
		users.GET("/:id", server.getUser)
		users.PUT("/:id", server.updateUser)
		users.POST("/:id/approve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.approveSignup)
		users.POST("/:id/reject", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.rejectSignup)
		users.DELETE("/:id", middleware.RequireRoles("hod", "admin"), server.deleteUser)
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
	}

	api.POST("/students", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createStudent)

	attendance := api.Group("/attendance")
	{
		attendance.POST("", middleware.RequireRoles("class_rep", "hod", "delegated_admin"), server.createAttendanceSheet)
		attendance.GET("/course", server.listCourseAttendanceSheets)
		attendance.GET("/student", server.listStudentAttendance)
		attendance.GET("/summary", server.getAttendanceSummary)
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
		courses.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCourse)
		courses.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCourse)
	}

	courseSubcategories := api.Group("/course-subcategories")
	{
		courseSubcategories.GET("", server.listAllCourseSubcategories)
		courseSubcategories.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createCourseSubcategory)
		courseSubcategories.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCourseSubcategoryHandler)
		courseSubcategories.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteCourseSubcategoryHandler)
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

	courseRegistrations := api.Group("/course-registrations")
	{
		courseRegistrations.POST("", middleware.RequireRoles("student", "hod", "delegated_admin"), server.createCourseRegistration)
		courseRegistrations.POST("/submit", middleware.RequireRoles("student"), server.submitRegistration)
		courseRegistrations.GET("/student/:student_id", server.listStudentCourseRegistrations)
		courseRegistrations.GET("/:id", server.getCourseRegistration)
		courseRegistrations.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateCourseRegistration)
		courseRegistrations.POST("/:id/courses", middleware.RequireRoles("student", "hod", "delegated_admin"), server.createRegisteredCourse)
		courseRegistrations.GET("/:id/courses", server.listRegisteredCourses)
		courseRegistrations.PUT("/:id/courses/:registered_course_id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateRegisteredCourse)
		courseRegistrations.DELETE("/:id/courses/:registered_course_id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteRegisteredCourse)
	}

	results := api.Group("/results")
	{
		results.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listAllResults)
		results.POST("", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.createResult)
		results.GET("/:id", server.getResult)
		results.GET("/student/:student_id", server.listStudentResults)
		results.GET("/course/:course_id/session/:session_id", server.listCourseResults)
		results.PUT("/:id", middleware.RequireRoles("lecturer", "hod", "delegated_admin"), server.updateResult)
		results.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateResultStatus)
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
	}

	announcements := api.Group("/announcements")
	{
		announcements.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createAnnouncement)
		announcements.GET("", server.listActiveAnnouncements)
		announcements.GET("/:id", server.getAnnouncement)
		announcements.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateAnnouncement)
		announcements.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteAnnouncement)
	}

	notifications := api.Group("/notifications")
	{
		notifications.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createNotification)
		notifications.GET("/user/:user_id", server.listUserNotifications)
		notifications.POST("/user/:user_id/mark-all-read", server.markAllUserNotificationsAsRead)
		notifications.PUT("/:id/read", server.markNotificationAsRead)
		notifications.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteNotification)
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
		payments.DELETE("/dues/:id", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.deleteDue)

		payments.POST("/cart", middleware.RequireRoles("student"), server.addToCart)
		payments.GET("/cart/:student_id", server.listStudentCart)
		payments.DELETE("/cart/:id", middleware.RequireRoles("student"), server.removeFromCart)
		payments.DELETE("/cart/student/:student_id", middleware.RequireRoles("student"), server.clearStudentCart)

		payments.POST("/batches", middleware.RequireRoles("student"), server.createPaymentBatch)
		payments.GET("/batches/student/:student_id", server.listStudentPaymentBatches)
		payments.GET("/batches/:id", server.getPaymentBatch)
		payments.GET("/batches/:id/payments", server.listBatchPayments)
		payments.PUT("/batches/:id/status", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.updatePaymentBatchStatus)

		payments.POST("", middleware.RequireRoles("student"), server.createPayment)
		payments.POST("/checkout", middleware.RequireRoles("student"), server.initializeCheckout)
		payments.GET("/student/:student_id", server.listStudentPayments)
		payments.GET("/summary/:student_id", server.getStudentPaymentSummary)
		payments.GET("/check-paid", server.checkDuePaid)
		payments.GET("/by-reference", server.getPaymentByReference)
		payments.GET("/defaulters", middleware.RequireRoles("hod", "admin", "bursar_dept", "bursar_class", "delegated_admin"), server.listDefaulters)
		payments.GET("", server.listAllPayments)
		payments.GET("/:id", server.getPayment)
		payments.PUT("/:id/status", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.updatePaymentStatus)
		payments.POST("/:id/verify", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.verifyPayment)
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

	// ── Universal Subcategories ──
	subcategoriesGroup := api.Group("/subcategories")
	{
		subcategoriesGroup.GET("", server.listSubcategories)
		subcategoriesGroup.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createSubcategory)
		subcategoriesGroup.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateSubcategory)
		subcategoriesGroup.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteSubcategory)
		subcategoriesGroup.POST("/reorder", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.reorderSubcategories)
	}

	api.POST("/complaints", middleware.RequireRoles("student"), server.createComplaint)
	api.GET("/complaints", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listComplaints)
	api.GET("/complaints/:id", server.getComplaint)
	api.PUT("/complaints/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateComplaint)
	api.DELETE("/complaints/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteComplaint)
	api.POST("/complaints/:id/assign", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.assignComplaint)
	api.POST("/complaints/:id/resolve", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.resolveComplaint)

	// ── Roles ──
	rolesGroup := api.Group("/roles")
	{
		rolesGroup.GET("", server.listRoles)
		rolesGroup.POST("", middleware.RequireRoles("hod", "admin"), server.createRole)
		rolesGroup.POST("/assign", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.assignUserRole)
		rolesGroup.POST("/revoke", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.revokeUserRole)
		rolesGroup.GET("/user/:id", server.listUserRoles)
		rolesGroup.GET("/user/:id/names", server.listUserRolesByName)
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
		manualsGroup.POST("/purchase", middleware.RequireRoles("student"), server.purchaseManual)
		manualsGroup.GET("/my-purchases", middleware.RequireRoles("student"), server.listMyPurchases)
		manualsGroup.GET("/:id/cover", middleware.RequireRoles("student"), server.downloadManualCover)

		// Admin: bought list & print queue
		manualsGroup.GET("/:id/purchases", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.listManualPurchasesByManual)
		manualsGroup.POST("/purchases/:id/collect", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.markManualCollected)
		manualsGroup.POST("/print-queue", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.addToPrintQueue)
		manualsGroup.GET("/print-queue", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.listPrintQueue)
		manualsGroup.PUT("/print-queue/:id", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.updatePrintQueueStatus)

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
		connect.POST("/messages", server.sendMessage)
		connect.GET("/messages/:id", server.listConversation)
		connect.PUT("/messages/:id/read", server.markMessageRead)
		connect.POST("/groups", server.createGroup)
		connect.GET("/groups", server.listGroups)
		connect.GET("/groups/my", server.listUserGroups)
		connect.GET("/groups/:id", server.getGroup)
		connect.POST("/groups/:id/join", server.joinGroup)
		connect.POST("/groups/:id/leave", server.leaveGroup)
		connect.GET("/groups/:id/members", server.listGroupMembers)
		connect.POST("/groups/:id/messages", server.sendGroupMessage)
		connect.GET("/groups/:id/messages", server.listGroupMessages)
		connect.GET("/directory/students", server.getStudentDirectory)
		connect.GET("/directory/alumni", server.getAlumniDirectory)
	}

	// ── Skills & Trade ──
	skills := api.Group("/skills-trade")
	{
		skills.GET("/categories", server.listSkillCategories)
		skills.POST("/categories", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.createSkillCategory)
		skills.POST("/listings", server.createSkillListing)
		skills.GET("/listings", server.listSkillListings)
		skills.GET("/listings/:id", server.getSkillListing)
		skills.GET("/listings/user/:id", server.listUserSkillListings)
		skills.PUT("/listings/:id", server.updateSkillListing)
		skills.DELETE("/listings/:id", server.deleteSkillListing)
		skills.POST("/trades", server.createTradeOffer)
		skills.GET("/trades", server.listUserTrades)
		skills.GET("/trades/:id", server.getTradeOffer)
		skills.PUT("/trades/:id", server.updateTradeStatus)
		skills.POST("/ratings", server.rateTrade)
		skills.GET("/ratings/user/:id", server.listUserRatings)
		skills.GET("/reputation/user/:id", server.getUserReputation)
	}

	// ── Backups ──
	backups := api.Group("/backups")
	{
		backups.GET("", server.listBackups)
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
		alumniGroup.GET("/mentorship/my", server.listMyMentorshipRequests)
		alumniGroup.POST("/status", server.createAlumniStatus)
		alumniGroup.GET("/status/:id", server.getAlumniStatus)
		alumniGroup.GET("", server.listAlumni)
		alumniGroup.PUT("/status/:id", server.updateAlumniStatus)
		alumniGroup.POST("/verify/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.verifyAlumni)
		alumniGroup.GET("/verifications/pending", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listPendingAlumniVerifications)
		alumniGroup.POST("/mentorship/requests", server.requestMentorship)
		alumniGroup.GET("/mentorship/student/:id", server.listStudentMentorshipRequests)
		alumniGroup.GET("/mentorship/mentor/:id", server.listMentorMentorshipRequests)
		alumniGroup.PUT("/mentorship/requests/:id", server.updateMentorshipStatus)
		alumniGroup.POST("/jobs", server.createJobPost)
		alumniGroup.GET("/jobs", server.listJobPosts)
		alumniGroup.GET("/jobs/:id", server.getJobPost)
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
		alumniGroup.GET("/donations", server.listDonations)
		alumniGroup.GET("/donations/mine", server.listMyDonations)
		alumniGroup.GET("/donations/stats", server.getDonationStats)
	}

	// ── Student Dashboard ──
	api.GET("/dashboard/student", middleware.RequireRoles("student"), server.getStudentDashboard)

	// ── Class Representative Management ──
	classRep := api.Group("/class-rep")
	{
		classRep.GET("/class-list", middleware.RequireRoles("class_rep"), server.getClassRepClassList)
		classRep.GET("/pending-registrations", middleware.RequireRoles("class_rep"), server.listPendingCourseRegistrations)
		classRep.POST("/appoint", middleware.RequireRoles("hod", "admin"), server.appointClassRep)
		classRep.GET("/list", middleware.RequireRoles("hod", "admin"), server.listClassReps)
		classRep.DELETE("/:id", middleware.RequireRoles("hod", "admin"), server.deactivateClassRep)

		// Attendance sessions
		classRep.POST("/attendance-sessions", middleware.RequireRoles("class_rep"), server.createAttendanceSession)
		classRep.PUT("/attendance-sessions/:id/open", middleware.RequireRoles("class_rep"), server.openAttendanceSession)
		classRep.PUT("/attendance-sessions/:id/close", middleware.RequireRoles("class_rep"), server.closeAttendanceSession)
		classRep.GET("/attendance-sessions/mine", middleware.RequireRoles("class_rep"), server.listMyAttendanceSessions)
		classRep.GET("/attendance-sessions/:id/checkins", middleware.RequireRoles("class_rep"), server.listAttendanceSessionCheckins)
		classRep.POST("/checkin", middleware.RequireRoles("class_rep"), server.checkInStudent)

		// Elections
		classRep.POST("/elections", middleware.RequireRoles("hod", "admin"), server.createElection)
		classRep.GET("/elections", server.listElections)
		classRep.GET("/elections/:id", server.getElection)
		classRep.POST("/elections/:id/nominate", middleware.RequireRoles("student"), server.nominateForElection)
		classRep.POST("/elections/:id/vote", middleware.RequireRoles("student"), server.castVote)
		classRep.PUT("/elections/:id/complete", middleware.RequireRoles("hod", "admin"), server.completeElection)
		classRep.PUT("/nominees/:nominee_id/approve", middleware.RequireRoles("hod", "admin"), server.approveNominee)

		// Reports
		classRep.POST("/reports", middleware.RequireRoles("class_rep"), server.submitClassRepReport)
		classRep.GET("/reports", middleware.RequireRoles("class_rep"), server.listClassRepReports)
		classRep.GET("/reports/all", middleware.RequireRoles("hod", "admin"), server.listAllClassRepReports)
		classRep.PUT("/reports/:id/status", middleware.RequireRoles("hod", "admin"), server.updateClassRepReportStatus)

		// Performance reviews
		classRep.POST("/performance", middleware.RequireRoles("hod", "admin"), server.createPerformanceReview)
		classRep.GET("/performance", server.listPerformanceReviews)
	}

	// ── Lecturer Management ──
	lecturers := api.Group("/lecturers")
	{
		lecturers.GET("", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.listLecturers)
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
		bursar.GET("/dashboard", middleware.RequireRoles("class_bursar", "dept_bursar", "hod", "delegated_admin"), server.getBursarDashboardStats)
		bursar.POST("/record-payment", middleware.RequireRoles("class_bursar", "dept_bursar", "hod", "delegated_admin"), server.recordManualPayment)
	}

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
