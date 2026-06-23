import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from '../ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  isLoading?: boolean;
}

const ConfirmDialog = ({
  isOpen, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, isLoading
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md p-6 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
          <X className="w-4 h-4 text-surface-500" />
        </button>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-danger-100 dark:bg-danger-900/30' : 'bg-warning-100 dark:bg-warning-900/30'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-danger-600' : 'text-warning-600'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">{title}</h3>
            {description && <p className="text-sm text-surface-500 dark:text-surface-400">{description}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
