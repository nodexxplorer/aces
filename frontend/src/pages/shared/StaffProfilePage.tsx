import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getMediaUrl } from '../../api/client';
import { updateBasicInfo, uploadProfilePhoto } from '../../api/profile-edit';
import { useNotification } from '../../hooks/useNotification';
import { getInitials } from '../../utils/formatters';
import { formatDepartmentDisplayName } from '../../config/department';
import { departmentAdminPath } from '../../config/departmentAdminPaths';
import ChangePasswordCard from '../../components/profile/ChangePasswordCard';
import { getErrorMessage } from '../../utils/errors';
import {
  User,
  Shield,
  Lock,
  Clock,
  Camera,
  Check,
  Pencil,
  AlertTriangle,
  Send,
  BookOpen,
  Users,
  CreditCard,
  Volume2,
  Sliders,
  X,
  Save,
} from 'lucide-react';

type TabKey = 'overview' | 'privileges' | 'security' | 'activity';

export const StaffProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const urlCode = user?.tenant?.urlCode;
  const role = user?.activeRole || user?.role || 'hod';
  const isAdmin = role === 'hod' || role === 'delegated_admin' || role === 'admin';
  const isLecturer = role === 'lecturer';

  // Real user data
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName =
    user?.fullName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    (isAdmin ? 'Admin' : isLecturer ? 'Lecturer' : 'Staff Member');
  const email = user?.email || '';
  const phone = user?.phone || '';
  const dateOfBirth = (user as { dateOfBirth?: string })?.dateOfBirth || '';
  const homeAddress = user?.address || (user as { homeAddress?: string })?.homeAddress || '';
  const emergencyName = (user as { emergencyContactName?: string })?.emergencyContactName || '';
  const emergencyPhone = (user as { emergencyContactPhone?: string })?.emergencyContactPhone || '';

  const initials = getInitials(firstName || fullName.split(' ')[0] || '', lastName || fullName.split(' ')[1] || '');
  const deptName = user?.tenant?.name ? formatDepartmentDisplayName(user.tenant.name) : '';

  const roleBadgeLabel = role === 'hod' ? 'HOD' : isAdmin ? 'Admin' : isLecturer ? 'Lecturer' : role.toUpperCase();
  const roleTitle =
    role === 'hod'
      ? 'Head of Department'
      : isAdmin
        ? 'Department Administrator'
        : isLecturer
          ? 'Lecturer'
          : 'Faculty Staff';

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return '9/26/2026';
    try {
      const d = new Date(user.createdAt);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } catch {
      return '9/26/2026';
    }
  }, [user?.createdAt]);

  // Edit form state
  const [form, setForm] = useState({
    firstName,
    lastName,
    phone,
    dateOfBirth,
    homeAddress,
    emergencyContactName: emergencyName,
    emergencyContactPhone: emergencyPhone,
  });

  const handleOpenEdit = (field?: string) => {
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      dateOfBirth: (user as { dateOfBirth?: string })?.dateOfBirth || '',
      homeAddress: user?.address || (user as { homeAddress?: string })?.homeAddress || '',
      emergencyContactName: (user as { emergencyContactName?: string })?.emergencyContactName || '',
      emergencyContactPhone: (user as { emergencyContactPhone?: string })?.emergencyContactPhone || '',
    });
    setEditingField(field || null);
    setIsEditModalOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
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
      success('Profile Updated', 'Your profile details have been saved successfully.');
    } catch (err) {
      notifyError('Update Failed', getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
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
      success('Photo Updated', 'Profile photo uploaded successfully.');
    } catch (err) {
      notifyError('Upload Failed', getErrorMessage(err, 'Failed to upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRequestAccess = () => {
    setRequestSent(true);
    success('Request Submitted', 'Your access review request was sent to the system administrator.');
    setTimeout(() => setRequestSent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* HERO CARD CONTAINER */}
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm mb-6">
          {/* Blue Curved Banner with Abstract Concentric Arcs */}
          <div className="relative h-36 sm:h-44 md:h-48 w-full bg-[#1a66d6] dark:bg-[#1554b3] overflow-hidden">
            {/* Concentric Decorative Rings in Banner */}
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
                    {/* Role Pill Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a66d6] text-white shadow-xs">
                      <Shield className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>{roleBadgeLabel}</span>
                    </span>

                    {/* Role Title Pill */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {roleTitle}
                    </span>

                    {/* Department Pill */}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {deptName}
                    </span>

                    {/* Status Pill */}
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
                  onClick={() => handleOpenEdit()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 transition-all shadow-xs active:scale-[0.99]"
                >
                  <Pencil className="w-4 h-4 stroke-[2]" />
                  <span>Edit profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PILL NAVIGATION TABS */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-1.5 flex items-center gap-1.5 shadow-sm mb-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
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
            onClick={() => setActiveTab('privileges')}
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
            onClick={() => setActiveTab('security')}
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
            onClick={() => setActiveTab('activity')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'activity'
                ? 'bg-[#1a66d6] text-white font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 font-medium'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Activity</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Personal details & Emergency contact */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Details Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Personal details</h2>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit()}
                    className="text-xs sm:text-sm font-semibold text-[#1a66d6] dark:text-[#4f9bff] hover:underline"
                  >
                    Edit all
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Full name */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Full name
                    </span>
                    <span className="flex-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                      {fullName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit('name')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit full name"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Email */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Email
                    </span>
                    <span className="flex-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {email}
                    </span>
                    <span className="p-1.5 text-slate-400" title="Email is managed by the institution">
                      <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Phone
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      {phone ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">{phone}</span>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Not added yet</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-slate-950 uppercase">
                            Missing
                          </span>
                        </>
                      )}
                    </div>
                    {phone ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('phone')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit phone"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('phone')}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Date of birth */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Date of birth
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      {dateOfBirth ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {dateOfBirth}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Not added yet</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-slate-950 uppercase">
                            Missing
                          </span>
                        </>
                      )}
                    </div>
                    {dateOfBirth ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('dateOfBirth')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit date of birth"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('dateOfBirth')}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Home address */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Home address
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      {homeAddress ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {homeAddress}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Not added yet</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-slate-950 uppercase">
                            Missing
                          </span>
                        </>
                      )}
                    </div>
                    {homeAddress ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('homeAddress')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit home address"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('homeAddress')}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Emergency contact</h2>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Contact name */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Contact name
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      {emergencyName ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {emergencyName}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Not added yet</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-slate-950 uppercase">
                            Missing
                          </span>
                        </>
                      )}
                    </div>
                    {emergencyName ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('emergencyContactName')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit contact name"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('emergencyContactName')}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Contact phone */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <span className="w-28 sm:w-36 text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
                      Contact phone
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      {emergencyPhone ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {emergencyPhone}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Not added yet</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-slate-950 uppercase">
                            Missing
                          </span>
                        </>
                      )}
                    </div>
                    {emergencyPhone ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('emergencyContactPhone')}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Edit contact phone"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('emergencyContactPhone')}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Account status, Your access, Secure your account */}
            <div className="space-y-6">
              {/* Account Status Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                  Account status
                </h3>

                <div className="space-y-3.5 text-xs sm:text-sm">
                  {/* Status */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Active</span>
                    </span>
                  </div>

                  {/* Approval */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Approval</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Approved</span>
                    </span>
                  </div>

                  {/* Member since */}
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Member since</span>
                    <span className="font-bold text-slate-900 dark:text-white">{memberSince}</span>
                  </div>

                  {/* Role */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500 dark:text-slate-400">Role</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">{roleBadgeLabel}</span>
                  </div>
                </div>
              </div>

              {/* Your Access Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#1a66d6] dark:text-[#4f9bff] flex items-center justify-center mb-4">
                  <Shield className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Your access</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  {isAdmin
                    ? 'You can manage 9 areas and view 3 across the department.'
                    : 'You can manage 4 teaching modules and view students across your courses.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('privileges')}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                >
                  See all privileges
                </button>
              </div>

              {/* Secure Your Account Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#1a66d6] dark:text-[#4f9bff] flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5 stroke-[2]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Secure your account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  Admin accounts hold sensitive data. Use a strong password.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Change password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRIVILEGES TAB (Replicated from Images 2 & 3) */}
        {activeTab === 'privileges' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Grouped Modules */}
            <div className="lg:col-span-2 space-y-6">
              {/* ACADEMICS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ACADEMICS
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Sessions and semesters */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sessions and semesters</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Create sessions, open registration, roll over students
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

                  {/* Courses */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Courses</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Create, edit, archive courses and assign lecturers
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

                  {/* Course enrollment */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Course enrollment</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Add or remove a student's registered courses
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/academics'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  {/* Course forms and signatures */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Course forms and signatures</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Sign forms and set the backlog fee
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

              {/* PEOPLE AND ACCESS */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    PEOPLE AND ACCESS
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Users */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Users</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        View and edit accounts, approve new accounts
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

                  {/* Roles and permissions */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Roles and permissions</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Change what each role can do</p>
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

              {/* FINANCE */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    FINANCE
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Dues */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dues</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Create and edit dues</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/expenses'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  {/* Payments and revenue */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Payments and revenue</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        See transactions and the revenue forecast
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/revenue-forecast'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs transition-colors shrink-0"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              {/* COMMUNICATE */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    COMMUNICATE
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Announcements */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Announcements</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Post and edit announcements and notices
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

                  {/* Support inbox */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Support inbox</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Read tickets and feedback</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/support')}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs transition-colors shrink-0"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              {/* SYSTEM */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                  <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    SYSTEM
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Settings */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Settings</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Department details and integrations
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/settings'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>

                  {/* Audit log */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Audit log</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">See who changed what</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(departmentAdminPath(urlCode, '/admin/analytics'))}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs transition-colors shrink-0"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Access at a glance, Actions that are logged, Need more access? */}
            <div className="space-y-6">
              {/* Access at a glance Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                  Access at a glance
                </h3>

                {/* Two Stat Boxes */}
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

                {/* Role / Scope / Granted By */}
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

              {/* Actions that are logged Card */}
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

                <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#1a66d6] dark:text-[#4f9bff] stroke-[2.5] shrink-0" />
                    <span>Advance a student who owes dues</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#1a66d6] dark:text-[#4f9bff] stroke-[2.5] shrink-0" />
                    <span>Change a student's course registration</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#1a66d6] dark:text-[#4f9bff] stroke-[2.5] shrink-0" />
                    <span>Delete a course</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#1a66d6] dark:text-[#4f9bff] stroke-[2.5] shrink-0" />
                    <span>Change a role or permission</span>
                  </div>
                </div>
              </div>

              {/* Need more access? Card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Need more access?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Ask the system administrator to review your role.
                </p>
                <button
                  type="button"
                  disabled={requestSent}
                  onClick={handleRequestAccess}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{requestSent ? 'Request Submitted' : 'Request access'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <ChangePasswordCard />
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Recent Account Activity</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
                <Clock className="w-4 h-4 text-[#1a66d6] dark:text-[#4f9bff] mt-0.5 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-slate-900 dark:text-white">Active Session</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    Logged in as {roleBadgeLabel} · {deptName}
                  </p>
                  <span className="text-[11px] text-slate-400 block mt-1">Current session active</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
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

            <form onSubmit={handleSave} className="p-6 space-y-4">
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
                  Home / Office Address
                </label>
                <input
                  type="text"
                  placeholder="Campus address or residential address"
                  value={form.homeAddress}
                  onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-3">Emergency Contact Details</p>
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
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffProfilePage;
