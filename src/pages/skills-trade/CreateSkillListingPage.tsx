import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateSkillListingPage = () => {
  const { success } = useNotification();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [level, setLevel] = useState('intermediate');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !desc) return;
    success('Skill Listed', 'Successfully added skill to trade marketplace.');
    navigate('/skills/my-skills');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Add Skill Listing</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Advertise your technical or academic skills to exchange for others.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skill Information</CardTitle>
          <CardDescription>Detail what you offer and what you are looking to swap</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
          <Input label="Skill Title" placeholder="e.g. PCB Design with Altium" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Select
            label="Skill Level"
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'expert', label: 'Expert' },
            ]}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              placeholder="Detail what you offer..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
            Publish Listing
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default CreateSkillListingPage;
