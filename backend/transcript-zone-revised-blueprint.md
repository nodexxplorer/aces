# TRANSCRIPT ZONE — REVISED COMPLETE FILE STRUCTURE & BLUEPRINT
## React 19 + TypeScript + Vite (Frontend) | Go + Gin (Backend)
### Updated: Self-registration for Students & Class Reps | HOD/Admin creates Lecturers | Opay Payment | Unified Login

---

## PART 1 — FRONTEND STRUCTURE

```
transcript-zone-web/
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── manifest.json                          # PWA manifest
│
├── src/
│   ├── main.tsx                               # React root, QueryClient, Router provider
│   ├── App.tsx                                # Route outlet + global toast/notification wrapper
│   ├── router.tsx                             # All route definitions with role guards + approval gates
│   │
│   ├── api/                                   # All HTTP calls (Axios)
│   │   ├── client.ts                          # Axios instance + interceptors (JWT, 401 refresh, Opay headers)
│   │   ├── auth.ts                            # login, logout, refresh, me, forgot-password, reset-password
│   │   ├── signup.ts                          # studentSignup, lecturerSignup (public), classRepSignup (public)
│   │   ├── results.ts                         # CRUD results, bulk upload, approve, reject, audit
│   │   ├── payments.ts                        # dues, cart, checkout (Opay), history, verify
│   │   ├── attendance.ts                      # sheets CRUD, finalize, PDF download
│   │   ├── courses.ts                         # course catalog, registration, carryovers, departmental/non-departmental
│   │   ├── assignments.ts                     # create, grade, list, upload question
│   │   ├── complaints.ts                      # submit, track, assign, resolve
│   │   ├── transcripts.ts                     # request, pay, download, QR verify
│   │   ├── timetable.ts                       # create, list, conflict flags
│   │   ├── announcements.ts                   # create, list, pin
│   │   ├── notifications.ts                   # list, mark-read, unread count
│   │   ├── analytics.ts                       # lecturer perf, sessional reports, CGPA
│   │   ├── users.ts                           # create, update, deactivate, delegate, pending approvals
│   │   ├── sessions.ts                        # academic session + semester management
│   │   └── cgpa.ts                            # auto-calculate, what-if predictor, academic standing
│   │
│   ├── stores/                                # Zustand (client state only)
│   │   ├── authStore.ts                       # user, token, isAuthenticated, isApproved, login(), logout()
│   │   ├── approvalStore.ts                   # pendingApprovalCount, approvalStatus (for students/class reps)
│   │   ├── cartStore.ts                       # items[], addItem(), removeItem(), total
│   │   ├── themeStore.ts                      # isDarkMode, toggleTheme()
│   │   └── notificationStore.ts               # unreadCount, lastFetched
│   │
│   ├── hooks/                                 # Custom React hooks
│   │   ├── useAuth.ts                         # reads authStore, derives role helpers
│   │   ├── useApprovalStatus.ts               # checks if student/class rep is approved by class rep/admin
│   │   ├── useRBAC.ts                         # canAccess(role[]), hasPermission(action)
│   │   ├── useDarkMode.ts                     # syncs themeStore with <html> class
│   │   ├── useOfflineSync.ts                  # monitors navigator.onLine, triggers Dexie sync
│   │   ├── useNotification.ts                 # polls/subscribes to notifications
│   │   ├── useDebounce.ts                     # generic debounce for search inputs
│   │   └── useCGPACalculator.ts               # auto-calculate CGPA, GPA, academic standing
│   │
│   ├── db/
│   │   └── offlineDb.ts                       # Dexie.js schema: attendance table (IndexedDB)
│   │
│   ├── types/                                 # TypeScript interfaces mirroring DB models
│   │   ├── index.ts                           # barrel export
│   │   ├── user.ts                            # User, UserRole, AdminPermissions
│   │   ├── student.ts                         # Student, AcademicStanding, GraduationStatus, AdmissionMode
│   │   ├── result.ts                          # Result, ResultStatus, Grade, AuditLog
│   │   ├── payment.ts                         # Due, PaymentCart, PaymentBatch, Payment, OpayTransaction
│   │   ├── attendance.ts                      # AttendanceSheet, AttendanceRecord
│   │   ├── course.ts                          # Course, CourseRegistration, RegisteredCourse, CourseType
│   │   ├── assignment.ts                      # Assignment, AssignmentGrade
│   │   ├── complaint.ts                       # Complaint, ComplaintStatus, ComplaintPriority
│   │   ├── transcript.ts                      # TranscriptRequest, TranscriptStatus
│   │   ├── timetable.ts                       # Timetable, ConflictDetails
│   │   ├── notification.ts                    # Notification, NotificationType
│   │   ├── announcement.ts                    # Announcement
│   │   ├── analytics.ts                       # LecturerPerf, SessionalReport, CGPATrend
│   │   └── cgpa.ts                            # CGPARule, GradeBoundary, AcademicStandingRule
│   │
│   ├── utils/
│   │   ├── formatters.ts                      # formatCurrency (₦), formatDate, gradeToPoint
│   │   ├── validators.ts                      # client-side helpers (matric regex, score range, reg no validation)
│   │   ├── constants.ts                       # GRADE_BOUNDARIES, ROLES, SEMESTER_TYPES, COURSE_TYPES
│   │   ├── cgpa.ts                            # calculateCGPA(), gradePoint(), whatIfPredictor()
│   │   ├── pdf.ts                             # jsPDF wrappers for attendance/transcript PDFs
│   │   └── opay.ts                            # Opay API helpers, signature verification
│   │
│   ├── components/
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx                   # Protected wrapper: sidebar + topnav + outlet
│   │   │   ├── Sidebar.tsx                    # Role-filtered nav links + collapse support
│   │   │   ├── TopNavbar.tsx                  # Search, notification bell, avatar/logout
│   │   │   ├── PublicLayout.tsx               # Login / forgot-password / signup wrapper
│   │   │   └── ApprovalGate.tsx               # Blocks unapproved students/class reps with "Waiting for approval" UI
│   │   │
│   │   ├── ui/                                # Primitive, reusable components
│   │   │   ├── Button.tsx                     # variants: primary, ghost, danger, loading state
│   │   │   ├── Input.tsx                      # label, error, helper text
│   │   │   ├── Select.tsx                     # Headless UI listbox wrapper
│   │   │   ├── Modal.tsx                      # Headless UI dialog wrapper
│   │   │   ├── Tabs.tsx                       # Headless UI tabs wrapper
│   │   │   ├── Badge.tsx                      # generic color badge
│   │   │   ├── Card.tsx                       # bordered container
│   │   │   ├── Spinner.tsx                    # loading spinner (sizes: sm/md/lg)
│   │   │   ├── Skeleton.tsx                   # loading skeleton placeholder
│   │   │   ├── Tooltip.tsx                    # hover tooltip
│   │   │   ├── Dropdown.tsx                   # Headless UI menu
│   │   │   ├── Pagination.tsx                 # page number + prev/next
│   │   │   └── EmptyState.tsx                 # icon + message for empty lists
│   │   │
│   │   ├── data-display/
│   │   │   ├── DataTable.tsx                  # AG Grid wrapper: sort, filter, export CSV
│   │   │   ├── KpiCard.tsx                    # metric card: label, value, delta, icon
│   │   │   ├── GradeBadge.tsx                 # A/B/C/D/E/F with color coding
│   │   │   ├── StatusBadge.tsx                # pending/approved/rejected/open/resolved etc.
│   │   │   ├── ResultRow.tsx                  # single result display row
│   │   │   ├── PaymentStatusBadge.tsx         # pending/completed/failed/refunded
│   │   │   ├── ApprovalStatusBadge.tsx        # waiting/approved/rejected
│   │   │   └── CourseTypeBadge.tsx            # departmental/non-departmental
│   │   │
│   │   ├── forms/
│   │   │   ├── ScoreInputForm.tsx             # CA + Exam score fields with Zod validation
│   │   │   ├── BulkUploadForm.tsx             # CSV upload + preview before confirm
│   │   │   ├── ComplaintForm.tsx              # category, subject, body
│   │   │   ├── ProfileUpdateForm.tsx          # student requests change, HOD approves
│   │   │   ├── AssignmentForm.tsx             # lecturer creates assignment
│   │   │   ├── DueForm.tsx                    # bursar creates/edits a due
│   │   │   ├── AnnouncementForm.tsx           # HOD/admin posts announcement
│   │   │   ├── TimetableForm.tsx              # admin inputs exam timetable entry
│   │   │   ├── CourseRegistrationForm.tsx     # student picks courses, credit check
│   │   │   ├── UserCreateForm.tsx             # HOD creates user (lecturer), assigns role
│   │   │   ├── StudentSignupForm.tsx          # name, DOB, reg no, level, admission mode, year admitted, email, password
│   │   │   ├── ClassRepSignupForm.tsx         # name, reg no, level, email, password
│   │   │   ├── LecturerSignupForm.tsx         # name, school email, phone, password
│   │   │   └── StudentOnboardingForm.tsx      # additional school details after signup
│   │   │
│   │   └── feedback/
│   │       ├── Toast.tsx                      # success/error/warning toast
│   │       ├── ConfirmDialog.tsx              # "Are you sure?" modal
│   │       ├── OfflineBanner.tsx              # yellow banner when offline
│   │       ├── ErrorBoundary.tsx              # catches render errors gracefully
│   │       └── ApprovalPendingBanner.tsx      # shows "Waiting for approval" message
│   │
│   └── pages/                                 # One file per route
│       │
│       ├── auth/
│       │   ├── LoginPage.tsx                  # Unified login: email/password, JWT, role redirect
│       │   ├── ForgotPasswordPage.tsx         # request reset link
│       │   ├── StudentSignupPage.tsx          # public student registration
│       │   ├── ClassRepSignupPage.tsx         # public class rep registration
│       │   └── LecturerSignupPage.tsx         # public lecturer registration (but HOD can also create)
│       │
│       ├── onboarding/
│       │   └── StudentOnboardingPage.tsx      # additional details after signup, before approval
│       │
│       ├── Dashboard.tsx                      # role-aware: KPIs differ per role + approval status
│       │
│       ├── student/
│       │   ├── ResultsPage.tsx                # student views own results per session (matched by reg no)
│       │   ├── ResultDetailPage.tsx           # single result: scores, grade, audit trail
│       │   ├── PaymentsPage.tsx               # dues list + cart + checkout (Opay) + history
│       │   ├── TranscriptsPage.tsx            # request, pay fee, download, QR verify
│       │   ├── CourseRegistrationPage.tsx     # pick courses, carryovers, submit
│       │   ├── ComplaintsPage.tsx             # submit + track own complaints
│       │   ├── TimetablePage.tsx              # view exam timetable, conflict alerts
│       │   └── ProfilePage.tsx                # view profile, request updates (non-sensitive only)
│       │
│       ├── lecturer/
│       │   ├── LecturerDashboard.tsx          # assigned courses, pending results, "waiting for courses" state
│       │   ├── ScoreEntryPage.tsx             # input CA + Exam per student per course
│       │   ├── BulkUploadPage.tsx             # download template, upload CSV, preview
│       │   ├── AssignmentsPage.tsx            # create assignments, grade submissions
│       │   ├── ClassListPage.tsx              # view enrolled students per course
│       │   └── LecturerReportsPage.tsx        # download class performance PDF
│       │
│       ├── class-rep/
│       │   ├── ClassRepDashboard.tsx          # attendance, assignments, pending requests
│       │   ├── AttendancePage.tsx             # AG Grid spreadsheet, offline-first, sync
│       │   ├── AssignmentUploadPage.tsx       # upload question paper for a course
│       │   ├── PendingRequestsPage.tsx        # accept/reject student signups for their level
│       │   └── ClassListPage.tsx              # view students in their class/level
│       │
│       ├── bursar/
│       │   ├── BursarDashboard.tsx            # dept bursar: all dues + defaulters overview
│       │   ├── DuesManagementPage.tsx         # create/edit/deactivate dues
│       │   ├── PaymentVerificationPage.tsx      # review + verify student payments
│       │   └── DefaultersPage.tsx             # list of students with unpaid dues
│       │
│       ├── admin/                             # HOD + Delegated Admin
│       │   ├── AdminDashboard.tsx             # full KPI overview: results, payments, complaints
│       │   ├── ResultApprovalPage.tsx         # pending results queue, approve/reject + reason
│       │   ├── UserManagementPage.tsx         # create/edit/deactivate users, assign roles
│       │   ├── PendingApprovalsPage.tsx       # approve/reject student & class rep signups
│       │   ├── DelegateAdminPage.tsx          # grant/revoke granular admin permissions
│       │   ├── AnalyticsPage.tsx              # lecturer perf, grade distribution, CGPA trends
│       │   ├── SessionManagementPage.tsx      # create sessions, semesters, archive old
│       │   ├── CourseManagementPage.tsx       # course catalog CRUD, tag departmental/non-departmental
│       │   ├── AnnouncementsPage.tsx          # post, pin, expire announcements
│       │   ├── TranscriptQueuePage.tsx        # process transcript requests, generate PDF+QR
│       │   ├── GraduationCheckPage.tsx        # per-student eligibility checklist
│       │   ├── ReportsPage.tsx                # sessional PDF generator per level
│       │   ├── BackupPage.tsx                 # trigger manual AWS S3 backup, view backup log
│       │   ├── ComplaintsManagePage.tsx       # all tickets, assign, resolve, escalate
│       │   ├── TimetableManagePage.tsx        # input exam timetable, view conflicts
│       │   ├── CGPASettingsPage.tsx           # configure CGPA rules, grade boundaries, standing rules
│       │   └── SettingsPage.tsx               # system config: roles, permissions, etc.
│       │
│       └── shared/
│           ├── NotificationsPage.tsx          # all notifications, mark read
│           └── NotFoundPage.tsx               # 404
│
├── index.html
├── .env                                     # VITE_API_URL, VITE_OPAY_PUBLIC_KEY, VITE_PAYSTACK_PUBLIC_KEY (backup)
├── .env.example
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── eslint.config.js
└── package.json
```

---

## PART 2 — BACKEND STRUCTURE

```
transcript-zone-api/
│
├── cmd/
│   └── api/
│       └── main.go                            # Entry: load config, connect DB/Redis, start server
│
├── internal/
│   │
│   ├── config/
│   │   └── config.go                          # Viper: DATABASE_URL, JWT_SECRET, OPAY_SECRET_KEY, etc.
│   │
│   ├── server/
│   │   └── server.go                          # Gin setup: middleware chain, route registration
│   │
│   ├── db/                                    # sqlc auto-generated (do not manually edit)
│   │   ├── db.go                              # pgx pool connection
│   │   ├── models.go                          # all Go structs from DB schema
│   │   ├── querier.go                         # interface for all queries
│   │   └── queries.sql.go                     # generated typed query functions
│   │
│   ├── handlers/                              # HTTP handlers (thin — delegate to services)
│   │   ├── auth_handler.go                    # login, refresh, logout, forgot, reset, me
│   │   ├── signup_handler.go                  # studentSignup, classRepSignup, lecturerSignup
│   │   ├── approval_handler.go                # approve/reject student & class rep signups
│   │   ├── result_handler.go                  # CRUD results, bulk upload, approve, reject, audit
│   │   ├── payment_handler.go                 # dues, cart, checkout, verify, webhook (Opay), history
│   │   ├── attendance_handler.go              # sheets CRUD, finalize, PDF, email
│   │   ├── course_handler.go                  # catalog CRUD, registration, carryovers, course type
│   │   ├── assignment_handler.go            # create, upload question, grade, list
│   │   ├── complaint_handler.go               # submit, assign, update status, resolve
│   │   ├── transcript_handler.go              # request, generate PDF+QR, download, verify
│   │   ├── timetable_handler.go               # CRUD timetable, conflict detection
│   │   ├── announcement_handler.go            # create, pin, list, expire
│   │   ├── notification_handler.go            # list, mark-read, unread count
│   │   ├── analytics_handler.go               # lecturer perf, CGPA, sessional reports
│   │   ├── user_handler.go                    # create, update, deactivate, delegate perms
│   │   ├── session_handler.go                 # sessions + semesters management
│   │   ├── student_handler.go                 # profile, standing, graduation check, onboarding
│   │   ├── cgpa_handler.go                    # auto-calculate CGPA, what-if predictor
│   │   └── backup_handler.go                  # trigger backup, list backups
│   │
│   ├── services/                              # Business logic layer
│   │   ├── auth_service.go                    # login, JWT pair, refresh, password reset
│   │   ├── signup_service.go                  # student/class rep self-registration, lecturer signup
│   │   ├── approval_service.go                # approve/reject signups, notify users
│   │   ├── result_service.go                  # validation, CGPA trigger, audit log, bulk CSV
│   │   ├── payment_service.go                 # cart ops, Opay init, webhook handling
│   │   ├── attendance_service.go              # sheet ops, PDF generation, email trigger
│   │   ├── course_service.go                  # catalog, registration, credit hour checks, course type
│   │   ├── assignment_service.go            # assignment lifecycle, grading, late flags
│   │   ├── complaint_service.go               # status machine, SLA escalation logic
│   │   ├── transcript_service.go              # PDF + QR gen, fee verification, email send
│   │   ├── timetable_service.go               # conflict detection algorithm
│   │   ├── announcement_service.go            # create, target audience logic
│   │   ├── notification_service.go            # create, bulk email, SendGrid calls
│   │   ├── analytics_service.go               # aggregate queries, CGPA calc, report gen
│   │   ├── student_service.go                 # academic standing calc, graduation check, onboarding
│   │   ├── user_service.go                    # CRUD users, role assignment, delegate perms
│   │   ├── session_service.go                 # session lifecycle, auto-archive
│   │   ├── cgpa_service.go                    # grade points, GPA, CGPA, what-if predictor, auto-calculate
│   │   └── backup_service.go                  # pg_dump + S3 upload + schedule
│   │
│   ├── middleware/
│   │   ├── auth.go                            # JWTAuth() — validate token, set context claims
│   │   ├── rbac.go                            # RequireRoles(...string) — role gate
│   │   ├── approval_check.go                  # Check if student/class rep is approved before allowing access
│   │   ├── rate_limit.go                      # ulule/limiter: 100/min general, 10/min auth
│   │   ├── cors.go                            # whitelist frontend origin
│   │   ├── logger.go                          # zap request logging (method, path, latency)
│   │   └── error_handler.go                   # global panic recovery + structured error response
│   │
│   ├── auth/
│   │   ├── jwt.go                             # GenerateToken(), ValidateToken(), Claims struct
│   │   └── password.go                        # HashPassword(), CheckPassword() (bcrypt cost 12)
│   │
│   ├── payment/
│   │   ├── opay.go                            # InitializeTransaction(), VerifyTransaction(), VerifyWebhook()
│   │   ├── paystack.go                        # backup payment provider
│   │   └── service.go                         # PaymentProvider interface
│   │
│   ├── email/
│   │   ├── sendgrid.go                        # SendEmail(), SendBulkEmail()
│   │   └── templates/
│   │       ├── result_published.html          # "Your result for MTH101 is available"
│   │       ├── payment_receipt.html           # itemized payment receipt
│   │       ├── complaint_resolved.html          # ticket resolution notification
│   │       ├── transcript_ready.html            # transcript download link
│   │       ├── deadline_reminder.html           # assignment/payment deadline
│   │       ├── password_reset.html              # reset link email
│   │       ├── signup_approved.html             # "Your account has been approved"
│   │       └── signup_rejected.html           # "Your signup was rejected"
│   │
│   ├── storage/
│   │   └── s3.go                              # UploadFile(), DownloadFile(), BackupDatabase()
│   │
│   ├── queue/
│   │   ├── asynq.go                           # Asynq client + server setup
│   │   └── workers/
│   │       ├── email_worker.go                # process email send tasks
│   │       ├── backup_worker.go               # monthly S3 backup job
│   │       ├── cgpa_worker.go                 # recalculate CGPA after result approval
│   │       ├── sla_worker.go                  # escalate unresolved complaints after 72h
│   │       ├── defaulter_worker.go            # update defaulter tags after payment deadlines
│   │       └── approval_worker.go             # notify admins of pending approvals
│   │
│   ├── validator/
│   │   └── validator.go                       # go-playground/validator setup + custom rules
│   │
│   ├── logger/
│   │   └── zap.go                             # zap logger init, log levels
│   │
│   └── utils/
│       ├── response.go                        # RespondSuccess(), RespondError(), RespondPaginated()
│       ├── errors.go                          # AppError type, ErrNotFound, ErrForbidden, etc.
│       ├── constants.go                         # grade boundaries, credit limits, course types
│       └── pagination.go                      # page/limit/offset helpers
│
├── migrations/                                # golang-migrate SQL files
│   ├── 001_init_enums.sql                     # all ENUM type definitions
│   ├── 002_users.sql                          # users, students, staff, admin_permissions
│   ├── 003_academic.sql                       # sessions, semesters, courses, registrations
│   ├── 004_results.sql                        # results, result_audit_logs, carryover_courses
│   ├── 005_assignments.sql                    # assignments, assignment_grades
│   ├── 006_attendance.sql                     # attendance_sheets
│   ├── 007_payments.sql                       # dues, payment_cart, payment_batches, payments
│   ├── 008_complaints.sql                     # complaints
│   ├── 009_transcripts.sql                    # transcript_requests
│   ├── 010_timetable.sql                      # timetable
│   ├── 011_communication.sql                  # announcements, notifications
│   ├── 012_system.sql                         # backups, profile_update_requests
│   ├── 013_approval_system.sql               # signup_approvals, approval_logs
│   ├── 014_cgpa_config.sql                    # cgpa_rules, grade_boundaries, academic_standing_rules
│   └── 015_course_types.sql                   # course type: departmental/non-departmental
│
├── sqlc/
│   ├── sqlc.yaml                              # sqlc config: engine=postgresql, out=internal/db
│   └── queries/
│       ├── users.sql                          # GetByEmail, ListByRole, Create, Update, Deactivate
│       ├── students.sql                       # GetByMatric, UpdateCGPA, UpdateStanding, GetByRegNo
│       ├── approvals.sql                      # GetPendingApprovals, ApproveSignup, RejectSignup
│       ├── results.sql                        # CRUD, ListPending, BulkInsert, GetAuditLogs
│       ├── payments.sql                       # CartOps, BatchInsert, UpdateStatus, History
│       ├── attendance.sql                     # SheetCRUD, FinalizeSheet
│       ├── courses.sql                        # Catalog, Registration, CarryoverList, CourseType
│       ├── assignments.sql                    # CRUD, Grade, ListByStudent
│       ├── complaints.sql                     # CRUD, UpdateStatus, AssignTo
│       ├── analytics.sql                      # LecturerPerf, GradeDistribution, CGPATrend
│       ├── notifications.sql                  # Create, MarkRead, UnreadCount
│       └── cgpa.sql                           # CGPA calc queries, grade boundary lookups
│
├── tests/
│   ├── integration/
│   │   ├── auth_test.go
│   │   ├── result_test.go
│   │   ├── signup_test.go
│   │   ├── approval_test.go
│   │   └── payment_test.go
│   └── unit/
│       ├── cgpa_test.go
│       ├── opay_test.go
│       ├── validator_test.go
│       └── approval_test.go
│
├── docs/
│   └── swagger.json                           # swaggo auto-generated OpenAPI spec
│
├── .env
├── .env.example
├── go.mod
├── go.sum
├── Makefile
├── Dockerfile
├── .air.toml                                  # hot reload config
└── docker-compose.yml
```

---

## PART 3 — ROUTE MAP

### PUBLIC ROUTES
| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | Unified login for all roles |
| `/forgot-password` | ForgotPasswordPage | Request reset link |
| `/signup/student` | StudentSignupPage | Self-registration: name, DOB, reg no, level, admission mode, year admitted, email, password |
| `/signup/class-rep` | ClassRepSignupPage | Self-registration for class reps |
| `/signup/lecturer` | LecturerSignupPage | Self-registration (HOD can also create from admin) |
| `/transcript/verify/:id` | TranscriptVerifyPage | Public QR landing |

### ONBOARDING ROUTES (Post-signup, pre-approval)
| Route | Page | Description |
|-------|------|-------------|
| `/onboarding` | StudentOnboardingPage | Additional school details after signup, before class rep approval |

### AUTHENTICATED — STUDENT (Must be approved)
| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Student view, shows "Waiting for approval" if not approved |
| `/results` | ResultsPage | View own results per session (matched by reg no) |
| `/results/:id` | ResultDetailPage | Single result: scores, grade, audit trail |
| `/payments` | PaymentsPage | Dues list + cart + checkout (Opay) + history |
| `/transcripts` | TranscriptsPage | Request, pay fee, download, QR verify |
| `/courses` | CourseRegistrationPage | Pick courses, carryovers, submit |
| `/complaints` | ComplaintsPage | Submit + track own complaints |
| `/timetable` | TimetablePage | View exam timetable, conflict alerts |
| `/profile` | ProfilePage | View profile, request updates (non-sensitive only) |
| `/notifications` | NotificationsPage | All notifications, mark read |

### AUTHENTICATED — LECTURER
| Route | Page | Description |
|-------|------|-------------|
| `/lecturer/dashboard` | LecturerDashboard | Assigned courses, pending results, "waiting for courses" state |
| `/lecturer/scores` | ScoreEntryPage | Input CA + Exam per student per course |
| `/lecturer/bulk-upload` | BulkUploadPage | Download template, upload CSV, preview |
| `/lecturer/assignments` | AssignmentsPage | Create assignments, grade submissions |
| `/lecturer/class-list` | ClassListPage | View enrolled students per course |
| `/lecturer/reports` | LecturerReportsPage | Download class performance PDF |

### AUTHENTICATED — CLASS REP
| Route | Page | Description |
|-------|------|-------------|
| `/class-rep/dashboard` | ClassRepDashboard | Attendance, assignments, pending requests |
| `/class-rep/attendance` | AttendancePage | AG Grid spreadsheet, offline-first, sync |
| `/class-rep/assignments` | AssignmentUploadPage | Upload question paper for a course |
| `/class-rep/pending-requests` | PendingRequestsPage | Accept/reject student signups for their level |
| `/class-rep/class-list` | ClassListPage | View students in their class/level |

### AUTHENTICATED — BURSAR (DEPT or CLASS)
| Route | Page | Description |
|-------|------|-------------|
| `/bursar/dashboard` | BursarDashboard | Dept bursar: all dues + defaulters overview |
| `/bursar/dues` | DuesManagementPage | Create/edit/deactivate dues |
| `/bursar/payments` | PaymentVerificationPage | Review + verify student payments |
| `/bursar/defaulters` | DefaultersPage | List of students with unpaid dues |

### AUTHENTICATED — ADMIN / HOD
| Route | Page | Description |
|-------|------|-------------|
| `/admin` | AdminDashboard | Full KPI overview: results, payments, complaints |
| `/admin/results` | ResultApprovalPage | Pending results queue, approve/reject + reason |
| `/admin/users` | UserManagementPage | Create/edit/deactivate users, assign roles |
| `/admin/pending-approvals` | PendingApprovalsPage | Approve/reject student & class rep signups |
| `/admin/delegate` | DelegateAdminPage | Grant/revoke granular admin permissions |
| `/admin/analytics` | AnalyticsPage | Lecturer perf, grade distribution, CGPA trends |
| `/admin/sessions` | SessionManagementPage | Create sessions, semesters, archive old |
| `/admin/courses` | CourseManagementPage | Course catalog CRUD, tag departmental/non-departmental |
| `/admin/announcements` | AnnouncementsPage | Post, pin, expire announcements |
| `/admin/transcripts` | TranscriptQueuePage | Process transcript requests, generate PDF+QR |
| `/admin/graduation` | GraduationCheckPage | Per-student eligibility checklist |
| `/admin/reports` | ReportsPage | Sessional PDF generator per level |
| `/admin/backups` | BackupPage | Trigger manual AWS S3 backup, view backup log |
| `/admin/complaints` | ComplaintsManagePage | All tickets, assign, resolve, escalate |
| `/admin/timetable` | TimetableManagePage | Input exam timetable, view conflicts |
| `/admin/cgpa-settings` | CGPASettingsPage | Configure CGPA rules, grade boundaries, standing rules |
| `/admin/settings` | SettingsPage | System config: roles, permissions, etc. |

---

## PART 4 — BACKEND API ENDPOINTS

### AUTH (Unified Login)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Login (all roles) |
| POST | `/api/v1/auth/refresh` | Public | Refresh token |
| POST | `/api/v1/auth/logout` | Bearer | Logout |
| POST | `/api/v1/auth/forgot-password` | Public | Forgot password |
| POST | `/api/v1/auth/reset-password` | Public | Reset password |
| GET | `/api/v1/auth/me` | Bearer | Current user |

### SIGNUP (Self-Registration)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/signup/student` | Public | Student self-registration |
| POST | `/api/v1/signup/class-rep` | Public | Class rep self-registration |
| POST | `/api/v1/signup/lecturer` | Public | Lecturer self-registration |
| POST | `/api/v1/signup/onboarding` | Bearer | Student onboarding details (post-signup) |

### APPROVALS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/approvals/pending` | Bearer | Admin, HOD, Class Rep | List pending signup approvals |
| POST | `/api/v1/approvals/:id/approve` | Bearer | Admin, HOD, Class Rep | Approve signup |
| POST | `/api/v1/approvals/:id/reject` | Bearer | Admin, HOD, Class Rep | Reject signup |
| GET | `/api/v1/approvals/status` | Bearer | Student, Class Rep | Check own approval status |

### RESULTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/results` | Bearer | All | List results (role-filtered) |
| GET | `/api/v1/results/:id` | Bearer | All | Get single result |
| POST | `/api/v1/results` | Bearer | Lecturer, HOD, Admin | Create result |
| PUT | `/api/v1/results/:id` | Bearer | Lecturer, HOD, Admin | Update result + reason |
| POST | `/api/v1/results/bulk` | Bearer | Lecturer, HOD, Admin | Bulk upload from CSV |
| POST | `/api/v1/results/:id/approve` | Bearer | HOD, Admin | Approve result |
| POST | `/api/v1/results/:id/reject` | Bearer | HOD, Admin | Reject result |
| GET | `/api/v1/results/:id/audit` | Bearer | HOD, Lecturer | Audit logs |

### PAYMENTS (Opay)
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/payments/dues` | Bearer | Student | List available dues |
| GET | `/api/v1/payments/cart` | Bearer | Student | Get cart items |
| POST | `/api/v1/payments/cart` | Bearer | Student | Add item to cart |
| DELETE | `/api/v1/payments/cart/:id` | Bearer | Student | Remove item from cart |
| POST | `/api/v1/payments/checkout` | Bearer | Student | Initialize Opay payment |
| GET | `/api/v1/payments/history` | Bearer | Student | Payment history |
| GET | `/api/v1/payments/verify/:ref` | Bearer | Student | Verify transaction |
| POST | `/api/v1/payments/webhook/opay` | Public | --- | Opay webhook (signature-verified) |

### ATTENDANCE
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/attendance/sheets` | Bearer | Class Rep, Lecturer | List sheets |
| POST | `/api/v1/attendance/sheets` | Bearer | Class Rep | Create sheet |
| GET | `/api/v1/attendance/sheets/:id` | Bearer | Class Rep, Lecturer | Get sheet data |
| PUT | `/api/v1/attendance/sheets/:id` | Bearer | Class Rep | Update attendance |
| POST | `/api/v1/attendance/sheets/:id/finalize` | Bearer | Class Rep | Lock sheet |
| GET | `/api/v1/attendance/sheets/:id/pdf` | Bearer | Class Rep, Lecturer | Download PDF |

### COURSES
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/courses` | Bearer | All | List courses |
| POST | `/api/v1/courses` | Bearer | Admin, HOD | Create course |
| PUT | `/api/v1/courses/:id` | Bearer | Admin, HOD | Update course |
| DELETE | `/api/v1/courses/:id` | Bearer | Admin, HOD | Delete course |
| GET | `/api/v1/courses/registration` | Bearer | Student | Get registration data |
| POST | `/api/v1/courses/registration` | Bearer | Student | Submit registration |
| GET | `/api/v1/courses/carryovers` | Bearer | Student | Get carryover courses |

### ASSIGNMENTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/assignments` | Bearer | All | List assignments |
| POST | `/api/v1/assignments` | Bearer | Lecturer | Create assignment |
| GET | `/api/v1/assignments/:id` | Bearer | All | Get assignment |
| POST | `/api/v1/assignments/:id/upload` | Bearer | Class Rep | Upload question paper |
| POST | `/api/v1/assignments/:id/grade` | Bearer | Lecturer | Grade assignment |

### COMPLAINTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/complaints` | Bearer | All | List complaints |
| POST | `/api/v1/complaints` | Bearer | Student | Submit complaint |
| GET | `/api/v1/complaints/:id` | Bearer | All | Get complaint |
| PUT | `/api/v1/complaints/:id` | Bearer | Admin, HOD | Update complaint |
| POST | `/api/v1/complaints/:id/assign` | Bearer | Admin, HOD | Assign complaint |
| POST | `/api/v1/complaints/:id/resolve` | Bearer | Admin, HOD | Resolve complaint |

### TRANSCRIPTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/transcripts` | Bearer | Student | List transcripts |
| POST | `/api/v1/transcripts` | Bearer | Student | Request transcript |
| GET | `/api/v1/transcripts/:id/download` | Bearer | Student | Download (after payment) |
| POST | `/api/v1/transcripts/:id/process` | Bearer | HOD, Admin | Generate PDF+QR |
| GET | `/api/v1/transcripts/verify/:id` | Public | --- | QR verify |

### TIMETABLE
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/timetable` | Bearer | All | List timetable |
| POST | `/api/v1/timetable` | Bearer | Admin, HOD | Create entry |
| PUT | `/api/v1/timetable/:id` | Bearer | Admin, HOD | Update entry |
| DELETE | `/api/v1/timetable/:id` | Bearer | Admin, HOD | Delete entry |
| GET | `/api/v1/timetable/conflicts` | Bearer | Admin, HOD | Get conflicts |

### ANNOUNCEMENTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/announcements` | Bearer | All | List announcements |
| POST | `/api/v1/announcements` | Bearer | HOD, Admin | Create announcement |
| PUT | `/api/v1/announcements/:id` | Bearer | HOD, Admin | Update announcement |
| DELETE | `/api/v1/announcements/:id` | Bearer | HOD, Admin | Delete announcement |
| POST | `/api/v1/announcements/:id/pin` | Bearer | HOD, Admin | Pin announcement |

### NOTIFICATIONS
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/notifications` | Bearer | List notifications |
| PUT | `/api/v1/notifications/:id/read` | Bearer | Mark as read |
| PUT | `/api/v1/notifications/read-all` | Bearer | Mark all as read |
| GET | `/api/v1/notifications/unread-count` | Bearer | Get unread count |

### ANALYTICS (HOD, Admin only)
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/analytics/lecturer-performance` | Bearer | HOD, Admin | Lecturer performance |
| GET | `/api/v1/analytics/grade-distribution` | Bearer | HOD, Admin | Grade distribution |
| GET | `/api/v1/analytics/cgpa-trends` | Bearer | HOD, Admin | CGPA trends |
| GET | `/api/v1/analytics/financial` | Bearer | HOD, Admin | Financial analytics |
| POST | `/api/v1/analytics/sessional-report` | Bearer | HOD, Admin | Generate sessional report |

### USERS (HOD, Admin)
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/users` | Bearer | HOD, Admin | List users |
| POST | `/api/v1/users` | Bearer | HOD, Admin | Create user (lecturer, admin) |
| GET | `/api/v1/users/:id` | Bearer | HOD, Admin | Get user |
| PUT | `/api/v1/users/:id` | Bearer | HOD, Admin | Update user |
| DELETE | `/api/v1/users/:id` | Bearer | HOD, Admin | Deactivate user |
| POST | `/api/v1/users/:id/delegate` | Bearer | HOD | Delegate admin permissions |

### SESSIONS (HOD, Admin)
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/sessions` | Bearer | HOD, Admin | List sessions |
| POST | `/api/v1/sessions` | Bearer | HOD, Admin | Create session |
| PUT | `/api/v1/sessions/:id` | Bearer | HOD, Admin | Update session |
| POST | `/api/v1/sessions/:id/archive` | Bearer | HOD, Admin | Archive session |

### STUDENTS
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/students/:id` | Bearer | All | Get student profile |
| GET | `/api/v1/students/:id/graduation-check` | Bearer | HOD, Admin, Student | Graduation eligibility |
| GET | `/api/v1/students/:id/cgpa` | Bearer | All | Get CGPA |
| POST | `/api/v1/students/:id/profile-update` | Bearer | Student | Request profile update |
| POST | `/api/v1/students/:id/profile-update/approve` | Bearer | HOD, Admin | Approve profile update |
| GET | `/api/v1/students/defaulters` | Bearer | Bursar, HOD, Admin | List defaulters |

### CGPA
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/cgpa/calculate/:studentId` | Bearer | All | Auto-calculate CGPA |
| GET | `/api/v1/cgpa/what-if` | Bearer | Student | What-if predictor |
| GET | `/api/v1/cgpa/standing/:studentId` | Bearer | All | Academic standing |
| GET | `/api/v1/cgpa/rules` | Bearer | HOD, Admin | Get CGPA rules |
| PUT | `/api/v1/cgpa/rules` | Bearer | HOD, Admin | Update CGPA rules |

### BACKUPS (HOD only)
| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/backups` | Bearer | HOD | List backups |
| POST | `/api/v1/backups` | Bearer | HOD | Trigger manual backup |

---

## PART 5 — USER ROLES SUMMARY

| Role | Portal | Key Pages | Account Creation |
|------|--------|-----------|------------------|
| HOD (Super Admin) | Admin Portal | All /admin/* pages, full CRUD everywhere | Pre-created |
| Delegated Admin | Admin Portal | /admin/results, /admin/users, /admin/analytics (as granted) | Created by HOD |
| Lecturer | Lecturer Portal | /lecturer/scores, /lecturer/bulk-upload, /lecturer/assignments | Self-signup OR HOD creates |
| Class Rep | Class Rep Module | /class-rep/attendance, /class-rep/assignments, /class-rep/pending-requests | Self-signup |
| Student | Student Portal | /results, /payments, /transcripts, /courses, /complaints, /timetable | Self-signup |
| Bursar (Dept) | Bursar Module | /bursar/dues (all levels), /bursar/payments, /bursar/defaulters | Created by HOD |
| Bursar (Class) | Bursar Module | /bursar/dues (own level only), /bursar/payments | Created by HOD |

---

## PART 6 — KEY DEPENDENCIES

### Backend go.mod (key modules)
```go
module github.com/your-org/transcript-zone-api

go 1.23

require (
    // Web Framework
    github.com/gin-gonic/gin v1.10.0

    // Database
    github.com/jackc/pgx/v5 v5.7.1
    github.com/golang-migrate/migrate/v4 v4.18.1
    github.com/sqlc-dev/sqlc v1.27.0

    // Authentication
    github.com/golang-jwt/jwt/v5 v5.2.1
    golang.org/x/crypto v0.31.0

    // Validation
    github.com/go-playground/validator/v10 v10.23.0

    // Configuration
    github.com/spf13/viper v1.19.0

    // Logging
    go.uber.org/zap v1.27.0

    // Redis
    github.com/redis/go-redis/v9 v9.7.0

    // Background Jobs
    github.com/hibiken/asynq v0.25.0

    // Email
    github.com/sendgrid/sendgrid-go v3.16.0

    // AWS S3
    github.com/aws/aws-sdk-go-v2 v1.32.0
    github.com/aws/aws-sdk-go-v2/config v1.28.0
    github.com/aws/aws-sdk-go-v2/service/s3 v1.71.0

    // WebSocket
    github.com/gorilla/websocket v1.5.3

    // Testing
    github.com/stretchr/testify v1.10.0

    // Utilities
    github.com/google/uuid v1.6.0
    github.com/robfig/cron/v3 v3.0.1
    github.com/ulule/limiter/v3 v3.11.0

    // Swagger
    github.com/swaggo/swag v1.16.0
    github.com/swaggo/gin-swagger v1.6.0
    github.com/swaggo/files v1.0.1
)
```

---

## PART 7 — GENERATION ORDER (for building files sequentially)

### Phase 1 — Config & Setup (run first, everything depends on these)
1. package.json
2. vite.config.ts
3. tsconfig.json + tsconfig.node.json
4. tailwind.config.js + postcss.config.js
5. index.html
6. src/index.css
7. src/types/index.ts (all interfaces)

### Phase 2 — Core Application Shell
8. src/api/client.ts
9. src/stores/authStore.ts
10. src/stores/approvalStore.ts
11. src/stores/themeStore.ts
12. src/stores/cartStore.ts
13. src/stores/notificationStore.ts
14. src/hooks/useAuth.ts
15. src/hooks/useApprovalStatus.ts
16. src/hooks/useRBAC.ts
17. src/hooks/useDarkMode.ts
18. src/db/offlineDb.ts
19. src/router.tsx
20. src/App.tsx
21. src/main.tsx

### Phase 3 — UI Primitives
22. src/components/ui/Button.tsx
23. src/components/ui/Input.tsx
24. src/components/ui/Modal.tsx
25. src/components/ui/Card.tsx
26. src/components/ui/Badge.tsx
27. src/components/ui/Spinner.tsx
28. src/components/ui/EmptyState.tsx
29. src/components/feedback/Toast.tsx
30. src/components/feedback/ConfirmDialog.tsx
31. src/components/feedback/OfflineBanner.tsx
32. src/components/feedback/ApprovalPendingBanner.tsx
33. src/components/data-display/GradeBadge.tsx
34. src/components/data-display/StatusBadge.tsx
35. src/components/data-display/ApprovalStatusBadge.tsx
36. src/components/data-display/CourseTypeBadge.tsx
37. src/components/data-display/KpiCard.tsx
38. src/components/data-display/DataTable.tsx

### Phase 4 — Layout
39. src/components/layout/PublicLayout.tsx
40. src/components/layout/Sidebar.tsx
41. src/components/layout/TopNavbar.tsx
42. src/components/layout/AppShell.tsx
43. src/components/layout/ApprovalGate.tsx

### Phase 5 — Auth & Signup Pages
44. src/pages/auth/LoginPage.tsx
45. src/pages/auth/ForgotPasswordPage.tsx
46. src/pages/auth/StudentSignupPage.tsx
47. src/pages/auth/ClassRepSignupPage.tsx
48. src/pages/auth/LecturerSignupPage.tsx
49. src/pages/onboarding/StudentOnboardingPage.tsx

### Phase 6 — API Layer
50. src/api/auth.ts
51. src/api/signup.ts
52. src/api/approvals.ts
53. src/api/results.ts
54. src/api/payments.ts
55. src/api/attendance.ts
56. src/api/courses.ts
57. src/api/assignments.ts
58. src/api/complaints.ts
59. src/api/transcripts.ts
60. src/api/notifications.ts
61. src/api/analytics.ts
62. src/api/users.ts
63. src/api/sessions.ts
64. src/api/cgpa.ts

### Phase 7 — Student Pages
65. src/pages/Dashboard.tsx
66. src/pages/student/ResultsPage.tsx
67. src/pages/student/PaymentsPage.tsx
68. src/pages/student/TranscriptsPage.tsx
69. src/pages/student/CourseRegistrationPage.tsx
70. src/pages/student/ComplaintsPage.tsx
71. src/pages/student/TimetablePage.tsx
72. src/pages/student/ProfilePage.tsx

### Phase 8 — Lecturer Pages
73. src/pages/lecturer/LecturerDashboard.tsx
74. src/pages/lecturer/ScoreEntryPage.tsx
75. src/pages/lecturer/BulkUploadPage.tsx
76. src/pages/lecturer/AssignmentsPage.tsx
77. src/pages/lecturer/ClassListPage.tsx
78. src/pages/lecturer/LecturerReportsPage.tsx

### Phase 9 — Class Rep & Bursar Pages
79. src/pages/class-rep/ClassRepDashboard.tsx
80. src/pages/class-rep/AttendancePage.tsx
81. src/pages/class-rep/AssignmentUploadPage.tsx
82. src/pages/class-rep/PendingRequestsPage.tsx
83. src/pages/class-rep/ClassListPage.tsx
84. src/pages/bursar/BursarDashboard.tsx
85. src/pages/bursar/DuesManagementPage.tsx
86. src/pages/bursar/PaymentVerificationPage.tsx
87. src/pages/bursar/DefaultersPage.tsx

### Phase 10 — Admin Pages
88. src/pages/admin/AdminDashboard.tsx
89. src/pages/admin/ResultApprovalPage.tsx
90. src/pages/admin/UserManagementPage.tsx
91. src/pages/admin/PendingApprovalsPage.tsx
92. src/pages/admin/DelegateAdminPage.tsx
93. src/pages/admin/AnalyticsPage.tsx
94. src/pages/admin/SessionManagementPage.tsx
95. src/pages/admin/CourseManagementPage.tsx
96. src/pages/admin/AnnouncementsPage.tsx
97. src/pages/admin/TranscriptQueuePage.tsx
98. src/pages/admin/GraduationCheckPage.tsx
99. src/pages/admin/ReportsPage.tsx
100. src/pages/admin/BackupPage.tsx
101. src/pages/admin/ComplaintsManagePage.tsx
102. src/pages/admin/TimetableManagePage.tsx
103. src/pages/admin/CGPASettingsPage.tsx
104. src/pages/admin/SettingsPage.tsx

### Phase 11 — Shared Pages
105. src/pages/shared/NotificationsPage.tsx
106. src/pages/shared/NotFoundPage.tsx

### Phase 12 — Forms
107. src/components/forms/ScoreInputForm.tsx
108. src/components/forms/BulkUploadForm.tsx
109. src/components/forms/ComplaintForm.tsx
110. src/components/forms/ProfileUpdateForm.tsx
111. src/components/forms/AssignmentForm.tsx
112. src/components/forms/DueForm.tsx
113. src/components/forms/AnnouncementForm.tsx
114. src/components/forms/TimetableForm.tsx
115. src/components/forms/CourseRegistrationForm.tsx
116. src/components/forms/UserCreateForm.tsx
117. src/components/forms/StudentSignupForm.tsx
118. src/components/forms/ClassRepSignupForm.tsx
119. src/components/forms/LecturerSignupForm.tsx
120. src/components/forms/StudentOnboardingForm.tsx

### Phase 13 — Utilities & Hooks
121. src/utils/formatters.ts
122. src/utils/validators.ts
123. src/utils/constants.ts
124. src/utils/cgpa.ts
125. src/utils/pdf.ts
126. src/utils/opay.ts
127. src/hooks/useOfflineSync.ts
128. src/hooks/useNotification.ts
129. src/hooks/useDebounce.ts
130. src/hooks/useCGPACalculator.ts

---

## PART 8 — DATABASE SCHEMA CHANGES

### NEW TABLES

#### signup_approvals
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | NOT NULL, REFERENCES users(id) |
| signup_type | VARCHAR(20) | NOT NULL (student, class_rep, lecturer) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' (pending, approved, rejected) |
| reg_no | VARCHAR(50) | (for students/class reps) |
| level | INTEGER | (for students/class reps) |
| approved_by | UUID | REFERENCES users(id) |
| approved_at | TIMESTAMPTZ | |
| rejection_reason | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

#### cgpa_rules
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| min_score | DECIMAL(5,2) | NOT NULL |
| max_score | DECIMAL(5,2) | NOT NULL |
| grade | VARCHAR(2) | NOT NULL |
| grade_point | DECIMAL(3,2) | NOT NULL |
| is_active | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

#### academic_standing_rules
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| min_cgpa | DECIMAL(3,2) | NOT NULL |
| max_cgpa | DECIMAL(3,2) | NOT NULL |
| standing | VARCHAR(50) | NOT NULL (good_standing, probation, suspension) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true |

### MODIFIED TABLES

#### users
- ADD `is_approved` BOOLEAN NOT NULL DEFAULT false
- ADD `approved_by` UUID REFERENCES users(id)
- ADD `approved_at` TIMESTAMPTZ

#### students
- ADD `admission_mode` VARCHAR(20) (UTME, Direct Entry)
- ADD `year_admitted` INTEGER
- ADD `onboarding_completed` BOOLEAN DEFAULT false

#### courses
- ADD `course_type` VARCHAR(20) NOT NULL DEFAULT 'departmental' (departmental, non_departmental)

---

## PART 9 — AI AUTOMATION FEATURES

### CGPA Auto-Calculation
- Trigger: After result approval by HOD/Admin
- Action: Recalculate student CGPA, update academic standing
- Background: Asynq worker processes CGPA recalculation
- What-if Predictor: Frontend tool allowing students to simulate grades

### Academic Standing Auto-Update
- Trigger: After CGPA recalculation
- Action: Update student standing (Good Standing / Probation / Suspension)
- Rules: Configurable in /admin/cgpa-settings

### Graduation Eligibility Auto-Check
- Trigger: Manual request or scheduled job
- Action: Check all courses passed + dues cleared
- Output: "Eligible" or "Pending: X courses, ₦X dues"

### Carryover Auto-Flag
- Trigger: After result input
- Action: Auto-flag failed courses, show in separate transcript column
- Limit: Max 3 re-registration attempts

### Defaulter Auto-Tag
- Trigger: After payment deadline passes
- Action: Tag students with unpaid dues
- Background: Asynq worker runs daily

### Conflict Detection
- Trigger: Timetable entry creation/update
- Action: Detect same-time exam conflicts
- Alert: Notify HOD + affected students

### SLA Escalation
- Trigger: Complaint created
- Action: Auto-escalate unresolved complaints after 72 hours
- Background: Asynq worker runs hourly

---

## PART 10 — APPROVAL WORKFLOW

### Student Signup Flow
1. Student visits `/signup/student`
2. Fills: name, DOB, reg no, level, admission mode (UTME/Direct Entry), year admitted, email, password
3. Submits → Account created with `is_approved = false`
4. Student sees "Waiting for class rep approval" on dashboard
5. Class Rep visits `/class-rep/pending-requests`
6. Class Rep approves/rejects student
7. If approved: Student can access full dashboard
8. If rejected: Student sees rejection reason, can re-apply

### Class Rep Signup Flow
1. Class Rep visits `/signup/class-rep`
2. Fills: name, reg no, level, email, password
3. Submits → Account created with `is_approved = false`
4. Admin/HOD visits `/admin/pending-approvals`
5. Admin/HOD approves/rejects class rep
6. If approved: Class Rep can access full dashboard

### Lecturer Signup Flow
1. Lecturer visits `/signup/lecturer` OR HOD creates from `/admin/users`
2. Fills: name, school email, phone, password
3. If self-signup: `is_approved = false`, waiting for HOD approval
4. If HOD creates: `is_approved = true` immediately
5. Lecturer dashboard shows "Waiting for courses to be assigned"
6. HOD assigns courses in `/admin/courses`
7. Lecturer can now access score entry, assignments, etc.

---

## PART 11 — SENSITIVE vs NON-SENSITIVE PROFILE FIELDS

### Sensitive (Admin/HOD Only)
- Full Name
- Matric Number / Reg No
- Date of Birth
- Level
- Admission Mode
- Year Admitted

### Non-Sensitive (Student Can Request Update)
- Phone Number
- Email
- Address
- Photo/Avatar
- Password

### Update Workflow
1. Student requests update via `/profile`
2. Request goes to `profile_update_requests` table
3. Admin/HOD reviews in `/admin/users`
4. Admin/HOD approves/rejects with reason
5. If approved: Field updated, student notified

---

*End of Revised Transcript Zone File Structure & Blueprint*
