import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Save, CalendarRange } from 'lucide-react';

const SessionManagementPage = () => {
  const { success } = useNotification();
  const [session, setSession] = useState('2025/2026');
  const [semester, setSemester] = useState('first');
  const [deptDues, setDeptDues] = useState('15000');
  const [classDues, setClassDues] = useState('5000');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      success('Parameters Saved', 'Academic session terms and dues rates updated successfully.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Dues & Sessions</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Configure active semester bounds and department fees.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary-500" />
            <CardTitle>Session Configuration</CardTitle>
          </div>
          <CardDescription>Setup academic context limits</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
          <Input
            label="Active Academic Session"
            placeholder="e.g. 2025/2026"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            required
          />
          <Select
            label="Active Semester"
            options={[
              { value: 'first', label: 'First Semester' },
              { value: 'second', label: 'Second Semester' },
            ]}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Department Association Dues (₦)"
              type="number"
              value={deptDues}
              onChange={(e) => setDeptDues(e.target.value)}
              required
            />
            <Input
              label="Class Dues Rate (₦)"
              type="number"
              value={classDues}
              onChange={(e) => setClassDues(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            Apply Parameters
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SessionManagementPage;
