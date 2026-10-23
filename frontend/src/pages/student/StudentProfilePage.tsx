import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getMediaUrl } from '../../api/client';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

import {
  updateBasicInfo,
  uploadProfilePhoto,
  // uploadStudentDocument,
  listStudentDocuments,
} from '../../api/profile-edit';
import type { StudentDocument } from '../../api/profile-edit';
import { useNotification } from '../../hooks/useNotification';
import { getInitials } from '../../utils/formatters';
import { formatDepartmentDisplayName } from '../../config/department';
import { useCurrentDepartment } from '../../components/branding/department';
import {
  User,
  Phone,
  MapPin,
  Mail,
  Lock,
  Upload,
  Camera,
  GraduationCap,
  PenLine,
  Check,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PROFILE_SCAN_PARAM } from '../../utils/qr-scanner';
import type { User as UserType } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import Student3DIDCard from '../../components/profile/Student3DIDCard';

type ProfileUser = UserType & { entryYear?: number };

type TabType = 'overview' | 'personal' | 'academic';

const extractDocuments = (raw: unknown): StudentDocument[] => {
  if (Array.isArray(raw)) return raw as StudentDocument[];
  const data = (raw as { data?: StudentDocument[] } | null | undefined)?.data;
  return Array.isArray(data) ? data : [];
};

/** Formats phone number into masked format e.g. +234 907 ••• ••34 */
const maskPhoneNumber = (phone?: string): string => {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length < 8) return clean;
  const prefix = clean.slice(0, Math.min(8, clean.length - 2));
  const suffix = clean.slice(-2);
  return `${prefix} ••• ••${suffix}`;
};

export const StudentProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const idCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const department = useCurrentDepartment();

  const u = user as ProfileUser | null;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [saving, setSaving] = useState(false);
  const [, setUploadingPhoto] = useState(false);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [, setLoadingDocs] = useState(false);

  // Form state
  const initialForm = useMemo(() => {
    let fName = u?.firstName || '';
    let lName = u?.lastName || '';
    if (!fName && !lName) {
      const rawName = u?.fullName || u?.full_name || (u as any)?.name || '';
      const parts = rawName.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }
    return {
      firstName: fName,
      lastName: lName,
      phone: u?.phone || '',
      homeAddress: u?.address || (u as { homeAddress?: string })?.homeAddress || '',
      dateOfBirth: u?.dateOfBirth || '',
      emergencyContactName: u?.emergencyContactName || '',
      emergencyContactPhone: u?.emergencyContactPhone || '',
    };
  }, [u]);

  const [form, setForm] = useState(initialForm);

  // Sync form when initialForm changes
  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  // Track if changes have been made
  const isDirty = useMemo(() => {
    return (
      form.firstName !== initialForm.firstName ||
      form.lastName !== initialForm.lastName ||
      form.phone !== initialForm.phone ||
      form.homeAddress !== initialForm.homeAddress ||
      form.dateOfBirth !== initialForm.dateOfBirth ||
      form.emergencyContactName !== initialForm.emergencyContactName ||
      form.emergencyContactPhone !== initialForm.emergencyContactPhone
    );
  }, [form, initialForm]);

  // Load documents
  useEffect(() => {
    setLoadingDocs(true);
    listStudentDocuments()
      .then((res) => {
        setDocuments(extractDocuments(res));
      })
      .catch(() => {})
      .finally(() => setLoadingDocs(false));
  }, []);

  // Generate Digital ID QR Code
  useEffect(() => {
    if (idCanvasRef.current) {
      const scanUrl = `${window.location.origin}/connect?${PROFILE_SCAN_PARAM}=${u?.id || ''}`;
      QRCode.toCanvas(idCanvasRef.current, scanUrl, {
        width: 100,
        margin: 1,
        color: { dark: '#0a0f1d', light: '#ffffff' },
      });
    }
  }, [u?.id, activeTab]);

  // Profile completion calculation (5 steps)
  const steps = useMemo(() => {
    const s1 = Boolean(form.firstName?.trim() && form.lastName?.trim());
    const s2 = Boolean(form.emergencyContactName?.trim() && form.emergencyContactPhone?.trim());
    const s3 = Boolean(form.homeAddress?.trim());
    const s4 = Boolean(u?.avatar || u?.avatarUrl);
    // const s5 = documents.length > 0;
    return [
      { id: 'personal', label: 'Personal information', done: s1 },
      { id: 'emergency', label: 'Emergency contact', done: s2 },
      { id: 'address', label: 'Home address', done: s3 },
      { id: 'photo', label: 'Profile photo', done: s4 },
      // { id: 'documents', label: 'Upload a document', done: s5 },
    ];
  }, [form, u, documents]);

  const completedSteps = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

  // Address validation: Required to finish profile
  const addressHasError = !form.homeAddress?.trim();

  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateBasicInfo(form);
      updateUser(data);
      success('Profile Updated', 'Your profile details have been saved successfully.');
    } catch (err) {
      notifyError('Update Failed', getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  // Handle Discard
  const handleDiscard = () => {
    setForm(initialForm);
  };

  // Photo upload
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
      success('Photo Updated', 'Profile photo uploaded successfully.');
    } catch (err) {
      notifyError('Upload Failed', getErrorMessage(err, 'Failed to upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deptDisplayName = formatDepartmentDisplayName(u?.tenant?.name) || '';
  const matricNo = u?.matricNumber || u?.matric_number || (u as any)?.regNo || (u as any)?.reg_no || '';
  const fullName =
    [form.firstName, form.lastName].filter(Boolean).join(' ') ||
    u?.fullName ||
    u?.full_name ||
    (u as any)?.name ||
    'Student';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header with Top Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--text)] tracking-tight">Profile</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Manage how you appear and keep your records up to date.
          </p>
        </div>

        {/* Top Navigation Tabs */}
        <div className="inline-flex items-center p-1 rounded-full border border-slate-200 dark:border-[#22252d] bg-white dark:bg-[#15171c] shadow-sm select-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'personal'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Personal</span>
          </button>

          <button
            onClick={() => setActiveTab('academic')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'academic'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Academic</span>
          </button>

          {/* <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'documents'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Documents</span>
          </button> */}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD VIEW                          */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Row 1: Profile Summary Card + 3D Digital ID Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Card: Student Bio, Level & Stats (~7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 sm:p-7 shadow-sm flex flex-col justify-between transition-colors">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar with Circular Completion Progress Arc */}
                <div className="relative shrink-0 flex flex-col items-center">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                    {/* SVG Circular Progress Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        className="stroke-slate-100 dark:stroke-[#22252e]"
                        strokeWidth="6"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        className="stroke-[#1d68ec] dark:stroke-[#38bdf8] transition-all duration-1000 ease-out"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={276.4}
                        strokeDashoffset={276.4 * (1 - completionPercentage / 100)}
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Central Avatar */}
                    <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden bg-gradient-to-br from-[#1d68ec] to-[#38bdf8] flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                      {u?.avatar || u?.avatarUrl ? (
                        <img
                          src={getMediaUrl(u.avatar || u.avatarUrl) ?? ''}
                          alt={fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(form.firstName, form.lastName)
                      )}
                    </div>

                    {/* Camera Badge Button */}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white dark:bg-[#20232b] text-[var(--text)] border border-slate-200 dark:border-[#2a2d39] flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                      aria-label="Upload photo"
                      title="Upload profile photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Completion pill */}
                  <span className="mt-2 text-[10px] font-bold text-[#1d68ec] dark:text-[#38bdf8] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/50">
                    {completionPercentage}% complete
                  </span>
                </div>

                {/* Info & Stats */}
                <div className="flex-1 text-center sm:text-left">
                  {/* Status Pills */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      Active
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      Approved
                    </span>
                  </div>

                  {/* Name & Program */}
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] tracking-tight">{fullName}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Student &middot; {deptDisplayName}</p>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 py-4 mt-2 border-y border-slate-100 dark:border-[#22252d] text-center sm:text-left">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Level</p>
                      <p className="text-sm font-bold text-[var(--text)]">{u?.level || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Standing</p>
                      <p className="text-sm font-bold text-[var(--text)]">Good</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Admitted</p>
                      <p className="text-sm font-bold text-[var(--text)]">{u?.yearAdmitted || u?.entryYear || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Member since</p>
                      <p className="text-sm font-bold text-[var(--text)]">
                        {u?.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : u?.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="px-4 py-2 rounded-full bg-[#1d68ec] hover:bg-[#1655c4] dark:bg-[#2563eb] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit profile</span>
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-4 py-2 rounded-full border border-slate-300 dark:border-[#2a2d39] bg-white dark:bg-[#181a20] text-xs font-semibold text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#20222a] flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload photo</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: 3D Digital Student ID Card (~5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-start">
              <Student3DIDCard
                fullName={fullName}
                matricNo={matricNo}
                level={u?.level || ''}
                departmentName={deptDisplayName}
                avatarUrl={u?.avatar || u?.avatarUrl}
                studentId={u?.id}
                tenant={u?.tenant || department}
              />
            </div>
          </div>

          {/* Row 2: Profile Strength & Next Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Profile Strength Card (4 cols) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 shadow-sm flex flex-col justify-between transition-colors">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] mb-1">Profile strength</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  {completedSteps} of {totalSteps} steps done
                </p>

                {/* 5-segment Progress Bar */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {steps.map((s) => (
                    <div
                      key={s.id}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        s.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-[#22252e]'
                      }`}
                      title={`${s.label}: ${s.done ? 'Completed' : 'Pending'}`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Finish the {totalSteps - completedSteps} steps on the right to unlock a complete, verified profile.
              </p>
            </div>

            {/* Next Steps Cards (8 cols) */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[var(--text)]">Next steps</h3>
                <span className="text-xs text-[var(--text-muted)]">{totalSteps - completedSteps} remaining</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Step 1: Add home address */}
                <div className="rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50/60 dark:bg-[#111317] p-4 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center mb-3">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)] mb-1">Add home address</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mb-4">Required to finish your profile.</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('personal')}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-[#2a2d39] text-[var(--text)] text-xs font-semibold hover:bg-white dark:hover:bg-[#1a1c22] transition-colors"
                  >
                    Add address
                  </button>
                </div>

                {/* Step 2: Add profile photo */}
                <div className="rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50/60 dark:bg-[#111317] p-4 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center mb-3">
                      <Camera className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)] mb-1">Add a profile photo</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mb-4">JPG or PNG, up to 2MB.</p>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-[#2a2d39] text-[var(--text)] text-xs font-semibold hover:bg-white dark:hover:bg-[#1a1c22] transition-colors"
                  >
                    Upload photo
                  </button>
                </div>

                {/* Step 3: Upload a document */}
                {/* <div className="rounded-xl border border-slate-200 dark:border-[#262833] bg-slate-50/60 dark:bg-[#111317] p-4 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center mb-3">
                      <Folder className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-[var(--text)] mb-1">
                      Upload a document
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mb-4">
                      Supporting files for verification.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-[#2a2d39] text-[var(--text)] text-xs font-semibold hover:bg-white dark:hover:bg-[#1a1c22] transition-colors"
                  >
                    Upload
                  </button>
                </div> */}
              </div>
            </div>
          </div>

          {/* Row 3: Personal details summary & Academic snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Personal Details Table (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[var(--text)]">Personal details</h3>
                <button
                  onClick={() => setActiveTab('personal')}
                  className="text-xs font-semibold text-[#1d68ec] dark:text-[#38bdf8] hover:underline"
                >
                  Edit all
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#22252d] text-xs">
                {/* Full name */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Full name</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">{fullName}</span>
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="text-slate-400 hover:text-[var(--text)]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Email</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">{u?.email || '—'}</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Phone */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">
                      {form.phone ? maskPhoneNumber(form.phone) : '—'}
                    </span>
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="text-slate-400 hover:text-[var(--text)]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Date of birth */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Date of birth</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">{form.dateOfBirth || '—'}</span>
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="text-slate-400 hover:text-[var(--text)]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Home address */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Home address</span>
                  <div className="flex items-center gap-2">
                    {form.homeAddress?.trim() ? (
                      <span className="font-semibold text-[var(--text)]">{form.homeAddress}</span>
                    ) : (
                      <>
                        <span className="text-[var(--text-muted)]">Not added yet</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Missing
                        </span>
                        <button
                          onClick={() => setActiveTab('personal')}
                          className="px-2.5 py-1 rounded-lg bg-[#1d68ec] text-white text-[11px] font-bold ml-1"
                        >
                          Add
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Emergency contact */}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Emergency contact</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">
                      {form.emergencyContactName} &middot; {maskPhoneNumber(form.emergencyContactPhone)}
                    </span>
                    <button
                      onClick={() => setActiveTab('personal')}
                      className="text-slate-400 hover:text-[var(--text)]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Snapshot (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[var(--text)]">Academic snapshot</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#20222a] text-[var(--text-muted)]">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              </div>

              {/* 2x3 Grid of Tiles */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Matric number</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">{matricNo || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Level</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">{u?.level ? `${u.level} Level` : '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Admission mode</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">{u?.admissionMode || 'UTME'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Year admitted</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">{u?.yearAdmitted || u?.entryYear || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Standing</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">Good standing</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-[#22252d] bg-slate-50/70 dark:bg-[#111317] p-3.5">
                  <p className="text-[10px] text-[var(--text-muted)]">Entry year</p>
                  <p className="text-xs font-bold text-[var(--text)] mt-1">{u?.entryYear || u?.yearAdmitted || '—'}</p>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Need a correction? Contact your HOD to request changes to academic details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONAL INFORMATION EDIT VIEW                                      */}
      {/* ========================================================================= */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Checklist Card (4 cols) */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-4 shadow-sm transition-colors">
              <div className="space-y-1">
                {/* Step 1: Personal Information */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 text-[#1d68ec] dark:text-[#38bdf8] font-semibold text-xs transition-colors">
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 shrink-0" />
                    <span>Personal information</span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                </div>

                {/* Step 2: Emergency Contact */}
                <div className="flex items-center justify-between p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-medium transition-colors">
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 shrink-0" />
                    <span>Emergency contact</span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                </div>

                {/* Step 3: Home address */}
                <button
                  onClick={() => addressInputRef.current?.focus()}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-medium text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Home address</span>
                  </div>
                  {form.homeAddress?.trim() ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                  )}
                </button>

                {/* Step 4: Profile photo */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-medium text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>Profile photo</span>
                  </div>
                  {u?.avatar || u?.avatarUrl ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Forms Area (9 cols) */}
          <div className="lg:col-span-9 space-y-6">
            {/* Personal Information Form Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 sm:p-7 shadow-sm transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">Personal information</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Edit your basic profile details</p>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Fields marked with a lock cannot be changed
                </span>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* First name (with visible focus ring) */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">First name</label>
                  <div className="relative flex items-center rounded-xl border-2 border-[#1d68ec] ring-4 ring-[#1d68ec]/15 dark:ring-[#38bdf8]/15 bg-white dark:bg-[#111317] transition-all">
                    <User className="w-4 h-4 text-[var(--text-muted)] ml-3.5 shrink-0" />
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Last name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Last name</label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#111317] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20 transition-all">
                    <User className="w-4 h-4 text-[var(--text-muted)] ml-3.5 shrink-0" />
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Email (Locked with reason) */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Email</label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 dark:border-[#22252d] bg-slate-50 dark:bg-[#111317]/60 text-[var(--text-muted)] select-none">
                    <Mail className="w-4 h-4 ml-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={u?.email || '—'}
                      disabled
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text-muted)] focus:outline-none cursor-not-allowed"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-3.5 shrink-0" />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                    Verified. Contact support to change your email.
                  </p>
                </div>

                {/* Phone (Masked) */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Phone</label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#111317] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20 transition-all">
                    <Phone className="w-4 h-4 text-[var(--text-muted)] ml-3.5 shrink-0" />
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+234 907 ••• ••34"
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Date of birth */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Date of birth</label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#111317] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20 transition-all">
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      className="w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Home address (with error message & red border when empty) */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Home address</label>
                  <div
                    className={`relative flex items-center rounded-xl bg-white dark:bg-[#111317] transition-all ${
                      addressHasError
                        ? 'border border-red-500/80 ring-1 ring-red-500/20'
                        : 'border border-slate-300 dark:border-[#262833] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20'
                    }`}
                  >
                    <MapPin
                      className={`w-4 h-4 ml-3.5 shrink-0 ${
                        addressHasError ? 'text-red-500' : 'text-[var(--text-muted)]'
                      }`}
                    />
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={form.homeAddress}
                      onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                      placeholder="Enter your home address"
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                  {addressHasError && (
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-500 dark:text-red-400 mt-1.5">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Required to finish your profile</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252d] bg-white dark:bg-[#16181d] p-6 sm:p-7 shadow-sm transition-colors">
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">Emergency contact</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Someone we can reach if needed</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Contact name</label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#111317] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20 transition-all">
                    <User className="w-4 h-4 text-[var(--text-muted)] ml-3.5 shrink-0" />
                    <input
                      type="text"
                      value={form.emergencyContactName}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      placeholder="Full name of emergency contact"
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-2">Contact phone</label>
                  <div className="relative flex items-center rounded-xl border border-slate-300 dark:border-[#262833] bg-white dark:bg-[#111317] focus-within:border-[#1d68ec] focus-within:ring-2 focus-within:ring-[#1d68ec]/20 transition-all">
                    <Phone className="w-4 h-4 text-[var(--text-muted)] ml-3.5 shrink-0" />
                    <input
                      type="text"
                      value={form.emergencyContactPhone}
                      onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                      placeholder="+234 803 ••• ••42"
                      className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[var(--text)] font-medium focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Floating Bar: "You have unsaved changes" */}
            <div className="rounded-2xl border border-blue-500/40 dark:border-blue-500/30 bg-blue-50/40 dark:bg-[#141b29] p-4 px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--text)]">You have unsaved changes</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {addressHasError
                      ? '1 field needs attention before you can save.'
                      : isDirty
                        ? 'Unsaved changes are waiting to be saved.'
                        : 'You can update your personal records at any time.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={!isDirty || saving}
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-[#2a2d39] bg-white dark:bg-[#181a20] text-xs font-semibold text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#20222a] disabled:opacity-50 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-2 rounded-full bg-[#1d68ec] hover:bg-[#1655c4] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-70 active:scale-[0.99]"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{saving ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACADEMIC DETAILS VIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'academic' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Academic Records & Degree Progress</CardTitle>
                <Lock className="w-4 h-4 text-surface-400" />
              </div>
              <CardDescription>
                Official university records managed by the Department of {deptDisplayName}
              </CardDescription>
            </CardHeader>
            <div className="p-6 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Institution</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{u?.tenant?.institution || '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Faculty / Department</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{deptDisplayName}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Matric Number</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{matricNo}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Current Level</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{u?.level || '—'} Level</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Admission Mode</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{u?.admissionMode || 'UTME'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-[#22252d] p-4 bg-slate-50/50 dark:bg-[#111317]">
                <p className="text-xs text-[var(--text-muted)]">Year Admitted</p>
                <p className="text-sm font-bold text-[var(--text)] mt-1">{u?.yearAdmitted || '—'}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DOCUMENTS VIEW                                                     */}
      {/* ========================================================================= */}
      {/* {activeTab === 'documents' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Supporting Academic Documents</CardTitle>
                  <CardDescription>
                    Upload course registration forms (CRF), dues receipts, and certificates for departmental verification
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => docRef.current?.click()}
                >
                  Upload Document
                </Button>
              </div>
            </CardHeader>
            <div className="p-6 pt-0">
              <input
                ref={docRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => handleDocUpload(e, 'supporting_doc')}
              />

              {loadingDocs && (
                <p className="text-xs text-[var(--text-muted)] py-4 text-center">Loading documents...</p>
              )}

              {!loadingDocs && documents.length === 0 && (
                <EmptyState
                  title="No documents uploaded yet."
                  description="Upload your Course Registration Form (CRF) or departmental clearance receipts."
                  className="py-10"
                />
              )}

              {documents.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-[#22252d]">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">{doc.file_name}</p>
                          <p className="text-[11px] text-[var(--text-muted)] capitalize">
                            {doc.doc_type?.replace('_', ' ')} &middot; {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          doc.status === 'verified'
                            ? 'success'
                            : doc.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {doc.status === 'verified' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {doc.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {doc.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )} */}

      {/* Hidden File Input for Profile Photo Upload */}
      <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handlePhotoUpload} />
    </div>
  );
};

export default StudentProfilePage;
