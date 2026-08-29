# Archived Feature: Practicals & Lab + Manuals

Removed on 2026-08-20 across frontend, backend, database, and mobile, at the
user's request. This file preserves every file that was deleted (full
original contents) and every snippet that was removed from files that
otherwise stayed (routes, sidebar entries, imports, integration branches),
so the feature can be restored by reversing each section below.

## Restoration checklist
1. Recreate each "DELETED FILE" below at its original path with its exact content.
2. Re-apply each "REMOVED SNIPPET" back into the (still-existing) file it came from.
3. Run the down-migration counterpart of `000045_remove_practicals_and_manuals` (or apply the recreate-tables SQL captured at the bottom of this file) to restore the `manuals`, `manual_purchases`, `manual_print_queue`, and `practical_enrollments` tables.
4. Re-run `sqlc generate` (or manually restore `manuals.sql.go` from git history at the commit before this removal) to regenerate the Go query bindings.
5. Rebuild all three codebases and re-check `git log` around this removal's commit for the exact diff if anything here is ambiguous.

---

## Deleted files (full original content)

### `frontend/src/pages/student/PracticalDetailsPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { getMyPracticalEnrollments } from '../../api/manuals';
import { Loader2, ClipboardList } from 'lucide-react';
import type { PracticalEnrollment } from '../../api/manuals';

const PracticalDetailsPage = () => {
  const [enrollments, setEnrollments] = useState<PracticalEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const data = await getMyPracticalEnrollments();
      setEnrollments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'course_code',
      label: 'Course',
      render: (_: unknown, row: PracticalEnrollment) => (
        <div>
          <p className="font-semibold">{row.course_code}</p>
          <p className="text-[10px] text-surface-500">{row.course_title}</p>
        </div>
      ),
    },
    {
      key: 'enrolled_via',
      label: 'Enrolled Via',
      render: (val: unknown) => <StatusBadge status={String(val || 'unknown')} />,
    },
    {
      key: 'enrolled_at',
      label: 'Enrolled At',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Practicals & Labs</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Your enrolled practical courses and lab sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            My Practical Enrollments
          </CardTitle>
          <CardDescription>Courses you are enrolled in via QR scan or manual enrollment</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading...</span>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-surface-300" />
            <p>No practical enrollments found.</p>
            <p className="text-xs text-surface-400 mt-1">Purchase a manual and scan the QR code to enroll.</p>
          </div>
        ) : (
          <DataTable columns={columns} data={enrollments} />
        )}
      </Card>
    </div>
  );
};

export default PracticalDetailsPage;
```

### `frontend/src/pages/student/ManualsPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import Select from '../../components/ui/Select';
import ManualCard from '../../components/ui/ManualCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { ShoppingCart, Search, Loader2, BookOpen, Receipt, ShoppingBag } from 'lucide-react';
import { getManuals, getMyPurchases, downloadReceipt } from '../../api/manuals';
import { useCartStore } from '../../stores/cartStore';
import type { Manual, ManualPurchase } from '../../api/manuals';

type Tab = 'browse' | 'my';

const ManualsPage = () => {
  const { success, error: notifyError } = useNotification();
  const params = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState<Tab>(params.get('tab') === 'my' ? 'my' : 'browse');

  const [manuals, setManuals] = useState<Manual[]>([]);
  const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const cartItems = useCartStore((s) => s.items);
  const cartManualIds = new Set(cartItems.map((i) => i.manual.id));
  const purchasedIds = new Set(purchases.map((p) => p.manual_id));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [manualsData, purchasesData] = await Promise.allSettled([getManuals(), getMyPurchases()]);
      if (manualsData.status === 'fulfilled') {
        setManuals(Array.isArray(manualsData.value) ? manualsData.value : []);
      }
      if (purchasesData.status === 'fulfilled') {
        setPurchases(Array.isArray(purchasesData.value) ? purchasesData.value : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = manuals.filter(
    (m) =>
      m.is_active &&
      (!level || m.level === parseInt(level)) &&
      (!searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleAddToCart = (manual: Manual) => {
    addItem({
      id: manual.id,
      title: manual.title,
      description: manual.description || '',
      price: manual.price,
      level: manual.level,
      isActive: manual.is_active,
      coverImageUrl: manual.cover_image_url,
      createdAt: manual.created_at,
    });
    success('Added to Cart', `"${manual.title}" added to your cart.`);
  };

  const handleDownloadReceipt = async (purchase: ManualPurchase) => {
    try {
      setDownloadingId(purchase.id);
      const blob = await downloadReceipt(purchase.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${purchase.manual_title || 'manual'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      notifyError('Download Failed', 'Could not download receipt.');
    } finally {
      setDownloadingId(null);
    }
  };

  const tabs = [
    { key: 'browse' as Tab, label: 'Browse Manuals', icon: ShoppingBag },
    { key: 'my' as Tab, label: `My Manuals${purchases.length > 0 ? ` (${purchases.length})` : ''}`, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Manuals</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Purchase recommended textbooks and laboratory manuals, and manage what you already own.
          </p>
        </div>
        <a
          href="/payments?tab=cart"
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 text-sm font-medium transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          View Cart
          {getItemCount() > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary-500 rounded-full">
              {getItemCount()}
            </span>
          )}
        </a>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-3 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search manuals..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              options={[
                { value: '', label: 'All Levels' },
                { value: '100', label: '100 Level' },
                { value: '200', label: '200 Level' },
                { value: '300', label: '300 Level' },
                { value: '400', label: '400 Level' },
                { value: '500', label: '500 Level' },
              ]}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-surface-500">
              <p>No manuals found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((m) => (
                <ManualCard
                  key={m.id}
                  manual={{
                    id: m.id,
                    title: m.title,
                    description: m.description || '',
                    price: m.price,
                    level: m.level,
                    isActive: m.is_active,
                    coverImageUrl: m.cover_image_url,
                    createdAt: m.created_at,
                  }}
                  isPurchased={purchasedIds.has(m.id)}
                  isInCart={cartManualIds.has(m.id)}
                  onPurchase={purchasedIds.has(m.id) || cartManualIds.has(m.id) ? undefined : () => handleAddToCart(m)}
                />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
        </div>
      ) : purchases.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-surface-300" />
            <p className="text-sm text-surface-500">No manuals purchased yet.</p>
            <button
              onClick={() => setActiveTab('browse')}
              className="mt-3 inline-block text-sm text-primary-600 hover:underline"
            >
              Browse Manuals
            </button>
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
                <StatusBadge status={p.is_collected ? 'collected' : 'active'} />
                {p.purchased_at && (
                  <span className="text-[10px] text-surface-400">
                    Purchased {new Date(p.purchased_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                leftIcon={
                  downloadingId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )
                }
                onClick={() => handleDownloadReceipt(p)}
                disabled={downloadingId === p.id}
              >
                Download Receipt
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManualsPage;
```

### `frontend/src/pages/admin/ManualsManagementPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { BookOpen, Plus, Loader2, Eye, Edit, Trash2 } from 'lucide-react';
import { getManuals, createManual, deleteManual } from '../../api/manuals';
import type { Manual } from '../../api/manuals';
import { getCourses } from '../../api/courses';
import type { Course } from '../../types';
import { getErrorMessage } from '../../utils/errors';

const ManualsManagementPage = () => {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('500');
  const [price, setPrice] = useState('0');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    fetchManuals();
    fetchCourses();
  }, []);

  const fetchManuals = async () => {
    try {
      setLoading(true);
      const data = await getManuals();
      const items = Array.isArray(data) ? data : (data as unknown as { items?: Manual[] }).items || [];
      setManuals(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await getCourses({ page: 1, perPage: 100 });
      const items = Array.isArray(data) ? data : (data as unknown as { items?: Course[] }).items || [];
      setCourses(items);
    } catch {
      // silent
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await createManual({
        title,
        description: description || undefined,
        level: parseInt(level) || 500,
        price: parseFloat(price) || 0,
        course_id: courseId || undefined,
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setLevel('500');
      setPrice('0');
      setCourseId('');
      success('Manual Created', `"${title}" has been added to the resource library`);
      fetchManuals();
    } catch (err: unknown) {
      notifyError('Create Failed', getErrorMessage(err, 'Could not create manual'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteManual(id);
      setManuals((prev) => prev.filter((m) => m.id !== id));
      success('Manual Deleted', 'Resource removed from library');
    } catch (err: unknown) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete manual'));
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Manual',
      render: (_: unknown, row: Manual) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <Link
              to={`/admin/manuals/${row.id}`}
              className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              {row.title}
            </Link>
            <p className="text-[10px] text-surface-500">{row.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      render: (val: unknown) => <StatusBadge status={String(val || 'N/A')} />,
    },
    {
      key: 'price',
      label: 'Price',
      render: (val: unknown) => (val ? `₦${Number(val).toLocaleString()}` : 'Free'),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (val: unknown) => <StatusBadge status={val ? 'active' : 'inactive'} />,
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Manual) => (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/admin/manuals/${row.id}`)}
          >
            View
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<Edit className="w-3.5 h-3.5" />}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-danger-500 hover:bg-danger-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => handleDelete(row.id, row.title)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Manuals & Resources</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, update and manage departmental handbooks, guides and academic resources.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Create Manual
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Library</CardTitle>
          <CardDescription>
            {manuals.length} manual{manuals.length !== 1 && 's'} and resource{manuals.length !== 1 && 's'} available
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
          </div>
        ) : (
          <DataTable<Manual> columns={columns} data={manuals} />
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Manual">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. CPE 523 Lab Manual"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-24"
              placeholder="Brief description of this resource..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Level" type="number" value={level} onChange={(e) => setLevel(e.target.value)} required />
            <Input
              label="Price (NGN)"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Select Course</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">No specific course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Create Manual
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default ManualsManagementPage;
```

### `frontend/src/pages/admin/ManualCoverBulkDownloadPage.tsx`
```tsx
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
```

### `frontend/src/pages/admin/ManualDetailPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/data-display/DataTable';
import { getManual, getManualPurchases, downloadCover } from '../../api/manuals';
import { useNotification } from '../../hooks/useNotification';
import { ArrowLeft, BookOpen, Layers, DollarSign, Calendar, Loader2, Download, Users } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Manual, ManualAdminPurchase } from '../../api/manuals';

const ManualDetailPage = () => {
  const { id } = useParams();
  const { success, error: notifyError } = useNotification();
  const [manual, setManual] = useState<Manual | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<ManualAdminPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getManual(id)
      .then((m) => {
        setManual(m);
        fetchPurchases(id);
      })
      .catch(() => notifyError('Error', 'Failed to load manual details'))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchPurchases = async (manualId: string) => {
    setPurchasesLoading(true);
    try {
      const data = await getManualPurchases(manualId);
      setPurchases(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setPurchasesLoading(false);
    }
  };

  const handleDownload = async (purchaseId: string, title: string) => {
    try {
      const blob = await downloadCover(purchaseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}-cover.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      success('Download Started', 'Cover page PDF download started.');
    } catch {
      notifyError('Download Failed', 'Could not download cover page.');
    }
  };

  const purchaseColumns = [
    {
      key: 'student_name',
      label: 'Student',
      render: (val: unknown, row: Record<string, unknown>) => (
        <div>
          <p className="font-medium text-surface-900 dark:text-surface-100">{String(val || 'Unknown')}</p>
          <p className="text-[10px] text-surface-500">{(row.matric_number as string) || ''}</p>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Amount',
      render: (val: unknown) => (
        <span className="font-semibold text-success-600">{val ? `₦${Number(val).toLocaleString()}` : 'Free'}</span>
      ),
    },
    {
      key: 'purchased_at',
      label: 'Purchased',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
    {
      key: 'is_collected',
      label: 'Status',
      render: (val: unknown) => <Badge variant={val ? 'success' : 'warning'}>{val ? 'Collected' : 'Pending'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: Record<string, unknown>) => (
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<Download className="w-3.5 h-3.5" />}
          onClick={() => handleDownload(row.id as string, (row.manual_title as string) || 'manual')}
        >
          Download
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-2 text-sm text-surface-500">Loading manual details...</span>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold">Manual Not Found</h2>
        <p className="text-surface-500">The manual record you are looking for does not exist.</p>
        <Link to="/admin/manuals">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Manuals Management
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/admin/manuals">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Manuals Management
        </Button>
      </Link>

      <Card glass className="p-8">
        <CardHeader className="border-b border-surface-200 dark:border-surface-700/50 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-500 to-secondary-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={manual.is_active ? 'success' : 'danger'}>
                  {manual.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="info">
                  {purchases.length} purchase{purchases.length !== 1 && 's'}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold">{manual.title}</CardTitle>
              <CardDescription>Manual ID: {manual.id}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Layers className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Level</p>
                <p>{manual.level ? `${manual.level} Level` : 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <DollarSign className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Price</p>
                <p className="font-semibold text-success-600 dark:text-success-400">{formatCurrency(manual.price)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Calendar className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Last Updated</p>
                <p>
                  {manual.updated_at
                    ? new Date(manual.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {manual.description && (
          <div className="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700/50">
            <p className="text-xs text-surface-400 font-medium mb-2">Description</p>
            <p className="text-sm text-surface-700 dark:text-surface-300">{manual.description}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            <CardTitle>Purchases</CardTitle>
          </div>
          <CardDescription>Students who have purchased this manual</CardDescription>
        </CardHeader>
        {purchasesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading purchases...</span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8 text-surface-500 text-sm">No purchases yet for this manual.</div>
        ) : (
          <div className="p-4 pt-0">
            <DataTable columns={purchaseColumns} data={purchases as unknown as Record<string, unknown>[]} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default ManualDetailPage;
```

### `frontend/src/components/ui/ManualCard.tsx`
```tsx
import { ShoppingCart, BookOpen } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { formatCurrency } from '../../utils/formatters';
import type { Manual } from '../../types';

interface ManualCardProps { manual: Manual; onPurchase?: () => void; isPurchased?: boolean; isInCart?: boolean; }

const ManualCard = ({ manual, onPurchase, isPurchased, isInCart }: ManualCardProps) => (
  <Card hover>
    <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3 overflow-hidden">
      {manual.coverImageUrl ? (
        <img src={manual.coverImageUrl} alt={manual.title} className="w-full h-full object-cover" />
      ) : (
        <BookOpen className="w-12 h-12 text-primary-400" />
      )}
    </div>
    <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-sm mb-1 line-clamp-2">{manual.title}</h4>
    <p className="text-xs text-surface-500 mb-2 line-clamp-2">{manual.description || 'No description'}</p>
    <div className="flex items-center justify-between">
      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(manual.price)}</span>
      <Badge variant="outline">Level {manual.level}</Badge>
    </div>
    {isPurchased ? (
      <Badge variant="success" className="w-full justify-center mt-3">Purchased</Badge>
    ) : isInCart ? (
      <Badge variant="info" className="w-full justify-center mt-3">Added to Cart</Badge>
    ) : onPurchase ? (
      <button onClick={onPurchase} className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-medium bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-600 transition-colors">
        <ShoppingCart className="w-4 h-4" /> Add to Cart
      </button>
    ) : null}
  </Card>
);

export default ManualCard;
```

### `frontend/src/components/data-display/ManualStatusBadge.tsx`
```tsx
import { cn } from '../../utils/cn';

type ManualStatus = 'available' | 'purchased' | 'printing' | 'ready' | 'collected';

const map: Record<ManualStatus, { label: string; cls: string }> = {
  available: { label: 'Available',  cls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' },
  purchased: { label: 'Purchased',  cls: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' },
  printing:  { label: 'Printing',   cls: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' },
  ready:     { label: 'Ready',      cls: 'bg-accent-100  text-accent-700  dark:bg-accent-900/30  dark:text-accent-400'  },
  collected: { label: 'Collected',  cls: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'   },
};

interface ManualStatusBadgeProps { status: ManualStatus; className?: string }

const ManualStatusBadge = ({ status, className }: ManualStatusBadgeProps) => {
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-surface-100 text-surface-600' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', cls, className)}>
      {label}
    </span>
  );
};

export default ManualStatusBadge;
```

### `frontend/src/components/forms/ManualUploadForm.tsx`
```tsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface ManualUploadFormProps {
  onSubmit: (data: { title: string; description: string; price: number; level: number; code: string; file: File | null }) => void;
  isLoading?: boolean;
}

const ManualUploadForm = ({ onSubmit, isLoading }: ManualUploadFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [level, setLevel] = useState('5');
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      price: parseFloat(price || '0'),
      level: parseInt(level),
      code,
      file,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Manual Code/ID"
        placeholder="e.g. CPE511-M"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <Input
        label="Manual Title"
        placeholder="e.g. CPE 511 Lab Manual v2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Selling Price (NGN)"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <Select
          label="Target Level"
          options={[
            { value: '1', label: '100 Level' },
            { value: '2', label: '200 Level' },
            { value: '3', label: '300 Level' },
            { value: '4', label: '400 Level' },
            { value: '5', label: '500 Level' },
          ]}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Manual Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Enter description, coverage info..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Upload PDF document
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-surface-500 dark:text-surface-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          required
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Upload Manual File
      </Button>
    </form>
  );
};

export default ManualUploadForm;
```

### `frontend/src/api/manuals.ts`
```ts
import apiClient, { unwrap } from './client';

export interface Manual {
  id: string;
  title: string;
  description?: string;
  level: number;
  price: number;
  file_url?: string;
  cover_image_url?: string;
  course_id?: string;
  session_id?: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ManualPurchase {
  id: string;
  manual_id: string;
  manual_title: string;
  manual_level: number;
  course_code?: string;
  course_title?: string;
  price: number;
  is_collected: boolean;
  collected_at?: string;
  purchased_at: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

export interface PracticalEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  enrolled_via: string;
  enrolled_at: string;
}

export const getManuals = async (params?: { level?: number }) => {
  const res = await apiClient.get('/manuals', { params });
  return unwrap<Manual[]>(res);
};

export const getManual = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}`);
  return unwrap<Manual>(res);
};

export const createManual = async (payload: {
  title: string;
  description?: string;
  level: number;
  price: number;
  course_id?: string;
  file_url?: string;
  cover_image_url?: string;
}) => {
  const res = await apiClient.post('/manuals', payload);
  return unwrap<Manual>(res);
};

export const updateManual = async (manualId: string, payload: Partial<Manual>) => {
  const res = await apiClient.put(`/manuals/${manualId}`, payload);
  return unwrap<Manual>(res);
};

export const deleteManual = async (manualId: string) => {
  await apiClient.delete(`/manuals/${manualId}`);
};

// Student purchase — requires a completed payment first for priced manuals
// (see checkoutManual below); safe to call directly for free manuals.
export const purchaseManual = async (manualId: string, paymentId?: string) => {
  const res = await apiClient.post('/manuals/purchase', { manual_id: manualId, payment_id: paymentId });
  return res.data;
};

// Student: initialize a Paystack checkout for a priced manual. Redirect the
// browser to the returned authorization_url; Paystack sends the student back
// to /payments/confirmation?manual_id=...&reference=... afterward.
export const checkoutManual = async (manualId: string, email: string) => {
  const res = await apiClient.post(`/manuals/${manualId}/checkout`, { email });
  return unwrap<{ authorization_url: string; reference: string; payment_id: string }>(res);
};

// Student my purchases
export const getMyPurchases = async () => {
  const res = await apiClient.get('/manuals/my-purchases');
  return unwrap<ManualPurchase[]>(res);
};

// Student download cover PDF (admin/print-collection use — carries a QR code)
export const downloadCover = async (purchaseId: string) => {
  const res = await apiClient.get(`/manuals/${purchaseId}/cover`, { responseType: 'blob' });
  return res.data;
};

// Student download proof-of-purchase receipt (no QR code)
export const downloadReceipt = async (purchaseId: string) => {
  const res = await apiClient.get(`/manuals/purchases/${purchaseId}/receipt`, { responseType: 'blob' });
  return res.data;
};

// Admin: bulk download every purchaser's cover for a manual as one combined PDF
export const bulkDownloadCovers = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}/covers/bulk`, { responseType: 'blob' });
  return res.data;
};

// QR verify
export const verifyManualQR = async (qrData: string) => {
  const res = await apiClient.post('/manuals/qr-verify', { qr_data: qrData });
  return res.data;
};

// Practical enrollments
export const getMyPracticalEnrollments = async () => {
  const res = await apiClient.get('/manuals/practicals');
  return unwrap<PracticalEnrollment[]>(res);
};

export interface ManualAdminPurchase {
  id: string;
  student_name?: string;
  matric_number?: string;
  manual_title?: string;
  price: number;
  is_collected: boolean;
  collected_at?: string;
  purchased_at: string;
}

// Admin: purchases by manual
export const getManualPurchases = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}/purchases`);
  return unwrap<ManualAdminPurchase[]>(res);
};

// Admin: mark collected
export const markManualCollected = async (purchaseId: string) => {
  const res = await apiClient.post(`/manuals/purchases/${purchaseId}/collect`);
  return res.data;
};
```

### `frontend/src/stores/cartStore.ts`
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Manual, ManualPurchase } from '../types';

interface CartItem {
  manual: Manual;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  purchases: ManualPurchase[];
  addItem: (manual: Manual) => void;
  removeItem: (manualId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  setPurchases: (purchases: ManualPurchase[]) => void;
  addPurchase: (purchase: ManualPurchase) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      purchases: [],
      addItem: (manual) =>
        set((state) => {
          const exists = state.items.find((i) => i.manual.id === manual.id);
          if (exists) return state;
          return { items: [...state.items, { manual, quantity: 1 }] };
        }),
      removeItem: (manualId) =>
        set((state) => ({
          items: state.items.filter((i) => i.manual.id !== manualId),
        })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((sum, i) => sum + i.manual.price * i.quantity, 0),
      getItemCount: () => get().items.length,
      setPurchases: (purchases) => set({ purchases }),
      addPurchase: (purchase) =>
        set((state) => ({ purchases: [purchase, ...state.purchases] })),
    }),
    { name: 'aces-cart' }
  )
);
```

### `backend/internal/api/manuals.go`
```go
package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/payment"
	"github.com/aces/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

type createManualRequest struct {
	Title         string   `json:"title" binding:"required"`
	Description   *string  `json:"description"`
	Level         int32    `json:"level" binding:"required"`
	Price         float64  `json:"price" binding:"required"`
	FileUrl       *string  `json:"file_url"`
	CoverImageUrl *string  `json:"cover_image_url"`
	CourseID      *string  `json:"course_id"`
	SessionID     *string  `json:"session_id"`
}

type updateManualRequest struct {
	Title         string   `json:"title" binding:"required"`
	Description   *string  `json:"description"`
	Level         int32    `json:"level" binding:"required"`
	Price         float64  `json:"price" binding:"required"`
	FileUrl       *string  `json:"file_url"`
	CoverImageUrl *string  `json:"cover_image_url"`
	IsActive      bool     `json:"is_active"`
}

type purchaseManualRequest struct {
	ManualID  string `json:"manual_id"  binding:"required"`
	PaymentID *string `json:"payment_id" binding:"omitempty,uuid"`
}

type qrVerifyRequest struct {
	QRData string `json:"qr_data" binding:"required"`
}

type manualPurchaseResponse struct {
	ID           string  `json:"id"`
	StudentID    string  `json:"student_id"`
	ManualID     string  `json:"manual_id"`
	ManualTitle  string  `json:"manual_title"`
	ManualLevel  int32   `json:"manual_level"`
	CourseCode   string  `json:"course_code,omitempty"`
	CourseTitle  string  `json:"course_title,omitempty"`
	Price        float64 `json:"price"`
	IsCollected  bool    `json:"is_collected"`
	CollectedAt  *string `json:"collected_at,omitempty"`
	PurchasedAt  string  `json:"purchased_at"`
	QRCodeData   *string `json:"qr_code_data,omitempty"`
	QRCodeURL    *string `json:"qr_code_url,omitempty"`
	StudentName  string  `json:"student_name,omitempty"`
	MatricNumber string  `json:"matric_number,omitempty"`
}

type practicalEnrollmentResponse struct {
	ID          string `json:"id"`
	StudentID   string `json:"student_id"`
	CourseID    string `json:"course_id"`
	CourseCode  string `json:"course_code"`
	CourseTitle string `json:"course_title"`
	EnrolledVia string `json:"enrolled_via"`
	EnrolledAt  string `json:"enrolled_at"`
}

// ─── Helper: get student ID from JWT user ───

func (server *Server) getStudentIDFromUser(ctx *gin.Context) (uuid.UUID, error) {
	userID := getUserID(ctx)
	if userID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("unauthorized")
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		return uuid.Nil, fmt.Errorf("database not available")
	}

	student, err := queries.GetStudentByUserIDFull(ctx, userID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("student record not found — only students can purchase manuals")
	}

	return student.ID, nil
}

// ─── Create Manual (Admin) ───

func (server *Server) createManual(ctx *gin.Context) {
	var req createManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	var courseID pgtype.UUID
	if req.CourseID != nil {
		if parsed, err := uuid.Parse(*req.CourseID); err == nil {
			courseID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}
	var sessionID pgtype.UUID
	if req.SessionID != nil {
		if parsed, err := uuid.Parse(*req.SessionID); err == nil {
			sessionID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}

	createdBy := getUserID(ctx)

	manual, err := server.manuals.Create(ctx, db.CreateManualParams{
		Title:         req.Title,
		Description:   req.Description,
		Level:         req.Level,
		Price:         decimalFromFloat64(req.Price),
		FileUrl:       req.FileUrl,
		CoverImageUrl: req.CoverImageUrl,
		CourseID:      courseID,
		SessionID:     sessionID,
		CreatedBy:     createdBy,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) getManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	manual, err := server.manuals.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) listManuals(ctx *gin.Context) {
	manuals, err := server.manuals.List(ctx, 100, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": manuals})
}

func (server *Server) updateManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var req updateManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	manual, err := server.manuals.Update(ctx, db.UpdateManualParams{
		ID:            id,
		Title:         req.Title,
		Description:   req.Description,
		Level:         req.Level,
		Price:         decimalFromFloat64(req.Price),
		FileUrl:       req.FileUrl,
		CoverImageUrl: req.CoverImageUrl,
		IsActive:      req.IsActive,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, manual)
}

func (server *Server) deleteManual(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	if err := server.manuals.Delete(ctx, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "manual deleted successfully"})
}

// ─── Checkout Manual (Student) ───

// createManualPayment POST /manuals/:id/checkout
// Creates a pending payment for a priced manual so it can be run through the
// existing generic /payments/checkout (Paystack) flow — purchaseManual
// requires a completed payment before it will create the purchase record,
// but until now nothing ever created that payment in the first place, so
// buying any priced manual always failed with "payment required".
func (server *Server) createManualPayment(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "manual not found"})
		return
	}
	if manual.Price.IsZero() {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "this manual is free — call purchase directly, no checkout needed"})
		return
	}

	purchased, _ := queries.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: studentID,
		ManualID:  manualID,
	})
	if purchased {
		ctx.JSON(http.StatusConflict, gin.H{"error": "manual already purchased"})
		return
	}

	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	paymentRecord, err := queries.CreatePayment(ctx, db.CreatePaymentParams{
		StudentID: studentID,
		DueID:     pgtype.UUID{Valid: false},
		Type:      db.PaymentTypeManual,
		ItemName:  manual.Title,
		Amount:    manual.Price,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	reference := fmt.Sprintf("ACES-MAN-%s-%d", paymentRecord.ID.String()[:8], time.Now().Unix())
	if _, err := queries.GetDB().Exec(ctx, "UPDATE payments SET paystack_reference = $1 WHERE id = $2", reference, paymentRecord.ID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	amountKobo := manual.Price.Mul(decimal.NewFromInt(100)).IntPart()
	paystackClient := payment.NewPaystackClient(server.config.PaystackSecretKey, server.config.PaystackPublicKey)
	resp, err := paystackClient.InitializePayment(payment.InitPaymentRequest{
		Email:     req.Email,
		Amount:    amountKobo,
		Reference: reference,
		// manual_id in the callback URL is how the confirmation page knows to
		// finalize a manual purchase record (not just mark the payment
		// completed) once Paystack redirects the student back — the generic
		// /payments/checkout flow has no notion of manuals at all.
		CallbackURL: fmt.Sprintf("%s/payments/confirmation?manual_id=%s", server.config.FrontendPublicURL, manualID.String()),
		Metadata: payment.Metadata{
			"payment_id": paymentRecord.ID.String(),
			"student_id": studentID.String(),
			"manual_id":  manualID.String(),
		},
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "checkout initialized",
		"data": gin.H{
			"authorization_url": resp.Data.AuthorizationURL,
			"reference":         resp.Data.Reference,
			"payment_id":        paymentRecord.ID,
		},
	})
}

// ─── Purchase Manual (Student) ───

func (server *Server) purchaseManual(ctx *gin.Context) {
	var req purchaseManualRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	manualID, err := uuid.Parse(req.ManualID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual_id"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Check if already purchased
	purchased, _ := queries.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: studentID,
		ManualID:  manualID,
	})
	if purchased {
		ctx.JSON(http.StatusConflict, gin.H{"error": "manual already purchased"})
		return
	}

	// Verify the manual exists
	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "manual not found"})
		return
	}

	// Optional payment_id for linking to a payment record.
	var paymentIDPtr *uuid.UUID
	if req.PaymentID != nil {
		payID, err := uuid.Parse(*req.PaymentID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment_id"})
			return
		}
		paymentIDPtr = &payID
	}

	if !manual.Price.IsZero() {
		paid, err := queries.HasCompletedPaymentForManual(ctx, db.HasCompletedPaymentForManualParams{
			StudentID: studentID,
			ManualID:  manualID,
			PaymentID: paymentIDPtr,
		})
		if err != nil || !paid {
			ctx.JSON(http.StatusPaymentRequired, gin.H{"error": "payment required before purchasing this manual"})
			return
		}
	}

	// Fetch student profile for QR data
	student, err := queries.GetStudentByUserIDFull(ctx, getUserID(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch student profile"})
		return
	}

	// Generate QR payload
	userID := getUserID(ctx)
	qrPayload, _ := utils.GenerateManualQRPayload(utils.ManualQRPayloadInput{
		StudentID: studentID,
		RegNo:     student.MatricNumber,
		ManualID:  manualID,
	}, []byte(server.config.ManualQRSecret))
	qrCodeImageURL, _ := utils.GenerateQRCodeImage(qrPayload)

	var paymentID pgtype.UUID
	if paymentIDPtr != nil {
		paymentID = pgtype.UUID{Bytes: *paymentIDPtr, Valid: true}
	}

	purchase, err := server.manuals.Purchase(ctx, db.CreateManualPurchaseParams{
		StudentID:  studentID,
		ManualID:   manualID,
		PaymentID:  paymentID,
		QrCodeData: &qrPayload,
		QrCodeUrl:  &qrCodeImageURL,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Fetch user name for response
	user, _ := server.users.GetByID(ctx, userID)

	ctx.JSON(http.StatusCreated, gin.H{
		"id":             purchase.ID,
		"student_id":     studentID,
		"manual_id":      manualID,
		"qr_code_data":   qrPayload,
		"qr_code_url":    qrCodeImageURL,
		"is_collected":   purchase.IsCollected,
		"purchased_at":   purchase.PurchasedAt,
		"student_name":   user.FullName,
		"matric_number":  student.MatricNumber,
	})
}

// ─── My Purchases (Student) ───

func (server *Server) listMyPurchases(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	purchases, err := server.manuals.ListStudentPurchases(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	type purchaseResp struct {
		ID           string  `json:"id"`
		ManualID     string  `json:"manual_id"`
		ManualTitle  string  `json:"manual_title"`
		ManualLevel  int32   `json:"manual_level"`
		Price        float64 `json:"price"`
		IsCollected  bool    `json:"is_collected"`
		CollectedAt  *string `json:"collected_at"`
		PurchasedAt  string  `json:"purchased_at"`
		QRCodeData   *string `json:"qr_code_data"`
		QRCodeURL    *string `json:"qr_code_url"`
	}

	var result []purchaseResp
	for _, p := range purchases {
		r := purchaseResp{
			ID:          p.ID.String(),
			ManualID:    p.ManualID.String(),
			ManualTitle: p.Title,
			ManualLevel: p.Level,
			Price:       p.Price.InexactFloat64(),
			IsCollected: p.IsCollected,
			PurchasedAt: p.PurchasedAt.Time.Format(time.RFC3339),
			QRCodeData:  p.QrCodeData,
			QRCodeURL:   p.QrCodeUrl,
		}
		if p.CollectedAt.Valid {
			s := p.CollectedAt.Time.Format(time.RFC3339)
			r.CollectedAt = &s
		}
		result = append(result, r)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

// ─── List Purchases by Manual (Admin) ───

func (server *Server) listManualPurchasesByManual(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	purchases, err := server.manuals.ListPurchasesByManual(ctx, manualID, 200, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": purchases})
}

// ─── Mark Manual Collected (Admin) ───

func (server *Server) markManualCollected(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	purchase, err := server.manuals.MarkCollected(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, purchase)
}

// ─── QR Verify (Student scans QR) ───

func (server *Server) verifyManualQR(ctx *gin.Context) {
	var req qrVerifyRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	payload, err := utils.VerifyManualQRPayload(req.QRData, []byte(server.config.ManualQRSecret))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid_qr", "message": err.Error()})
		return
	}

	// Verify identity
	if payload.StudentID != studentID {
		ctx.JSON(http.StatusForbidden, gin.H{"success": false, "error": "identity_mismatch", "message": "This QR code was issued to a different student"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	// Find purchase by student_id + manual_id
	purchases, err := server.manuals.ListStudentPurchases(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not list purchases"})
		return
	}

	var foundPurchase *db.ListStudentManualPurchasesRow
	for i := range purchases {
		if purchases[i].ManualID == payload.ManualID {
			foundPurchase = &purchases[i]
			break
		}
	}
	if foundPurchase == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "purchase_not_found", "message": "No purchase found for this manual"})
		return
	}

	if !foundPurchase.IsCollected {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "not_collected", "message": "Manual has not been collected yet"})
		return
	}

	// Fetch course details from manual
	manual, err := queries.GetManual(ctx, payload.ManualID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "manual not found"})
		return
	}

	courseID := manual.CourseID
	if !courseID.Valid {
		ctx.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "no_course", "message": "Manual is not linked to a course"})
		return
	}

	sessionID := manual.SessionID
	if !sessionID.Valid {
		// Use a nil UUID for session if not set
		sessionID = pgtype.UUID{Bytes: uuid.Nil, Valid: false}
	}

	enrollment, err := server.manuals.EnrollPractical(ctx, db.CreatePracticalEnrollmentParams{
		StudentID:   studentID,
		CourseID:    courseID.Bytes,
		SessionID:   uuid.UUID(sessionID.Bytes),
		EnrolledVia: "qr_scan",
	})
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"success": false, "error": "already_enrolled", "message": err.Error()})
		return
	}

	course, _ := queries.GetCourse(ctx, courseID.Bytes)

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Enrolled successfully",
		"enrollment": practicalEnrollmentResponse{
			ID:          enrollment.ID.String(),
			StudentID:   enrollment.StudentID.String(),
			CourseID:    uuid.UUID(courseID.Bytes).String(),
			CourseCode:  course.Code,
			CourseTitle: course.Title,
			EnrolledVia: enrollment.EnrolledVia,
			EnrolledAt:  enrollment.EnrolledAt.Time.Format(time.RFC3339),
		},
	})
}

// ─── List Practical Enrollments (Student) ───

func (server *Server) listMyPracticalEnrollments(ctx *gin.Context) {
	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	rows, err := queries.ListStudentPracticalEnrollments(ctx, studentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var result []practicalEnrollmentResponse
	for _, r := range rows {
		result = append(result, practicalEnrollmentResponse{
			ID:          r.ID.String(),
			StudentID:   r.StudentID.String(),
			CourseID:    r.CourseID.String(),
			CourseCode:  r.CourseCode,
			CourseTitle: r.CourseTitle,
			EnrolledVia: r.EnrolledVia,
			EnrolledAt:  r.EnrolledAt.Time.Format(time.RFC3339),
		})
	}

	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

// ─── Enroll Practical (Manual) ───

func (server *Server) enrollPractical(ctx *gin.Context) {
	var req struct {
		CourseID  string `json:"course_id" binding:"required"`
		SessionID string `json:"session_id" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "internal server error"})
		return
	}

	studentID, err := server.getStudentIDFromUser(ctx)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "internal server error"})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid course_id"})
		return
	}

	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid session_id"})
		return
	}

	enrollment, err := server.manuals.EnrollPractical(ctx, db.CreatePracticalEnrollmentParams{
		StudentID:   studentID,
		CourseID:    courseID,
		SessionID:   sessionID,
		EnrolledVia: "manual",
	})
	if err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, enrollment)
}

// ─── Generate Cover PDF (Student downloads personalized cover, Admin can also download) ───

// buildCoverInputForPurchase resolves everything GenerateManualCover needs
// (student, course, session) for one manual purchase. Shared by the
// single-purchase and bulk-download handlers so the two can't drift.
func (server *Server) buildCoverInputForPurchase(ctx *gin.Context, queries *db.Queries, studentID, manualID uuid.UUID, qrCodeData *string) (utils.CoverPageInput, error) {
	manual, err := queries.GetManual(ctx, manualID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("manual not found: %w", err)
	}

	student, err := queries.GetStudent(ctx, studentID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("student profile not found: %w", err)
	}

	user, err := server.users.GetByID(ctx, student.UserID)
	if err != nil {
		return utils.CoverPageInput{}, fmt.Errorf("user not found: %w", err)
	}

	courseCode := "N/A"
	courseTitle := "N/A"
	if manual.CourseID.Valid {
		if course, err := queries.GetCourse(ctx, manual.CourseID.Bytes); err == nil {
			courseCode = course.Code
			courseTitle = course.Title
		}
	}

	sessionName := "2025/2026"
	semesterName := "Second Semester"
	if manual.SessionID.Valid {
		if sess, err := queries.GetSession(ctx, uuid.UUID(manual.SessionID.Bytes)); err == nil {
			sessionName = sess.Name
		}
	}

	return utils.CoverPageInput{
		StudentName: user.FullName,
		RegNo:       student.MatricNumber,
		Department:  "Computer Engineering",
		Level:       int(manual.Level),
		CourseCode:  courseCode,
		CourseTitle: courseTitle,
		Session:     sessionName,
		Semester:    semesterName,
		QRCodeData:  qrCodeData,
	}, nil
}

// downloadManualReceipt GET /manuals/purchases/:id/receipt
// Student-facing proof of purchase — deliberately separate from the cover
// page (which carries a QR code meant for admin print/collection handling,
// not something a student needs to see or print themselves).
func (server *Server) downloadManualReceipt(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchase, err := queries.GetManualPurchase(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "purchase not found"})
		return
	}

	if !isStaffCaller(ctx) {
		studentID, err := server.getStudentIDFromUser(ctx)
		if err != nil || purchase.StudentID != studentID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "not your purchase"})
			return
		}
	}

	manual, err := queries.GetManual(ctx, purchase.ManualID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "manual not found"})
		return
	}

	student, err := queries.GetStudent(ctx, purchase.StudentID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "student profile not found"})
		return
	}

	user, err := server.users.GetByID(ctx, student.UserID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "user not found"})
		return
	}

	amount := manual.Price
	reference := purchase.ID.String()
	if purchase.PaymentID.Valid {
		if p, err := queries.GetPayment(ctx, purchase.PaymentID.Bytes); err == nil {
			amount = p.Amount
			if p.PaystackReference != nil && *p.PaystackReference != "" {
				reference = *p.PaystackReference
			}
		}
	}

	date := "N/A"
	if purchase.PurchasedAt.Valid {
		date = purchase.PurchasedAt.Time.Format("2 Jan 2006")
	}

	pdfBytes, err := utils.GenerateReceipt(utils.ReceiptInput{
		StudentName: user.FullName,
		RegNo:       student.MatricNumber,
		ItemName:    manual.Title,
		Amount:      amount.StringFixed(2),
		Reference:   reference,
		Date:        date,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=receipt-%s.pdf", purchaseID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (server *Server) downloadManualCover(ctx *gin.Context) {
	purchaseID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchase, err := queries.GetManualPurchase(ctx, purchaseID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "purchase not found"})
		return
	}

	// Students can only download their own cover; staff/admin can download any.
	if !isStaffCaller(ctx) {
		studentID, err := server.getStudentIDFromUser(ctx)
		if err != nil || purchase.StudentID != studentID {
			ctx.JSON(http.StatusForbidden, gin.H{"error": "not your purchase"})
			return
		}
	}

	input, err := server.buildCoverInputForPurchase(ctx, queries, purchase.StudentID, purchase.ManualID, purchase.QrCodeData)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	pdfBytes, err := utils.GenerateManualCover(input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=manual-cover-%s.pdf", purchaseID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// bulkDownloadManualCovers GET /manuals/:id/covers/bulk
// Generates one combined multi-page PDF with every purchaser's cover page
// for the given manual, so staff can print a whole class's covers in one go
// instead of downloading each purchase's cover individually.
func (server *Server) bulkDownloadManualCovers(ctx *gin.Context) {
	manualID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid manual ID"})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "database not available"})
		return
	}

	purchases, err := server.manuals.ListPurchasesByManual(ctx, manualID, 500, 0)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Once a batch is printed those purchases flip to collected and drop out
	// of this list — the same is_collected flag the print-queue/collection
	// flow already uses — so re-running this never regenerates and hands out
	// duplicate covers for someone already printed. A purchase that needs a
	// second copy (lost cover, printer jam) is a deliberate reprint via the
	// single-purchase cover download instead, not this bulk button.
	pending := make([]db.ListManualPurchasesByManualRow, 0, len(purchases))
	for _, p := range purchases {
		if !p.IsCollected {
			pending = append(pending, p)
		}
	}
	if len(pending) == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no unprinted purchases for this manual — everyone already has a printed cover"})
		return
	}

	inputs := make([]utils.CoverPageInput, 0, len(pending))
	printed := make([]uuid.UUID, 0, len(pending))
	for _, p := range pending {
		input, err := server.buildCoverInputForPurchase(ctx, queries, p.StudentID, p.ManualID, p.QrCodeData)
		if err != nil {
			continue
		}
		inputs = append(inputs, input)
		printed = append(printed, p.ID)
	}
	if len(inputs) == 0 {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "could not resolve any purchase covers"})
		return
	}

	pdfBytes, err := utils.GenerateManualCoverBatch(inputs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	for _, purchaseID := range printed {
		if _, err := queries.MarkManualCollected(ctx, purchaseID); err != nil {
			log.Printf("[bulk-cover] failed to mark purchase %s collected: %v", purchaseID, err)
		}
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=manual-covers-%s.pdf", manualID))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}


```

### `backend/internal/service/manual_service.go`
```go
package service

import (
	"context"
	"errors"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/google/uuid"
)

type ManualService struct {
	store db.Querier
}

func NewManualService(store db.Querier) *ManualService {
	return &ManualService{store: store}
}

func (s *ManualService) Create(ctx context.Context, params db.CreateManualParams) (db.Manual, error) {
	return s.store.CreateManual(ctx, params)
}

func (s *ManualService) GetByID(ctx context.Context, id uuid.UUID) (db.Manual, error) {
	return s.store.GetManual(ctx, id)
}

func (s *ManualService) List(ctx context.Context, limit, offset int32) ([]db.Manual, error) {
	return s.store.ListManuals(ctx, db.ListManualsParams{Limit: limit, Offset: offset})
}

func (s *ManualService) ListByLevel(ctx context.Context, level int32) ([]db.Manual, error) {
	return s.store.ListManualsByLevel(ctx, level)
}

func (s *ManualService) Update(ctx context.Context, params db.UpdateManualParams) (db.Manual, error) {
	return s.store.UpdateManual(ctx, params)
}

func (s *ManualService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.store.DeleteManual(ctx, id)
}

func (s *ManualService) Purchase(ctx context.Context, params db.CreateManualPurchaseParams) (db.ManualPurchase, error) {
	purchased, err := s.store.CheckManualPurchased(ctx, db.CheckManualPurchasedParams{
		StudentID: params.StudentID,
		ManualID:  params.ManualID,
	})
	if err == nil && purchased {
		return db.ManualPurchase{}, errors.New("manual already purchased")
	}
	return s.store.CreateManualPurchase(ctx, params)
}

func (s *ManualService) ListStudentPurchases(ctx context.Context, studentID uuid.UUID) ([]db.ListStudentManualPurchasesRow, error) {
	return s.store.ListStudentManualPurchases(ctx, studentID)
}

func (s *ManualService) ListPurchasesByManual(ctx context.Context, manualID uuid.UUID, limit, offset int32) ([]db.ListManualPurchasesByManualRow, error) {
	return s.store.ListManualPurchasesByManual(ctx, db.ListManualPurchasesByManualParams{
		ManualID: manualID, Limit: limit, Offset: offset,
	})
}

func (s *ManualService) MarkCollected(ctx context.Context, id uuid.UUID) (db.ManualPurchase, error) {
	return s.store.MarkManualCollected(ctx, id)
}

func (s *ManualService) EnrollPractical(ctx context.Context, params db.CreatePracticalEnrollmentParams) (db.PracticalEnrollment, error) {
	enrolled, err := s.store.CheckPracticalEnrolled(ctx, db.CheckPracticalEnrolledParams{
		StudentID: params.StudentID, CourseID: params.CourseID, SessionID: params.SessionID,
	})
	if err == nil && enrolled {
		return db.PracticalEnrollment{}, errors.New("already enrolled in this practical")
	}
	return s.store.CreatePracticalEnrollment(ctx, params)
}
```

### `backend/internal/utils/manual_printer.go`
```go
package utils

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"strings"

	"github.com/skip2/go-qrcode"
)

// uniuyoLogoPNG is the University of Uyo crest, rasterized once from the
// official SVG (download.svg -> assets/uniuyo_logo.png @ 400x400, white bg)
// and baked into the binary. Re-generate with:
//
//	rsvg-convert -w 400 -h 400 -b white download.svg -o assets/uniuyo_logo.png
//
//go:embed assets/uniuyo_logo.png
var uniuyoLogoPNG []byte

// CoverPageInput holds all data needed to generate a lab manual cover PDF.
type CoverPageInput struct {
	StudentName string
	RegNo       string
	Department  string
	Level       int
	CourseCode  string
	CourseTitle string
	Session     string // e.g. "2025/2026"
	Semester    string // e.g. "Second Semester"
	QRCodeData  *string
}

// GenerateManualCover produces a PDF/1.4 A4 cover page matching the physical
// University of Uyo lab manual cover used by the Dept. of Computer Engineering.
func GenerateManualCover(input CoverPageInput) ([]byte, error) {
	return GenerateManualCoverBatch([]CoverPageInput{input})
}

// resolveSessionSemester applies the same session/semester fallback defaults
// used by every cover page, single or batched.
func resolveSessionSemester(input CoverPageInput) string {
	sessionLabel := input.Session
	if sessionLabel == "" {
		sessionLabel = "2025/2026"
	}
	semesterLabel := input.Semester
	if semesterLabel == "" {
		semesterLabel = "Second Semester"
	}
	return sessionLabel + " \u00b7 " + semesterLabel
}

// GenerateManualCoverBatch produces a single multi-page PDF/1.4 document with
// one cover page per input, in order — so an admin can print an entire
// class's covers from one file instead of downloading them one at a time.
// The Helvetica/Times fonts and the university crest are shared XObjects
// referenced by every page rather than duplicated per page, so file size
// scales with page count, not with page count times asset size.
func GenerateManualCoverBatch(inputs []CoverPageInput) ([]byte, error) {
	if len(inputs) == 0 {
		return nil, fmt.Errorf("no covers to generate")
	}

	logoW, logoH, logoJPEG, err := encodeLogoJPEG()
	if err != nil {
		return nil, fmt.Errorf("encode logo: %w", err)
	}

	var buf bytes.Buffer
	objs := []string{}
	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	catalogIdx := addObj("") // patched once the Pages object index is known
	pagesIdx := addObj("")   // patched once every page's object index is known

	f1Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	f2Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
	f3Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>")
	f4Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>")
	imageIdx := addObj(fmt.Sprintf(
		"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
		logoW, logoH, len(logoJPEG), string(logoJPEG),
	))

	pageIdxs := make([]int, 0, len(inputs))
	for _, input := range inputs {
		sessionSemester := resolveSessionSemester(input)

		var qrMatrix [][]bool
		if input.QRCodeData != nil && *input.QRCodeData != "" {
			if qc, qrErr := qrcode.New(*input.QRCodeData, qrcode.Medium); qrErr == nil {
				qrMatrix = qc.Bitmap()
			}
		}

		content := buildCoverContent(input, sessionSemester, qrMatrix)
		contentIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))
		pageIdx := addObj(fmt.Sprintf(
			"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R /F2 %d 0 R /F3 %d 0 R /F4 %d 0 R >> /XObject << /Im1 %d 0 R >> >> >>",
			pagesIdx, contentIdx, f1Idx, f2Idx, f3Idx, f4Idx, imageIdx,
		))
		pageIdxs = append(pageIdxs, pageIdx)
	}

	kidsRefs := make([]string, len(pageIdxs))
	for i, idx := range pageIdxs {
		kidsRefs[i] = fmt.Sprintf("%d 0 R", idx)
	}
	objs[pagesIdx-1] = fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kidsRefs, " "), len(pageIdxs))
	objs[catalogIdx-1] = fmt.Sprintf("<< /Type /Catalog /Pages %d 0 R >>", pagesIdx)

	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs))
	for i, body := range objs {
		offsets[i] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, body))
	}

	xrefOff := buf.Len()
	n := len(objs) + 1
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", n))
	buf.WriteString("0000000000 65535 f \n")
	for _, off := range offsets {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", off))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n", n, catalogIdx, xrefOff))

	return buf.Bytes(), nil
}

// encodeLogoJPEG decodes the embedded PNG crest and re-encodes it as JPEG
// (DCTDecode), which PDF viewers can embed as an Image XObject with no
// extra decode filters needed.
func encodeLogoJPEG() (w, h int, data []byte, err error) {
	img, _, decErr := image.Decode(bytes.NewReader(uniuyoLogoPNG))
	if decErr != nil {
		return 0, 0, nil, decErr
	}
	var buf bytes.Buffer
	if encErr := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 92}); encErr != nil {
		return 0, 0, nil, encErr
	}
	b := img.Bounds()
	return b.Dx(), b.Dy(), buf.Bytes(), nil
}

// mm converts millimeters to PDF points (1mm = 2.83465pt), matching the
// spec's measurements exactly rather than eyeballed point values.
func mm(v float64) float64 { return v * 2.83465 }

func buildCoverContent(input CoverPageInput, sessionSemester string, qrMatrix [][]bool) string {
	var txt strings.Builder // BT...ET text block
	var gfx strings.Builder // graphics operators (outside BT/ET)

	const (
		pageW   = 595.0
		pageH   = 842.0
		centerX = pageW / 2
	)

	leftMargin := mm(22)        // spec: left margin 22mm
	rightEdge := pageW - mm(22) // spec: right margin 22mm

	// gapScale stretches the header/title cascade (logo through the NAME
	// field) so the content fills more of the page instead of leaving a
	// large blank strip at the bottom. It deliberately does NOT apply to the
	// NAME/REG.NO/DEPARTMENT/SESSION field spacing below — those are meant
	// to stay as tight, literal 12mm/4mm form-field gaps per spec; scaling
	// them too pushed "2025/2026 · Second Semester" completely off the page.
	const gapScale = 2.26
	g := func(v float64) float64 { return mm(v * gapScale) }

	// ── Logo: 23mm square, 9mm below the top margin ─────────────────────────
	logoSize := mm(23)
	logoTop := pageH - mm(9)
	logoBottom := logoTop - logoSize
	{
		logoX := centerX - logoSize/2
		gfx.WriteString("q\n")
		gfx.WriteString(fmt.Sprintf("%.2f 0 0 %.2f %.2f %.2f cm\n", logoSize, logoSize, logoX, logoBottom))
		gfx.WriteString("/Im1 Do\n")
		gfx.WriteString("Q\n")
	}

	// ── Vertical cascade — header/title gaps scaled, field gaps literal ────
	uniY := logoBottom - g(5)              // logo -> university name: 5mm (scaled)
	facultyY := uniY - g(3)                // university -> faculty: 3mm (scaled)
	deptY := facultyY - g(5)               // faculty -> department: 5mm (scaled)
	labManualY := deptY - g(17)            // department -> "laboratory manual for": 17mm (scaled)
	courseCodeY := labManualY - g(14)      // -> course code: 14mm (scaled)
	courseTitleY := courseCodeY - g(2.5)   // -> course title: 2.5mm (scaled)
	studentIDY := courseTitleY - g(22)     // -> "student's identification": 22mm (scaled)
	nameY := studentIDY - g(14)            // -> NAME field: 14mm (scaled)
	regY := nameY - mm(12)                 // NAME -> REG. NO: 12mm (literal)
	deptFieldY := regY - mm(12)            // REG. NO -> DEPARTMENT: 12mm (literal)
	levelFieldY := deptFieldY - mm(12)     // DEPARTMENT -> LEVEL: 12mm (literal)
	sessionLabelY := levelFieldY - mm(12)  // LEVEL -> SESSION-SEMESTER: 12mm (literal)
	sessionValueY := sessionLabelY - mm(4) // label -> value: 4mm (literal)

	txt.WriteString("BT\n")

	pdfCentered(&txt, centerX, uniY, 19, "F4", "UNIVERSITY OF UYO")                     // Times-Bold 19pt
	pdfCentered(&txt, centerX, facultyY, 10.5, "F3", "FACULTY OF ENGINEERING")          // Times-Roman 10.5pt
	pdfCentered(&txt, centerX, deptY, 14.5, "F4", "DEPARTMENT OF COMPUTER ENGINEERING") // Times-Bold 14.5pt

	pdfCentered(&txt, centerX, labManualY, 11.5, "F1", "LABORATORY MANUAL FOR")              // Arial (Helvetica) 11.5pt
	pdfCentered(&txt, centerX, courseCodeY, 30, "F4", input.CourseCode)                      // Times-Bold 30pt
	pdfCentered(&txt, centerX, courseTitleY, 14.5, "F2", strings.ToUpper(input.CourseTitle)) // Arial Bold 14.5pt

	pdfCentered(&txt, centerX, studentIDY, 11.5, "F3", "STUDENT'S IDENTIFICATION") // Times-Roman 11.5pt

	// ── Two-column split begins here ────────────────────────────────────────
	// QR block: 34mm square + reg-no + verification text inside one bordered
	// box, right-aligned to the right margin. Left column's field lines stop
	// ~22mm short of it (spec: "left info block -> QR block: 20-25mm").
	qrSize := mm(34)
	outerBoxW := qrSize + mm(5) // small padding either side of the QR square
	outerBoxX := rightEdge - outerBoxW
	fieldUnderW := outerBoxX - mm(28) - leftMargin // line stops ~22mm before the box

	fieldLabelX := leftMargin
	fieldValueX := leftMargin + mm(28)

	pdfAt(&txt, fieldLabelX, nameY, 10.5, "F2", "NAME:")
	pdfAt(&txt, fieldValueX, nameY, 10.5, "F1", input.StudentName)

	pdfAt(&txt, fieldLabelX, regY, 10.5, "F2", "REG. NO:")
	pdfAt(&txt, fieldValueX, regY, 10.5, "F1", input.RegNo)

	pdfAt(&txt, fieldLabelX, deptFieldY, 10.5, "F2", "DEPARTMENT:")
	pdfAt(&txt, fieldValueX, deptFieldY, 10.5, "F1", input.Department)

	pdfAt(&txt, fieldLabelX, levelFieldY, 10.5, "F2", "LEVEL:")
	pdfAt(&txt, fieldValueX, levelFieldY, 10.5, "F1", pdfSafe(fmt.Sprintf("%dL", input.Level)))

	// Session/Semester — no line, just label then value directly underneath.
	pdfAt(&txt, fieldLabelX, sessionLabelY, 10.5, "F2", "SESSION\u00b7SEMESTER:")
	pdfAt(&txt, fieldLabelX, sessionValueY, 12, "F1", sessionSemester)

	// ── QR box internal layout (top to bottom): reg-no, QR, verification ───
	outerBoxTop := nameY + mm(6)
	regNoBaseline := outerBoxTop - mm(6) - 6.8 // padding + ascent for 8.5pt text
	qrTop := regNoBaseline - 2 - mm(2)
	qrBottom := qrTop - qrSize
	verif1Y := qrBottom - mm(2) - 6
	verif2Y := verif1Y - 9
	outerBoxBottom := verif2Y - 2 - mm(3)
	outerBoxH := outerBoxTop - outerBoxBottom

	// Registration number, right-aligned within the box (spec: "Right
	// aligned within the QR section").
	regNoText := input.RegNo
	regNoW := textWidth(regNoText, "F1", 8.5)
	pdfAt(&txt, outerBoxX+outerBoxW-mm(2)-regNoW, regNoBaseline, 8.5, "F1", regNoText)

	// Verification text, centered under the QR.
	pdfCenteredBetween(&txt, outerBoxX, outerBoxX+outerBoxW, verif1Y, 7.5, "F1", "Scan to Verify")
	pdfCenteredBetween(&txt, outerBoxX, outerBoxX+outerBoxW, verif2Y, 7.5, "F1", "Submission \u00b7 Payment \u00b7 Identity")

	txt.WriteString("ET\n")

	// ── Graphics: field underlines (0.6pt, spec) ────────────────────────────
	gfx.WriteString("0.6 w\n")
	for _, fy := range []float64{nameY, regY, deptFieldY, levelFieldY} {
		ly := fy - 4
		gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", fieldLabelX, ly))
		gfx.WriteString(fmt.Sprintf("%.2f %.2f l\n", fieldLabelX+fieldUnderW, ly))
		gfx.WriteString("S\n")
	}

	// ── Graphics: single border enclosing reg-no + QR + verification text ──
	gfx.WriteString("0.6 w\n")
	gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\nS\n", outerBoxX, outerBoxBottom, outerBoxW, outerBoxH))

	// ── Graphics: QR code as vector grid, centered in the box ───────────────
	qrX := outerBoxX + (outerBoxW-qrSize)/2
	if qrMatrix != nil && len(qrMatrix) > 0 {
		size := len(qrMatrix)
		gfx.WriteString("1 g\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re f\n", qrX, qrBottom, qrSize, qrSize))
		gfx.WriteString("0 g\n")

		quietZone := 4
		modules := size - 2*quietZone
		if modules < 1 {
			quietZone = 0
			modules = size
		}
		cellSize := qrSize / float64(modules)

		for row := 0; row < modules; row++ {
			for col := 0; col < modules; col++ {
				srcRow := row + quietZone
				srcCol := col + quietZone
				if srcRow >= size || srcCol >= size {
					continue
				}
				if qrMatrix[srcRow][srcCol] {
					px := qrX + float64(col)*cellSize
					py := qrBottom + float64(modules-1-row)*cellSize
					gfx.WriteString(fmt.Sprintf("%.3f %.3f %.3f %.3f re f\n",
						px, py, cellSize, cellSize))
				}
			}
		}
	} else {
		gfx.WriteString("0.6 w\n")
		gfx.WriteString(fmt.Sprintf("%.2f %.2f %.2f %.2f re\nS\n", qrX, qrBottom, qrSize, qrSize))
	}

	return gfx.String() + txt.String()
}

// pdfSafe escapes PDF string literal special characters.
func pdfSafe(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r < 128 {
			switch r {
			case '(':
				b.WriteString("\\(")
			case ')':
				b.WriteString("\\)")
			case '\\':
				b.WriteString("\\\\")
			default:
				b.WriteRune(r)
			}
		} else if r < 256 {
			// Latin-1 supplement (includes middle dot U+00B7) — octal escape
			b.WriteString(fmt.Sprintf("\\%03o", r))
		}
	}
	return b.String()
}

// pdfCentered places text centered horizontally at centerX, using real
// Helvetica/Helvetica-Bold glyph metrics (not a rough per-character guess)
// so headings land dead-center instead of drifting.
func pdfCentered(b *strings.Builder, centerX, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	x := centerX - w/2
	pdfAt(b, x, y, size, font, text)
}

// pdfCenteredBetween centers text between x1 and x2.
func pdfCenteredBetween(b *strings.Builder, x1, x2, y, size float64, font, text string) {
	w := textWidth(text, font, size)
	cx := (x1 + x2) / 2
	pdfAt(b, cx-w/2, y, size, font, text)
}

// pdfAt emits PDF operators to render text at absolute position (x, y).
// Escaping is applied here, once, so callers (and width calculations done
// by pdfCentered/pdfCenteredBetween) always work with the real text.
func pdfAt(b *strings.Builder, x, y, size float64, font, text string) {
	b.WriteString(fmt.Sprintf("/%s %g Tf\n", font, size))
	b.WriteString(fmt.Sprintf("1 0 0 1 %.2f %.2f Tm\n", x, y))
	b.WriteString(fmt.Sprintf("(%s) Tj\n", pdfSafe(text)))
}

// textWidth computes the rendered width (in points) of text set in the
// given font ("F1"=Helvetica, "F2"=Helvetica-Bold, "F3"=Times-Roman,
// "F4"=Times-Bold) at the given size, using standard AFM glyph widths
// (per 1000 em units).
func textWidth(text string, font string, size float64) float64 {
	var widths map[rune]float64
	switch font {
	case "F2":
		widths = helveticaBoldWidths
	case "F3":
		widths = timesRomanWidths
	case "F4":
		widths = timesBoldWidths
	default:
		widths = helveticaWidths
	}
	total := 0.0
	for _, r := range text {
		w, ok := widths[r]
		if !ok {
			w = 500
		}
		total += w
	}
	return total / 1000.0 * size
}

// Standard Times-Roman AFM widths (per 1000 em units).
var timesRomanWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, '\'': 180,
	'(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
	'@': 921,
	'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722, 'H': 722,
	'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722, 'P': 556,
	'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944, 'X': 722,
	'Y': 722, 'Z': 611,
	'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 333, 'g': 500, 'h': 500,
	'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500, 'p': 500,
	'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '\u00b7': 250,
}

// Standard Times-Bold AFM widths (per 1000 em units).
var timesBoldWidths = map[rune]float64{
	' ': 250, '!': 333, '"': 555, '#': 500, '$': 500, '%': 1000, '&': 833, '\'': 278,
	'(': 333, ')': 333, '*': 500, '+': 570, ',': 250, '-': 333, '.': 250, '/': 278,
	'0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
	'8': 500, '9': 500, ':': 333, ';': 333, '<': 570, '=': 570, '>': 570, '?': 500,
	'@': 930,
	'A': 722, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 778,
	'I': 389, 'J': 500, 'K': 778, 'L': 667, 'M': 944, 'N': 722, 'O': 778, 'P': 611,
	'Q': 778, 'R': 722, 'S': 556, 'T': 667, 'U': 722, 'V': 722, 'W': 1000, 'X': 722,
	'Y': 722, 'Z': 667,
	'a': 500, 'b': 556, 'c': 444, 'd': 556, 'e': 444, 'f': 333, 'g': 500, 'h': 556,
	'i': 278, 'j': 333, 'k': 556, 'l': 278, 'm': 833, 'n': 556, 'o': 500, 'p': 556,
	'q': 556, 'r': 444, 's': 389, 't': 333, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 444, '\u00b7': 250,
}

// Standard Helvetica AFM widths (per 1000 em units).
var helveticaWidths = map[rune]float64{
	' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, '\'': 191,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
	'@': 1015,
	'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556,
	'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
	'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
	'y': 500, 'z': 500,
}

// Standard Helvetica-Bold AFM widths (per 1000 em units).
var helveticaBoldWidths = map[rune]float64{
	' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, '\'': 238,
	'(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
	'0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
	'8': 556, '9': 556, ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611,
	'@': 975,
	'A': 722, 'B': 722, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
	'I': 278, 'J': 556, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 778, 'P': 667,
	'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
	'Y': 667, 'Z': 611,
	'a': 556, 'b': 611, 'c': 556, 'd': 611, 'e': 556, 'f': 333, 'g': 611, 'h': 611,
	'i': 278, 'j': 278, 'k': 556, 'l': 278, 'm': 889, 'n': 611, 'o': 611, 'p': 611,
	'q': 611, 'r': 389, 's': 556, 't': 333, 'u': 611, 'v': 556, 'w': 778, 'x': 556,
	'y': 556, 'z': 500,
}
```

### `backend/internal/db/queries/manuals.sql`
```sql
-- ==================== MANUALS ====================

-- name: CreateManual :one
INSERT INTO manuals (
    title, description, level, price, file_url, cover_image_url, course_id, session_id, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING *;

-- name: GetManual :one
SELECT * FROM manuals
WHERE id = $1 LIMIT 1;

-- name: ListManuals :many
SELECT * FROM manuals
WHERE is_active = true
ORDER BY level, title
LIMIT $1 OFFSET $2;

-- name: ListManualsByLevel :many
SELECT * FROM manuals
WHERE is_active = true AND level = $1
ORDER BY title;

-- name: UpdateManual :one
UPDATE manuals
SET title = $2, description = $3, level = $4, price = $5,
    file_url = $6, cover_image_url = $7, is_active = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteManual :exec
UPDATE manuals SET is_active = false, updated_at = NOW() WHERE id = $1;

-- ==================== MANUAL PURCHASES ====================

-- name: CreateManualPurchase :one
INSERT INTO manual_purchases (
    student_id, manual_id, payment_id, qr_code_data, qr_code_url
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetManualPurchase :one
SELECT * FROM manual_purchases
WHERE id = $1 LIMIT 1;

-- name: ListStudentManualPurchases :many
SELECT mp.*, m.title, m.level, m.price
FROM manual_purchases mp
JOIN manuals m ON mp.manual_id = m.id
WHERE mp.student_id = $1
ORDER BY mp.purchased_at DESC;

-- name: ListManualPurchasesByManual :many
SELECT mp.*, s.matric_number, u.full_name
FROM manual_purchases mp
JOIN students s ON mp.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE mp.manual_id = $1
ORDER BY mp.purchased_at DESC
LIMIT $2 OFFSET $3;

-- name: MarkManualCollected :one
UPDATE manual_purchases
SET is_collected = true, collected_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MarkManualPrinted :one
UPDATE manual_purchases
SET printed_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CheckManualPurchased :one
SELECT EXISTS(
    SELECT 1 FROM manual_purchases
    WHERE student_id = $1 AND manual_id = $2
) AS is_purchased;

-- ==================== MANUAL PRINT QUEUE ====================

-- name: CreatePrintQueueItem :one
INSERT INTO manual_print_queue (
    purchase_id, student_id, manual_id
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: ListPrintQueue :many
SELECT mpq.*, m.title AS manual_title, u.full_name AS student_name, s.matric_number
FROM manual_print_queue mpq
JOIN manuals m ON mpq.manual_id = m.id
JOIN students s ON mpq.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE ($1 = '' OR mpq.status = $1)
ORDER BY mpq.queued_at
LIMIT $2 OFFSET $3;

-- name: UpdatePrintQueueStatus :one
UPDATE manual_print_queue
SET status = $2::varchar, processed_by = $3::uuid,
    printed_at = CASE WHEN $2::varchar = 'ready' THEN NOW() ELSE printed_at END,
    collected_at = CASE WHEN $2::varchar = 'collected' THEN NOW() ELSE collected_at END
WHERE id = $1
RETURNING *;

-- ==================== PRACTICAL ENROLLMENTS ====================

-- name: CreatePracticalEnrollment :one
INSERT INTO practical_enrollments (
    student_id, course_id, manual_purchase_id, session_id, enrolled_via
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING *;

-- name: ListStudentPracticalEnrollments :many
SELECT pe.*, c.code AS course_code, c.title AS course_title
FROM practical_enrollments pe
JOIN courses c ON pe.course_id = c.id
WHERE pe.student_id = $1
ORDER BY pe.enrolled_at DESC;

-- name: CheckPracticalEnrolled :one
SELECT EXISTS(
    SELECT 1 FROM practical_enrollments
    WHERE student_id = $1 AND course_id = $2 AND session_id = $3
) AS is_enrolled;
```

### `backend/internal/db/sql/manuals.sql.go`
```go
// Code generated by sqlc. DO NOT EDIT.
// versions:
//   sqlc v1.31.1
// source: manuals.sql

package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/shopspring/decimal"
)

const checkManualPurchased = `-- name: CheckManualPurchased :one
SELECT EXISTS(
    SELECT 1 FROM manual_purchases
    WHERE student_id = $1 AND manual_id = $2
) AS is_purchased
`

type CheckManualPurchasedParams struct {
	StudentID uuid.UUID `json:"student_id"`
	ManualID  uuid.UUID `json:"manual_id"`
}

func (q *Queries) CheckManualPurchased(ctx context.Context, arg CheckManualPurchasedParams) (bool, error) {
	row := q.db.QueryRow(ctx, checkManualPurchased, arg.StudentID, arg.ManualID)
	var is_purchased bool
	err := row.Scan(&is_purchased)
	return is_purchased, err
}

const checkPracticalEnrolled = `-- name: CheckPracticalEnrolled :one
SELECT EXISTS(
    SELECT 1 FROM practical_enrollments
    WHERE student_id = $1 AND course_id = $2 AND session_id = $3
) AS is_enrolled
`

type CheckPracticalEnrolledParams struct {
	StudentID uuid.UUID `json:"student_id"`
	CourseID  uuid.UUID `json:"course_id"`
	SessionID uuid.UUID `json:"session_id"`
}

func (q *Queries) CheckPracticalEnrolled(ctx context.Context, arg CheckPracticalEnrolledParams) (bool, error) {
	row := q.db.QueryRow(ctx, checkPracticalEnrolled, arg.StudentID, arg.CourseID, arg.SessionID)
	var is_enrolled bool
	err := row.Scan(&is_enrolled)
	return is_enrolled, err
}

const createManual = `-- name: CreateManual :one

INSERT INTO manuals (
    title, description, level, price, file_url, cover_image_url, course_id, session_id, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING id, title, description, level, price, file_url, cover_image_url, course_id, session_id, is_active, created_by, created_at, updated_at
`

type CreateManualParams struct {
	Title         string          `json:"title"`
	Description   *string         `json:"description"`
	Level         int32           `json:"level"`
	Price         decimal.Decimal `json:"price"`
	FileUrl       *string         `json:"file_url"`
	CoverImageUrl *string         `json:"cover_image_url"`
	CourseID      pgtype.UUID     `json:"course_id"`
	SessionID     pgtype.UUID     `json:"session_id"`
	CreatedBy     uuid.UUID       `json:"created_by"`
}

// ==================== MANUALS ====================
func (q *Queries) CreateManual(ctx context.Context, arg CreateManualParams) (Manual, error) {
	row := q.db.QueryRow(ctx, createManual,
		arg.Title,
		arg.Description,
		arg.Level,
		arg.Price,
		arg.FileUrl,
		arg.CoverImageUrl,
		arg.CourseID,
		arg.SessionID,
		arg.CreatedBy,
	)
	var i Manual
	err := row.Scan(
		&i.ID,
		&i.Title,
		&i.Description,
		&i.Level,
		&i.Price,
		&i.FileUrl,
		&i.CoverImageUrl,
		&i.CourseID,
		&i.SessionID,
		&i.IsActive,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const createManualPurchase = `-- name: CreateManualPurchase :one

INSERT INTO manual_purchases (
    student_id, manual_id, payment_id, qr_code_data, qr_code_url
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, student_id, manual_id, payment_id, qr_code_data, qr_code_url, is_collected, collected_at, purchased_at, printed_at
`

type CreateManualPurchaseParams struct {
	StudentID  uuid.UUID   `json:"student_id"`
	ManualID   uuid.UUID   `json:"manual_id"`
	PaymentID  pgtype.UUID `json:"payment_id"`
	QrCodeData *string     `json:"qr_code_data"`
	QrCodeUrl  *string     `json:"qr_code_url"`
}

// ==================== MANUAL PURCHASES ====================
func (q *Queries) CreateManualPurchase(ctx context.Context, arg CreateManualPurchaseParams) (ManualPurchase, error) {
	row := q.db.QueryRow(ctx, createManualPurchase,
		arg.StudentID,
		arg.ManualID,
		arg.PaymentID,
		arg.QrCodeData,
		arg.QrCodeUrl,
	)
	var i ManualPurchase
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.ManualID,
		&i.PaymentID,
		&i.QrCodeData,
		&i.QrCodeUrl,
		&i.IsCollected,
		&i.CollectedAt,
		&i.PurchasedAt,
		&i.PrintedAt,
	)
	return i, err
}

const createPracticalEnrollment = `-- name: CreatePracticalEnrollment :one

INSERT INTO practical_enrollments (
    student_id, course_id, manual_purchase_id, session_id, enrolled_via
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, student_id, course_id, manual_purchase_id, session_id, enrolled_via, enrolled_at
`

type CreatePracticalEnrollmentParams struct {
	StudentID        uuid.UUID   `json:"student_id"`
	CourseID         uuid.UUID   `json:"course_id"`
	ManualPurchaseID pgtype.UUID `json:"manual_purchase_id"`
	SessionID        uuid.UUID   `json:"session_id"`
	EnrolledVia      string      `json:"enrolled_via"`
}

// ==================== PRACTICAL ENROLLMENTS ====================
func (q *Queries) CreatePracticalEnrollment(ctx context.Context, arg CreatePracticalEnrollmentParams) (PracticalEnrollment, error) {
	row := q.db.QueryRow(ctx, createPracticalEnrollment,
		arg.StudentID,
		arg.CourseID,
		arg.ManualPurchaseID,
		arg.SessionID,
		arg.EnrolledVia,
	)
	var i PracticalEnrollment
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.CourseID,
		&i.ManualPurchaseID,
		&i.SessionID,
		&i.EnrolledVia,
		&i.EnrolledAt,
	)
	return i, err
}

const createPrintQueueItem = `-- name: CreatePrintQueueItem :one

INSERT INTO manual_print_queue (
    purchase_id, student_id, manual_id
) VALUES (
    $1, $2, $3
) RETURNING id, purchase_id, student_id, manual_id, status, queued_at, printed_at, collected_at, processed_by
`

type CreatePrintQueueItemParams struct {
	PurchaseID uuid.UUID `json:"purchase_id"`
	StudentID  uuid.UUID `json:"student_id"`
	ManualID   uuid.UUID `json:"manual_id"`
}

// ==================== MANUAL PRINT QUEUE ====================
func (q *Queries) CreatePrintQueueItem(ctx context.Context, arg CreatePrintQueueItemParams) (ManualPrintQueue, error) {
	row := q.db.QueryRow(ctx, createPrintQueueItem, arg.PurchaseID, arg.StudentID, arg.ManualID)
	var i ManualPrintQueue
	err := row.Scan(
		&i.ID,
		&i.PurchaseID,
		&i.StudentID,
		&i.ManualID,
		&i.Status,
		&i.QueuedAt,
		&i.PrintedAt,
		&i.CollectedAt,
		&i.ProcessedBy,
	)
	return i, err
}

const deleteManual = `-- name: DeleteManual :exec
UPDATE manuals SET is_active = false, updated_at = NOW() WHERE id = $1
`

func (q *Queries) DeleteManual(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteManual, id)
	return err
}

const getManual = `-- name: GetManual :one
SELECT id, title, description, level, price, file_url, cover_image_url, course_id, session_id, is_active, created_by, created_at, updated_at FROM manuals
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetManual(ctx context.Context, id uuid.UUID) (Manual, error) {
	row := q.db.QueryRow(ctx, getManual, id)
	var i Manual
	err := row.Scan(
		&i.ID,
		&i.Title,
		&i.Description,
		&i.Level,
		&i.Price,
		&i.FileUrl,
		&i.CoverImageUrl,
		&i.CourseID,
		&i.SessionID,
		&i.IsActive,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getManualPurchase = `-- name: GetManualPurchase :one
SELECT id, student_id, manual_id, payment_id, qr_code_data, qr_code_url, is_collected, collected_at, purchased_at, printed_at FROM manual_purchases
WHERE id = $1 LIMIT 1
`

func (q *Queries) GetManualPurchase(ctx context.Context, id uuid.UUID) (ManualPurchase, error) {
	row := q.db.QueryRow(ctx, getManualPurchase, id)
	var i ManualPurchase
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.ManualID,
		&i.PaymentID,
		&i.QrCodeData,
		&i.QrCodeUrl,
		&i.IsCollected,
		&i.CollectedAt,
		&i.PurchasedAt,
		&i.PrintedAt,
	)
	return i, err
}

const listManualPurchasesByManual = `-- name: ListManualPurchasesByManual :many
SELECT mp.id, mp.student_id, mp.manual_id, mp.payment_id, mp.qr_code_data, mp.qr_code_url, mp.is_collected, mp.collected_at, mp.purchased_at, mp.printed_at, s.matric_number, u.full_name
FROM manual_purchases mp
JOIN students s ON mp.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE mp.manual_id = $1
ORDER BY mp.purchased_at DESC
LIMIT $2 OFFSET $3
`

type ListManualPurchasesByManualParams struct {
	ManualID uuid.UUID `json:"manual_id"`
	Limit    int32     `json:"limit"`
	Offset   int32     `json:"offset"`
}

type ListManualPurchasesByManualRow struct {
	ID           uuid.UUID          `json:"id"`
	StudentID    uuid.UUID          `json:"student_id"`
	ManualID     uuid.UUID          `json:"manual_id"`
	PaymentID    pgtype.UUID        `json:"payment_id"`
	QrCodeData   *string            `json:"qr_code_data"`
	QrCodeUrl    *string            `json:"qr_code_url"`
	IsCollected  bool               `json:"is_collected"`
	CollectedAt  pgtype.Timestamptz `json:"collected_at"`
	PurchasedAt  pgtype.Timestamptz `json:"purchased_at"`
	PrintedAt    pgtype.Timestamptz `json:"printed_at"`
	MatricNumber string             `json:"matric_number"`
	FullName     string             `json:"full_name"`
}

func (q *Queries) ListManualPurchasesByManual(ctx context.Context, arg ListManualPurchasesByManualParams) ([]ListManualPurchasesByManualRow, error) {
	rows, err := q.db.Query(ctx, listManualPurchasesByManual, arg.ManualID, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListManualPurchasesByManualRow{}
	for rows.Next() {
		var i ListManualPurchasesByManualRow
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.ManualID,
			&i.PaymentID,
			&i.QrCodeData,
			&i.QrCodeUrl,
			&i.IsCollected,
			&i.CollectedAt,
			&i.PurchasedAt,
			&i.PrintedAt,
			&i.MatricNumber,
			&i.FullName,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listManuals = `-- name: ListManuals :many
SELECT id, title, description, level, price, file_url, cover_image_url, course_id, session_id, is_active, created_by, created_at, updated_at FROM manuals
WHERE is_active = true
ORDER BY level, title
LIMIT $1 OFFSET $2
`

type ListManualsParams struct {
	Limit  int32 `json:"limit"`
	Offset int32 `json:"offset"`
}

func (q *Queries) ListManuals(ctx context.Context, arg ListManualsParams) ([]Manual, error) {
	rows, err := q.db.Query(ctx, listManuals, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Manual{}
	for rows.Next() {
		var i Manual
		if err := rows.Scan(
			&i.ID,
			&i.Title,
			&i.Description,
			&i.Level,
			&i.Price,
			&i.FileUrl,
			&i.CoverImageUrl,
			&i.CourseID,
			&i.SessionID,
			&i.IsActive,
			&i.CreatedBy,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listManualsByLevel = `-- name: ListManualsByLevel :many
SELECT id, title, description, level, price, file_url, cover_image_url, course_id, session_id, is_active, created_by, created_at, updated_at FROM manuals
WHERE is_active = true AND level = $1
ORDER BY title
`

func (q *Queries) ListManualsByLevel(ctx context.Context, level int32) ([]Manual, error) {
	rows, err := q.db.Query(ctx, listManualsByLevel, level)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Manual{}
	for rows.Next() {
		var i Manual
		if err := rows.Scan(
			&i.ID,
			&i.Title,
			&i.Description,
			&i.Level,
			&i.Price,
			&i.FileUrl,
			&i.CoverImageUrl,
			&i.CourseID,
			&i.SessionID,
			&i.IsActive,
			&i.CreatedBy,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listPrintQueue = `-- name: ListPrintQueue :many
SELECT mpq.id, mpq.purchase_id, mpq.student_id, mpq.manual_id, mpq.status, mpq.queued_at, mpq.printed_at, mpq.collected_at, mpq.processed_by, m.title AS manual_title, u.full_name AS student_name, s.matric_number
FROM manual_print_queue mpq
JOIN manuals m ON mpq.manual_id = m.id
JOIN students s ON mpq.student_id = s.id
JOIN users u ON s.user_id = u.id
WHERE ($1 = '' OR mpq.status = $1)
ORDER BY mpq.queued_at
LIMIT $2 OFFSET $3
`

type ListPrintQueueParams struct {
	Status string `json:"status"`
	Limit  int32  `json:"limit"`
	Offset int32  `json:"offset"`
}

type ListPrintQueueRow struct {
	ID           uuid.UUID          `json:"id"`
	PurchaseID   uuid.UUID          `json:"purchase_id"`
	StudentID    uuid.UUID          `json:"student_id"`
	ManualID     uuid.UUID          `json:"manual_id"`
	Status       string             `json:"status"`
	QueuedAt     pgtype.Timestamptz `json:"queued_at"`
	PrintedAt    pgtype.Timestamptz `json:"printed_at"`
	CollectedAt  pgtype.Timestamptz `json:"collected_at"`
	ProcessedBy  pgtype.UUID        `json:"processed_by"`
	ManualTitle  string             `json:"manual_title"`
	StudentName  string             `json:"student_name"`
	MatricNumber string             `json:"matric_number"`
}

func (q *Queries) ListPrintQueue(ctx context.Context, arg ListPrintQueueParams) ([]ListPrintQueueRow, error) {
	rows, err := q.db.Query(ctx, listPrintQueue, arg.Status, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListPrintQueueRow{}
	for rows.Next() {
		var i ListPrintQueueRow
		if err := rows.Scan(
			&i.ID,
			&i.PurchaseID,
			&i.StudentID,
			&i.ManualID,
			&i.Status,
			&i.QueuedAt,
			&i.PrintedAt,
			&i.CollectedAt,
			&i.ProcessedBy,
			&i.ManualTitle,
			&i.StudentName,
			&i.MatricNumber,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listStudentManualPurchases = `-- name: ListStudentManualPurchases :many
SELECT mp.id, mp.student_id, mp.manual_id, mp.payment_id, mp.qr_code_data, mp.qr_code_url, mp.is_collected, mp.collected_at, mp.purchased_at, mp.printed_at, m.title, m.level, m.price
FROM manual_purchases mp
JOIN manuals m ON mp.manual_id = m.id
WHERE mp.student_id = $1
ORDER BY mp.purchased_at DESC
`

type ListStudentManualPurchasesRow struct {
	ID          uuid.UUID          `json:"id"`
	StudentID   uuid.UUID          `json:"student_id"`
	ManualID    uuid.UUID          `json:"manual_id"`
	PaymentID   pgtype.UUID        `json:"payment_id"`
	QrCodeData  *string            `json:"qr_code_data"`
	QrCodeUrl   *string            `json:"qr_code_url"`
	IsCollected bool               `json:"is_collected"`
	CollectedAt pgtype.Timestamptz `json:"collected_at"`
	PurchasedAt pgtype.Timestamptz `json:"purchased_at"`
	PrintedAt   pgtype.Timestamptz `json:"printed_at"`
	Title       string             `json:"title"`
	Level       int32              `json:"level"`
	Price       decimal.Decimal    `json:"price"`
}

func (q *Queries) ListStudentManualPurchases(ctx context.Context, studentID uuid.UUID) ([]ListStudentManualPurchasesRow, error) {
	rows, err := q.db.Query(ctx, listStudentManualPurchases, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListStudentManualPurchasesRow{}
	for rows.Next() {
		var i ListStudentManualPurchasesRow
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.ManualID,
			&i.PaymentID,
			&i.QrCodeData,
			&i.QrCodeUrl,
			&i.IsCollected,
			&i.CollectedAt,
			&i.PurchasedAt,
			&i.PrintedAt,
			&i.Title,
			&i.Level,
			&i.Price,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listStudentPracticalEnrollments = `-- name: ListStudentPracticalEnrollments :many
SELECT pe.id, pe.student_id, pe.course_id, pe.manual_purchase_id, pe.session_id, pe.enrolled_via, pe.enrolled_at, c.code AS course_code, c.title AS course_title
FROM practical_enrollments pe
JOIN courses c ON pe.course_id = c.id
WHERE pe.student_id = $1
ORDER BY pe.enrolled_at DESC
`

type ListStudentPracticalEnrollmentsRow struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	ManualPurchaseID pgtype.UUID        `json:"manual_purchase_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	EnrolledVia      string             `json:"enrolled_via"`
	EnrolledAt       pgtype.Timestamptz `json:"enrolled_at"`
	CourseCode       string             `json:"course_code"`
	CourseTitle      string             `json:"course_title"`
}

func (q *Queries) ListStudentPracticalEnrollments(ctx context.Context, studentID uuid.UUID) ([]ListStudentPracticalEnrollmentsRow, error) {
	rows, err := q.db.Query(ctx, listStudentPracticalEnrollments, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ListStudentPracticalEnrollmentsRow{}
	for rows.Next() {
		var i ListStudentPracticalEnrollmentsRow
		if err := rows.Scan(
			&i.ID,
			&i.StudentID,
			&i.CourseID,
			&i.ManualPurchaseID,
			&i.SessionID,
			&i.EnrolledVia,
			&i.EnrolledAt,
			&i.CourseCode,
			&i.CourseTitle,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const markManualCollected = `-- name: MarkManualCollected :one
UPDATE manual_purchases
SET is_collected = true, collected_at = NOW()
WHERE id = $1
RETURNING id, student_id, manual_id, payment_id, qr_code_data, qr_code_url, is_collected, collected_at, purchased_at, printed_at
`

func (q *Queries) MarkManualCollected(ctx context.Context, id uuid.UUID) (ManualPurchase, error) {
	row := q.db.QueryRow(ctx, markManualCollected, id)
	var i ManualPurchase
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.ManualID,
		&i.PaymentID,
		&i.QrCodeData,
		&i.QrCodeUrl,
		&i.IsCollected,
		&i.CollectedAt,
		&i.PurchasedAt,
		&i.PrintedAt,
	)
	return i, err
}

const markManualPrinted = `-- name: MarkManualPrinted :one
UPDATE manual_purchases
SET printed_at = NOW()
WHERE id = $1
RETURNING id, student_id, manual_id, payment_id, qr_code_data, qr_code_url, is_collected, collected_at, purchased_at, printed_at
`

func (q *Queries) MarkManualPrinted(ctx context.Context, id uuid.UUID) (ManualPurchase, error) {
	row := q.db.QueryRow(ctx, markManualPrinted, id)
	var i ManualPurchase
	err := row.Scan(
		&i.ID,
		&i.StudentID,
		&i.ManualID,
		&i.PaymentID,
		&i.QrCodeData,
		&i.QrCodeUrl,
		&i.IsCollected,
		&i.CollectedAt,
		&i.PurchasedAt,
		&i.PrintedAt,
	)
	return i, err
}

const updateManual = `-- name: UpdateManual :one
UPDATE manuals
SET title = $2, description = $3, level = $4, price = $5,
    file_url = $6, cover_image_url = $7, is_active = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING id, title, description, level, price, file_url, cover_image_url, course_id, session_id, is_active, created_by, created_at, updated_at
`

type UpdateManualParams struct {
	ID            uuid.UUID       `json:"id"`
	Title         string          `json:"title"`
	Description   *string         `json:"description"`
	Level         int32           `json:"level"`
	Price         decimal.Decimal `json:"price"`
	FileUrl       *string         `json:"file_url"`
	CoverImageUrl *string         `json:"cover_image_url"`
	IsActive      bool            `json:"is_active"`
}

func (q *Queries) UpdateManual(ctx context.Context, arg UpdateManualParams) (Manual, error) {
	row := q.db.QueryRow(ctx, updateManual,
		arg.ID,
		arg.Title,
		arg.Description,
		arg.Level,
		arg.Price,
		arg.FileUrl,
		arg.CoverImageUrl,
		arg.IsActive,
	)
	var i Manual
	err := row.Scan(
		&i.ID,
		&i.Title,
		&i.Description,
		&i.Level,
		&i.Price,
		&i.FileUrl,
		&i.CoverImageUrl,
		&i.CourseID,
		&i.SessionID,
		&i.IsActive,
		&i.CreatedBy,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const updatePrintQueueStatus = `-- name: UpdatePrintQueueStatus :one
UPDATE manual_print_queue
SET status = $2::varchar, processed_by = $3::uuid,
    printed_at = CASE WHEN $2::varchar = 'ready' THEN NOW() ELSE printed_at END,
    collected_at = CASE WHEN $2::varchar = 'collected' THEN NOW() ELSE collected_at END
WHERE id = $1
RETURNING id, purchase_id, student_id, manual_id, status, queued_at, printed_at, collected_at, processed_by
`

type UpdatePrintQueueStatusParams struct {
	ID          uuid.UUID   `json:"id"`
	Status      string      `json:"status"`
	ProcessedBy pgtype.UUID `json:"processed_by"`
}

func (q *Queries) UpdatePrintQueueStatus(ctx context.Context, arg UpdatePrintQueueStatusParams) (ManualPrintQueue, error) {
	row := q.db.QueryRow(ctx, updatePrintQueueStatus, arg.ID, arg.Status, arg.ProcessedBy)
	var i ManualPrintQueue
	err := row.Scan(
		&i.ID,
		&i.PurchaseID,
		&i.StudentID,
		&i.ManualID,
		&i.Status,
		&i.QueuedAt,
		&i.PrintedAt,
		&i.CollectedAt,
		&i.ProcessedBy,
	)
	return i, err
}
```

### `mobile/app/(tabs)/manuals.tsx`
```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import Text from '../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { getManuals, getMyPurchases, type Manual, type ManualPurchase } from '../../src/api/manuals';

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

export default function ManualsScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [manualsData, purchasesData] = await Promise.allSettled([getManuals(), getMyPurchases()]);
    if (manualsData.status === 'fulfilled') setManuals(manualsData.value);
    if (purchasesData.status === 'fulfilled') setPurchases(purchasesData.value);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const purchasedIds = new Set(purchases.map((p) => p.manual_id));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Manuals</Text>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['browse', 'mine'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'browse' ? 'Browse' : `My Manuals (${purchases.length})`}
          </Text>
        ))}
      </View>

      {tab === 'browse' ? (
        <FlatList
          data={manuals.filter((m) => m.is_active)}
          scrollEnabled={false}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No manuals available right now.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => {
            const owned = purchasedIds.has(item.id);
            return (
              <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
                <Card style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.primaryMuted }]}>
                    <Ionicons name="book" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>Level {item.level}</Text>
                  </View>
                  {owned ? (
                    <Badge label="Owned" tone="success" />
                  ) : (
                    <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.price)}</Text>
                  )}
                </Card>
              </Animated.View>
            );
          }}
        />
      ) : (
        <FlatList
          data={purchases}
          scrollEnabled={false}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No manuals purchased yet.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: theme.successMuted }]}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.manual_title}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>
                    Purchased {new Date(item.purchased_at).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label={item.is_collected ? 'Collected' : 'Not collected'} tone={item.is_collected ? 'success' : 'neutral'} />
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xl,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  itemMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
});
```

### `mobile/src/api/manuals.ts`
```ts
import apiClient, { unwrap } from './client';

export interface Manual {
  id: string;
  title: string;
  description?: string;
  level: number;
  price: number;
  cover_image_url?: string;
  is_active: boolean;
}

export interface ManualPurchase {
  id: string;
  manual_id: string;
  manual_title: string;
  manual_level: number;
  price: number;
  is_collected: boolean;
  purchased_at: string;
}

export const getManuals = async (params?: { level?: number }) => {
  const res = await apiClient.get('/manuals', { params });
  return unwrap<Manual[]>(res);
};

export const getMyPurchases = async () => {
  const res = await apiClient.get('/manuals/my-purchases');
  return unwrap<ManualPurchase[]>(res);
};

export interface QRVerifyResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const verifyManualQR = async (qrData: string) => {
  const res = await apiClient.post('/manuals/qr-verify', { qr_data: qrData });
  return unwrap<QRVerifyResult>(res);
};
```

### `backend/internal/utils/qr_generator.go`
```go
package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ManualQRPayloadInput struct {
	StudentID uuid.UUID `json:"student_id"`
	RegNo     string    `json:"reg_no"`
	ManualID  uuid.UUID `json:"manual_id"`
}

type manualQRClaims struct {
	Payload ManualQRPayloadInput `json:"payload"`
	Sig     string               `json:"sig"`
	Exp     int64                `json:"exp"`
}

func GenerateManualQRPayload(input ManualQRPayloadInput, secret []byte) (string, error) {
	claims := manualQRClaims{
		Payload: input,
		Exp:     time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	data, err := json.Marshal(claims.Payload)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(data)
	claims.Sig = hex.EncodeToString(mac.Sum(nil))

	final, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(final), nil
}

func VerifyManualQRPayload(qrData string, secret []byte) (*ManualQRPayloadInput, error) {
	data, err := base64.URLEncoding.DecodeString(qrData)
	if err != nil {
		return nil, fmt.Errorf("invalid QR format")
	}
	var claims manualQRClaims
	if err := json.Unmarshal(data, &claims); err != nil {
		return nil, fmt.Errorf("invalid QR data")
	}

	payloadData, _ := json.Marshal(claims.Payload)
	mac := hmac.New(sha256.New, secret)
	mac.Write(payloadData)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(claims.Sig)) {
		return nil, fmt.Errorf("invalid QR signature")
	}

	return &claims.Payload, nil
}
```

### `backend/internal/utils/receipt_printer.go`
```go
package utils

import (
	"bytes"
	"fmt"
	"strings"
)

// ReceiptInput holds everything needed to render a simple proof-of-purchase
// receipt — unlike the manual cover page, this carries no QR code and isn't
// meant for printing/collection, just a record the student can keep.
type ReceiptInput struct {
	StudentName string
	RegNo       string
	ItemName    string
	Amount      string // pre-formatted, e.g. "2,000.00"
	Reference   string
	Date        string // pre-formatted, e.g. "8 Aug 2026"
}

// GenerateReceipt produces a single-page PDF/1.4 payment receipt. Built with
// the same minimal hand-rolled PDF object approach as manual_printer.go
// (no external PDF library in this codebase) but far simpler: one page, one
// content stream, no QR/image beyond the shared crest.
func GenerateReceipt(input ReceiptInput) ([]byte, error) {
	logoW, logoH, logoJPEG, err := encodeLogoJPEG()
	if err != nil {
		return nil, fmt.Errorf("encode logo: %w", err)
	}

	content := buildReceiptContent(input)

	var buf bytes.Buffer
	objs := []string{}
	addObj := func(s string) int { objs = append(objs, s); return len(objs) }

	addObj("<< /Type /Catalog /Pages 2 0 R >>")
	addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	pageIdx := addObj("")
	contentIdx := addObj(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content))
	f1Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
	f2Idx := addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
	imageIdx := addObj(fmt.Sprintf(
		"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n%s\nendstream",
		logoW, logoH, len(logoJPEG), string(logoJPEG),
	))

	objs[pageIdx-1] = fmt.Sprintf(
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> /XObject << /Im1 %d 0 R >> >> >>",
		contentIdx, f1Idx, f2Idx, imageIdx,
	)

	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objs))
	for i, body := range objs {
		offsets[i] = buf.Len()
		buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, body))
	}

	xrefOff := buf.Len()
	n := len(objs) + 1
	buf.WriteString(fmt.Sprintf("xref\n0 %d\n", n))
	buf.WriteString("0000000000 65535 f \n")
	for _, off := range offsets {
		buf.WriteString(fmt.Sprintf("%010d 00000 n \n", off))
	}
	buf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", n, xrefOff))

	return buf.Bytes(), nil
}

func buildReceiptContent(input ReceiptInput) string {
	var txt strings.Builder
	var gfx strings.Builder

	const (
		pageW   = 595.0
		pageH   = 842.0
		centerX = pageW / 2
	)
	leftMargin := mm(25)
	rightEdge := pageW - mm(25)

	logoSize := mm(22)
	logoTop := pageH - mm(30)
	logoBottom := logoTop - logoSize
	logoX := centerX - logoSize/2
	gfx.WriteString("q\n")
	gfx.WriteString(fmt.Sprintf("%.2f 0 0 %.2f %.2f %.2f cm\n", logoSize, logoSize, logoX, logoBottom))
	gfx.WriteString("/Im1 Do\nQ\n")

	titleY := logoBottom - mm(12)
	subtitleY := titleY - mm(8)
	paidBadgeY := subtitleY - mm(14)

	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, titleY, 18, "F2", "ACES Zone")
	pdfCentered(&txt, centerX, subtitleY, 11, "F1", "Payment Receipt")
	pdfCentered(&txt, centerX, paidBadgeY, 13, "F2", "PAID")
	txt.WriteString("ET\n")

	gfx.WriteString("0.6 w\n")
	lineY := paidBadgeY - mm(8)
	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, lineY))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\nS\n", rightEdge, lineY))

	fields := []struct{ label, value string }{
		{"Item", input.ItemName},
		{"Amount", "NGN " + input.Amount},
		{"Reference", input.Reference},
		{"Date", input.Date},
		{"Student", input.StudentName},
		{"Reg. No.", input.RegNo},
	}

	rowY := lineY - mm(12)
	txt.WriteString("BT\n")
	for _, f := range fields {
		pdfAt(&txt, leftMargin, rowY, 11, "F2", f.label+":")
		pdfAt(&txt, leftMargin+mm(35), rowY, 11, "F1", f.value)
		rowY -= mm(9)
	}
	txt.WriteString("ET\n")

	gfx.WriteString(fmt.Sprintf("%.2f %.2f m\n", leftMargin, rowY-mm(4)))
	gfx.WriteString(fmt.Sprintf("%.2f %.2f l\nS\n", rightEdge, rowY-mm(4)))

	footerY := rowY - mm(14)
	txt.WriteString("BT\n")
	pdfCentered(&txt, centerX, footerY, 9, "F1", "This is a computer-generated receipt from ACES Zone.")
	txt.WriteString("ET\n")

	return gfx.String() + txt.String()
}
```

## Database tables (originally created in migration 000003_blueprint_v5_tables.up.sql)

These four tables were dropped by a new migration `000045_remove_practicals_and_manuals`
rather than by touching migration 000003 directly (that migration also creates many
unrelated tables). The exact CREATE TABLE statements below are what migration 000003
still contains in its own file (untouched) — this section is just a convenience copy,
and also exactly what `000045_remove_practicals_and_manuals.down.sql` recreates.

```sql
CREATE TABLE manuals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    file_url TEXT,
    cover_image_url TEXT,
    course_id UUID REFERENCES courses(id),
    session_id UUID REFERENCES sessions(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manuals_level ON manuals(level);
CREATE INDEX idx_manuals_course ON manuals(course_id);

CREATE TABLE manual_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    manual_id UUID NOT NULL REFERENCES manuals(id),
    payment_id UUID REFERENCES payments(id),
    qr_code_data TEXT,
    qr_code_url TEXT,
    is_collected BOOLEAN NOT NULL DEFAULT false,
    collected_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at TIMESTAMPTZ, -- added by migration 000032_manual_purchase_printed_at
    UNIQUE(student_id, manual_id)
);

CREATE INDEX idx_manual_purchases_student ON manual_purchases(student_id);
CREATE INDEX idx_manual_purchases_manual ON manual_purchases(manual_id);

CREATE TABLE manual_print_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES manual_purchases(id),
    student_id UUID NOT NULL REFERENCES students(id),
    manual_id UUID NOT NULL REFERENCES manuals(id),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_print_queue_status ON manual_print_queue(status);
CREATE INDEX idx_print_queue_student ON manual_print_queue(student_id);

CREATE TABLE practical_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    manual_purchase_id UUID REFERENCES manual_purchases(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    enrolled_via VARCHAR(20) NOT NULL DEFAULT 'qr_scan',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, course_id, session_id)
);

CREATE INDEX idx_practical_enrollments_student ON practical_enrollments(student_id);
CREATE INDEX idx_practical_enrollments_course ON practical_enrollments(course_id);
```

Note: migration 000003 itself is left untouched (it creates many unrelated tables too);
only migration 000045 (new, forward-only removal) actually drops these four tables from
the live database. Migration 000032 (`manual_purchases.printed_at`) becomes moot once
`manual_purchases` is dropped — its own up/down files are also left untouched in the
migrations folder for historical/version accuracy, but the column it added no longer
exists after 000045 runs.

---

## Removed snippets from files that otherwise stayed

### `frontend/src/router.tsx`

Removed lazy imports:
```tsx
const ManualsPage = lazy(() => import('./pages/student/ManualsPage'));
const PracticalDetailsPage = lazy(() => import('./pages/student/PracticalDetailsPage'));
const ManualsManagementPage = lazy(() => import('./pages/admin/ManualsManagementPage'));
const ManualCoverBulkDownloadPage = lazy(() => import('./pages/admin/ManualCoverBulkDownloadPage'));
const ManualDetailPage = lazy(() => import('./pages/admin/ManualDetailPage'));
```

Removed routes:
```tsx
{ path: '/manuals', element: <ManualsPage /> },
{ path: '/manuals/my', element: <Navigate to="/manuals?tab=my" replace /> },
{ path: '/practicals', element: <PracticalDetailsPage /> },
{ path: '/admin/manuals', element: <ManualsManagementPage /> },
{ path: '/admin/manuals/covers/bulk', element: <ManualCoverBulkDownloadPage /> },
{ path: '/admin/manuals/:id', element: <ManualDetailPage /> },
```

### `frontend/src/components/layout/Navbar.tsx`

Removed import: `import { useCartStore } from '../../stores/cartStore';`
Removed hook: `const getItemCount = useCartStore((s) => s.getItemCount);`
Removed JSX block (cart icon shown for students on mobile navbar):
```tsx
{isStudent && (
  <div className="flex items-center gap-1 md:hidden">
    <Link to="/manuals">
      <button
        className="relative p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        aria-label="Shopping cart"
      >
        <ShoppingCart className="w-5 h-5" />
        {getItemCount() > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-danger-500 rounded-full">
            {getItemCount()}
          </span>
        )}
      </button>
    </Link>
  </div>
)}
```


### Removed from `frontend/src/pages/student/PaymentsPage.tsx`

This page is otherwise a generic dues-payment page; only the manual-cart integration was removed. Snippets below are exact original content.

Imports removed:
```tsx
import { purchaseManual, checkoutManual } from '../../api/manuals';
import { useCartStore } from '../../stores/cartStore';
```

`TYPE_OPTIONS` had `'manual',` removed from the array, and `TYPE_LABELS` had `manual: 'Manual/Book Purchase',` removed.

State/hooks removed:
```tsx
  const [manualCheckoutBusy, setManualCheckoutBusy] = useState(false);
  ...
  const manualCartItems = useCartStore((s) => s.items);
  const removeManualItem = useCartStore((s) => s.removeItem);
  const clearManualCart = useCartStore((s) => s.clearCart);
  const manualCartTotal = useCartStore((s) => s.getTotal);
  const manualCartCount = useCartStore((s) => s.getItemCount);

  const totalCartCount = cart.length + manualCartCount();
```
(`totalCartCount` was changed to `cart.length` after removal.)

`handleManualCheckout` function removed in full:
```tsx
  const handleManualCheckout = async () => {
    if (manualCartItems.length === 0) return;
    setManualCheckoutBusy(true);

    // Free manuals can be purchased directly. Priced manuals need a Paystack
    // checkout first — purchaseManual refuses them without a completed
    // payment — and since a Paystack redirect navigates the whole page away,
    // only one priced manual can be sent to checkout per click.
    const freeItems = manualCartItems.filter((item) => !(item.manual.price > 0));
    const pricedItems = manualCartItems.filter((item) => item.manual.price > 0);

    let purchased = 0;
    let failed = 0;
    for (const item of freeItems) {
      try {
        await purchaseManual(item.manual.id);
        removeManualItem(item.manual.id);
        purchased++;
      } catch (err: unknown) {
        const msg = getErrorMessage(err, 'Purchase failed');
        if (msg.includes('already purchased')) {
          removeManualItem(item.manual.id);
          purchased++;
        } else {
          failed++;
        }
      }
    }

    if (purchased > 0) {
      success('Purchased', `${purchased} free manual(s) added to "My Manuals".`);
    }
    if (failed > 0) {
      notifyError('Purchase Failed', `${failed} manual(s) failed to purchase.`);
    }

    if (pricedItems.length === 0) {
      setManualCheckoutBusy(false);
      return;
    }

    if (!user?.email) {
      notifyError('Checkout Error', 'User email is required.');
      setManualCheckoutBusy(false);
      return;
    }

    const next = pricedItems[0];
    try {
      const res = await checkoutManual(next.manual.id, user.email);
      if (res?.authorization_url) {
        success(
          'Redirecting',
          pricedItems.length > 1
            ? `Forwarding to Paystack for ${next.manual.title}. Check out the remaining ${pricedItems.length - 1} manual(s) afterward.`
            : `Forwarding to Paystack for ${next.manual.title}...`,
        );
        window.location.href = res.authorization_url;
        return;
      }
      notifyError('Checkout Error', 'No redirect URL returned.');
    } catch (err: unknown) {
      notifyError('Checkout Error', getErrorMessage(err, 'Unable to initiate gateway transaction.'));
    }

    setManualCheckoutBusy(false);
  };
```

`combinedCartTotal` was `duesCartTotal + manualCartTotal()`, changed to just `duesCartTotal`.

JSX: the "Unified Cart" section's condition was `(cart.length > 0 || manualCartCount() > 0)`, changed to `cart.length > 0`. The manual cart items `<tbody>` rows were removed:
```tsx
                    {manualCartItems.map((item) => (
                      <tr key={item.manual.id} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{item.manual.title}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Manual
                          </span>
                        </td>
                        <td className="px-4 py-3 text-surface-700 dark:text-surface-300">
                          {formatCurrency(item.manual.price)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="xs"
                            variant="danger"
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => removeManualItem(item.manual.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
```

The `Clear All` button's `onClick` was `{ handleClearCart(); clearManualCart(); }`, changed to just `handleClearCart()`.

The footer total/checkout block:
```tsx
                <div className="text-sm text-surface-700 dark:text-surface-300 space-y-0.5">
                  {cart.length > 0 && <div>Dues: {formatCurrency(duesCartTotal)}</div>}
                  {manualCartCount() > 0 && <div>Manuals: {formatCurrency(manualCartTotal())}</div>}
                  <div className="font-semibold">Total: {formatCurrency(combinedCartTotal)}</div>
                </div>
```
changed to drop the manuals line. And the "Get Manuals" checkout button was removed:
```tsx
                  {manualCartCount() > 0 && (
                    <Button
                      leftIcon={
                        manualCheckoutBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )
                      }
                      onClick={handleManualCheckout}
                      disabled={manualCheckoutBusy}
                    >
                      {manualCheckoutBusy ? 'Processing...' : `Get Manuals (${manualCartCount()})`}
                    </Button>
                  )}
```

Empty-cart state condition was `cart.length === 0 && manualCartCount() === 0 && !cartLoading`, changed to `cart.length === 0 && !cartLoading`. The "Browse Manuals" link was removed:
```tsx
                <a href="/manuals" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
                  Browse Manuals
                </a>
```
and the surrounding helper text changed from "Add dues from the list above or browse manuals to add items." to "Add dues from the list above."

### Removed from `frontend/src/pages/student/PaymentConfirmationPage.tsx`

This page is otherwise a generic Paystack-redirect payment confirmation page. The manual-purchase finalization branch was removed.

Import removed: `import { purchaseManual } from '../../api/manuals';`

`manualId` state removed: `const manualId = searchParams.get('manual_id');`

Inside the `verify()` effect, on `data?.status === 'completed'`, this branch was removed:
```tsx
          // The generic payment confirmation only marks the payment row
          // completed — a manual purchase still needs its own record (QR
          // code, print-queue entry) created via purchaseManual now that
          // there's a completed payment behind it.
          if (manualId) {
            try {
              await purchaseManual(manualId, data.id);
            } catch {
              // Already purchased (e.g. a retried/duplicate redirect) is fine;
              // any other failure still leaves the payment itself completed.
            }
          }
```

The effect's dependency array was `[reference, manualId]`, changed to `[reference]`.

### Removed from `frontend/src/pages/student/QRScanPage.tsx`

This page also handles scanning a student's profile QR code (redirects to `/connect?scan=<id>`) — that branch stays. Only the manual-QR-verification branch/fallback was removed. Full original file preserved below for exact restoration (the whole file was replaced, since after removing the manuals branch it makes most sense to redesign around only the profile-scan use case rather than leave dead scaffolding):

```tsx
import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import QRScanner from '../../components/ui/QRScanner';
import { verifyManualQR } from '../../api/manuals';
import { useNotification } from '../../hooks/useNotification';
import { ScanLine, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseProfileScanUserId } from '../../utils/qr-scanner';
import { getErrorMessage } from '../../utils/errors';

// The manuals QR-verify endpoint's response shape isn't declared in
// src/api/manuals.ts (it returns the raw axios `res.data`) — capture just
// the fields this page reads from it.
interface ManualQRVerifyResult {
  message?: string;
  student_name?: string;
}

export default function QRScanPage() {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    data?: ManualQRVerifyResult;
  } | null>(null);

  const handleScan = async (data: string) => {
    setScanning(false);

    // A scanned student profile QR takes you straight to Connect instead of
    // being treated as a manual-purchase verification code.
    const scannedUserId = parseProfileScanUserId(data);
    if (scannedUserId) {
      navigate(`/connect?scan=${scannedUserId}`);
      return;
    }

    try {
      const result = (await verifyManualQR(data)) as ManualQRVerifyResult;
      setLastResult({ success: true, message: result.message || 'QR code verified successfully.', data: result });
      success('QR Verified', result.message || 'Manual QR code verified.');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Invalid QR code');
      setLastResult({ success: false, message: msg });
      notifyError('Verification Failed', msg);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-surface-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Scan QR Code</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Scan a manual QR code to verify or enroll.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera Scanner</CardTitle>
          <CardDescription>Point your camera at a QR code</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          {!scanning ? (
            <Button
              onClick={() => {
                setScanning(true);
                setLastResult(null);
              }}
              leftIcon={<ScanLine className="w-4 h-4" />}
            >
              Start Scanning
            </Button>
          ) : (
            <div className="space-y-3">
              <QRScanner onScan={handleScan} />
              <Button variant="outline" onClick={() => setScanning(false)} className="w-full">
                Stop Scanner
              </Button>
            </div>
          )}
        </div>
      </Card>

      {lastResult && (
        <Card>
          <div
            className={`p-4 flex items-start gap-3 ${lastResult.success ? 'bg-success-50 dark:bg-success-900/10' : 'bg-danger-50 dark:bg-danger-900/10'} rounded-xl`}
          >
            {lastResult.success ? (
              <CheckCircle className="w-5 h-5 text-success-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-danger-500 mt-0.5 shrink-0" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${lastResult.success ? 'text-success-700 dark:text-success-400' : 'text-danger-700 dark:text-danger-400'}`}
              >
                {lastResult.success ? 'Verified' : 'Failed'}
              </p>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{lastResult.message}</p>
              {lastResult.data?.student_name && (
                <p className="text-xs text-surface-500 mt-1">Student: {lastResult.data.student_name}</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
```

### Removed from `frontend/src/types/index.ts`

`PaymentType` was `'dept_dues' | 'class_dues' | 'manual' | 'materials' | 'transcript_fee' | 'other'`, the `'manual'` variant was removed (note: `PaymentMethod = 'paystack' | 'manual'` on the line above is unrelated — bursar's manually-recorded payment method — and was left untouched).

These two interfaces were removed in full:
```ts
// ───── Manuals ─────
export interface Manual extends BaseEntity {
  title: string;
  description?: string;
  price: number;
  level: number;
  coverImageUrl?: string;
  fileUrl?: string;
  isActive: boolean;
  courseId?: string;
  sessionId?: string;
  createdBy?: string;
}

export interface ManualPurchase extends BaseEntity {
  manualId: string;
  manualTitle?: string;
  manualLevel?: number;
  price: number;
  isCollected: boolean;
  collectedAt?: string;
  purchasedAt?: string;
  qrCodeData?: string;
  qrCodeUrl?: string;
  studentName?: string;
  matricNumber?: string;
  matric_number?: string;
}
```

Note: `CourseSubcategory`'s `'practical'` enum value is unrelated to this feature (it describes a course delivery format, not the Practicals & Manuals feature) and was left untouched.

### Removed from `frontend/src/components/forms/ComplaintForm.tsx`

The complaint category dropdown had a "Course Manuals" option removed:
```tsx
            { value: 'manual', label: 'Course Manuals' },
```

### Removed from `frontend/src/pages/bursar/PaymentHistoryPage.tsx`

`TYPE_OPTIONS` had `'manual',` removed and `TYPE_LABELS` had `manual: 'Manual/Book Purchase',` removed (mirrors the same cleanup in `PaymentsPage.tsx`, needed since `PaymentType` no longer includes `'manual'`).

### Removed from `backend/internal/api/server.go`

Struct field removed: `manuals           *service.ManualService`

Constructor field removed: `manuals:           service.NewManualService(store),`

Route group removed in full (note: bursar's unrelated `POST /bursar/record-payment` → `server.recordManualPayment` — a manually-recorded cash/transfer payment, nothing to do with the manuals/book feature — was left untouched):
```go
	// ── Manuals ──
	manualsGroup := api.Group("/manuals")
	{
		// Catalog
		manualsGroup.POST("", middleware.RequireRoles("hod", "admin", "delegated_admin", "lecturer"), server.createManual)
		manualsGroup.GET("", server.listManuals)
		manualsGroup.GET("/:id", server.getManual)
		manualsGroup.PUT("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.updateManual)
		manualsGroup.DELETE("/:id", middleware.RequireRoles("hod", "admin", "delegated_admin"), server.deleteManual)

		// Student purchase flow
		manualsGroup.POST("/:id/checkout", middleware.RequireRoles("student"), server.createManualPayment)
		manualsGroup.POST("/purchase", middleware.RequireRoles("student"), server.purchaseManual)
		manualsGroup.GET("/my-purchases", middleware.RequireRoles("student"), server.listMyPurchases)
		manualsGroup.GET("/:id/cover", server.downloadManualCover)
		manualsGroup.GET("/purchases/:id/receipt", server.downloadManualReceipt)

		// Admin: bought list & print queue
		manualsGroup.GET("/:id/purchases", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.listManualPurchasesByManual)
		manualsGroup.GET("/:id/covers/bulk", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.bulkDownloadManualCovers)
		manualsGroup.POST("/purchases/:id/collect", middleware.RequireRoles("hod", "admin", "bursar_dept", "delegated_admin"), server.markManualCollected)

		// QR scan & enrollment
		manualsGroup.POST("/qr-verify", middleware.RequireRoles("student"), server.verifyManualQR)
		manualsGroup.POST("/practical/enroll", middleware.RequireRoles("student"), server.enrollPractical)
		manualsGroup.GET("/practicals", middleware.RequireRoles("student"), server.listMyPracticalEnrollments)
	}
```

### Note: shared PDF text-rendering helpers were NOT deleted

`manual_printer.go` (archived above) also defined `pdfCentered`, `pdfCenteredBetween`, `pdfAt`, `pdfSafe`, `mm`, `textWidth`, and the AFM glyph-width tables (`timesRomanWidths`, `timesBoldWidths`, `helveticaWidths`, `helveticaBoldWidths`). These turned out to be generic PDF text-layout utilities also used by `attendance_printer.go` and `result_slip_printer.go` (unrelated to manuals/practicals) — deleting `manual_printer.go` broke their build. They were extracted verbatim into a new shared file `backend/internal/utils/pdf_text.go` instead of being removed. `encodeLogoJPEG`/`uniuyoLogoPNG` (the embedded crest image, only used by manual/receipt PDFs) were NOT extracted and remain gone — restore them from the `manual_printer.go`/`receipt_printer.go` snippets above if this feature comes back.

### Removed from `backend/internal/db/sql/custom.go`

```go
type HasCompletedPaymentForManualParams struct {
	StudentID uuid.UUID
	ManualID  uuid.UUID
	PaymentID *uuid.UUID
}

func (q *Queries) HasCompletedPaymentForManual(ctx context.Context, arg HasCompletedPaymentForManualParams) (bool, error) {
	if arg.PaymentID != nil {
		var exists bool
		err := q.db.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM payments
				WHERE id = $1 AND student_id = $2 AND status = 'completed'
			)
		`, *arg.PaymentID, arg.StudentID).Scan(&exists)
		return exists, err
	}

	var exists bool
	err := q.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM payments p
			JOIN manuals m ON m.id = $2
			WHERE p.student_id = $1 
			  AND p.status = 'completed'
			  AND (p.type = 'manual' OR p.item_name ILIKE '%' || m.title || '%')
		)
	`, arg.StudentID, arg.ManualID).Scan(&exists)
	return exists, err
}
```

### Note: `getStudentIDFromUser` was NOT deleted

`manuals.go` (archived above) defined `func (server *Server) getStudentIDFromUser(ctx *gin.Context) (uuid.UUID, error)`. This turned out to be a generic helper also used by `cgpa.go`, `dashboard.go`, and `payment.go` (unrelated to manuals) — deleting `manuals.go` broke their build. It was moved verbatim (with its error message generalized from "only students can purchase manuals" to "student record not found", since that reason no longer applies) into `backend/internal/api/helpers.go`.

### Removed from `backend/internal/db/sql/models.go` (sqlc-generated)

```go
type Manual struct {
	ID            uuid.UUID          `json:"id"`
	Title         string             `json:"title"`
	Description   *string            `json:"description"`
	Level         int32              `json:"level"`
	Price         decimal.Decimal    `json:"price"`
	FileUrl       *string            `json:"file_url"`
	CoverImageUrl *string            `json:"cover_image_url"`
	CourseID      pgtype.UUID        `json:"course_id"`
	SessionID     pgtype.UUID        `json:"session_id"`
	IsActive      bool               `json:"is_active"`
	CreatedBy     uuid.UUID          `json:"created_by"`
	CreatedAt     pgtype.Timestamptz `json:"created_at"`
	UpdatedAt     pgtype.Timestamptz `json:"updated_at"`
}

type ManualPrintQueue struct {
	ID          uuid.UUID          `json:"id"`
	PurchaseID  uuid.UUID          `json:"purchase_id"`
	StudentID   uuid.UUID          `json:"student_id"`
	ManualID    uuid.UUID          `json:"manual_id"`
	Status      string             `json:"status"`
	QueuedAt    pgtype.Timestamptz `json:"queued_at"`
	PrintedAt   pgtype.Timestamptz `json:"printed_at"`
	CollectedAt pgtype.Timestamptz `json:"collected_at"`
	ProcessedBy pgtype.UUID        `json:"processed_by"`
}

type ManualPurchase struct {
	ID          uuid.UUID          `json:"id"`
	StudentID   uuid.UUID          `json:"student_id"`
	ManualID    uuid.UUID          `json:"manual_id"`
	PaymentID   pgtype.UUID        `json:"payment_id"`
	QrCodeData  *string            `json:"qr_code_data"`
	QrCodeUrl   *string            `json:"qr_code_url"`
	IsCollected bool               `json:"is_collected"`
	CollectedAt pgtype.Timestamptz `json:"collected_at"`
	PurchasedAt pgtype.Timestamptz `json:"purchased_at"`
	PrintedAt   pgtype.Timestamptz `json:"printed_at"`
}

type PracticalEnrollment struct {
	ID               uuid.UUID          `json:"id"`
	StudentID        uuid.UUID          `json:"student_id"`
	CourseID         uuid.UUID          `json:"course_id"`
	ManualPurchaseID pgtype.UUID        `json:"manual_purchase_id"`
	SessionID        uuid.UUID          `json:"session_id"`
	EnrolledVia      string             `json:"enrolled_via"`
	EnrolledAt       pgtype.Timestamptz `json:"enrolled_at"`
}
```

### Removed from `backend/internal/api/expenses_feedback.go`

Four seed help-article rows referencing manuals were removed from the `articles` slice in the help-center seeding function:
```go
		{"Payments", "How to purchase a lab manual", "1. Go to Manuals in the sidebar.\n2. Browse and click Add to Cart.\n3. Go to Payments Cart tab.\n4. Click Get Manuals.\nAfter purchase go to My Manuals for your QR code.", 3},
		{"Manuals", "How to download my manual cover page", "1. Go to My Manuals.\n2. Click Download Cover.\n3. Print the cover and attach it to your manual before submission.\nThe cover page includes a QR code used for verification.", 1},
		{"Manuals", "How is the QR code used for verification?", "During lab submission the QR code on your cover is scanned to verify your identity, confirm payment, and link you to this academic session.\nEnsure the code is printed clearly.", 2},
		{"Troubleshooting", "My manual QR code is not scanning", "Ensure the cover page PDF was printed at full size (100% scale, no fit-to-page).\nThe QR code must not be distorted or cut off.\nIf the code is damaged, go to My Manuals and download a fresh copy to reprint.", 3},
```

### Removed from `mobile/app/(tabs)/_layout.tsx`

```tsx
        <Tabs.Screen
          name="manuals"
          options={{
            title: 'Manuals',
            tabBarIcon: ({ color, focused }) => <TabIcon name="library" color={color} focused={focused} />,
          }}
        />
```

### Removed from `mobile/app/scan.tsx`

This screen also handles attendance self-check-in QR codes (URL shape `.../attendance/checkin?session=<id>`) and student profile QR codes (`.../connect?scan=<userId>`) — both branches stay. Only the manual-QR-verification fallback was removed. Full original file preserved below for exact restoration:

```tsx
import { useState, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from '../src/components/ui/Text';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../src/theme/typography';
import Button from '../src/components/ui/Button';
import { verifyManualQR, type QRVerifyResult } from '../src/api/manuals';
import { selfCheckIn } from '../src/api/attendance';
import { haptics } from '../src/utils/haptics';
import { PROFILE_SCAN_PARAM } from '../src/config';

// Attendance check-in QR codes encode a plain URL (.../attendance/checkin?session=<id>) —
// any stock camera app can open them. Manual QR codes encode an opaque
// signed JSON payload instead. Same camera, same screen, branch on shape.
function extractAttendanceSessionId(data: string): string | null {
  if (!data.startsWith('http')) return null;
  try {
    const url = new URL(data);
    if (!url.pathname.includes('/attendance/checkin')) return null;
    return url.searchParams.get('session');
  } catch {
    return null;
  }
}

// A student's profile QR (see Profile screen) encodes .../connect?scan=<userId>
// — same URL shape the web app's class-rep scanner and Connect page already
// understand, so this one code works everywhere.
function extractProfileScanUserId(data: string): string | null {
  if (!data.startsWith('http')) return null;
  try {
    const url = new URL(data);
    if (!url.pathname.includes('/connect')) return null;
    return url.searchParams.get(PROFILE_SCAN_PARAM);
  } catch {
    return null;
  }
}

export default function ScanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const lineY = useSharedValue(0);
  const lastScan = useRef<string | null>(null);

  useState(() => {
    lineY.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
    );
  });

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value * 220 }],
    opacity: 0.9,
  }));

  const handleScan = async (scan: BarcodeScanningResult) => {
    if (locked || scan.data === lastScan.current) return;
    lastScan.current = scan.data;
    setLocked(true);
    haptics.tap();

    const sessionId = extractAttendanceSessionId(scan.data);
    const scannedUserId = extractProfileScanUserId(scan.data);

    if (scannedUserId) {
      haptics.success();
      router.replace(`/connect?${PROFILE_SCAN_PARAM}=${scannedUserId}`);
      return;
    }

    try {
      if (sessionId) {
        await selfCheckIn(sessionId);
        haptics.success();
        setResult({ ok: true, text: 'You have been marked present.' });
      } else {
        const res: QRVerifyResult = await verifyManualQR(scan.data);
        haptics.success();
        setResult({ ok: true, text: res.message || 'Manual collection confirmed' });
      }
    } catch (err: unknown) {
      haptics.error();
      const message =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not verify this QR code.';
      setResult({ ok: false, text: message });
    }
  };
  // ... rest of file (styles, render) unchanged from what's on disk pre-removal
```

Original `handleScan`'s manual-QR fallback replaced with a plain "not recognized" error when neither an attendance session URL nor a profile-scan URL matches. `verifyManualQR`/`QRVerifyResult` import removed (that module, `mobile/src/api/manuals.ts`, was deleted entirely). Overlay/permission-screen copy referencing "manual" was reworded to drop the mention.

### `frontend/src/hooks/useManualEnrollment.ts` (deleted — not caught in the original file survey)
```ts
import { useState } from 'react';
import { purchaseManual } from '../api/manuals';

export const useManualEnrollment = () => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const enrollViaQR = async (manualId: string) => {
    setIsEnrolling(true);
    setEnrollmentStatus('idle');
    try {
      await purchaseManual(manualId);
      setEnrollmentStatus('success');
    } catch {
      setEnrollmentStatus('error');
    } finally {
      setIsEnrolling(false);
    }
  };

  return { isEnrolling, enrollmentStatus, enrollViaQR, setEnrollmentStatus };
};
```

### `frontend/src/stores/manualStore.ts` (deleted — not caught in the original file survey)
```ts
import { create } from 'zustand';
import type { Manual } from '../types';

interface ManualState {
  manuals: Manual[];
  selectedManual: Manual | null;
  setManuals: (manuals: Manual[]) => void;
  setSelectedManual: (manual: Manual | null) => void;
  updateManual: (id: string, partial: Partial<Manual>) => void;
}

export const useManualStore = create<ManualState>()((set) => ({
  manuals: [],
  selectedManual: null,
  setManuals: (manuals) => set({ manuals }),
  setSelectedManual: (selectedManual) => set({ selectedManual }),
  updateManual: (id, partial) =>
    set((state) => ({
      manuals: state.manuals.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    })),
}));
```

### `frontend/src/types/manual.ts` (deleted — not caught in the original file survey)
```ts
// Manual domain types — re-exported from master index
export type { Manual, ManualPurchase } from './index';
```

### `frontend/src/components/forms/QRPrintForm.tsx` (deleted — orphaned, not caught in the original file survey)
```tsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface QRPrintFormProps {
  onSubmit: (data: { manualId: string; quantity: number }) => void;
  isLoading?: boolean;
}

const QRPrintForm = ({ onSubmit, isLoading }: QRPrintFormProps) => {
  const [manualId, setManualId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      manualId,
      quantity: parseInt(quantity || '1'),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Target Manual ID / Code"
        placeholder="e.g. m-1"
        value={manualId}
        onChange={(e) => setManualId(e.target.value)}
        required
      />
      <Input
        label="Quantity to Print"
        type="number"
        min={1}
        max={100}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Generate Print Codes
      </Button>
    </form>
  );
};

export default QRPrintForm;
```

### Removed from `backend/internal/config/config.go`

Struct field `ManualQRSecret string` and its loader line `ManualQRSecret: getEnv("MANUAL_QR_SECRET", "aces-manual-qr-secret-change-in-prod-2026"),` were removed (only used by the deleted `qr_generator.go`'s `GenerateManualQRPayload`/`VerifyManualQRPayload`). The `MANUAL_QR_SECRET` env var in `.env`/`.env.example`, if present, can also be dropped.

### Removed from `backend/internal/service/ai_service.go`

A rule-based chatbot FAQ entry was removed:
```go
		{
			keywords: []string{"manual", "lab manual", "practical", "practicals"},
			handler: func() *ChatbotResponse {
				return &ChatbotResponse{
					Reply:       "Lab manuals are available on the Manuals page. You can view and download manuals for your registered practical courses. QR codes are provided for verification.",
					Confidence:  0.85,
					ModelUsed:   "rule_based",
					Suggestions: []string{"View my manuals", "Check practical details"},
				}
			},
		},
```
