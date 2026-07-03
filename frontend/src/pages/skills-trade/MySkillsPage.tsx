import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const mockMySkills = [
  { id: '1', title: 'React & TypeScript Development', level: 'Expert' },
];

const MySkillsPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState(mockMySkills);

  const handleDelete = (id: string) => {
    setList((prev) => prev.filter((s) => s.id !== id));
    success('Skill Removed', 'Successfully archived listing.');
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {list.map((s) => (
          <Card key={s.id} className="p-6">
            <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">{s.title}</h3>
            <p className="text-xs text-primary-500 mb-4">{s.level}</p>
            <Button variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(s.id)}>
              Archive Listing
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MySkillsPage;
