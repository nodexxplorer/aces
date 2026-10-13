import { useState, type FormEvent } from 'react';
import { Lock, Save } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription } from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { changePassword } from '../../api/additional-features';
import { useNotification } from '../../hooks/useNotification';

// Matches the server's rule (binding:"required,min=6,max=72").
const MIN_LENGTH = 6;
const MAX_LENGTH = 72;

/** The server's message when it has one, otherwise a general line. */
function serverMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : 'Please try again in a moment.';
}

/** The first problem with the new password, or null when it can be sent. */
function passwordProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  if (next.length < MIN_LENGTH) return `The new password must be at least ${MIN_LENGTH} characters.`;
  if (next.length > MAX_LENGTH) return `The new password must be at most ${MAX_LENGTH} characters.`;
  if (next !== confirm) return 'The new password and the confirmation do not match.';
  if (next === current) return 'Choose a password different from the current one.';
  return null;
}

/**
 * Lets any signed-in person change their own password. Staff (admins, HODs,
 * lecturers) and students all use it from the profile page.
 */
export default function ChangePasswordCard() {
  const { success, error: notifyError } = useNotification();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const issue = passwordProblem(current, next, confirm);
    if (issue) {
      setProblem(issue);
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await changePassword(current, next);
      success('Password changed', 'Use the new password the next time you sign in.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      const message = serverMessage(err);
      setProblem(message);
      notifyError('Password not changed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Enter your current password, then choose a new one.</CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4 px-6 pb-6" noValidate>
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          rightIcon={<Lock className="w-3.5 h-3.5 text-surface-400" />}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint={`${MIN_LENGTH} to ${MAX_LENGTH} characters`}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {problem && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {problem}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
