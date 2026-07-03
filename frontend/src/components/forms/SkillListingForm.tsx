import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface SkillListingFormProps {
  onSubmit: (data: { title: string; description: string; categoryId: string; level: 'beginner' | 'intermediate' | 'expert'; isPaid: boolean; price?: number; isBarterAvailable: boolean; barterPreferences?: string; availability?: string }) => void;
  categories: { id: string; name: string }[];
  isLoading?: boolean;
}

const SkillListingForm = ({ onSubmit, categories, isLoading }: SkillListingFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [isBarterAvailable, setIsBarterAvailable] = useState(true);
  const [barterPreferences, setBarterPreferences] = useState('');
  const [availability, setAvailability] = useState('Flexible');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      categoryId,
      level,
      isPaid,
      price: isPaid ? parseFloat(price || '0') : undefined,
      isBarterAvailable,
      barterPreferences: isBarterAvailable ? barterPreferences : undefined,
      availability,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Service / Skill Title"
        placeholder="e.g. Graphic Design tutoring, Python Assignment help"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
        <Select
          label="My Skill Level"
          options={[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'expert', label: 'Expert' },
          ]}
          value={level}
          onChange={(e) => setLevel(e.target.value as any)}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Detailed Description of Service
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Describe what you can offer, tools you use..."
          required
        />
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skill-is-paid"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="rounded border-surface-300 dark:border-surface-700 text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="skill-is-paid" className="text-sm text-surface-700 dark:text-surface-300">
            Paid Service
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skill-is-barter"
            checked={isBarterAvailable}
            onChange={(e) => setIsBarterAvailable(e.target.checked)}
            className="rounded border-surface-300 dark:border-surface-700 text-primary-500 focus:ring-primary-500"
          />
          <label htmlFor="skill-is-barter" className="text-sm text-surface-700 dark:text-surface-300">
            Open to Barter/Trade
          </label>
        </div>
      </div>
      {isPaid && (
        <Input
          label="Price (NGN)"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      )}
      {isBarterAvailable && (
        <Input
          label="Barter Preferences / What I want to learn"
          placeholder="e.g. Looking for Figma design tips, math tutoring"
          value={barterPreferences}
          onChange={(e) => setBarterPreferences(e.target.value)}
        />
      )}
      <Input
        label="Availability schedule"
        placeholder="e.g. Evenings, Weekends, Flexible"
        value={availability}
        onChange={(e) => setAvailability(e.target.value)}
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        List Skill Service
      </Button>
    </form>
  );
};

export default SkillListingForm;
