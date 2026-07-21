import { useState, useEffect } from 'react';
import { Shield, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import apiClient from '../../api/client';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  is_enabled: boolean;
  target_roles: string[];
  target_levels: number[];
  percentage: number;
  created_at: string;
}

const MOCK_FLAGS: FeatureFlag[] = [
  { id: '1', name: 'dark_mode', description: 'Enable dark mode toggle for students', is_enabled: true, target_roles: ['student'], target_levels: [100, 200, 300, 400], percentage: 100 },
  { id: '2', name: 'gpa_predictor', description: 'AI-powered GPA prediction feature', is_enabled: false, target_roles: ['student'], target_levels: [300, 400], percentage: 50 },
  { id: '3', name: 'bulk_transcript', description: 'Batch transcript generation for admin', is_enabled: true, target_roles: ['admin', 'hod'], target_levels: [], percentage: 100 },
];

const FeatureFlagsPage = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>(MOCK_FLAGS);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [formRoles, setFormRoles] = useState('');
  const [formLevels, setFormLevels] = useState('');
  const [formPercentage, setFormPercentage] = useState(100);

  useEffect(() => {
    const fetchFlags = async () => {
      setLoading(true);
      try {
        // const res = await apiClient.get('/feature-flags');
        // setFlags(res.data.data || []);
      } catch {
        // fallback to mock data
      } finally {
        setLoading(false);
      }
    };
    fetchFlags();
  }, []);

  const toggleFlag = async (id: string) => {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, is_enabled: !f.is_enabled } : f)));
    try {
      // const flag = flags.find((f) => f.id === id);
      // await apiClient.put(`/feature-flags/${id}`, { is_enabled: !flag?.is_enabled });
    } catch {
      // revert on error
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, is_enabled: !f.is_enabled } : f)));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const newFlag: FeatureFlag = {
      id: String(Date.now()),
      name: formName,
      description: formDesc,
      is_enabled: formEnabled,
      target_roles: formRoles.split(',').map((r) => r.trim()).filter(Boolean),
      target_levels: formLevels.split(',').map((l) => parseInt(l.trim(), 10)).filter((n) => !isNaN(n)),
      percentage: Number(formPercentage),
      created_at: new Date().toISOString(),
    };
    setFlags((prev) => [...prev, newFlag]);
    try {
      // await apiClient.post('/feature-flags', { ...newFlag, id: undefined });
    } catch {
      // silent
    }
    setFormName('');
    setFormDesc('');
    setFormEnabled(false);
    setFormRoles('');
    setFormLevels('');
    setFormPercentage(100);
    setShowForm(false);
  };

  const statusColor = (enabled: boolean) =>
    enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Feature Flags</h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">Toggle features on or off and control rollout percentage</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Flag
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">Create Feature Flag</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. new_dashboard"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What does this flag control?"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Target Roles (comma-separated)</label>
                <input
                  value={formRoles}
                  onChange={(e) => setFormRoles(e.target.value)}
                  placeholder="student, lecturer"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Target Levels (comma-separated)</label>
                <input
                  value={formLevels}
                  onChange={(e) => setFormLevels(e.target.value)}
                  placeholder="100, 200, 300"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Rollout Percentage</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formPercentage}
                  onChange={(e) => setFormPercentage(Number(e.target.value))}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Enabled</label>
                <button
                  type="button"
                  onClick={() => setFormEnabled(!formEnabled)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm transition-all"
                >
                  {formEnabled ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-surface-400" />
                  )}
                  <span className="text-surface-700 dark:text-surface-300">{formEnabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Create Flag
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-surface-500">Loading feature flags...</span>
            </div>
          ) : flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">No feature flags configured</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Create your first flag to start rolling out features gradually</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Flag</th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Target Roles</th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Target Levels</th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Rollout</th>
                  <th className="text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                {flags.map((flag) => (
                  <tr key={flag.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-surface-900 dark:text-white">{flag.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-surface-500 dark:text-surface-400">{flag.description || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusColor(flag.is_enabled)}`}>
                        {flag.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {flag.target_roles.length > 0 ? flag.target_roles.map((role) => (
                          <span key={role} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-medium">
                            {role}
                          </span>
                        )) : (
                          <span className="text-xs text-surface-400">All</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {flag.target_levels.length > 0 ? flag.target_levels.map((lvl) => (
                          <span key={lvl} className="text-[10px] px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 font-medium">
                            {lvl}
                          </span>
                        )) : (
                          <span className="text-xs text-surface-400">All</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all"
                            style={{ width: `${flag.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{flag.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleFlag(flag.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-surface-100 dark:hover:bg-surface-800"
                      >
                        {flag.is_enabled ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">On</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-surface-400" />
                            <span className="text-surface-500">Off</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureFlagsPage;
