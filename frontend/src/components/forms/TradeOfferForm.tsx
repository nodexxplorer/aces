import React, { useState } from 'react';
import Button from '../ui/Button';
import Select from '../ui/Select';

interface TradeOfferFormProps {
  mySkills: { id: string; title: string }[];
  recipientSkills: { id: string; title: string }[];
  onSubmit: (data: { offererSkillId: string; recipientSkillId: string; offererDescription: string }) => void;
  isLoading?: boolean;
}

const TradeOfferForm = ({ mySkills, recipientSkills, onSubmit, isLoading }: TradeOfferFormProps) => {
  const [offererSkillId, setOffererSkillId] = useState(mySkills[0]?.id || '');
  const [recipientSkillId, setRecipientSkillId] = useState(recipientSkills[0]?.id || '');
  const [offererDescription, setOffererDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ offererSkillId, recipientSkillId, offererDescription });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Skill I Am Offering to Teach You"
        options={mySkills.map((s) => ({ value: s.id, label: s.title }))}
        value={offererSkillId}
        onChange={(e) => setOffererSkillId(e.target.value)}
      />
      <Select
        label="Skill I Want to Learn From You"
        options={recipientSkills.map((s) => ({ value: s.id, label: s.title }))}
        value={recipientSkillId}
        onChange={(e) => setRecipientSkillId(e.target.value)}
      />
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Barter Proposal Details / Note
        </label>
        <textarea
          rows={3}
          value={offererDescription}
          onChange={(e) => setOffererDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Describe how the skill exchange would work (e.g. 2 hours of python for 2 hours of design)..."
          required
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Send Barter Trade Offer
      </Button>
    </form>
  );
};

export default TradeOfferForm;
