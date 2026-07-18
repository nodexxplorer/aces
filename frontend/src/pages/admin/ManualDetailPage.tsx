import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getManual } from '../../api/manuals';
import { useNotification } from '../../hooks/useNotification';
import { ArrowLeft, BookOpen, Layers, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Manual } from '../../api/manuals';

const ManualDetailPage = () => {
  const { id } = useParams();
  const { error: notifyError } = useNotification();
  const [manual, setManual] = useState<Manual | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getManual(id)
      .then(setManual)
      .catch(() => notifyError('Error', 'Failed to load manual details'))
      .finally(() => setLoading(false));
  }, [id]);

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
    <div className="space-y-6 max-w-3xl mx-auto">
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
                <p className="font-semibold text-success-600 dark:text-success-400">
                  {formatCurrency(manual.price)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Calendar className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Last Updated</p>
                <p>{manual.updated_at ? new Date(manual.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}</p>
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
    </div>
  );
};

export default ManualDetailPage;
