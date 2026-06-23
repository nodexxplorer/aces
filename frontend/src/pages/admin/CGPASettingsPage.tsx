import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { Save } from 'lucide-react';

const CGPASettingsPage = () => {
  const { success } = useNotification();
  const [scale, setScale] = useState('5.0');
  const [firstClassMin, setFirstClassMin] = useState('4.50');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    success('Grading Matrix Applied', 'Academic grading rules updated.');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grading System Limits</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Adjust scale metrics, class limits and passing score bounds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GPA Settings</CardTitle>
          <CardDescription>Setup grading parameters</CardDescription>
        </CardHeader>
        <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
          <Select
            label="Grading Scale"
            options={[
              { value: '5.0', label: '5.0 Scale (NUC Standard)' },
              { value: '4.0', label: '4.0 Scale' },
            ]}
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
          <Input label="First Class Minimum Cumulative GPA" type="number" step="0.01" value={firstClassMin} onChange={(e) => setFirstClassMin(e.target.value)} required />
          <Button type="submit" className="w-full" leftIcon={<Save className="w-4 h-4" />}>
            Apply Settings
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CGPASettingsPage;
