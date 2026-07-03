import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { UserCheck } from 'lucide-react';
import { useState } from 'react';

const DelegateAdminPage = () => {
  const { success } = useNotification();
  const [email, setEmail] = useState('');

  const handleDelegate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    success('Admin Delegated', `Delegated secondary admin access rights to ${email}`);
    setEmail('');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Delegate Admin Authority</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Delegate administrative overrides and course approvals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delegation Panel</CardTitle>
          <CardDescription>Assign delegated HOD roles to trusted lecturers</CardDescription>
        </CardHeader>
        <form onSubmit={handleDelegate} className="p-4 pt-0 space-y-4">
          <Input
            label="Lecturer Email"
            placeholder="e.g. lecturer@uniuyo.edu.ng"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" leftIcon={<UserCheck className="w-4 h-4" />}>
            Grant Delegated Admin Rights
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default DelegateAdminPage;
