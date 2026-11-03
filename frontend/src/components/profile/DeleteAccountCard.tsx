import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Lock, ShieldAlert, Loader2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription } from '../ui/Card';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { deleteMyAccount } from '../../api/users';
import { getErrorMessage } from '../../utils/errors';

export default function DeleteAccountCard() {
  const { user, logout } = useAuth();
  const { success, error: notifyError } = useNotification();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isHod = user?.role === 'hod';
  const confirmationTarget = 'DELETE';
  const canSubmit = confirmText.trim() === confirmationTarget && password.trim().length > 0 && !loading;

  const handleOpen = () => {
    setConfirmText('');
    setPassword('');
    setReason('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    if (!loading) {
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      await deleteMyAccount({
        password: password.trim(),
        reason: reason.trim() || undefined,
      });

      success('Account Deleted', 'Your account has been permanently deleted.');
      setIsModalOpen(false);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to delete account. Please verify your password.');
      setErrorMsg(message);
      notifyError('Deletion Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-rose-300/70 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-rose-200/50 dark:border-rose-900/30 pb-4">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <CardTitle className="text-rose-900 dark:text-rose-300 text-base font-bold">
              Danger Zone: Delete Account
            </CardTitle>
          </div>
          <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
            Permanently remove your account, profile details, and portal access. This action cannot be reversed.
          </CardDescription>
        </CardHeader>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white/70 dark:bg-[#13151b] p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Before you delete your account:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1 leading-relaxed">
              <li>All personal profile records and uploads will be wiped.</li>
              <li>You will lose access to course registrations, receipts, and signing history.</li>
              <li>You will be immediately logged out of all active sessions.</li>
            </ul>
          </div>

          {isHod ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
              <p className="font-semibold">HOD Account Protection</p>
              <p className="mt-0.5">
                Head of Department accounts cannot be self-deleted. You must transfer the HOD role to another staff
                member first.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You will be asked to confirm with your password.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleOpen}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                className="self-start sm:self-auto"
              >
                Delete My Account
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal isOpen={isModalOpen} onClose={handleClose} size="md" title="Delete Your Account">
        <form onSubmit={handleDelete} className="p-6 space-y-5">
          <div className="p-4 rounded-xl border border-rose-300/80 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Are you absolutely sure?</h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5 leading-relaxed">
                This action is <strong>permanent</strong> and cannot be undone. All your account data will be erased.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Reason Input (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for leaving (optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Select a reason...</option>
              <option value="graduated">Graduated / Completed degree</option>
              <option value="transferring">Transferring to another department</option>
              <option value="privacy">Privacy concerns</option>
              <option value="duplicate">Created a duplicate account</option>
              <option value="other">Other reason</option>
            </select>
          </div>

          {/* Current Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm your password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="password"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                required
                className="w-full text-xs"
              />
            </div>
          </div>

          {/* Confirmation Keyword */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Type <strong className="text-rose-600 dark:text-rose-400 font-mono">DELETE</strong> to confirm{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Type DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              required
              className="w-full text-xs font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!canSubmit}
              leftIcon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            >
              {loading ? 'Deleting...' : 'Permanently Delete Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
