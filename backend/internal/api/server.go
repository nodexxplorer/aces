package api

import (
	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/token"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Server serves HTTP requests for the backend service.
type Server struct {
	store      db.Querier
	tokenMaker token.Maker
	router     *gin.Engine
}

// NewServer creates a new HTTP server and sets up routing.
func NewServer(store db.Querier, tokenMaker token.Maker) *Server {
	server := &Server{
		store:      store,
		tokenMaker: tokenMaker,
	}
	router := gin.Default()

	// Allow all origins (CORS disabled for development)
	router.Use(cors.Default())

	// Public routes
	users := router.Group("/users")
	{
		users.POST("", server.createUser)            // Public: Registration
		users.POST("/login", server.loginUser)       // Public: Login
		users.POST("/refresh", server.renewAccessToken) // Public: Refresh Token
	}

	staff := router.Group("/staff")
	{
		staff.POST("", server.createStaff) // Public: Registration
	}

	router.POST("/students", server.createStudent) // Public: Registration

	// Protected routes
	authRoutes := router.Group("/")
	authRoutes.Use(AuthMiddleware(server.tokenMaker))

	// Sessions routes
	sessions := authRoutes.Group("/sessions")
	{
		sessions.POST("", server.createSession)
		sessions.GET("", server.listSessions)
		sessions.GET("/:id", server.getSession)
		sessions.PUT("/:id", server.updateSession)
		sessions.DELETE("/:id", server.deleteSession)
	}

	// Semesters routes
	semesters := authRoutes.Group("/semesters")
	{
		semesters.POST("", server.createSemester)
		semesters.GET("/session/:session_id", server.listSessionSemesters)
		semesters.GET("/:id", server.getSemester)
		semesters.PUT("/:id", server.updateSemester)
		semesters.DELETE("/:id", server.deleteSemester)
	}

	// Staff routes (Protected)
	staffProtected := authRoutes.Group("/staff")
	{
		staffProtected.GET("", server.listStaff)
		staffProtected.GET("/:id", server.getStaff)
		staffProtected.GET("/user/:user_id", server.getStaffByUserID)
		staffProtected.PUT("/:id", server.updateStaff)
		staffProtected.DELETE("/:id", server.deleteStaff)
	}

	// Users routes (Protected)
	usersProtected := authRoutes.Group("/users")
	{
		usersProtected.GET("", server.listUsers)
		usersProtected.GET("/:id", server.getUser)
		usersProtected.PUT("/:id", server.updateUser)
		usersProtected.DELETE("/:id", server.deleteUser)
	}

	// Attendance routes
	attendance := authRoutes.Group("/attendance")
	{
		attendance.POST("", server.createAttendanceSheet)
		attendance.GET("/course", server.listCourseAttendanceSheets)
		attendance.GET("/student", server.listStudentAttendance)
		attendance.GET("/summary", server.getAttendanceSummary)
		attendance.GET("/:id", server.getAttendanceSheet)
		attendance.PUT("/:id", server.updateAttendanceSheet)
		attendance.POST("/:id/finalize", server.finalizeAttendanceSheet)
		attendance.DELETE("/:id", server.deleteAttendanceSheet)
	}

	// Courses routes
	courses := authRoutes.Group("/courses")
	{
		courses.POST("", server.createCourse)
		courses.GET("", server.listCourses)
		courses.GET("/:id", server.getCourse)
		courses.PUT("/:id", server.updateCourse)
		courses.DELETE("/:id", server.deleteCourse)
	}

	// Assignments routes
	assignments := authRoutes.Group("/assignments")
	{
		assignments.POST("", server.createAssignment)
		assignments.GET("/course/:course_id/session/:session_id", server.listCourseAssignments)
		assignments.GET("/:id", server.getAssignment)
		assignments.PUT("/:id", server.updateAssignment)
		assignments.DELETE("/:id", server.deleteAssignment)

		// Assignment Grades
		assignments.POST("/grades", server.createAssignmentGrade)
		assignments.GET("/grades/lookup", server.getAssignmentGrade) // expects ?assignment_id=X&student_id=Y
		assignments.GET("/:assignment_id/grades", server.listAssignmentGrades)
		assignments.GET("/grades/student/:student_id", server.listStudentAssignmentGrades)
		assignments.PUT("/grades/:id", server.updateAssignmentGrade)
		assignments.DELETE("/grades/:id", server.deleteAssignmentGrade)
	}

	// Course Registration routes
	courseRegistrations := authRoutes.Group("/course-registrations")
	{
		courseRegistrations.POST("", server.createCourseRegistration)
		courseRegistrations.GET("/student/:student_id", server.listStudentCourseRegistrations)
		courseRegistrations.GET("/:id", server.getCourseRegistration)
		courseRegistrations.PUT("/:id", server.updateCourseRegistration)

		// Registered Courses under a registration
		courseRegistrations.POST("/:id/courses", server.createRegisteredCourse)
		courseRegistrations.GET("/:id/courses", server.listRegisteredCourses)
		courseRegistrations.PUT("/:id/courses/:registered_course_id", server.updateRegisteredCourse)
		courseRegistrations.DELETE("/:id/courses/:registered_course_id", server.deleteRegisteredCourse)
	}

	// Result routes
	results := authRoutes.Group("/results")
	{
		results.POST("", server.createResult)
		results.GET("/:id", server.getResult)
		results.GET("/student/:student_id", server.listStudentResults)
		results.GET("/course/:course_id/session/:session_id", server.listCourseResults)
		results.PUT("/:id", server.updateResult)
		results.PUT("/:id/status", server.updateResultStatus)

		results.POST("/:id/audit-logs", server.createResultAuditLog)
		results.GET("/:id/audit-logs", server.listResultAuditLogs)
	}

	// Carryover routes
	carryovers := authRoutes.Group("/carryovers")
	{
		carryovers.POST("", server.createCarryoverCourse)
		carryovers.GET("/:id", server.getCarryoverCourse)
		carryovers.PUT("/:id", server.updateCarryoverCourse)
		carryovers.DELETE("/:id", server.deleteCarryoverCourse)
		carryovers.GET("/student/:student_id", server.listStudentCarryoverCourses)
	}

	// Announcement routes
	announcements := authRoutes.Group("/announcements")
	{
		announcements.POST("", server.createAnnouncement)
		announcements.GET("", server.listActiveAnnouncements)
		announcements.GET("/:id", server.getAnnouncement)
		announcements.PUT("/:id", server.updateAnnouncement)
		announcements.DELETE("/:id", server.deleteAnnouncement)
	}

	// Notification routes
	notifications := authRoutes.Group("/notifications")
	{
		notifications.POST("", server.createNotification)
		notifications.GET("/user/:user_id", server.listUserNotifications)
		notifications.POST("/user/:user_id/mark-all-read", server.markAllUserNotificationsAsRead)
		notifications.PUT("/:id/read", server.markNotificationAsRead)
		notifications.DELETE("/:id", server.deleteNotification)
	}

	// Timetable routes
	timetables := authRoutes.Group("/timetable")
	{
		timetables.POST("", server.createTimetableEntry)
		timetables.GET("", server.listTimetableEntries)
		timetables.GET("/:id", server.getTimetableEntry)
		timetables.PUT("/:id", server.updateTimetableEntry)
		timetables.DELETE("/:id", server.deleteTimetableEntry)
	}

	// Payment routes
	payments := authRoutes.Group("/payments")
	{
		// Dues
		payments.POST("/dues", server.createDue)
		payments.GET("/dues", server.listDues)
		payments.GET("/dues/level", server.listDuesByLevel)
		payments.GET("/dues/:id", server.getDue)
		payments.PUT("/dues/:id", server.updateDue)
		payments.DELETE("/dues/:id", server.deleteDue)

		// Cart
		payments.POST("/cart", server.addToCart)
		payments.GET("/cart/:student_id", server.listStudentCart)
		payments.DELETE("/cart/:id", server.removeFromCart)
		payments.DELETE("/cart/student/:student_id", server.clearStudentCart)

		// Batches
		payments.POST("/batches", server.createPaymentBatch)
		payments.GET("/batches/student/:student_id", server.listStudentPaymentBatches)
		payments.GET("/batches/:id", server.getPaymentBatch)
		payments.GET("/batches/:id/payments", server.listBatchPayments)
		payments.PUT("/batches/:id/status", server.updatePaymentBatchStatus)

		// Individual Payments
		payments.POST("", server.createPayment)
		payments.GET("/student/:student_id", server.listStudentPayments)
		payments.GET("/summary/:student_id", server.getStudentPaymentSummary)
		payments.GET("/check-paid", server.checkDuePaid)
		payments.GET("/:id", server.getPayment)
		payments.PUT("/:id/status", server.updatePaymentStatus)
		payments.POST("/:id/verify", server.verifyPayment)
	}

	// Transcript Requests routes
	transcripts := authRoutes.Group("/transcript-requests")
	{
		transcripts.POST("", server.createTranscriptRequest)
		transcripts.GET("/pending", server.listPendingTranscriptRequests)
		transcripts.GET("/student/:student_id", server.listStudentTranscriptRequests)
		transcripts.GET("/:id", server.getTranscriptRequest)
		transcripts.PUT("/:id", server.updateTranscriptRequest)
		transcripts.DELETE("/:id", server.deleteTranscriptRequest)
	}

	// Profile Update Requests routes
	profileUpdates := authRoutes.Group("/profile-update-requests")
	{
		profileUpdates.POST("", server.createProfileUpdateRequest)
		profileUpdates.GET("/pending", server.listPendingProfileUpdateRequests)
		profileUpdates.GET("/student/:student_id", server.listStudentProfileUpdateRequests)
		profileUpdates.GET("/:id", server.getProfileUpdateRequest)
		profileUpdates.PUT("/:id", server.updateProfileUpdateRequestStatus)
		profileUpdates.DELETE("/:id", server.deleteProfileUpdateRequest)
	}

	// Admin Permissions routes
	adminPermissions := authRoutes.Group("/admin-permissions")
	{
		adminPermissions.POST("", server.grantAdminPermission)
		adminPermissions.GET("", server.listAdminPermissions)
		adminPermissions.GET("/:user_id", server.getAdminPermission)
		adminPermissions.PUT("/:user_id", server.updateAdminPermission)
		adminPermissions.DELETE("/:user_id", server.revokeAdminPermission)
	}

	server.router = router
	return server
}

// Start runs the HTTP server on a specific address.
func (server *Server) Start(address string) error {
	return server.router.Run(address)
}

