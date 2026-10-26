import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Pencil, Save, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMediaUrl } from '../../api/client';
import { updateBasicInfo, uploadProfilePhoto } from '../../api/profile-edit';
import {
  getLecturerProfile,
  updateLecturerProfile,
  type LecturerAssignment,
  type LecturerProfile,
} from '../../api/lecturers';
import { getInitials, formatTimeAgo } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { formatDepartmentDisplayName } from '../../config/department';
import { tenantPath } from '../../config/departmentAdminPaths';
import ChangePasswordCard from '../../components/profile/ChangePasswordCard';
import Modal from '../../components/ui/Modal';

type TabKey = 'overview' | 'teaching' | 'security' | 'activity';

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
];

function parseOfficeHours(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return parseOfficeHours(JSON.parse(raw));
    } catch {
      return raw.trim() ? { mon: raw.trim() } : {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k.toLowerCase()] = v.trim();
    }
    return out;
  }
  return {};
}

function maskEmail(email: string) {
  const [userPart, domain] = email.split('@');
  if (!userPart || !domain) return email;
  return `${userPart.charAt(0)}•••••@${domain}`;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  title: string;
  rank: string;
  office: string;
  bio: string;
  specialization: string;
  officeHours: Record<string, string>;
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
  const [staff, setStaff] = useState<LecturerProfile | null>(null);
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);

  const extra = user as
    | (typeof user & {
        dateOfBirth?: string;
        homeAddress?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      })
    | null;

  const urlCode = user?.tenant?.urlCode;
  const firstName = staff?.first_name || user?.firstName || '';
  const lastName = staff?.last_name || user?.lastName || '';
  const fullName = staff?.full_name || user?.fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Lecturer';
  const deptName = user?.tenant?.name
    ? formatDepartmentDisplayName(user.tenant.name)
    : staff?.department
      ? formatDepartmentDisplayName(staff.department)
      : '';
  const initials = getInitials(firstName || fullName.split(' ')[0] || '', lastName || fullName.split(' ')[1] || '');
  const avatarSrc = getMediaUrl(staff?.avatar_url || user?.avatar || user?.avatarUrl || user?.avatar_url) ?? '';
  const officeHours = parseOfficeHours(staff?.office_hours);
  const interests = (staff?.specialization || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const details = {
    email: staff?.email || user?.email || '',
    phone: staff?.phone || user?.phone || '',
    title: staff?.title || '',
    rank: staff?.rank || '',
    office: staff?.office_location || '',
    bio: staff?.bio || user?.bio || '',
    dateOfBirth: extra?.dateOfBirth || '',
    homeAddress: user?.address || extra?.homeAddress || '',
    emergencyContactName: extra?.emergencyContactName || '',
    emergencyContactPhone: extra?.emergencyContactPhone || '',
  };

  const [form, setForm] = useState<ProfileForm>({
    firstName,
    lastName,
    phone: details.phone,
    title: details.title,
    rank: details.rank,
    office: details.office,
    bio: details.bio,
    specialization: staff?.specialization || '',
    officeHours,
  });

  useEffect(() => {
    if (!user?.id) return;
    getLecturerProfile(user.id)
      .then((res) => {
        if (res?.profile) setStaff(res.profile);
        if (Array.isArray(res?.assignments)) setAssignments(res.assignments);
      })
      .catch(() => {
        /* Staff row may not exist yet; the signed-in user fields still show. */
      });
  }, [user?.id]);

  const openEdit = () => {
    setForm({
      firstName,
      lastName,
      phone: details.phone,
      title: details.title,
      rank: details.rank,
      office: details.office,
      bio: details.bio,
      specialization: staff?.specialization || '',
      officeHours,
    });
    setIsEditOpen(true);
  };

  const persistStaff = async (patch: Partial<ProfileForm>) => {
    if (!user?.id) return;
    await updateLecturerProfile(user.id, {
      title: patch.title,
      first_name: patch.firstName,
      last_name: patch.lastName,
      rank: patch.rank,
      specialization: patch.specialization,
      bio: patch.bio,
      office_location: patch.office,
      office_hours: JSON.stringify(patch.officeHours ?? form.officeHours),
    });
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const updated = await updateBasicInfo({
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      updateUser(updated);
      try {
        await persistStaff(form);
        const refreshed = await getLecturerProfile(user?.id || '');
        if (refreshed?.profile) setStaff(refreshed.profile);
      } catch {
        /* Basic user fields were saved even if the staff row cannot be updated. */
      }
      setIsEditOpen(false);
      success('Profile updated', 'Your details have been saved.');
    } catch (err) {
      notifyError('Update failed', getErrorMessage(err, 'Failed to update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      await persistStaff({ ...form, officeHours: form.officeHours });
      const refreshed = await getLecturerProfile(user?.id || '');
      if (refreshed?.profile) setStaff(refreshed.profile);
      setHoursOpen(false);
      success('Office hours saved', 'Students can see when you are available.');
    } catch (err) {
      notifyError('Update failed', getErrorMessage(err, 'Could not save office hours.'));
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

  const missing = [!details.phone && 'phone', !details.office && 'office', !details.bio && 'about'].filter(Boolean);
  const strength = Math.round(((3 - missing.length) / 3) * 100);

  const teachingLinks = [
    { label: 'Scores', description: 'Enter and review student scores', path: '/l/scores' },
    { label: 'Class list', description: 'See the students in your classes', path: '/l/class-list' },
    { label: 'Assignments', description: 'Create and track assignments', path: '/l/assignments' },
    { label: 'Leave requests', description: 'Request time away', path: '/l/leave' },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'teaching', label: 'Teaching' },
    { key: 'security', label: 'Security' },
    ...(user?.lastLogin ? [{ key: 'activity' as const, label: 'Activity' }] : []),
  ];

  const field = (label: string, value: string, onAdd?: () => void) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{label}</span>
      {value ? (
        <span className="text-sm font-semibold text-slate-900 dark:text-white break-words">{value}</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Not added yet</span>
          {onAdd && (
            <button type="button" onClick={onAdd} className="text-xs font-semibold text-[#1a66d6]">
              Add
            </button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <div className="text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden">
          <div className="px-5 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative w-20 h-20 rounded-full border-4 border-white dark:border-[#131722] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-200 shrink-0">
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
                STAFF · Lecturer{deptName ? ` · ${deptName}` : ''}
                {user?.isApproved ? ' · Active and approved' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a66d6] hover:bg-[#1554b3] text-white text-sm font-semibold"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit profile</span>
            </button>
          </div>

          <div
            className="px-5 sm:px-8 border-t border-slate-200 dark:border-slate-800 flex gap-6 overflow-x-auto"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
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
                {field('Full name', fullName)}
                {field('Email', details.email ? maskEmail(details.email) : '')}
                {field('Phone', details.phone, openEdit)}
                {field('Title or rank', [details.title, details.rank].filter(Boolean).join(' · '), openEdit)}
                {field('Office', details.office, openEdit)}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6">
                <h2 className="text-base font-bold mb-2">About you</h2>
                <p className="text-xs text-slate-500 mb-3">Students and staff can see this on your profile</p>
                {details.bio ? (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{details.bio}</p>
                ) : (
                  <button type="button" onClick={openEdit} className="text-sm text-slate-400 hover:text-[#1a66d6]">
                    Write a short bio about your teaching and research.
                  </button>
                )}
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Research interests
                  </p>
                  {interests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {interests.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button type="button" onClick={openEdit} className="text-xs font-semibold text-[#1a66d6]">
                      Add
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">Office hours</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((p) => ({ ...p, officeHours }));
                      setHoursOpen(true);
                    }}
                    className="text-xs font-semibold text-[#1a66d6]"
                  >
                    Add hours
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-3">When students can find you</p>
                <div className="space-y-2">
                  {WEEKDAYS.map((d) => (
                    <div key={d.key} className="flex items-center justify-between text-sm">
                      <span className="font-medium w-10">{d.label}</span>
                      <span className="text-slate-500">{officeHours[d.key] || 'Not set'}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
                <h2 className="text-base font-bold mb-2">Account status</h2>
                {field('Status', user?.isActive === false ? 'Inactive' : 'Active')}
                {field('Approval', user?.isApproved ? 'Approved' : 'Pending')}
                {field('Role', 'Lecturer')}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
                <h2 className="text-base font-bold mb-2">Profile strength</h2>
                <p className="text-2xl font-bold">{strength}%</p>
                <p className="text-xs text-slate-500 mt-2">
                  {missing.length
                    ? `Add a ${missing.join(', ')} to help students reach you.`
                    : 'Your profile has the details students need to reach you.'}
                </p>
              </section>
            </aside>
          </div>
        )}

        {activeTab === 'teaching' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6">
              <h2 className="text-base font-bold mb-4">Courses assigned to you</h2>
              {assignments.length === 0 ? (
                <p className="text-sm text-slate-500">No course assignments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {assignments.map((a) => (
                    <li
                      key={a.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {a.course_code} {a.course_title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {a.course_unit} units{a.level ? ` · Level ${a.level}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
              <h2 className="text-base font-bold mb-3">Your teaching</h2>
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
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-2xl">
            <ChangePasswordCard />
          </div>
        )}

        {activeTab === 'activity' && user?.lastLogin && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 sm:p-6 max-w-xl">
            <h2 className="text-base font-bold mb-2">Activity</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Last sign-in {formatTimeAgo(user.lastLogin)}</p>
          </section>
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
              <span className="font-semibold">Title</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Rank</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Office</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.office}
                onChange={(e) => setForm({ ...form, office: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold">About</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 min-h-24"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-semibold">Research interests</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Comma-separated"
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

      <Modal isOpen={hoursOpen} onClose={() => !saving && setHoursOpen(false)} title="Office hours">
        <div className="space-y-3">
          {WEEKDAYS.map((d) => (
            <label key={d.key} className="flex items-center gap-3 text-sm">
              <span className="w-10 font-semibold">{d.label}</span>
              <input
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2"
                value={form.officeHours[d.key] || ''}
                placeholder="e.g. 10:00–12:00"
                onChange={(e) => setForm((p) => ({ ...p, officeHours: { ...p.officeHours, [d.key]: e.target.value } }))}
              />
            </label>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setHoursOpen(false)}
              className="px-4 py-2 rounded-xl border text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveHours}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#1a66d6] text-white text-sm font-semibold disabled:opacity-60"
            >
              Save hours
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
