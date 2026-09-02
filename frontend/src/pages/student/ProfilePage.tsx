import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getMediaUrl } from '../../api/client';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import {
  updateBasicInfo,
  uploadProfilePhoto,
  uploadStudentDocument,
  listStudentDocuments,
} from '../../api/profile-edit';
import type { StudentDocument } from '../../api/profile-edit';
import { useNotification } from '../../hooks/useNotification';
import {
  User,
  Phone,
  MapPin,
  Mail,
  Lock,
  Save,
  Upload,
  Camera,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PROFILE_SCAN_PARAM } from '../../utils/qr-scanner';
import type { User as UserType } from '../../types';
import { getErrorMessage } from '../../utils/errors';

// The backend's student record includes a couple of fields (e.g. entryYear)
// that aren't part of the shared User type — extend it locally for this page.
type ProfileUser = UserType & { entryYear?: number };

const extractDocuments = (raw: unknown): StudentDocument[] => {
  if (Array.isArray(raw)) return raw as StudentDocument[];
  const data = (raw as { data?: StudentDocument[] } | null | undefined)?.data;
  return Array.isArray(data) ? data : [];
};

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { success, error: notifyError } = useNotification();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const u = user as ProfileUser | null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [form, setForm] = useState({
    firstName: u?.firstName || '',
    lastName: u?.lastName || '',
    phone: u?.phone || '',
    homeAddress: u?.homeAddress || '',
    dateOfBirth: u?.dateOfBirth || '',
    emergencyContactName: u?.emergencyContactName || '',
    emergencyContactPhone: u?.emergencyContactPhone || '',
  });

  useEffect(() => {
    if (canvasRef.current && u?.id) {
      // Encode a plain URL (not JSON) so any stock phone camera app can open it
      // directly — it lands on the Connect page, which looks up this student and
      // offers to send a connection request. The same value is parsed in-app to
      // check the student into an active attendance session.
      const scanUrl = `${window.location.origin}/connect?${PROFILE_SCAN_PARAM}=${u.id}`;
      QRCode.toCanvas(canvasRef.current, scanUrl, {
        width: 176,
        margin: 2,
        color: { dark: '#2563eb', light: '#ffffff' },
      });
    }
  }, [u?.id]);

  useEffect(() => {
    setLoadingDocs(true);
    listStudentDocuments()
      .then((res) => {
        setDocuments(extractDocuments(res));
      })
      .catch(() => {})
      .finally(() => setLoadingDocs(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateBasicInfo(form);
      updateUser(data);
      setEditing(false);
      success('Profile Updated', 'Your profile has been updated successfully.');
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
      success('Photo Updated', 'Profile photo updated successfully.');
    } catch (err) {
      notifyError('Upload Failed', getErrorMessage(err, 'Failed to upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoUrlSave = async () => {
    const url = photoUrl.trim();
    if (!url) return;
    try {
      setSavingUrl(true);
      const data = await updateBasicInfo({ avatarUrl: url });
      updateUser(data);
      setPhotoUrl('');
      success('Photo Updated', 'Profile photo URL saved.');
    } catch (err) {
      notifyError('Save Failed', getErrorMessage(err, 'Failed to save photo URL.'));
    } finally {
      setSavingUrl(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadStudentDocument(file, docType);
      success('Document Uploaded', 'Document submitted for verification.');
      const res = await listStudentDocuments();
      setDocuments(extractDocuments(res));
    } catch (err) {
      notifyError('Upload Failed', getErrorMessage(err, 'Failed to upload document.'));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Update your personal information. Academic details require HOD approval.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Basic Information — EDITABLE */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Edit your basic profile details</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={editing ? 'outline' : 'primary'}
                  onClick={() => {
                    if (editing) {
                      setForm({
                        firstName: u?.firstName || '',
                        lastName: u?.lastName || '',
                        phone: u?.phone || '',
                        homeAddress: u?.homeAddress || '',
                        dateOfBirth: u?.dateOfBirth || '',
                        emergencyContactName: u?.emergencyContactName || '',
                        emergencyContactPhone: u?.emergencyContactPhone || '',
                      });
                    }
                    setEditing(!editing);
                  }}
                >
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={editing ? form.firstName : u?.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                disabled={!editing}
                leftIcon={<User className="w-4 h-4" />}
              />
              <Input
                label="Last Name"
                value={editing ? form.lastName : u?.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                disabled={!editing}
              />
              <Input
                label="Email"
                value={u?.email}
                leftIcon={<Mail className="w-4 h-4" />}
                disabled
                rightIcon={<Lock className="w-3.5 h-3.5 text-surface-400" />}
              />
              <Input
                label="Phone"
                value={editing ? form.phone : u?.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={!editing}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={editing ? form.dateOfBirth : u?.dateOfBirth || ''}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                disabled={!editing}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Home Address"
                  value={editing ? form.homeAddress : u?.homeAddress || ''}
                  onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                  disabled={!editing}
                  leftIcon={<MapPin className="w-4 h-4" />}
                />
              </div>
            </div>
            {editing && (
              <div className="px-4 pb-4">
                <Button onClick={handleSave} isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
              </div>
            )}
          </Card>

          {/* Emergency Contact — EDITABLE */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>Update your emergency contact information</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contact Name"
                value={editing ? form.emergencyContactName : u?.emergencyContactName || ''}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                disabled={!editing}
                leftIcon={<User className="w-4 h-4" />}
              />
              <Input
                label="Contact Phone"
                value={editing ? form.emergencyContactPhone : u?.emergencyContactPhone || ''}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                disabled={!editing}
                leftIcon={<Phone className="w-4 h-4" />}
              />
            </div>
          </Card>

          {/* Academic Information — READ ONLY */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Academic Information</CardTitle>
                <Lock className="w-4 h-4 text-surface-400" />
              </div>
              <CardDescription>Contact HOD to request changes to academic details</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Matric Number" value={u?.matricNumber || 'N/A'} disabled />
              <Input label="Level" value={u?.level ? `${u.level} Level` : 'N/A'} disabled />
              <Input label="Admission Mode" value={u?.admissionMode || 'N/A'} disabled />
              <Input label="Year Admitted" value={u?.yearAdmitted ? String(u.yearAdmitted) : 'N/A'} disabled />
              <Input label="Academic Standing" value={u?.academicStanding?.replace('_', ' ') || 'N/A'} disabled />
              <Input label="Entry Year" value={u?.entryYear ? String(u.entryYear) : 'N/A'} disabled />
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Upload supporting documents for verification</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0">
              <div className="flex gap-3 mb-4">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => docRef.current?.click()}
                >
                  Upload Document
                </Button>
                <input
                  ref={docRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => handleDocUpload(e, 'supporting_doc')}
                />
              </div>
              {loadingDocs && <p className="text-xs text-surface-400">Loading documents...</p>}
              {!loadingDocs && documents.length === 0 && (
                <EmptyState title="No documents uploaded yet." className="py-0" />
              )}
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-surface-400" />
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{doc.file_name}</p>
                      <p className="text-[10px] text-surface-400 capitalize">{doc.doc_type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <Badge
                    variant={doc.status === 'verified' ? 'success' : doc.status === 'rejected' ? 'danger' : 'warning'}
                  >
                    {doc.status === 'verified' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {doc.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {doc.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Profile Photo */}
          <Card className="text-center p-6 flex flex-col items-center">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              Profile Photo
            </h4>
            <div className="relative group">
              <img
                src={getMediaUrl(u?.avatar || u?.avatarUrl) ?? ''}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-surface-200 dark:border-surface-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handlePhotoUpload} />
            <p className="text-[10px] text-surface-400 mt-2">JPG/PNG, max 2MB</p>
            {uploadingPhoto && <p className="text-xs text-primary-500 mt-1">Uploading...</p>}
            <div className="w-full mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
              <p className="text-[10px] text-surface-400 mb-2 uppercase tracking-wider">Or paste an image URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <Button
                  size="xs"
                  variant="outline"
                  leftIcon={savingUrl ? undefined : <LinkIcon className="w-3 h-3" />}
                  onClick={handlePhotoUrlSave}
                  disabled={savingUrl || !photoUrl.trim()}
                >
                  {savingUrl ? 'Saving...' : 'Set'}
                </Button>
              </div>
            </div>
          </Card>

          {/* QR Code */}
          <Card className="text-center p-6 flex flex-col items-center">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              Academic ID QR Code
            </h4>
            <canvas ref={canvasRef} className="rounded-2xl" />
            <p className="text-[10px] text-surface-400 mt-4 leading-relaxed max-w-xs">
              Show this to your class rep to check into attendance, or let any phone camera scan it to send you a
              Connect request.
            </p>
          </Card>

          {/* Quick Info */}
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
              Account Status
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Status</span>
                <Badge variant={u?.isActive ? 'success' : 'danger'}>{u?.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Approval</span>
                <Badge variant={u?.isApproved ? 'success' : 'warning'}>{u?.approvalStatus || 'pending'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Member Since</span>
                <span className="text-surface-700 dark:text-surface-300">
                  {u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
