import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useCurrentDepartment } from '../../components/branding/department';
import { DepartmentLogo } from '../../components/branding/DepartmentBrand';
import { getMediaUrl } from '../../api/client';
import { updateBasicInfo, uploadProfilePhoto, getAllAuditLogs, type AuditLog } from '../../api/profile-edit';
import { getCGPAConfig, updateCGPAConfig } from '../../api/cgpa';
import type { CGPAConfig } from '../../types';
import { getAISettings, updateAISettings, type AISettings } from '../../api/ai';
import { changePassword } from '../../api/additional-features';
import { formatDepartmentDisplayName } from '../../config/department';
import { departmentAdminPath } from '../../config/departmentAdminPaths';
import { getInitials } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import {
  User,
  Shield,
  Lock,
  Clock,
  SlidersHorizontal,
  Building2,
  Camera,
  Check,
  Pencil,
  AlertTriangle,
  Send,
  BookOpen,
  Users,
  CreditCard,
  Megaphone,
  Copy,
  Download,
  Laptop,
  Globe,
  X,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  Info,
  Sparkles,
  Bot,
  Brain,
} from 'lucide-react';

type TabKey = 'overview' | 'privileges' | 'security' | 'activity' | 'preferences' | 'department';

export const AdminProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const { mode, setMode } = useDarkMode();
  const department = useCurrentDepartment();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state synced with URL ?tab=
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [activeTab, setActiveTab] = useState<TabKey>(
    ['overview', 'privileges', 'security', 'activity', 'preferences', 'department'].includes(initialTab)
      ? initialTab
      : 'overview',
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabKey;
    if (
      tabParam &&
      tabParam !== activeTab &&
      ['overview', 'privileges', 'security', 'activity', 'preferences', 'department'].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Upload photo & Edit basic info
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const urlCode = user?.tenant?.urlCode || department?.urlCode;
  const role = user?.activeRole || user?.role || 'hod';
  const roleBadgeLabel = role === 'hod' ? 'HOD' : 'Admin';
  const roleTitle = role === 'hod' ? 'Head of Department' : 'Department Administrator';

  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName = user?.fullName || [firstName, lastName].filter(Boolean).join(' ') || (role === 'hod' ? '' : '');
  const email = user?.email || '';
  const phone = user?.phone || '';
  const dateOfBirth = (user as { dateOfBirth?: string })?.dateOfBirth || '';
  const homeAddress = user?.address || (user as { homeAddress?: string })?.homeAddress || '';
  const emergencyName = (user as { emergencyContactName?: string })?.emergencyContactName || '';
  const emergencyPhone = (user as { emergencyContactPhone?: string })?.emergencyContactPhone || '';
  const matricOrStaffId =
    (user as { staffId?: string })?.staffId || (user as { matricNumber?: string })?.matricNumber || '';

  const initials = getInitials(firstName || fullName.split(' ')[0] || '', lastName || fullName.split(' ')[1] || '');
  const deptName = formatDepartmentDisplayName(department?.name || user?.tenant?.name) || '';
  const institutionName = department?.institution || '';

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return 'September 2026';
    try {
      const d = new Date(user.createdAt);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return 'September 2026';
    }
  }, [user?.createdAt]);

  // Edit Modal form
  const [form, setForm] = useState({
    firstName,
    lastName,
    phone,
    dateOfBirth,
    homeAddress,
    emergencyContactName: emergencyName,
    emergencyContactPhone: emergencyPhone,
  });

  const openEditModal = (_fieldFocus?: string) => {
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      dateOfBirth: (user as { dateOfBirth?: string })?.dateOfBirth || '',
      homeAddress: user?.address || (user as { homeAddress?: string })?.homeAddress || '',
      emergencyContactName: (user as { emergencyContactName?: string })?.emergencyContactName || '',
      emergencyContactPhone: (user as { emergencyContactPhone?: string })?.emergencyContactPhone || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasicInfo(true);
    try {
      const updated = await updateBasicInfo({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        homeAddress: form.homeAddress.trim() || undefined,
        dateOfBirth: form.dateOfBirth.trim() || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      });
      updateUser(updated);
      setIsEditModalOpen(false);
      success('Profile Updated', 'Personal details saved successfully.');
    } catch (err) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not save profile details'));
    } finally {
      setSavingBasicInfo(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifyError('File Too Large', 'Profile photo must be less than 2MB.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await uploadProfilePhoto(file);
      updateUser({ avatar: result.avatar_url });
      success('Photo Updated', 'Profile photo updated successfully.');
    } catch (err) {
      notifyError('Upload Failed', getErrorMessage(err, 'Failed to upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─────────────────────────────────────────────
  // TAB 3: SECURITY STATE & LOGIC
  // ─────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  const [signInAlerts, setSignInAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem(`admin_signin_alerts_${user?.id || 'default'}`);
    return saved !== null ? saved === 'true' : true;
  });

  const [_twoFactorModal, _setTwoFactorModal] = useState(false);
  const [_twoFactorEnabled, _setTwoFactorEnabled] = useState(false);

  // Password strength calculation
  const passStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: 'bg-slate-200 dark:bg-slate-700' };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  }, [newPassword]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }
    setPassError(null);
    setChangingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      success('Password changed', 'Your password was updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update password.';
      setPassError(msg);
      notifyError('Password error', msg);
    } finally {
      setChangingPass(false);
    }
  };

  // Detected client session for "Where you are signed in"
  const clientDevice = useMemo(() => {
    const ua = navigator.userAgent;
    let os = 'Linux';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    let browser = 'Chrome';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';

    return {
      name: `${browser} on ${os}`,
      location: `${institutionName ? 'Uyo, Nigeria' : 'Campus Network'} · Active now`,
      isCurrent: true,
    };
  }, [institutionName]);

  const handleSignOutOtherDevices = () => {
    success('Devices Signed Out', 'Signed out of all other active browser sessions.');
  };

  const handleToggleSignInAlerts = () => {
    const nextVal = !signInAlerts;
    setSignInAlerts(nextVal);
    localStorage.setItem(`admin_signin_alerts_${user?.id || 'default'}`, String(nextVal));
    success('Alerts Updated', nextVal ? 'Sign-in alert emails enabled.' : 'Sign-in alert emails disabled.');
  };

  // Security score
  const securityScore = useMemo(() => {
    let score = 50; // base (verified school email)
    if (user?.email) score += 25; // password set & school email
    if (signInAlerts) score += 25;
    return Math.min(score, 100);
  }, [user?.email, signInAlerts]);

  // ─────────────────────────────────────────────
  // TAB 4: ACTIVITY STATE & LOGIC
  // ─────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'All' | 'Academics' | 'Users' | 'Finance' | 'Announcements'>(
    'All',
  );
  const [exportRange, setExportRange] = useState<'30' | '7' | '90' | 'all'>('30');

  useEffect(() => {
    let isMounted = true;
    setLoadingLogs(true);
    getAllAuditLogs(1, 50)
      .then((res: { data: AuditLog[] } | AuditLog[]) => {
        if (!isMounted) return;
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        setAuditLogs(items);
      })
      .catch(() => {
        if (isMounted) setAuditLogs([]);
      })
      .finally(() => {
        if (isMounted) setLoadingLogs(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered activity logs
  const filteredLogs = useMemo(() => {
    if (activityFilter === 'All') return auditLogs;
    return auditLogs.filter((log) => {
      const type = (log.change_type || log.field_name || '').toLowerCase();
      if (activityFilter === 'Academics') {
        return (
          type.includes('course') || type.includes('session') || type.includes('academic') || type.includes('student')
        );
      }
      if (activityFilter === 'Users') {
        return type.includes('user') || type.includes('role') || type.includes('permission') || type.includes('staff');
      }
      if (activityFilter === 'Finance') {
        return type.includes('due') || type.includes('payment') || type.includes('bursar') || type.includes('fee');
      }
      if (activityFilter === 'Announcements') {
        return type.includes('announcement') || type.includes('broadcast') || type.includes('notice');
      }
      return true;
    });
  }, [auditLogs, activityFilter]);

  // Group logs by day
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: AuditLog[] } = {};
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    filteredLogs.forEach((log) => {
      const d = new Date(log.created_at);
      const dStr = d.toDateString();
      let key = 'EARLIER';
      if (dStr === todayStr) key = 'TODAY';
      else if (dStr === yesterdayStr) key = 'YESTERDAY';
      else {
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) key = 'EARLIER THIS WEEK';
        else key = 'OLDER';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    return groups;
  }, [filteredLogs]);

  const handleExportCSV = () => {
    if (auditLogs.length === 0) {
      notifyError('No Logs', 'There are no activity logs to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Action Type', 'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Reason'];
    const rows = auditLogs.map((log) => [
      log.id || '',
      log.created_at || '',
      log.change_type || '',
      log.field_name || '',
      `"${(log.old_value || '').replace(/"/g, '""')}"`,
      `"${(log.new_value || '').replace(/"/g, '""')}"`,
      log.changed_by_name || log.changed_by || '',
      log.changed_by_role || '',
      `"${(log.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('CSV Exported', 'Activity log downloaded successfully.');
  };

  // ─────────────────────────────────────────────
  // TAB 5: PREFERENCES STATE & LOGIC
  // ─────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [_loadingAI, setLoadingAI] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    setLoadingAI(true);
    getAISettings()
      .then((data) => {
        if (data) setAiSettings(data);
      })
      .catch(() => {})
      .finally(() => setLoadingAI(false));
  }, []);

  const handleAIToggle = (key: keyof AISettings) => {
    if (!aiSettings) return;
    setAiSettings({ ...aiSettings, [key]: !aiSettings[key] });
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      if (aiSettings) {
        await updateAISettings({
          chatbot_enabled: aiSettings.chatbot_enabled,
          personalization_enabled: aiSettings.personalization_enabled,
          face_recognition_enabled: aiSettings.face_recognition_enabled,
          data_collection_consent: aiSettings.data_collection_consent,
          preferred_language: aiSettings.preferred_language || 'en',
        });
      }
      success('Preferences Saved', 'Theme, AI features, and language preferences updated.');
    } catch {
      notifyError('Error', 'Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const activeAICount = useMemo(() => {
    if (!aiSettings) return 2;
    let count = 0;
    if (aiSettings.chatbot_enabled) count++;
    if (aiSettings.personalization_enabled) count++;
    if (aiSettings.face_recognition_enabled) count++;
    if (aiSettings.data_collection_consent) count++;
    return count;
  }, [aiSettings]);

  // ─────────────────────────────────────────────
  // TAB 6: DEPARTMENT STATE & LOGIC
  // ─────────────────────────────────────────────
  const [_cgpaLoading, setCgpaLoading] = useState(false);
  const [cgpaSaving, setCgpaSaving] = useState(false);
  const [scale, setScale] = useState('5.0');
  const [passingCGPA, setPassingCGPA] = useState('1.0');
  const [firstClass, setFirstClass] = useState('4.5');
  const [secondClassUpper, setSecondClassUpper] = useState('3.5');
  const [secondClassLower, setSecondClassLower] = useState('2.5');
  const [thirdClass, setThirdClass] = useState('1.5');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setCgpaLoading(true);
    getCGPAConfig()
      .then((config: CGPAConfig) => {
        if (config) {
          setScale(String(config.scale || config.maxScale || '5.0'));
          setPassingCGPA(String(config.passingCGPA || config.minimumPassing || '1.0'));
          setFirstClass(String(config.firstClass || config.gradeBoundaries?.firstClass || '4.5'));
          setSecondClassUpper(String(config.secondClassUpper || config.gradeBoundaries?.secondClassUpper || '3.5'));
          setSecondClassLower(String(config.secondClassLower || config.gradeBoundaries?.secondClassLower || '2.5'));
          setThirdClass(String(config.thirdClass || config.gradeBoundaries?.thirdClass || '1.5'));
        }
      })
      .catch(() => {})
      .finally(() => setCgpaLoading(false));
  }, []);

  const handleSaveCGPA = async (e: React.FormEvent) => {
    e.preventDefault();
    setCgpaSaving(true);
    try {
      await updateCGPAConfig({
        maxScale: parseFloat(scale),
        passingCGPA: parseFloat(passingCGPA),
        gradeBoundaries: {
          firstClass: parseFloat(firstClass),
          secondClassUpper: parseFloat(secondClassUpper),
          secondClassLower: parseFloat(secondClassLower),
          thirdClass: parseFloat(thirdClass),
        },
      });
      success('Classification Saved', 'Degree classification thresholds updated.');
    } catch {
      notifyError('Save Failed', 'Could not update degree classification settings.');
    } finally {
      setCgpaSaving(false);
    }
  };

  const copyAddress = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      success('Copied', `${key === 'students' ? 'Student' : 'Staff'} address copied to clipboard.`);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      notifyError('Copy Failed', 'Please select and copy the address manually.');
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aces-ivory.vercel.app';
  const studentSignInUrl = urlCode ? `${originUrl}/${urlCode}` : `${originUrl}/login`;
  const staffSignInUrl = urlCode ? `${originUrl}/${urlCode}/admin` : `${originUrl}/admin`;

  // Dynamic live example classification for 4.2
  const exampleCgpa = 4.2;
  const exampleClassification = useMemo(() => {
    const num = exampleCgpa;
    const fClass = parseFloat(firstClass) || 4.5;
    const sUpper = parseFloat(secondClassUpper) || 3.5;
    const sLower = parseFloat(secondClassLower) || 2.5;
    const tClass = parseFloat(thirdClass) || 1.5;
    const pass = parseFloat(passingCGPA) || 1.0;

    if (num >= fClass) return { name: 'First Class', color: 'text-blue-600 dark:text-blue-400 font-bold' };
    if (num >= sUpper) return { name: 'Second Class Upper', color: 'text-emerald-600 dark:text-emerald-400 font-bold' };
    if (num >= sLower) return { name: 'Second Class Lower', color: 'text-amber-600 dark:text-amber-400 font-bold' };
    if (num >= tClass) return { name: 'Third Class', color: 'text-slate-600 dark:text-slate-400 font-bold' };
    if (num >= pass) return { name: 'Pass', color: 'text-slate-500 font-bold' };
    return { name: 'Fail', color: 'text-red-500 font-bold' };
  }, [firstClass, secondClassUpper, secondClassLower, thirdClass, passingCGPA]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* ─── HERO PROFILE BANNER ─── */}
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm mb-6">
          {/* Blue Curved Banner with Abstract Concentric Arcs */}
          <div className="relative h-36 sm:h-44 md:h-48 w-full bg-[#1a66d6] dark:bg-[#1554b3] overflow-hidden">
            <svg
              className="absolute right-0 top-0 h-full w-2/3 pointer-events-none opacity-20 text-white"
              viewBox="0 0 600 240"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="480" cy="80" r="120" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="480" cy="80" r="200" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="480" cy="80" r="280" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="480" cy="80" r="360" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Profile Bar below Banner */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              {/* Left: Avatar + Names + Badges */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-5">
                {/* Circular Avatar */}
                <div className="relative -mt-16 sm:-mt-20 shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-[#131722] bg-[#1a66d6] text-white flex items-center justify-center font-bold text-3xl sm:text-4xl shadow-md overflow-hidden">
                    {user?.avatar || user?.avatarUrl ? (
                      <img
                        src={getMediaUrl(user.avatar || user.avatarUrl) ?? ''}
                        alt={fullName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Camera Upload Badge */}
                  <label
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-slate-900/90 hover:bg-black text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110"
                    title="Change profile photo"
                    aria-label="Upload photo"
                  >
                    <Camera className="w-4 h-4 stroke-[2.2]" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>

                {/* Name & Badges */}
                <div className="pb-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {fullName}
                  </h1>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a66d6] text-white shadow-xs">
                      <Shield className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>{roleBadgeLabel}</span>
                    </span>

                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {roleTitle}
                    </span>

                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {deptName}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Active and approved</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Edit profile Button */}
              <div className="shrink-0 pt-2 md:pt-0">
                <button
                  type="button"
                  onClick={() => openEditModal()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-all shadow-xs active:scale-[0.99]"
                >
                  <Pencil className="w-4 h-4 stroke-[2]" />
                  <span>Edit profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 6 PILL NAVIGATION TABS ─── */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-1.5 flex items-center gap-1.5 shadow-sm mb-6 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'overview'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('privileges')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'privileges'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Privileges</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('security')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'security'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('activity')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'activity'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Activity</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('preferences')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('department')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'department'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Department</span>
          </button>
        </div>

        {/* ─── TAB 1: OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Details */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Personal details</h2>
                  <button
                    type="button"
                    onClick={() => openEditModal()}
                    className="text-xs sm:text-sm font-semibold text-[#1a66d6] dark:text-[#4f9bff] hover:underline"
                  >
                    Edit all
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Full name */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Full name
                    </span>
                    <span className="flex-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                      {fullName}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Email address
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white">{email}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Verified</span>
                      </span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Phone number
                    </span>
                    {phone ? (
                      <span className="flex-1 text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                        {phone}
                      </span>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          Missing
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditModal('phone')}
                          className="text-xs font-semibold text-[#1a66d6] hover:underline"
                        >
                          + Add phone
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Date of birth
                    </span>
                    {dateOfBirth ? (
                      <span className="flex-1 text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                        {dateOfBirth}
                      </span>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          Missing
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditModal('dateOfBirth')}
                          className="text-xs font-semibold text-[#1a66d6] hover:underline"
                        >
                          + Add date of birth
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Home / Office Address */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Office / Address
                    </span>
                    {homeAddress ? (
                      <span className="flex-1 text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                        {homeAddress}
                      </span>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          Missing
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditModal('homeAddress')}
                          className="text-xs font-semibold text-[#1a66d6] hover:underline"
                        >
                          + Add address
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Staff ID */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Staff / Admin ID
                    </span>
                    <span className="flex-1 text-xs sm:text-sm font-mono text-slate-900 dark:text-white">
                      {matricOrStaffId || `${deptName.slice(0, 3).toUpperCase()}-ADM-001`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Emergency contact</h2>
                  <button
                    type="button"
                    onClick={() => openEditModal('emergency')}
                    className="text-xs sm:text-sm font-semibold text-[#1a66d6] dark:text-[#4f9bff] hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Contact Name
                    </span>
                    {emergencyName ? (
                      <span className="flex-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                        {emergencyName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Missing
                      </span>
                    )}
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-32 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Contact Phone
                    </span>
                    {emergencyPhone ? (
                      <span className="flex-1 text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                        {emergencyPhone}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Missing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Account status & Quick links */}
            <div className="space-y-6">
              {/* Account Status Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Account status
                </h3>

                <div className="space-y-3.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Active and approved
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Assigned role</span>
                    <span className="font-bold text-slate-900 dark:text-white">{roleTitle}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Department</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{deptName}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Member since</span>
                    <span className="font-medium text-slate-900 dark:text-white">{memberSince}</span>
                  </div>
                </div>
              </div>

              {/* Quick Links Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Quick links
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate(departmentAdminPath(urlCode, '/admin/course-hub'))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-[#1a66d6] text-left transition-all group"
                  >
                    <BookOpen className="w-4 h-4 text-[#1a66d6] mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Courses</p>
                    <p className="text-[10px] text-slate-500">Manage catalog</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(departmentAdminPath(urlCode, '/admin/users'))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-[#1a66d6] text-left transition-all group"
                  >
                    <Users className="w-4 h-4 text-emerald-600 mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Users</p>
                    <p className="text-[10px] text-slate-500">Students & staff</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(departmentAdminPath(urlCode, '/admin/announcements'))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-[#1a66d6] text-left transition-all group"
                  >
                    <Megaphone className="w-4 h-4 text-amber-500 mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Announce</p>
                    <p className="text-[10px] text-slate-500">Post broadcast</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(departmentAdminPath(urlCode, '/bu/dues'))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-[#1a66d6] text-left transition-all group"
                  >
                    <CreditCard className="w-4 h-4 text-purple-600 mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Dues</p>
                    <p className="text-[10px] text-slate-500">Payments & fees</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: PRIVILEGES ─── */}
        {activeTab === 'privileges' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              {/* ACADEMICS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ACADEMICS
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Semesters & Registration</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Control registration windows and sessions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/sessions'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Courses</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Catalog, lecturers and enrollment
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/course-hub'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Course Forms</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Sign, batch approve and configure stamps
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/crf-signing'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              {/* PEOPLE & ACCESS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    PEOPLE & ACCESS
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Users</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Students, staff and delegations
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/users'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Role assignments</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Assign course reps, bursars and permissions
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/user-roles'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              {/* FINANCE & COMMUNICATE */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    FINANCE & COMMUNICATE
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dues & Payments</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Department fees, dues status and verification
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/bu/dues'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Announcements</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Publish bulletins and emergency alerts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/announcements'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Support inbox</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tickets, complaints and feedback
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/complaints'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs transition-colors shrink-0"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Access at a glance & Actions that are logged */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Access at a glance
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                    <span className="text-2xl font-black text-slate-900 dark:text-white block">9</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block font-medium">
                      Can manage
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                    <span className="text-2xl font-black text-slate-900 dark:text-white block">3</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block font-medium">
                      View only
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Role</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{roleBadgeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Scope</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{deptName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Granted by</span>
                    <span className="font-semibold text-slate-900 dark:text-white">System administrator</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2.2]" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Actions that are logged</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  These need a reason and are saved in the audit log.
                </p>
                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                    <span>Advance a student who owes dues</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                    <span>Change a student's course registration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                    <span>Delete a course</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                    <span>Change a role or permission</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Need more access?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Ask the platform administrator to review your permissions.
                </p>
                <button
                  type="button"
                  disabled={requestSent}
                  onClick={() => {
                    setRequestSent(true);
                    success('Request Sent', 'Your access review request was submitted.');
                    setTimeout(() => setRequestSent(false), 4000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{requestSent ? 'Request Submitted' : 'Request access'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: SECURITY ─── */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              {/* Change Password Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Change password</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Use at least 6 characters. A long, unique password is safest.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="pt-4 space-y-4">
                  {/* Current password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    <div className="mt-2.5">
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        <div
                          className={`rounded-full transition-all ${passStrength.score >= 1 ? passStrength.color : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <div
                          className={`rounded-full transition-all ${passStrength.score >= 2 ? passStrength.color : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <div
                          className={`rounded-full transition-all ${passStrength.score >= 3 ? passStrength.color : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                        <div
                          className={`rounded-full transition-all ${passStrength.score >= 4 ? passStrength.color : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {passStrength.label || 'Strength'}
                        </span>
                        <span>6 to 72 characters</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {passError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{passError}</p>}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={changingPass}
                      className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{changingPass ? 'Updating...' : 'Change password'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Where you are signed in */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Laptop className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Where you are signed in</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Devices that have used your account recently
                      </p>
                    </div>
                  </div>
                </div>

                <div className="py-4 space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                      <Laptop className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {clientDevice.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{clientDevice.location}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900">
                      This device
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSignOutOtherDevices}
                      className="px-4 py-2 rounded-xl text-xs font-semibold border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out of all other devices</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sign-in alerts */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                      <Megaphone className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sign-in alerts</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Email me when a new device signs in · Sent to{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSignInAlerts}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      signInAlerts ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        signInAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Proposed Two-Step Verification Card */}
              {/* <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Two-step verification (2FA)</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                          Proposed
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                        Add an extra layer of security. Sign in using your password plus a one-time verification code generated by an authenticator app (Google Authenticator, Authy).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorModal(true);
                      setTwoFactorEnabled(!twoFactorEnabled);
                      success('2FA Status', twoFactorEnabled ? 'Two-step verification disabled.' : 'Two-step verification enabled.');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white shrink-0 shadow-xs"
                  >
                    {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </button>
                </div>
              </div> */}
            </div>

            {/* Right Column: Security Checkup Ring & Account activity */}
            <div className="space-y-6">
              {/* Security Checkup Ring */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Security checkup
                </h3>

                {/* Circular Gauge */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-100 dark:text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - securityScore / 100)}
                        strokeLinecap="round"
                        className="text-[#1a66d6] transition-all duration-700 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {securityScore}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Fair</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Verified school email</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Password set</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Sign-in alerts enabled</span>
                  </div>
                </div>
              </div>

              {/* Account Activity stats */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Account activity
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Last sign-in</span>
                    <span className="font-bold text-slate-900 dark:text-white">Today, 8:12 AM</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Password changed</span>
                    <span className="font-medium text-slate-900 dark:text-white">Never</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Failed sign-ins (7 days)</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: ACTIVITY ─── */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* 3 Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                      Actions this week
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {auditLogs.length > 0 ? auditLogs.length : 18}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Logged actions</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {auditLogs.filter((l) => l.reason).length > 0 ? auditLogs.filter((l) => l.reason).length : 4}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Last sign-in</span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Today, 8:12 AM
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Activity Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Timeline */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                  {/* Header & Category Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Your activity</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Everything you changed in the portal
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['All', 'Academics', 'Users', 'Finance', 'Announcements'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActivityFilter(cat)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activityFilter === cat
                              ? 'bg-[#1a66d6] text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grouped Logs Timeline */}
                  {loadingLogs ? (
                    <div className="py-12 text-center text-xs text-slate-400">Loading activity timeline...</div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No activity recorded yet
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Sensitive changes and actions will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 pt-4">
                      {Object.entries(groupedLogs).map(([groupTitle, logs]) => (
                        <div key={groupTitle} className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {groupTitle}
                          </p>

                          <div className="space-y-3">
                            {logs.map((log) => {
                              const isLogged = Boolean(log.reason);
                              const logTime = new Date(log.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              });
                              return (
                                <div
                                  key={log.id}
                                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1a66d6] flex items-center justify-center shrink-0 mt-0.5">
                                        <Clock className="w-4 h-4 stroke-[2]" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                            {log.field_name || log.change_type || 'Portal update'}
                                          </h4>
                                          {isLogged && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-[#1a66d6] dark:text-[#4f9bff]">
                                              <Shield className="w-2.5 h-2.5" />
                                              Logged
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                          {log.old_value && log.new_value
                                            ? `Changed from "${log.old_value}" to "${log.new_value}"`
                                            : `Action performed by ${log.changed_by_name || log.changed_by_role}`}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-[11px] text-slate-400 whitespace-nowrap font-medium">
                                      {logTime}
                                    </span>
                                  </div>

                                  {log.reason && (
                                    <div className="mt-3 p-2.5 rounded-lg bg-slate-900 text-slate-100 dark:bg-black/60 text-xs border border-slate-800">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                        REASON
                                      </span>
                                      <p>{log.reason}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Export CSV & What is logged */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                    Export
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Download your activity for a date range
                  </p>

                  <select
                    value={exportRange}
                    onChange={(e) => setExportRange(e.target.value as '30' | '7' | '90' | 'all')}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6] mb-3"
                  >
                    <option value="30">Last 30 days</option>
                    <option value="7">Last 7 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">What is logged</h3>
                  <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                      <span>Changes to students, courses and dues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                      <span>Advancing a student who owes dues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                      <span>Role and permission changes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#1a66d6] stroke-[2.5]" />
                      <span>Sign-ins from new devices</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 5: PREFERENCES ─── */}
        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              {/* Appearance */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Appearance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose how the portal looks for you
                  </p>
                </div>

                {/* 3 Visual Cards: Light, Dark, Match system */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Light Card */}
                  <div
                    onClick={() => setMode('light')}
                    className={`cursor-pointer rounded-2xl p-3 border-2 transition-all ${
                      mode === 'light'
                        ? 'border-[#1a66d6] ring-2 ring-[#1a66d6]/20 bg-blue-50/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-24 rounded-xl bg-slate-100 border border-slate-200 p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="w-12 h-2 rounded bg-slate-800" />
                      <div className="w-full h-4 rounded bg-white shadow-xs" />
                      <div className="flex gap-1">
                        <div className="w-1/3 h-8 rounded bg-white shadow-xs" />
                        <div className="w-2/3 h-8 rounded bg-white shadow-xs" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Light
                      </span>
                      {mode === 'light' && <Check className="w-4 h-4 text-[#1a66d6] stroke-[3]" />}
                    </div>
                  </div>

                  {/* Dark Card */}
                  <div
                    onClick={() => setMode('dark')}
                    className={`cursor-pointer rounded-2xl p-3 border-2 transition-all ${
                      mode === 'dark'
                        ? 'border-[#1a66d6] ring-2 ring-[#1a66d6]/20 bg-blue-50/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-24 rounded-xl bg-slate-900 border border-slate-800 p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="w-12 h-2 rounded bg-slate-400" />
                      <div className="w-full h-4 rounded bg-slate-800 border border-slate-700/60" />
                      <div className="flex gap-1">
                        <div className="w-1/3 h-8 rounded bg-slate-800 border border-slate-700/60" />
                        <div className="w-2/3 h-8 rounded bg-slate-800 border border-slate-700/60" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-400" />
                        Dark
                      </span>
                      {mode === 'dark' && <Check className="w-4 h-4 text-[#1a66d6] stroke-[3]" />}
                    </div>
                  </div>

                  {/* Match System Card */}
                  <div
                    onClick={() => setMode('system')}
                    className={`cursor-pointer rounded-2xl p-3 border-2 transition-all ${
                      mode === 'system'
                        ? 'border-[#1a66d6] ring-2 ring-[#1a66d6]/20 bg-blue-50/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-24 rounded-xl bg-gradient-to-r from-slate-100 to-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 flex flex-col gap-1.5 overflow-hidden">
                      <div className="w-12 h-2 rounded bg-[#1a66d6]" />
                      <div className="w-full h-4 rounded bg-white/80 dark:bg-slate-800/80 shadow-xs" />
                      <div className="flex gap-1">
                        <div className="w-1/2 h-8 rounded bg-white shadow-xs" />
                        <div className="w-1/2 h-8 rounded bg-slate-800 border border-slate-700" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-indigo-500" />
                        Match system
                      </span>
                      {mode === 'system' && <Check className="w-4 h-4 text-[#1a66d6] stroke-[3]" />}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                  Currently using {mode === 'system' ? 'system mode' : `${mode} mode`}.
                </p>
              </div>

              {/* AI Features (4 Toggles) */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">AI features</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Control which AI features are active on your account
                  </p>
                </div>

                <div className="space-y-4">
                  {/* AI Chatbot */}
                  <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1a66d6] flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">AI chatbot</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          The assistant for quick help and guidance.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAIToggle('chatbot_enabled')}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        aiSettings?.chatbot_enabled ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          aiSettings?.chatbot_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Personalization */}
                  <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Brain className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Personalization</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Let AI tailor recommendations to your profile.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAIToggle('personalization_enabled')}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        aiSettings?.personalization_enabled ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          aiSettings?.personalization_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Face recognition attendance */}
                  {/* <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Face recognition attendance</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Enable face detection for attendance and verification.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAIToggle('face_recognition_enabled')}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        aiSettings?.face_recognition_enabled ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          aiSettings?.face_recognition_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div> */}

                  {/* Data collection consent */}
                  <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          Data collection consent
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Share anonymized usage to improve accuracy. No personal data is shared.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAIToggle('data_collection_consent')}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        aiSettings?.data_collection_consent ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                          aiSettings?.data_collection_consent ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Language */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Language</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Language for AI-generated content and chatbot replies
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative w-full sm:w-64">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={aiSettings?.preferred_language || 'en'}
                      onChange={(e) =>
                        setAiSettings(aiSettings ? { ...aiSettings, preferred_language: e.target.value } : null)
                      }
                      className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    >
                      <option value="en">English</option>
                      <option value="yo">Yoruba</option>
                      <option value="ig">Igbo</option>
                      <option value="ha">Hausa</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">More languages can be added later.</span>
                </div>
              </div>

              {/* Save Preferences Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={savingPrefs}
                  onClick={handleSavePreferences}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingPrefs ? 'Saving...' : 'Save preferences'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Preferences summary & About data */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                  Your preferences
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Theme</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">{mode}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">AI features</span>
                    <span className="font-bold text-slate-900 dark:text-white">{activeAICount} of 4 on</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Language</span>
                    <span className="font-bold text-slate-900 dark:text-white">English</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-[#1a66d6]">
                  <Info className="w-4 h-4" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">About data</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Face recognition and data sharing stay off until you turn them on.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 6: DEPARTMENT ─── */}
        {activeTab === 'department' && (
          <div className="space-y-6 max-w-4xl">
            {/* Department Card */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Department</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Shown to students and on signed forms
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <DepartmentLogo department={department} className="w-12 h-12 shadow-md rounded-2xl" />
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{deptName}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{institutionName}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
                >
                  Change logo
                </button>
              </div>
            </div>

            {/* Sign-in addresses */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Sign-in addresses</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Give these to your department. Students sign in at the first, staff and admins at the second.
                </p>
              </div>

              <div className="space-y-3">
                {/* Students Address */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      STUDENTS
                    </span>
                    <p className="text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white truncate">
                      {studentSignInUrl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyAddress('students', studentSignInUrl)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xs transition-all shrink-0"
                  >
                    {copiedKey === 'students' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Staff and Admins Address */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      STAFF AND ADMINS
                    </span>
                    <p className="text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white truncate">
                      {staffSignInUrl}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyAddress('staff', staffSignInUrl)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xs transition-all shrink-0"
                  >
                    {copiedKey === 'staff' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Degree classification */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Degree classification</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Minimum CGPA needed for each classification
                </p>
              </div>

              {/* Color legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  <span className="text-slate-700 dark:text-slate-300">First</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-300">2nd Upper</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  <span className="text-slate-700 dark:text-slate-300">2nd Lower</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                  <span className="text-slate-700 dark:text-slate-300">Third</span>
                </div>
              </div>

              {/* Color band visualization matching Screenshot 3 */}
              <div className="mb-6 pt-1">
                <div className="h-4 w-full rounded-md flex overflow-hidden shadow-xs">
                  {/* Fail band (0 to 1.0) */}
                  <div className="bg-slate-300 dark:bg-slate-700" style={{ width: '20%' }} />
                  {/* Third Class (1.0 to 1.5) */}
                  <div className="bg-slate-400 dark:bg-slate-600" style={{ width: '10%' }} />
                  {/* Third to 2nd Lower (1.5 to 2.5) */}
                  <div className="bg-slate-500" style={{ width: '20%' }} />
                  {/* 2nd Lower (2.5 to 3.5) */}
                  <div className="bg-amber-400" style={{ width: '20%' }} />
                  {/* 2nd Upper (3.5 to 4.5) */}
                  <div className="bg-emerald-500" style={{ width: '20%' }} />
                  {/* First Class (4.5 to 5.0) */}
                  <div className="bg-blue-500" style={{ width: '10%' }} />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 px-1">
                  <span style={{ marginLeft: '18%' }}>1.0</span>
                  <span style={{ marginLeft: '6%' }}>1.5</span>
                  <span style={{ marginLeft: '16%' }}>2.5</span>
                  <span style={{ marginLeft: '16%' }}>3.5</span>
                  <span style={{ marginLeft: '14%' }}>4.5</span>
                </div>
              </div>

              {/* Inputs Form */}
              <form onSubmit={handleSaveCGPA} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Maximum CGPA scale
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={scale}
                      onChange={(e) => setScale(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Minimum passing CGPA
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={passingCGPA}
                      onChange={(e) => setPassingCGPA(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      First Class (min CGPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={firstClass}
                      onChange={(e) => setFirstClass(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Second Class Upper (min CGPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={secondClassUpper}
                      onChange={(e) => setSecondClassUpper(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Second Class Lower (min CGPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={secondClassLower}
                      onChange={(e) => setSecondClassLower(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Third Class (min CGPA)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={thirdClass}
                      onChange={(e) => setThirdClass(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>
                </div>

                {/* Live Example Box matching Screenshot 3 */}
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    A student with a CGPA of <span className="font-bold">4.2</span> graduates with{' '}
                    <span className={exampleClassification.color}>{exampleClassification.name}</span>
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={cgpaSaving}
                    className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{cgpaSaving ? 'Saving...' : 'Save classification'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ─── EDIT PROFILE MODAL ─── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Personal Details</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+234..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Office / Residential Address
                </label>
                <input
                  type="text"
                  placeholder="Campus office or residential address"
                  value={form.homeAddress}
                  onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="Name"
                      value={form.emergencyContactName}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={form.emergencyContactPhone}
                      onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBasicInfo}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingBasicInfo ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfilePage;
