import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, GraduationCap, KeyRound, Pencil, Save, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMediaUrl } from '../../api/client';
import { updateBasicInfo, uploadProfilePhoto } from '../../api/profile-edit';
import { getInitials, formatTimeAgo } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { formatDepartmentDisplayName } from '../../config/department';
import { tenantPath } from '../../config/departmentAdminPaths';
import ChangePasswordCard from '../../components/profile/ChangePasswordCard';
import Modal from '../../components/ui/Modal';

type TabKey = 'overview' | 'security';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  homeAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

/**
 * The lecturer's own profile. Lecturers have no admin privileges, so this page
 * shows only their details, their teaching pages and password change.
 */
export default function LecturerProfilePage() {
  const { user, updateUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const extra = user as
    | (typeof user & {
        dateOfBirth?: string;
        homeAddress?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      })
    | null;

  const urlCode = user?.tenant?.urlCode;
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName = user?.fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Lecturer';
  const deptName = user?.tenant?.name ? formatDepartmentDisplayName(user.tenant.name) : '';
  const initials = getInitials(firstName || fullName.split(' ')[0] || '', lastName || fullName.split(' ')[1] || '');
  const avatarSrc = getMediaUrl(user?.avatar || user?.avatarUrl || user?.avatar_url) ?? '';

  const details = {
    email: user?.email || '',
    phone: user?.phone || '',
    dateOfBirth: extra?.dateOfBirth || '',
    homeAddress: user?.address || extra?.homeAddress || '',
    emergencyContactName: extra?.emergencyContactName || '',
    emergencyContactPhone: extra?.emergencyContactPhone || '',
  };

  const [form, setForm] = useState<ProfileForm>({
    firstName,
    lastName,
    phone: details.phone,
    dateOfBirth: details.dateOfBirth,
    homeAddress: details.homeAddress,
    emergencyContactName: details.emergencyContactName,
    emergencyContactPhone: details.emergencyContactPhone,
  });

  const openEdit = () => {
    setForm({
      firstName,
      lastName,
      phone: details.phone,
      dateOfBirth: details.dateOfBirth,
      homeAddress: details.homeAddress,
      emergencyContactName: details.emergencyContactName,
      emergencyContactPhone: details.emergencyContactPhone,
    });
    setIsEditOpen(true);
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
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
      setIsEditOpen(false);
      success('Profile updated', 'Your details have been saved.');
    } catch (err) {
      notifyError('Update failed', getErrorMessage(err, 'Failed to update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifyError('File too large', 'Profile photo must be less than 2MB.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await uploadProfilePhoto(file);
      updateUser({ avatar: result.avatar_url });
      success('Photo updated', 'Your profile photo has been uploaded.');
    } catch (err) {
      notifyError('Upload failed', getErrorMessage(err, 'Failed to upload your photo.'));
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const memberSince = user?.createdAt ? formatTimeAgo(user.createdAt) : '';
  const teachingLinks = [
    { label: 'Scores', description: 'Enter and review student scores', path: '/l/scores' },
    { label: 'Class list', description: 'See the students in your classes', path: '/l/class-list' },
    { label: 'Assignments', description: 'Create and track assignments', path: '/l/assignments' },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'security', label: 'Security' },
  ];

  const field = (label: string, value: string) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white break-words">
        {value || <span className="font-normal text-slate-400">Not added yet</span>}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm">
          <div className="h-28 sm:h-36 w-full bg-[#1a66d6] dark:bg-[#1554b3]" />
          <div className="px-5 sm:px-8 pb-6 -mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-[#131722] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-2xl font-bold text-slate-600 dark:text-slate-200 shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label="Change profile photo"
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#1a66d6] text-white flex items-center justify-center shadow disabled:opacity-60"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{fullName}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Lecturer{deptName ? ` · ${deptName}` : ''}
              </p>
              {memberSince && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Joined {memberSince}</p>}
            </div>

            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a66d6] hover:bg-[#1554b3] text-white text-sm font-semibold shadow-sm"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit details</span>
            </button>
          </div>

          <div className="px-5 sm:px-8 border-t border-slate-200 dark:border-slate-800 flex gap-6" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 text-sm font-semibold border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-[#1a66d6] text-[#1a66d6]'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6">
                <h2 className="text-base font-bold mb-2">Personal details</h2>
                {field('Email', details.email)}
                {field('Phone', details.phone)}
                {field('Date of birth', details.dateOfBirth)}
                {field('Home address', details.homeAddress)}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6">
                <h2 className="text-base font-bold mb-2">Emergency contact</h2>
                {field('Name', details.emergencyContactName)}
                {field('Phone', details.emergencyContactPhone)}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-[#1a66d6]" />
                  <h2 className="text-base font-bold">Your teaching</h2>
                </div>
                <ul className="space-y-2">
                  {teachingLinks.map((link) => (
                    <li key={link.path}>
                      <button
                        type="button"
                        onClick={() => navigate(tenantPath(urlCode, link.path))}
                        className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="block text-sm font-semibold">{link.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{link.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4 text-[#1a66d6]" />
                  <h2 className="text-base font-bold">Password</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Change your password from the Security tab.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="text-sm font-semibold text-[#1a66d6] hover:underline"
                >
                  Go to Security
                </button>
              </section>
            </aside>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-2xl">
            <ChangePasswordCard />
          </div>
        )}
      </div>

      <Modal isOpen={isEditOpen} onClose={() => !saving && setIsEditOpen(false)} title="Edit your details">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-semibold">First name</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Last name</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Phone</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Date of birth</span>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold">Home address</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Emergency contact name</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Emergency contact phone</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a66d6] hover:bg-[#1554b3] text-white text-sm font-semibold disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
