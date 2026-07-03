import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { Save } from 'lucide-react';

const SettingsPage = () => {
  const { success } = useNotification();
  const [deptName, setDeptName] = useState('Computer Engineering');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success('Settings Applied', 'General department system configurations updated.');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Admin System Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Edit global console parameters and branding settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Console Configuration</CardTitle>
          <CardDescription>Setup general settings</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
          <Input label="Department Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
          <Button type="submit" className="w-full" leftIcon={<Save className="w-4 h-4" />}>
            Save Changes
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SettingsPage;
