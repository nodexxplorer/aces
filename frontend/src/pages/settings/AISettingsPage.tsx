import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { getAISettings, updateAISettings } from '../../api/ai';
import type { AISettings } from '../../api/ai';
import { Bot, Brain, Eye, Shield, Globe, Save } from 'lucide-react';

const AISettingsPage = () => {
  const { success, error } = useNotification();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getAISettings();
      setSettings(data);
    } catch {
      error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

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
      success('Settings Saved', 'Your AI preferences have been updated.');
    } catch {
      error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
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
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">AI Preferences</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage how AI features work for you. You can opt out of any feature at any time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <CardDescription>Control which AI features are active on your account</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
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
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings[t.key] ? 'translate-x-5' : 'translate-x-0'
                }`} />
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
          Save Preferences
        </Button>
      </div>
    </div>
  );
};

export default AISettingsPage;
