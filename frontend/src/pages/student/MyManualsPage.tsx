import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Download, BookOpen, Loader2, QrCode, CheckCircle, ExternalLink } from 'lucide-react';
import { getMyPurchases, downloadCover } from '../../api/manuals';
import type { ManualPurchase } from '../../api/manuals';

const MyManualsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ open: boolean; purchase: ManualPurchase | null }>({ open: false, purchase: null });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const data = await getMyPurchases();
      setPurchases(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (purchase: ManualPurchase) => {
    try {
      setDownloadingId(purchase.id);
      const blob = await downloadCover(purchase.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manual-cover-${purchase.manual_title || 'download'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      success('Downloaded', 'Cover page PDF downloaded.');
    } catch {
      notifyError('Download Failed', 'Could not download cover PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Manuals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Access your purchased manuals, download cover pages, and view your QR codes.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
        </div>
      ) : purchases.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-surface-300" />
            <p className="text-sm text-surface-500">No manuals purchased yet.</p>
            <a href="/manuals" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
              Browse Manuals
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((p) => (
            <Card key={p.id} hover>
              <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3">
                <BookOpen className="w-12 h-12 text-primary-400" />
              </div>
              <h4 className="font-semibold text-surface-900 dark:text-white text-sm mb-1 line-clamp-2">
                {p.manual_title || 'Manual'}
              </h4>
              <p className="text-xs text-surface-500 mb-2">
                Level {p.manual_level || 'N/A'} | &#8358;{Number(p.price).toLocaleString()}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <StatusBadge status={p.is_collected ? 'collected' : 'pending'} />
                {p.purchased_at && (
                  <span className="text-[10px] text-surface-400">
                    Purchased {new Date(p.purchased_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  leftIcon={downloadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  onClick={() => handleDownload(p)}
                  disabled={downloadingId === p.id}
                >
                  Cover
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  leftIcon={<QrCode className="w-4 h-4" />}
                  onClick={() => setQrModal({ open: true, purchase: p })}
                >
                  QR Code
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      <Modal
        isOpen={qrModal.open}
        onClose={() => setQrModal({ open: false, purchase: null })}
        title="Manual QR Code"
      >
        {qrModal.purchase && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Show this QR code when collecting your manual.
            </p>
            {qrModal.purchase.qr_code_url ? (
              <div className="flex justify-center">
                <img
                  src={qrModal.purchase.qr_code_url}
                  alt="QR Code"
                  className="w-64 h-64 border-2 border-surface-200 rounded-lg"
                />
              </div>
            ) : qrModal.purchase.qr_code_data ? (
              <div className="p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
                <p className="text-xs text-surface-500 break-all font-mono">{qrModal.purchase.qr_code_data}</p>
              </div>
            ) : (
              <p className="text-sm text-surface-400">QR code not yet generated</p>
            )}
            <p className="text-xs text-surface-400">
              {qrModal.purchase.manual_title} | {(qrModal.purchase as unknown as { matric_number?: string }).matric_number || ''}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyManualsPage;
