import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTheme } from '../../hooks/useTheme';
import { useNotification } from '../../hooks/useNotification';
import { useAuthStore } from '../../stores/authStore';
import { getMediaUrl } from '../../api/client';
import { updateUser } from '../../api/users';
import { getCGPAConfig, updateCGPAConfig } from '../../api/cgpa';
import { getAISettings, updateAISettings } from '../../api/ai';
import type { AISettings } from '../../api/ai';
import { getErrorMessage } from '../../utils/errors';
import {
  Settings,
  Moon,
  Sun,
  Save,
  Camera,
  User,
  Bot,
  Brain,
  Eye,
  Shield,
  Globe,
  BarChart3,
  Loader2,
} from 'lucide-react';

type SettingsTab = 'profile' | 'cgpa' | 'ai';

const tabs: { key: SettingsTab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'cgpa', label: 'CGPA', icon: BarChart3 },
  { key: 'ai', label: 'AI Settings', icon: Brain },
];

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { success, error: notifyError } = useNotification();
  const { user, updateUser: updateAuthUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      setSaving(true);
      await updateUser(user.id, {
        full_name: fullName,
        phone: phone || undefined,
        avatar_url: avatarUrl || undefined,
      });
      updateAuthUser({ fullName, full_name: fullName, phone, avatar: avatarUrl, avatarUrl, avatar_url: avatarUrl });
      setEditing(false);
      success('Profile Updated', 'Your profile has been updated successfully');
    } catch (err: unknown) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage your profile, CGPA configuration, and AI preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal details and profile picture</CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveProfile} className="p-4 pt-0 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={getMediaUrl(avatarUrl) ?? undefined}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-surface-200 dark:border-surface-700"
                    />
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
                  <p className="text-[10px] text-surface-400 capitalize mt-0.5">
                    Role: {user?.activeRole || user?.role}
                  </p>
                </div>
              </div>

              {editing ? (
                <>
                  <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  <Input
                    label="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                  <Input
                    label="Avatar URL"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                      Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditing(false);
                        setFullName(user?.fullName || user?.full_name || '');
                        setPhone(user?.phone || '');
                        setAvatarUrl(user?.avatar || user?.avatarUrl || user?.avatar_url || '');
                      }}
                    >
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-500" />
                Appearance
              </CardTitle>
              <CardDescription>General display preferences</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0">
              <div className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-primary-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-warning-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">Theme</p>
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
      )}

      {/* CGPA Settings Tab */}
      {activeTab === 'cgpa' && <CGPATab />}

      {/* AI Settings Tab */}
      {activeTab === 'ai' && <AITab />}
    </div>
  );
};

function CGPATab() {
  const { success, error: notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState('5.0');
  const [passingCGPA, setPassingCGPA] = useState('1.0');
  const [firstClass, setFirstClass] = useState('4.5');
  const [secondClassUpper, setSecondClassUpper] = useState('3.5');
  const [secondClassLower, setSecondClassLower] = useState('2.5');
  const [thirdClass, setThirdClass] = useState('1.5');

  useEffect(() => {
    getCGPAConfig()
      .then((config) => {
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
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
      success('Settings Updated', 'CGPA classification thresholds saved');
    } catch {
      notifyError('Error', 'Failed to save CGPA settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade Classification Thresholds</CardTitle>
        <CardDescription>Minimum CGPA required to achieve each degree classification</CardDescription>
      </CardHeader>
      <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Maximum CGPA Scale"
            type="number"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            required
          />
          <Input
            label="Minimum Passing CGPA"
            type="number"
            step="0.1"
            value={passingCGPA}
            onChange={(e) => setPassingCGPA(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Class (min CGPA)"
            type="number"
            step="0.1"
            value={firstClass}
            onChange={(e) => setFirstClass(e.target.value)}
            required
          />
          <Input
            label="Second Class Upper (min CGPA)"
            type="number"
            step="0.1"
            value={secondClassUpper}
            onChange={(e) => setSecondClassUpper(e.target.value)}
            required
          />
          <Input
            label="Second Class Lower (min CGPA)"
            type="number"
            step="0.1"
            value={secondClassLower}
            onChange={(e) => setSecondClassLower(e.target.value)}
            required
          />
          <Input
            label="Third Class (min CGPA)"
            type="number"
            step="0.1"
            value={thirdClass}
            onChange={(e) => setThirdClass(e.target.value)}
            required
          />
        </div>
        <Button type="submit" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
          Save CGPA Configuration
        </Button>
      </form>
    </Card>
  );
}

function AITab() {
  const { success, error: notifyError } = useNotification();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAISettings()
      .then(setSettings)
      .catch(() => notifyError('Error', 'Failed to load AI settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: keyof AISettings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateAISettings({
        chatbot_enabled: settings.chatbot_enabled,
        personalization_enabled: settings.personalization_enabled,
        face_recognition_enabled: settings.face_recognition_enabled,
        data_collection_consent: settings.data_collection_consent,
      });
      success('Settings Saved', 'AI preferences have been updated.');
    } catch {
      notifyError('Error', 'Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!settings) return null;

  const toggles = [
    {
      key: 'chatbot_enabled' as const,
      icon: <Bot className="w-5 h-5" />,
      title: 'AI Chatbot',
      description: 'Enable the ACES Assistant chatbot for quick help and guidance.',
    },
    {
      key: 'personalization_enabled' as const,
      icon: <Brain className="w-5 h-5" />,
      title: 'Personalization',
      description: 'Allow AI to personalize recommendations based on your academic profile.',
    },
    {
      key: 'face_recognition_enabled' as const,
      icon: <Eye className="w-5 h-5" />,
      title: 'Face Recognition Attendance',
      description: 'Enable face detection for automatic class check-in (camera required).',
    },
    {
      key: 'data_collection_consent' as const,
      icon: <Shield className="w-5 h-5" />,
      title: 'Data Collection Consent',
      description: 'Allow anonymized interaction data to improve AI accuracy. No PII is shared.',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <CardDescription>Control which AI features are active on your account</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-3">
          {toggles.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-500 shrink-0">
                  {t.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-surface-900 dark:text-white">{t.title}</h4>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{t.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(t.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                  settings[t.key] ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings[t.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-surface-400" />
            Preferred Language
          </CardTitle>
          <CardDescription>Language for AI-generated content and chatbot responses</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          <select
            value={settings.preferred_language || 'en'}
            onChange={(e) => setSettings({ ...settings, preferred_language: e.target.value })}
            className="px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="en">English</option>
            <option value="yo">Yoruba</option>
            <option value="ig">Igbo</option>
            <option value="ha">Hausa</option>
          </select>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button leftIcon={<Save className="w-4 h-4" />} isLoading={saving} onClick={handleSave}>
          Save AI Preferences
        </Button>
      </div>
    </div>
  );
}

export default SettingsPage;
