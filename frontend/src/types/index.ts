/* ──────────────────────────────────────────────
   ACES Zone — Master Type Definitions
   ────────────────────────────────────────────── */

// ───── Enums ─────
export type UserRole = 'hod' | 'delegated_admin' | 'lecturer' | 'class_rep' | 'class_bursar' | 'dept_bursar' | 'student' | 'alumni';
export type AccountType = 'staff' | 'student' | 'graduate';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'paystack' | 'manual';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';
export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'collected';
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
export type Semester = 'first' | 'second';
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
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  avatar?: string;
  roles: UserRole[];
  activeRole: UserRole;
  accountType?: AccountType;
  isApproved: boolean;
  approvalStatus: ApprovalStatus;
  lastLogin?: string;
  rejectionReason?: string;
  bio?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
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
  startYear: number;
  endYear: number;
  isActive: boolean;
}

export interface Course extends BaseEntity {
  code: string;
  title: string;
  creditUnits: number;
  level: number;
  semester: Semester;
  subcategory: CourseSubcategory;
  lecturerId?: string;
  lecturerName?: string;
  department: string;
  isActive: boolean;
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
export interface Payment extends BaseEntity {
  userId: string;
  amount: number;
  currency: string;
  purpose: string;
  reference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  paidAt?: string;
  verifiedBy?: string;
  receiptUrl?: string;
}

export interface DuePayment extends BaseEntity {
  title: string;
  amount: number;
  description: string;
  level?: number;
  dueDate: string;
  createdBy: string;
  isPaid: boolean;
  paymentId?: string;
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
}


// ───── Timetable ─────
export interface TimetableEntry extends BaseEntity {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  venue: string;
  semester: Semester;
  sessionId: string;
  course?: Course;
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
  description: string;
  price: number;
  level: number;
  coverImageUrl?: string;
  fileUrl?: string;
  isActive: boolean;
  totalPurchases?: number;
  totalPrinted?: number;
  code?: string;
  semester?: Semester;
  authorId?: string;
}

export interface ManualPurchase extends BaseEntity {
  manualId: string;
  userId: string;
  paymentId: string;
  isPrinted: boolean;
  printedAt?: string;
  qrCode?: string;
  manual?: Manual;
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

export interface JobPost extends BaseEntity {
  postedBy: string;
  title: string;
  company: string;
  location?: string;
  type: JobType;
  description: string;
  requirements?: string;
  salaryRange?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  deadline?: string;
  isActive: boolean;
  viewCount: number;
  applicationCount: number;
  poster?: User;
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

export interface EventAttendee extends BaseEntity {
  eventId: string;
  userId: string;
  status: EventAttendeeStatus;
  registeredAt: string;
  user?: User;
}

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
