/* ──────────────────────────────────────────────
   ACES Zone — Master Type Definitions
   ────────────────────────────────────────────── */

// ───── Enums ─────
export type UserRole = 'hod' | 'delegated_admin' | 'lecturer' | 'class_rep' | 'class_bursar' | 'dept_bursar' | 'student' | 'alumni' | 'project_coordinator' | 'event_coordinator' | 'alumni_rep' | 'admin';
export type AccountType = 'staff' | 'student' | 'graduate';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'paystack' | 'manual';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';
export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'collected' | 'approved' | 'printed';
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type SkillLevel = 'beginner' | 'intermediate' | 'expert';
export type PriceType = 'fixed' | 'hourly' | 'negotiable';
export type AlumniStatusType = 'pending' | 'active' | 'suspended' | 'honorary';
export type MentorshipStatus = 'pending' | 'accepted' | 'rejected' | 'completed';
export type JobType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type JobApplicationStatus = 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
export type EventType = 'networking' | 'reunion' | 'workshop' | 'mentorship';
export type EventAttendeeStatus = 'registered' | 'attended' | 'cancelled';
export type GroupType = 'study' | 'project' | 'interest' | 'alumni';
export type GroupMemberRole = 'admin' | 'moderator' | 'member';
export type CourseSubcategory = 'core' | 'elective' | 'general' | 'practical';
export type Semester = 'harmattan' | 'rain';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// ───── Base ─────
export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

// ───── Auth ─────
export interface User extends BaseEntity {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  full_name?: string;
  otherNames?: string;
  phone?: string;
  avatar?: string;
  avatarUrl?: string;
  avatar_url?: string;
  gender?: string;
  address?: string;
  roles: UserRole[];
  activeRole: UserRole;
  role: UserRole;
  accountType?: AccountType;
  isApproved: boolean;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  lastLogin?: string;
  rejectionReason?: string;
  onboardingCompleted?: boolean;
  bio?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  // Student-specific fields (may be populated from student record)
  matricNumber?: string;
  matric_number?: string;
  level?: number;
  cgpa?: number;
  admissionMode?: string;
  admission_mode?: string;
  yearAdmitted?: number;
  year_admitted?: number;
  academicStanding?: string;
  academic_standing?: string;
  dateOfBirth?: string;
  date_of_birth?: string;
  homeAddress?: string;
  home_address?: string;
  emergencyContactName?: string;
  emergency_contact?: string;
  emergencyContactPhone?: string;
  emergency_contact_phone?: string;
  profilePhotoUrl?: string;
  profile_photo_url?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface StudentSignupPayload extends SignupPayload {
  matricNumber: string;
  level: number;
  department: string;
}

export interface LecturerSignupPayload extends SignupPayload {
  staffId: string;
  department: string;
  specialization?: string;
}

// ───── Academic ─────
export interface Session extends BaseEntity {
  name: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  is_archived?: boolean;
  // Legacy camelCase (optional, for backward compat)
  startYear?: number;
  endYear?: number;
  isActive?: boolean;
}

export interface SemesterEntry extends BaseEntity {
  session_id: string;
  name: 'harmattan' | 'rain';
  start_date?: string;
  end_date?: string;
  registration_deadline?: string;
  is_active: boolean;
}

export interface Course extends BaseEntity {
  code: string;
  title: string;
  description?: string;
  unit: number;
  creditUnits: number;
  level: number;
  semester: Semester;
  courseType: string;
  subcategory: CourseSubcategory;
  lecturerId?: string;
  lecturerName?: string;
  department: string;
  isActive: boolean;
  maxCreditHours?: number;
  prerequisiteId?: string;
}

export interface Student extends BaseEntity {
  userId: string;
  matricNumber: string;
  level: number;
  department: string;
  faculty: string;
  cgpa: number;
  totalCredits: number;
  totalGradePoints: number;
  enrollmentYear: number;
  isActive: boolean;
  user?: User;
}

export interface Result extends BaseEntity {
  studentId: string;
  courseId: string;
  sessionId: string;
  semester: Semester;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: Grade;
  gradePoints: number;
  isApproved: boolean;
  approvedBy?: string;
  course?: Course;
  student?: Student;
}

export interface ResultSummary {
  sessionId: string;
  sessionName: string;
  semester: Semester;
  courses: Result[];
  totalCredits: number;
  totalGradePoints: number;
  gpa: number;
  cgpa: number;
}

export interface CGPAConfig extends BaseEntity {
  gradePoints: Record<Grade, number>;
  passMark: number;
  maxCreditsPerSemester: number;
  scale?: number;
  maxScale?: number;
  passingCGPA?: number;
  minimumPassing?: number;
  firstClass?: number;
  secondClassUpper?: number;
  secondClassLower?: number;
  thirdClass?: number;
  gradeBoundaries?: {
    firstClass?: number;
    secondClassUpper?: number;
    secondClassLower?: number;
    thirdClass?: number;
  };
}

// ───── Attendance ─────
export interface AttendanceRecord extends BaseEntity {
  courseId: string;
  studentId: string;
  date: string;
  isPresent: boolean;
  markedBy: string;
  course?: Course;
  student?: Student;
}

export interface AttendanceSession extends BaseEntity {
  courseId: string;
  date: string;
  classRepId: string;
  totalPresent: number;
  totalAbsent: number;
  records: AttendanceRecord[];
}

// ───── Assignments ─────
export interface Assignment extends BaseEntity {
  courseId?: string;
  title: string;
  description?: string;
  dueDate: string;
  maxScore?: number;
  maxPoints?: number;
  uploadedBy?: string;
  attachmentUrl?: string;
  course?: Course;
  isClosed?: boolean;
}

// ───── Payments ─────
export type PaymentType = 'dept_dues' | 'class_dues' | 'manual' | 'materials' | 'transcript_fee' | 'other';

export interface Payment extends BaseEntity {
  student_id: string;
  batch_id?: string;
  due_id: string;
  type: PaymentType;
  item_name: string;
  amount: number;
  paystack_reference?: string;
  status: PaymentStatus;
  verified_by?: string;
  verified_at?: string;
  paid_at?: string;
  // Joined fields
  matric_number?: string;
  student_name?: string;
  due_name?: string;
}

export interface DuePayment extends BaseEntity {
  name: string;
  description?: string;
  type: PaymentType;
  amount: number;
  level?: number;
  session_id?: string;
  semester_id?: string;
  deadline?: string;
  is_active: boolean;
  created_by: string;
}

export interface Defaulter {
  student_id: string;
  full_name: string;
  matric_number: string;
  level: number;
  unpaid_dues_count: number;
  total_outstanding: number;
}

// ───── Complaints ─────
export interface Complaint extends BaseEntity {
  userId?: string;
  studentId?: string;
  subject?: string;
  title?: string;
  description: string;
  category: string;
  priority?: ComplaintPriority;
  status: ComplaintStatus;
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: string;
  user?: User;
}

// ───── Transcripts ─────
export interface TranscriptRequest extends BaseEntity {
  studentId: string;
  status: TranscriptStatus;
  requestedAt?: string;
  processedAt?: string;
  readyAt?: string;
  collectedAt?: string;
  paymentId?: string;
  student?: Student;
  destination?: string;
  paymentStatus?: string;
  studentName?: string;
  purpose?: string;
  copies?: number;
}


// ───── Timetable ─────
export type EntryType = 'class' | 'exam';
export type ClassType = 'lecture' | 'lab' | 'tutorial' | 'seminar';
export type ExamType = 'main' | 'carryover';

export interface TimetableEntry {
  id: string;
  course_id: string;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  venue: string;
  level?: number;
  courseCode: string;
  courseTitle: string;
  entry_type: EntryType;
  class_type?: ClassType;
  exam_type?: ExamType;
  lecturer_id?: string;
  lecturer_name?: string;
  invigilators?: string;
  is_published: boolean;
  has_conflict: boolean;
  conflict_details?: string;
  exam_date?: string;
  session_id?: string;
  semester_id?: string;
  created_by?: string;
  created_at?: string;
  course?: Course;
  // Legacy aliases for backward compat
  courseId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
}

export interface TimetableConflict {
  type: string;
  message: string;
  entry1_id: string;
  entry2_id: string;
}

// ───── Announcements ─────
export interface Announcement extends BaseEntity {
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  targetRoles: UserRole[];
  targetLevels?: number[];
  isPinned: boolean;
  expiresAt?: string;
}

// ───── Notifications ─────
export interface AppNotification extends BaseEntity {
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// ───── Manuals ─────
export interface Manual extends BaseEntity {
  title: string;
  description?: string;
  price: number;
  level: number;
  coverImageUrl?: string;
  fileUrl?: string;
  isActive: boolean;
  courseId?: string;
  sessionId?: string;
  createdBy?: string;
}

export interface ManualPurchase extends BaseEntity {
  manualId: string;
  manualTitle?: string;
  manualLevel?: number;
  price: number;
  isCollected: boolean;
  collectedAt?: string;
  purchasedAt?: string;
  qrCodeData?: string;
  qrCodeUrl?: string;
  studentName?: string;
  matricNumber?: string;
  matric_number?: string;
}

// ───── Campus Connect ─────
export interface Connection extends BaseEntity {
  requesterId: string;
  recipientId: string;
  status: ConnectionStatus;
  message?: string;
  connectedAt?: string;
  requester?: User;
  recipient?: User;
}

export interface Message extends BaseEntity {
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  sender?: User;
}

export interface Group extends BaseEntity {
  name: string;
  description?: string;
  type: GroupType;
  createdBy: string;
  isPrivate: boolean;
  maxMembers: number;
  memberCount: number;
  creator?: User;
}

export interface GroupMember extends BaseEntity {
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  user?: User;
}

export interface GroupMessage extends BaseEntity {
  groupId: string;
  senderId: string;
  content: string;
  sender?: User;
}

// ───── Skills & Trade ─────
export interface SkillCategory extends BaseEntity {
  name: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export interface SkillListing extends BaseEntity {
  userId?: string;
  categoryId?: string;
  title: string;
  description?: string;
  level: SkillLevel;
  isPaid: boolean;
  price?: number;
  priceType?: PriceType;
  isBarterAvailable: boolean;
  barterPreferences?: string;
  availability?: string;
  isActive?: boolean;
  user?: User;
  category?: SkillCategory;
  averageRating?: number;
  totalReviews?: number;
  portfolioUrl?: string;
}

export interface TradeOffer extends BaseEntity {
  offererId: string;
  recipientId: string;
  offererSkillId: string;
  recipientSkillId?: string;
  offererDescription?: string;
  recipientDescription?: string;
  status: TradeStatus;
  completedAt?: string;
  offerer?: User;
  recipient?: User;
  offererSkill?: SkillListing;
  recipientSkill?: SkillListing;
}

export interface SkillRating extends BaseEntity {
  tradeId: string;
  raterId: string;
  rateeId: string;
  rating: number;
  review?: string;
  rater?: User;
}

export interface UserReputation extends BaseEntity {
  userId: string;
  totalTrades: number;
  completedTrades: number;
  averageRating: number;
  totalReviews: number;
  reputationScore: number;
}

// ───── Alumni ─────
export interface AlumniStatus extends BaseEntity {
  userId: string;
  studentId: string;
  status: AlumniStatusType;
  graduationYear: number;
  graduationSessionId?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  hasCarryover: boolean;
  carryoverCourses: number;
  duesCleared: boolean;
  industry?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  isMentorAvailable: boolean;
  mentorshipCapacity: number;
  isJobPoster: boolean;
  user?: User;
}

export interface AlumniProfile extends BaseEntity {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  regNo?: string;
  department?: string;
  graduationYear: number;
  isVerified: boolean;
}

export interface AlumniFullProfile {
  id: string;
  user_id: string;
  graduation_year: number;
  graduation_class?: string;
  verification_status: string;
  is_mentor_available: boolean;
  mentor_specialization?: string;
  current_company?: string;
  current_position?: string;
  linkedin_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  location?: string;
  portfolio_url?: string;
  privacy_level?: string;
  mentorship_topics?: string[];
  skills?: string[];
  willing_to_speak?: boolean;
  event_interests?: string[];
  industry?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
}

export interface AlumniDirectoryItem {
  id: string;
  user_id: string;
  graduation_year: number;
  graduation_class?: string;
  current_company?: string;
  current_position?: string;
  industry?: string;
  location?: string;
  is_mentor_available: boolean;
  privacy_level?: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  linkedin_url?: string;
}

export interface AlumniDashboardStats {
  total_alumni: number;
  active_this_year: number;
  new_this_session: number;
  active_jobs: number;
  active_mentors: number;
  active_mentorships: number;
  upcoming_events: number;
  pending_mentorship_requests: number;
  total_donations: number;
}

export interface AlumniMyStats {
  connection_count: number;
  active_mentees: number;
  completed_sessions: number;
  jobs_posted: number;
  events_attended: number;
}

export interface MentorshipRequest extends BaseEntity {
  alumniId: string;
  studentId: string;
  status: MentorshipStatus;
  studentMessage?: string;
  alumniResponse?: string;
  startedAt?: string;
  completedAt?: string;
  alumni?: User;
  student?: User;
}

export interface MentorshipRequestItem {
  id: string;
  student_id: string;
  mentor_id: string;
  topic: string;
  status: string;
  message?: string;
  student_name: string;
  created_at: string;
}

export interface MentorItem {
  id: string;
  user_id: string;
  graduation_year: number;
  graduation_class?: string;
  is_mentor_available: boolean;
  mentor_specialization?: string;
  current_company?: string;
  current_position?: string;
  bio?: string;
  full_name: string;
  email: string;
  industry?: string;
  location?: string;
}

export interface JobPost extends BaseEntity {
  postedBy: string;
  title: string;
  company: string;
  location?: string;
  type: JobType;
  description: string;
  requirements?: string;
  responsibilities?: string;
  salaryRange?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  deadline?: string;
  isActive: boolean;
  viewCount: number;
  applicationCount: number;
  poster?: User;
  job_type?: string;
  salary_range?: string;
  application_url?: string;
  poster_name?: string;
  industry?: string;
  views_count?: number;
  applications_count?: number;
  is_active?: boolean;
}

export interface JobApplication extends BaseEntity {
  jobId: string;
  studentId: string;
  status: JobApplicationStatus;
  coverLetter?: string;
  resumeUrl?: string;
  appliedAt: string;
  student?: User;
  job?: JobPost;
}

export interface AlumniEvent extends BaseEntity {
  title: string;
  description?: string;
  eventType: EventType;
  eventDate: string;
  location?: string;
  isVirtual: boolean;
  virtualLink?: string;
  maxAttendees?: number;
  createdBy: string;
  isActive: boolean;
  attendeeCount?: number;
  creator?: User;
}

export interface AlumniEventItem {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  location?: string;
  is_virtual: boolean;
  virtual_link?: string;
  start_date: string;
  end_date: string;
  max_attendees?: number;
  is_active: boolean;
  created_by: string;
  target_audience?: string;
  status?: string;
  attendee_count?: number;
}

export interface EventAttendee extends BaseEntity {
  eventId: string;
  userId: string;
  status: EventAttendeeStatus;
  registeredAt: string;
  user?: User;
}

export interface AlumniDonation {
  id: string;
  donor_id: string;
  channel: string;
  amount: number;
  currency: string;
  message?: string;
  is_anonymous: boolean;
  recognized_tier: string;
  status: string;
  created_at: string;
  donor_name?: string;
}

export interface DonationStats {
  total_donations: number;
  donation_count: number;
  platinum_count: number;
  gold_count: number;
  silver_count: number;
  bronze_count: number;
}

export type DonationChannel = 'general' | 'scholarship' | 'project' | 'event_sponsorship' | 'emergency';
export type DonationTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

// ───── Analytics ─────
export interface AnalyticsData {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  totalResults: number;
  averageCGPA: number;
  paymentCollected: number;
  pendingApprovals: number;
  activeComplaints: number;
  registrationTrend: { month: string; count: number }[];
  gradeDistribution: { grade: string; count: number }[];
  paymentTrend: { month: string; amount: number }[];
  topCourses: { course: string; students: number }[];
}

// ───── API Response ─────
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  items?: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  page_id?: number;
  page_size?: number;
}

// ───── UI ─────
export interface SidebarItem {
  label: string;
  icon: string;
  path: string;
  roles: UserRole[];
  children?: SidebarItem[];
  badge?: string | number;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'range';
  options?: SelectOption[];
}

export type ThemeMode = 'light' | 'dark' | 'system';

// ==================== DELEGATE STUDENT ROLES ====================

export interface RoleAssignmentLog {
  id: string;
  user_name: string;
  user_id: string;
  role: UserRole;
  action: 'assigned' | 'removed';
  performed_by_name: string;
  performed_by_id: string;
  performed_by_role: string | null;
  previous_roles: string[];
  new_roles: string[];
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface StudentForRoleManagement {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  student_id: string;
  matric_number: string | null;
  level: number | null;
  roles: UserRole[];
}
