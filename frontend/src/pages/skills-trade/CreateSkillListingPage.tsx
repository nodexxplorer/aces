import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Plus, Edit, Loader2 } from 'lucide-react';
import { createSkillListing, updateSkillListing, getSkillListing, getSkillCategories } from '../../api/skills-trade';
import type { SkillCategory } from '../../types';

const CreateSkillListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [barterAvailable, setBarterAvailable] = useState(false);
  const [barterDescription, setBarterDescription] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const cats = await getSkillCategories();
        setCategories(Array.isArray(cats) ? cats : []);

        if (id) {
          const listing: any = await getSkillListing(id);
          if (listing) {
            setTitle(listing.title || '');
            setDescription(listing.description || '');
            setCategoryId(listing.category_id || listing.categoryId || '');
            setSkillLevel(listing.skill_level || listing.skillLevel || 'intermediate');
            setIsFree(listing.is_free ?? listing.isFree ?? true);
            setPrice(listing.price ? String(listing.price) : '');
            setBarterAvailable(listing.barter_available ?? listing.barterAvailable ?? false);
            setBarterDescription(listing.barter_description || listing.barterDescription || '');
            setPortfolioUrl(listing.portfolio_url || listing.portfolioUrl || '');
          }
        }
      } catch (err: any) {
        notifyError('Error', err?.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;
    try {
      setSubmitting(true);
      const payload = {
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || undefined,
        skill_level: skillLevel,
        price: !isFree && price ? Number(price) : undefined,
        is_free: isFree,
        barter_available: barterAvailable,
        barter_description: barterAvailable ? barterDescription.trim() || undefined : undefined,
        portfolio_url: portfolioUrl.trim() || undefined,
      };

      if (id) {
        await updateSkillListing(id, {
          title: payload.title,
          description: payload.description,
          skill_level: payload.skill_level,
          price: payload.price,
          is_free: payload.is_free,
          barter_available: payload.barter_available,
          barter_description: payload.barter_description,
          portfolio_url: payload.portfolio_url,
          is_active: true,
        });
        success('Skill Updated', 'Your skill listing has been updated.');
      } else {
        await createSkillListing(payload);
        success('Skill Listed', 'Your skill has been added to the marketplace.');
      }
      navigate('/skills/my-skills');
    } catch (err: any) {
      notifyError('Failed', err?.message || (id ? 'Could not update listing' : 'Could not create listing'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2 text-surface-500">
        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
          {isEditMode ? 'Edit Skill Listing' : 'Add Skill Listing'}
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          {isEditMode ? 'Update the details of your offered skill listing.' : 'Advertise your technical or academic skills to exchange for others.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? 'Edit Skill Details' : 'Skill Information'}</CardTitle>
          <CardDescription>Detail what you offer and what you are looking to swap</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
          <Input
            label="Skill Title"
            placeholder="e.g. PCB Design with Altium"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Select
            label="Category"
            placeholder="Select a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isEditMode}
          />
          <Select
            label="Skill Level"
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
              { value: 'expert', label: 'Expert' },
            ]}
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              placeholder="Detail what you offer..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Free</label>
            <button
              type="button"
              onClick={() => setIsFree(!isFree)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFree ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFree ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {!isFree && (
            <Input
              label="Price (NGN)"
              type="number"
              placeholder="e.g. 5000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Barter Available</label>
            <button
              type="button"
              onClick={() => setBarterAvailable(!barterAvailable)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${barterAvailable ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${barterAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {barterAvailable && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Barter Description</label>
              <textarea
                placeholder="What would you like in exchange?"
                className="w-full h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                value={barterDescription}
                onChange={(e) => setBarterDescription(e.target.value)}
              />
            </div>
          )}

          <Input
            label="Portfolio URL"
            placeholder="https://..."
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditMode ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
          >
            {submitting ? (isEditMode ? 'Updating...' : 'Publishing...') : (isEditMode ? 'Update Listing' : 'Publish Listing')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CreateSkillListingPage;
