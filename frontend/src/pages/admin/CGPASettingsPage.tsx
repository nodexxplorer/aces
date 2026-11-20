import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { getCGPAConfig, updateCGPAConfig } from '../../api/cgpa';
import { Save, Loader2 } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
const CGPASettingsPage = () => {
  const { success } = useNotification();
  const [saving, setSaving] = useState(false);

  const { data: _qd, isLoading: loading } = useQuery({
    queryKey: ['cgpasettings'],
    queryFn: async () => {
      const _r: any = {
        scale: '5.0',
        passingCGPA: '1.0',
        firstClass: '4.5',
        secondClassUpper: '3.5',
        secondClassLower: '2.5',
        thirdClass: '1.5',
      };
      try {
        const config = await getCGPAConfig();
        if (config) {
          _r.scale = String(config.scale || config.maxScale || '5.0');
          _r.passingCGPA = String(config.passingCGPA || config.minimumPassing || '1.0');
          _r.firstClass = String(config.firstClass || config.gradeBoundaries?.firstClass || '4.5');
          _r.secondClassUpper = String(config.secondClassUpper || config.gradeBoundaries?.secondClassUpper || '3.5');
          _r.secondClassLower = String(config.secondClassLower || config.gradeBoundaries?.secondClassLower || '2.5');
          _r.thirdClass = String(config.thirdClass || config.gradeBoundaries?.thirdClass || '1.5');
        }
      } catch {
        // silent
      }
      return _r;
    },
    staleTime: 5 * 60_000,
  });
  const scale = _qd?.scale ?? '5.0';
  const passingCGPA = _qd?.passingCGPA ?? '1.0';
  const firstClass = _qd?.firstClass ?? '4.5';
  const secondClassUpper = _qd?.secondClassUpper ?? '3.5';
  const secondClassLower = _qd?.secondClassLower ?? '2.5';
  const thirdClass = _qd?.thirdClass ?? '1.5';
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
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
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">CGPA Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Configure grade point averages and degree classification thresholds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grade Classification Thresholds</CardTitle>
          <CardDescription>Minimum CGPA required to achieve each degree classification</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-4 pt-0 space-y-4">
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
            <Button type="submit" className="w-full" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
              Save Configuration
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default CGPASettingsPage;
