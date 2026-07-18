import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getStudentFullProfile, hodEditStudent, getStudentAuditLogs } from '../../api/profile-edit';
import { useNotification } from '../../hooks/useNotification';
import { ArrowLeft, Save, Shield, Clock, User, Phone, MapPin, Mail, BookOpen, AlertCircle } from 'lucide-react';

const EditStudentPage = () => {
  const { id } = useParams();
  const { success, error: notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    homeAddress: '',
    dateOfBirth: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    matricNumber: '',
    level: '',
    academicStanding: '',
    graduationStatus: '',
    admissionMode: '',
    yearAdmitted: '',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStudentFullProfile(id)
      .then((data: any) => {
        setProfile(data);
        setAuditLogs(data.audit_logs || []);
        setForm({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          homeAddress: data.homeAddress || '',
          dateOfBirth: data.dateOfBirth || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          matricNumber: data.matricNumber || '',
          level: data.level ? String(data.level) : '',
          academicStanding: data.academicStanding || '',
          graduationStatus: data.graduationStatus || '',
          admissionMode: data.admissionMode || '',
          yearAdmitted: data.yearAdmitted ? String(data.yearAdmitted) : '',
        });
      })
      .catch((err: any) => notifyError('Error', err?.response?.data?.error || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    phone: profile?.phone || '',
    homeAddress: profile?.homeAddress || '',
    dateOfBirth: profile?.dateOfBirth || '',
    emergencyContactName: profile?.emergencyContactName || '',
    emergencyContactPhone: profile?.emergencyContactPhone || '',
    matricNumber: profile?.matricNumber || '',
    level: profile?.level ? String(profile.level) : '',
    academicStanding: profile?.academicStanding || '',
    graduationStatus: profile?.graduationStatus || '',
    admissionMode: profile?.admissionMode || '',
    yearAdmitted: profile?.yearAdmitted ? String(profile.yearAdmitted) : '',
  });

  const handleSave = async () => {
    if (!id) return;
    if (hasChanges && reason.length < 10) {
      setShowReason(true);
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (reason) payload.reason = reason;
      await hodEditStudent(id, payload);
      success('Student Updated', 'Student profile has been updated.');
      setReason('');
      setShowReason(false);
      // Reload
      const data = await getStudentFullProfile(id);
      setProfile(data);
      setAuditLogs(data.audit_logs || []);
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || 'Failed to update student.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-10 h-10 text-danger-500 mx-auto mb-3" />
        <p className="text-surface-500">Student not found.</p>
        <Link to="/admin/users" className="text-primary-500 text-sm mt-2 inline-block">Back to Users</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={`/admin/users/${id}`} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-surface-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Edit Student: {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-sm text-surface-500">
            Matric: {profile.matricNumber || 'N/A'} | Level: {profile.level || 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Edit personal details</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} leftIcon={<User className="w-4 h-4" />} />
              <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <Input label="Email" value={profile.email || ''} disabled leftIcon={<Mail className="w-4 h-4" />} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="w-4 h-4" />} />
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              <Input label="Home Address" value={form.homeAddress} onChange={(e) => setForm({ ...form, homeAddress: e.target.value })} leftIcon={<MapPin className="w-4 h-4" />} />
              <Input label="Emergency Contact Name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
              <Input label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} leftIcon={<Phone className="w-4 h-4" />} />
            </div>
          </Card>

          {/* Academic Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Academic Identity</CardTitle>
              <CardDescription>Changes require a documented reason</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Matric Number" value={form.matricNumber} onChange={(e) => setForm({ ...form, matricNumber: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Level</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                >
                  <option value="">Select Level</option>
                  <option value="100">100 Level</option>
                  <option value="200">200 Level</option>
                  <option value="300">300 Level</option>
                  <option value="400">400 Level</option>
                  <option value="500">500 Level</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Academic Standing</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={form.academicStanding}
                  onChange={(e) => setForm({ ...form, academicStanding: e.target.value })}
                >
                  <option value="">Select Standing</option>
                  <option value="good_standing">Good Standing</option>
                  <option value="probation">Probation</option>
                  <option value="suspension">Suspension</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Graduation Status</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={form.graduationStatus}
                  onChange={(e) => setForm({ ...form, graduationStatus: e.target.value })}
                >
                  <option value="">Select Status</option>
                  <option value="in_progress">In Progress</option>
                  <option value="graduated">Graduated</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="expelled">Expelled</option>
                </select>
              </div>
              <Input label="Admission Mode" value={form.admissionMode} onChange={(e) => setForm({ ...form, admissionMode: e.target.value })} />
              <Input label="Year Admitted" value={form.yearAdmitted} onChange={(e) => setForm({ ...form, yearAdmitted: e.target.value })} />
            </div>
          </Card>

          {/* Reason + Save */}
          {hasChanges && (
            <Card className="border-warning-500/20 bg-warning-500/5">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-warning-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">You have unsaved changes</span>
                </div>
                {showReason && (
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Reason for changes (min 10 characters) <span className="text-danger-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 text-sm"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain the reason for these changes..."
                    />
                    {reason.length > 0 && reason.length < 10 && (
                      <p className="text-xs text-danger-500 mt-1">{reason.length}/10 minimum characters</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowReason(true)}
                    leftIcon={<Save className="w-4 h-4" />}
                    isLoading={saving}
                  >
                    Save Changes
                  </Button>
                  {showReason && (
                    <Button
                      variant="outline"
                      onClick={handleSave}
                      disabled={reason.length < 10}
                      isLoading={saving}
                    >
                      Confirm Save
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Quick Info */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary-500" />
              <h4 className="font-medium text-sm text-surface-700 dark:text-surface-300">Student Info</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-500">Status</span>
                <Badge variant={profile.isActive ? 'success' : 'danger'}>{profile.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Approval</span>
                <Badge variant={profile.isApproved ? 'success' : 'warning'}>{profile.approvalStatus}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Role</span>
                <Badge variant="outline">{profile.role}</Badge>
              </div>
            </div>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-surface-400" />
                <CardTitle className="text-sm">Recent Changes</CardTitle>
              </div>
            </CardHeader>
            <div className="p-4 pt-0">
              {auditLogs.length === 0 && (
                <p className="text-xs text-surface-400">No changes recorded yet.</p>
              )}
              {auditLogs.slice(0, 10).map((log: any, idx: number) => (
                <div key={idx} className="py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-surface-700 dark:text-surface-300">{log.field_name}</span>
                    <Badge variant={log.change_type === 'hod_edit' ? 'primary' : 'outline'} className="text-[10px]">
                      {log.change_type?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    {log.old_value && <span>{log.old_value} → </span>}
                    <span className="text-surface-600 dark:text-surface-300">{log.new_value}</span>
                  </div>
                  {log.reason && (
                    <p className="text-[10px] text-surface-400 italic mt-0.5">Reason: {log.reason}</p>
                  )}
                  <p className="text-[10px] text-surface-400 mt-0.5">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditStudentPage;
