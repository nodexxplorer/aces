import type { UserRole } from '../types';

export const APP_NAME = 'Aces Zone';
export const APP_TAGLINE = 'Connecting Minds, Building Futures';
export const APP_DESCRIPTION = 'Association of Computer Engineering Students (ACES) — Uniuyo Chapter';

export const COLORS = {
  primary: '#0066CC',
  secondary: '#003366',
  accent: '#00AAFF',
} as const;

export const LEVELS = [1, 2, 3, 4, 5] as const;
export const SEMESTERS = ['first', 'second'] as const;

export const GRADE_POINTS: Record<string, number> = {
  A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0, F: 0.0,
};

export const GRADE_LABELS: Record<string, string> = {
  A: '70-100 (Excellent)', B: '60-69 (Very Good)', C: '50-59 (Good)',
  D: '45-49 (Fair)', E: '40-44 (Pass)', F: '0-39 (Fail)',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  hod: 'HOD',
  delegated_admin: 'Delegated Admin',
  lecturer: 'Lecturer',
  class_rep: 'Class Rep',
  class_bursar: 'Class Bursar',
  dept_bursar: 'Dept Bursar',
  student: 'Student',
  alumni: 'Alumni',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  hod: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  delegated_admin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  lecturer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  class_rep: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  class_bursar: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  dept_bursar: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  student: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  alumni: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

export const SKILL_CATEGORIES = [
  { value: 'programming', label: 'Programming', icon: 'Code2' },
  { value: 'web_design', label: 'Web Design', icon: 'Globe' },
  { value: 'graphics', label: 'Graphics Design', icon: 'Palette' },
  { value: 'writing', label: 'Writing', icon: 'PenTool' },
  { value: 'tutoring', label: 'Tutoring', icon: 'GraduationCap' },
  { value: 'electronics', label: 'Electronics', icon: 'Cpu' },
  { value: 'data_analysis', label: 'Data Analysis', icon: 'BarChart3' },
  { value: 'mobile_dev', label: 'Mobile Development', icon: 'Smartphone' },
  { value: 'networking', label: 'Networking', icon: 'Network' },
  { value: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;

export const PAYMENT_PURPOSES = [
  'Department Dues', 'Class Dues', 'Manual Purchase', 'Transcript Request',
  'Lab Fee', 'Association Fee', 'Event Registration',
] as const;

export const COMPLAINT_CATEGORIES = [
  'Result Error', 'Payment Issue', 'Account Access', 'Course Registration',
  'Timetable Conflict', 'Manual Issue', 'Other',
] as const;

export const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
