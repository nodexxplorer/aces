package api

import (
	"github.com/aces/backend/internal/db/sql"
	"github.com/gin-gonic/gin"
)

// Server serves HTTP requests for the backend service.
type Server struct {
	store  db.Querier
	router *gin.Engine
}

// NewServer creates a new HTTP server and sets up routing.
func NewServer(store db.Querier) *Server {
	server := &Server{store: store}
	router := gin.Default()

	// Users routes
	router.POST("/users", server.createUser)

	// Students routes
	router.POST("/students", server.createStudent)

	// Attendance routes
	attendance := router.Group("/attendance")
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

	// Course Registration routes
	courseRegistrations := router.Group("/course-registrations")
	{
		courseRegistrations.POST("", server.createCourseRegistration)
		courseRegistrations.GET("/student/:student_id", server.listStudentCourseRegistrations)
		courseRegistrations.GET("/:id", server.getCourseRegistration)
		courseRegistrations.PUT("/:id", server.updateCourseRegistration)
		
		// Registered Courses under a registration
		courseRegistrations.POST("/:id/courses", server.createRegisteredCourse)
		courseRegistrations.GET("/:id/courses", server.listRegisteredCourses)
		courseRegistrations.DELETE("/:id/courses/:registered_course_id", server.deleteRegisteredCourse)
	}

	// Result routes
	results := router.Group("/results")
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
	carryovers := router.Group("/carryovers")
	{
		carryovers.POST("", server.createCarryoverCourse)
		carryovers.GET("/:id", server.getCarryoverCourse)
		carryovers.PUT("/:id", server.updateCarryoverCourse)
		carryovers.GET("/student/:student_id", server.listStudentCarryoverCourses)
	}

	// Announcement routes
	announcements := router.Group("/announcements")
	{
		announcements.POST("", server.createAnnouncement)
		announcements.GET("", server.listActiveAnnouncements)
		announcements.GET("/:id", server.getAnnouncement)
		announcements.PUT("/:id", server.updateAnnouncement)
		announcements.DELETE("/:id", server.deleteAnnouncement)
	}

	// Notification routes
	notifications := router.Group("/notifications")
	{
		notifications.POST("", server.createNotification)
		notifications.GET("/user/:user_id", server.listUserNotifications)
		notifications.POST("/user/:user_id/mark-all-read", server.markAllUserNotificationsAsRead)
		notifications.PUT("/:id/read", server.markNotificationAsRead)
		notifications.DELETE("/:id", server.deleteNotification)
	}

	// Timetable routes
	timetables := router.Group("/timetable")
	{
		timetables.POST("", server.createTimetableEntry)
		timetables.GET("", server.listTimetableEntries)
		timetables.GET("/:id", server.getTimetableEntry)
		timetables.PUT("/:id", server.updateTimetableEntry)
		timetables.DELETE("/:id", server.deleteTimetableEntry)
	}

	server.router = router
	return server
}

// Start runs the HTTP server on a specific address.
func (server *Server) Start(address string) error {
	return server.router.Run(address)
}
