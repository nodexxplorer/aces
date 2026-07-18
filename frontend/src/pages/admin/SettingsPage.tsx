import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../hooks/useTheme';
import { useNotification } from '../../hooks/useNotification';
import { useAuthStore } from '../../stores/authStore';
import { updateUser } from '../../api/users';
import { Settings, Moon, Sun, Save, Loader2, Camera } from 'lucide-react';

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { success, error: notifyError } = useNotification();
  const { user, updateUser: updateAuthUser } = useAuthStore();
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.full_name || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar || user.avatarUrl || user.avatar_url || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      setSaving(true);
      await updateUser(user.id, {
        full_name: fullName,
        phone: phone || undefined,
        avatar_url: avatarUrl || undefined,
      } as any);
      updateAuthUser({ fullName, full_name: fullName, phone, avatar: avatarUrl, avatarUrl, avatar_url: avatarUrl } as any);
      setEditing(false);
      success('Profile Updated', 'Your profile has been updated successfully');
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Profile & Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage your profile and application preferences.
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your personal details and profile picture</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-surface-200 dark:border-surface-700" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-2xl font-bold">
                  {fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              {editing && (
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-600 transition-colors">
                  <Camera className="w-3.5 h-3.5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div>
              <p className="font-semibold text-surface-900 dark:text-white">{fullName || 'No Name'}</p>
              <p className="text-sm text-surface-500">{user?.email}</p>
              <p className="text-[10px] text-surface-400 capitalize mt-0.5">Role: {user?.activeRole || user?.role}</p>
            </div>
          </div>

          {editing ? (
            <>
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" />
              <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/photo.jpg" />
              <div className="flex gap-3">
                <Button type="submit" className="flex-1" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                  Save Changes
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setEditing(false);
                  setFullName(user?.fullName || user?.full_name || '');
                  setPhone(user?.phone || '');
                  setAvatarUrl(user?.avatar || user?.avatarUrl || user?.avatar_url || '');
                }}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          )}
        </form>
      </Card>

      {/* Application Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            Application Settings
          </CardTitle>
          <CardDescription>General system preferences</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-primary-500" /> : <Sun className="w-5 h-5 text-warning-500" />}
              <div>
                <p className="font-medium text-sm">Appearance</p>
                <p className="text-[10px] text-surface-500">Currently using {theme} mode</p>
              </div>
            </div>
            <Button size="xs" variant="outline" onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
