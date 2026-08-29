import { useState } from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import Tabs from '../../components/ui/Tabs';
import GPACalculatorTab from './GPACalculatorPage';
import WhatIfSimulatorTab from './WhatIfSimulatorPage';

const gpaTabs = [
  { id: 'whatif', label: 'What-If Simulator', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'calculator', label: 'GPA Calculator', icon: <Calculator className="w-4 h-4" /> },
];

export default function GPAHubPage() {
  const [activeTab, setActiveTab] = useState('whatif');

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">GPA Tools</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Run what-if scenarios and calculate your GPA
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="px-4">
            <Tabs tabs={gpaTabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div className="p-4">
            {activeTab === 'whatif' && <WhatIfSimulatorTab />}
            {activeTab === 'calculator' && <GPACalculatorTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
