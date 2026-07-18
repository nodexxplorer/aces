import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { getMySkillListings, deleteSkillListing } from '../../api/skills-trade';
import type { SkillListing } from '../../types';

const mapListing = (raw: any): SkillListing => ({
  id: raw.id,
  title: raw.title,
  description: raw.description,
  level: raw.skill_level || raw.level || 'beginner',
  isPaid: raw.is_free !== undefined ? !raw.is_free : raw.isPaid ?? false,
  price: raw.price,
  isBarterAvailable: raw.barter_available ?? raw.isBarterAvailable ?? false,
  barterPreferences: raw.barter_description || raw.barterPreferences,
  userId: raw.user_id || raw.userId,
  categoryId: raw.category_id || raw.categoryId,
  isActive: raw.is_active ?? raw.isActive ?? true,
  createdAt: raw.created_at || raw.createdAt,
  updatedAt: raw.updated_at || raw.updatedAt,
  user: raw.user,
  category: raw.category,
  averageRating: raw.average_rating ?? raw.averageRating,
});

const levelColors: Record<string, string> = {
  beginner: 'info',
  intermediate: 'warning',
  advanced: 'primary',
  expert: 'success',
};

const MySkillsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [listings, setListings] = useState<SkillListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchListings = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const raw = await getMySkillListings(user.id);
      setListings(Array.isArray(raw) ? raw.map(mapListing) : []);
    } catch (err: any) {
      notifyError('Load Failed', err?.message || 'Could not load your skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteSkillListing(id);
      setListings((prev) => prev.filter((s) => s.id !== id));
      success('Skill Removed', 'Listing has been archived.');
    } catch (err: any) {
      notifyError('Delete Failed', err?.message || 'Could not delete listing');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Skills</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage your listed swap and barter skills.
          </p>
        </div>
        <Link to="/skills/create">
          <Button leftIcon={<Plus className="w-4 h-4" />}>Add Skill</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-500 dark:text-surface-400 mb-4">You have no skill listings yet.</p>
          <Link to="/skills/create">
            <Button leftIcon={<Plus className="w-4 h-4" />}>Create Your First Listing</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {listings.map((s) => (
            <Card key={s.id} className="p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{s.title}</h3>
                <Badge variant={(levelColors[s.level] as any) || 'default'}>{s.level}</Badge>
              </div>
              {s.description && (
                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3">{s.description}</p>
              )}
              {s.category && (
                <p className="text-xs text-surface-500 mb-4">{s.category.name}</p>
              )}
              <div className="flex gap-2">
                <Link to={`/skills/${s.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full" leftIcon={<Pencil className="w-3.5 h-3.5" />}>
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger-500 hover:bg-danger-50"
                  leftIcon={deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySkillsPage;
