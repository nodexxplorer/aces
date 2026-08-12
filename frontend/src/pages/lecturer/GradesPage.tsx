import { useState } from 'react';
import Tabs from '../../components/ui/Tabs';
import { PenLine, Database, ClipboardList } from 'lucide-react';
import { SingleEntryTab } from './SingleEntryPage';
import { BulkUploadTab } from './BulkUploadPage';
import { ScoresTab } from './EnterScoresPage';

type Tab = 'single' | 'bulk' | 'scores';

export default function GradesPage() {
  const [tab, setTab] = useState<Tab>('single');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grades</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Enter, import, and edit Continuous Assessment and Examination scores for your courses.
        </p>
      </div>

      <Tabs
        tabs={[
          { id: 'single', label: 'Single Entry', icon: <PenLine className="w-4 h-4" /> },
          { id: 'bulk', label: 'Bulk Upload', icon: <Database className="w-4 h-4" /> },
          { id: 'scores', label: 'Enter Scores', icon: <ClipboardList className="w-4 h-4" /> },
        ]}
        activeTab={tab}
        onChange={(t) => setTab(t as Tab)}
      />

      {tab === 'single' && <SingleEntryTab />}
      {tab === 'bulk' && <BulkUploadTab />}
      {tab === 'scores' && <ScoresTab />}
    </div>
  );
}
