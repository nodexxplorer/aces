import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import SkillCard from '../../components/ui/SkillCard';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, Plus, ArrowRightLeft } from 'lucide-react';
import type { SkillListing } from '../../types';

const mockSkills: SkillListing[] = [
  {
    id: 's-1',
    title: 'React & TypeScript Development',
    description: 'Help build high performance web interfaces. Open to swap with UI design principles.',
    level: 'expert',
    isBarterAvailable: true,
    isPaid: false,
    user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: '', roles: [], role: 'student', activeRole: 'student', isApproved: true, approvalStatus: 'approved', isActive: true, createdAt: '' },
    category: { id: 'cat-1', name: 'Software Development' },
    averageRating: 4.8,
  },
];

const SkillsTradePage = () => {
  const { success } = useNotification();
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<SkillListing[]>(mockSkills);
  const [createOpen, setCreateOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillListing | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLevel, setNewLevel] = useState('intermediate');

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDesc) return;
    const newSkill: SkillListing = {
      id: `s-${Date.now()}`,
      title: newTitle,
      description: newDesc,
      level: newLevel as any,
      isBarterAvailable: true,
      isPaid: false,
      user: { id: 'me', firstName: 'Aces', lastName: 'Member', email: '', roles: [], role: 'student', activeRole: 'student', isApproved: true, approvalStatus: 'approved', isActive: true, createdAt: '' },
      category: { id: 'cat-1', name: 'Software Development' },
    };
    setListings((prev) => [newSkill, ...prev]);
    setCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
    success('Skill Listed', 'Your skill has been added to the trade marketplace.');
  };

  const handleSendOffer = () => {
    success('Offer Submitted', 'Barter trade request dispatched to the skill provider.');
    setOfferOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Skills Trade</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Swap practical engineering skills, design talent, or study guides via barter deals.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Add Skill Listing
        </Button>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((s) => (
          <SkillCard
            key={s.id}
            skill={s}
            onClick={() => {
              setSelectedSkill(s);
              setOfferOpen(true);
            }}
          />
        ))}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Skill Listing">
        <form onSubmit={handleCreateListing} className="space-y-4">
          <Input label="Skill Title" placeholder="e.g. PCB Design with Altium" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          <Select
            label="Skill Level"
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'expert', label: 'Expert' },
            ]}
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              placeholder="Detail what you offer and what you are looking to swap..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
            Publish Listing
          </Button>
        </form>
      </Modal>

      <Modal isOpen={offerOpen} onClose={() => setOfferOpen(false)} title="Initiate Barter Deal">
        {selectedSkill && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-base">{selectedSkill.title}</h4>
              <p className="text-xs text-surface-500">Provider: {selectedSkill.user?.firstName} {selectedSkill.user?.lastName}</p>
              <p className="text-sm text-surface-700 dark:text-surface-300 mt-2">{selectedSkill.description}</p>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-800 pt-4 space-y-4">
              <Select
                label="Offer One of Your Listed Skills"
                options={[
                  { value: 'my-1', label: 'UI Design Fundamentals' },
                ]}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Proposal Details</label>
                <textarea
                  placeholder="Explain why this swap is mutually beneficial..."
                  className="w-full h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                />
              </div>
              <Button className="w-full" leftIcon={<ArrowRightLeft className="w-4 h-4" />} onClick={handleSendOffer}>
                Submit Proposal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillsTradePage;
