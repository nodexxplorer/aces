import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import {
  getManuals,
  getManualPurchases,
  bulkDownloadCovers,
  downloadCover,
  type Manual,
  type ManualAdminPurchase,
} from '../../api/manuals';
import { getErrorMessage } from '../../utils/errors';
import { Download, Loader2, FileStack, Users, History, Search, RotateCcw } from 'lucide-react';

type Tab = 'to-print' | 'history';

export default function ManualCoverBulkDownloadPage() {
  const { success, error: notifyError } = useNotification();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [manualId, setManualId] = useState('');
  const [purchases, setPurchases] = useState<ManualAdminPurchase[]>([]);
  const [loadingManuals, setLoadingManuals] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('to-print');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getManuals()
      .then((list) => {
        setManuals(list);
        if (list.length > 0) setManualId(list[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load manuals'))
      .finally(() => setLoadingManuals(false));
  }, []);

  const fetchPurchases = () => {
    if (!manualId) return;
    setLoadingPurchases(true);
    getManualPurchases(manualId)
      .then((list) => setPurchases(Array.isArray(list) ? list : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoadingPurchases(false));
  };

  useEffect(fetchPurchases, [manualId]);

  const selectedManual = manuals.find((m) => m.id === manualId);
  const pending = purchases.filter((p) => !p.is_collected);
  const history = purchases
    .filter((p) => p.is_collected)
    .filter(
      (p) =>
        !search ||
        p.matric_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.student_name?.toLowerCase().includes(search.toLowerCase()),
    );

  const handleBulkDownload = async () => {
    if (!manualId || pending.length === 0) return;
    setDownloading(true);
    try {
      const blob = await bulkDownloadCovers(manualId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedManual?.title || 'manual'}-covers.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      success(
        'Download Started',
        `Combined cover PDF for ${pending.length} purchase(s) started downloading. They're now marked collected and moved to History.`,
      );
      fetchPurchases();
    } catch (err: unknown) {
      notifyError('Download Failed', getErrorMessage(err, 'Could not generate bulk cover PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleReprint = async (purchase: ManualAdminPurchase) => {
    try {
      setReprintingId(purchase.id);
      const blob = await downloadCover(purchase.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manual-cover-${purchase.matric_number || purchase.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notifyError('Download Failed', 'Could not reprint this cover.');
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bulk Cover Download</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Download every unprinted purchaser's manual cover page as one combined PDF. Once printed, they're marked
          collected and move to History so the same batch never gets printed twice.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileStack className="w-5 h-5 text-primary-500" />
            <CardTitle>Select a Manual</CardTitle>
          </div>
          <CardDescription>Pick the manual whose purchaser covers you want to print.</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {loadingManuals ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          ) : manuals.length === 0 ? (
            <p className="text-sm text-surface-400">No manuals found.</p>
          ) : (
            <Select
              options={manuals.map((m) => ({ value: m.id, label: `${m.title} (Level ${m.level})` }))}
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
            />
          )}
        </div>
      </Card>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        <button
          onClick={() => setTab('to-print')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            tab === 'to-print'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
              : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          <Users className="w-4 h-4" />
          To Print {pending.length > 0 && `(${pending.length})`}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            tab === 'history'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
              : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {tab === 'to-print' ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle>Unprinted Purchasers {pending.length > 0 && `(${pending.length})`}</CardTitle>
              <Button
                leftIcon={downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleBulkDownload}
                disabled={downloading || loadingPurchases || pending.length === 0}
              >
                {downloading ? 'Generating PDF...' : `Download All Covers (${pending.length})`}
              </Button>
            </div>
            <CardDescription>One combined PDF, one cover page per purchaser, in the order shown below.</CardDescription>
          </CardHeader>
          {loadingPurchases ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-12">
              Nothing to print — every purchaser's cover has already been generated.
            </p>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 dark:text-surface-100">{p.student_name}</p>
                    <p className="text-xs text-surface-500">{p.matric_number}</p>
                  </div>
                  <span className="text-[10px] text-surface-400">Not printed</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Printed / Collected History {history.length > 0 && `(${history.length})`}</CardTitle>
            <CardDescription>
              Already printed as part of a bulk batch. Search by reg. no. to reprint a specific cover if needed.
            </CardDescription>
            <div className="relative mt-3 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by reg. no. or name..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          {loadingPurchases ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-12">
              {search ? 'No match found.' : 'No covers printed yet for this manual.'}
            </p>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {history.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 dark:text-surface-100">{p.student_name}</p>
                    <p className="text-xs text-surface-500">{p.matric_number}</p>
                    {p.collected_at && (
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        Printed {new Date(p.collected_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={
                      reprintingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )
                    }
                    onClick={() => handleReprint(p)}
                    disabled={reprintingId === p.id}
                  >
                    Reprint
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
