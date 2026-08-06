import { useState, useEffect } from 'react';
import { Shield, Plus, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import {
  listFeatureFlags,
  createFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
  type FeatureFlag,
} from '../../api/additional-features';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';

const FeatureFlagsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [formRoles, setFormRoles] = useState('');
  const [formLevels, setFormLevels] = useState('');
  const [formPercentage, setFormPercentage] = useState(100);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const data = await listFeatureFlags();
      setFlags(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Error', 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    setTogglingId(flag.name);
    try {
      await toggleFeatureFlag(flag.name, !flag.is_enabled);
      setFlags((prev) => prev.map((f) => (f.name === flag.name ? { ...f, is_enabled: !f.is_enabled } : f)));
      success('Updated', `${flag.name} ${flag.is_enabled ? 'disabled' : 'enabled'}`);
    } catch {
      notifyError('Error', 'Failed to toggle feature flag');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const targetRoles = formRoles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const targetLevels = formLevels
        .split(',')
        .map((l) => parseInt(l.trim(), 10))
        .filter((n) => !isNaN(n));
      await createFeatureFlag({
        name: formName,
        description: formDesc || undefined,
        is_enabled: formEnabled,
        target_roles: targetRoles.length > 0 ? targetRoles : undefined,
        target_levels: targetLevels.length > 0 ? targetLevels : undefined,
        percentage: formPercentage,
      });
      success('Created', `Feature flag "${formName}" created`);
      setFormName('');
      setFormDesc('');
      setFormEnabled(false);
      setFormRoles('');
      setFormLevels('');
      setFormPercentage(100);
      setShowForm(false);
      fetchFlags();
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to create feature flag'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete feature flag "${name}"?`)) return;
    try {
      await deleteFeatureFlag(name);
      setFlags((prev) => prev.filter((f) => f.name !== name));
      success('Deleted', `Feature flag "${name}" deleted`);
    } catch {
      notifyError('Error', 'Failed to delete feature flag');
    }
  };

  const statusColor = (enabled: boolean) =>
    enabled
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400';

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
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Toggle features on or off and control rollout percentage
              </p>
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
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Target Roles (comma-separated)
                </label>
                <input
                  value={formRoles}
                  onChange={(e) => setFormRoles(e.target.value)}
                  placeholder="student, lecturer"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Target Levels (comma-separated)
                </label>
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
                  disabled={creating}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Flag
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              <span className="ml-3 text-sm text-surface-500">Loading feature flags...</span>
            </div>
          ) : flags.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">No feature flags configured</p>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                Create your first flag to start rolling out features gradually
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100 dark:border-surface-800">
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Flag
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Description
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Target Roles
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Target Levels
                  </th>
                  <th className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Rollout
                  </th>
                  <th className="text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
                {flags.map((flag) => (
                  <tr key={flag.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-surface-900 dark:text-white">
                        {flag.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-surface-500 dark:text-surface-400">{flag.description || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusColor(flag.is_enabled)}`}
                      >
                        {flag.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {flag.target_roles && flag.target_roles.length > 0 ? (
                          flag.target_roles.map((role) => (
                            <span
                              key={role}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-surface-400">All</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {flag.target_levels && flag.target_levels.length > 0 ? (
                          flag.target_levels.map((lvl) => (
                            <span
                              key={lvl}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 font-medium"
                            >
                              {lvl}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-surface-400">All</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all"
                            style={{ width: `${flag.percentage ?? 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-surface-600 dark:text-surface-400">
                          {flag.percentage ?? 100}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(flag)}
                          disabled={togglingId === flag.name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-50"
                        >
                          {togglingId === flag.name ? (
                            <Loader2 className="w-5 h-5 animate-spin text-surface-400" />
                          ) : flag.is_enabled ? (
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
                        <button
                          onClick={() => handleDelete(flag.name)}
                          className="inline-flex items-center p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
