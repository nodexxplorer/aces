import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { getMyApprovedResults, simulateCgpa, type ApprovedResultDetail, type CGPASimulation } from '../../api/cgpa';
import { getCourses } from '../../api/courses';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import type { Course } from '../../types';
import EmptyState from '../../components/ui/EmptyState';

interface OverrideRow {
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  score: string;
}

export default function WhatIfSimulatorTab() {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [results, setResults] = useState<ApprovedResultDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, OverrideRow>>({});
  const [simulation, setSimulation] = useState<CGPASimulation | null>(null);
  const [simulating, setSimulating] = useState(false);

  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [addCourseId, setAddCourseId] = useState('');
  const [addScore, setAddScore] = useState('');

  useEffect(() => {
    getMyApprovedResults()
      .then(setResults)
      .catch(() => notifyError('Error', 'Failed to load your results'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const level = user?.level;
    getCourses({ level, perPage: 100 })
      .then(setAvailableCourses)
      .catch(() => {});
  }, [user]);

  const takenCourseIds = useMemo(() => new Set(results.map((r) => r.course_id)), [results]);
  const addableCourses = availableCourses.filter((c) => !takenCourseIds.has(c.id) && !overrides[c.id]);

  const setOverrideScore = (course: ApprovedResultDetail, score: string) => {
    setOverrides((prev) => ({
      ...prev,
      [course.course_id]: {
        course_id: course.course_id,
        course_code: course.course_code,
        course_title: course.course_title,
        unit: course.unit,
        score,
      },
    }));
  };

  const handleAddCourse = () => {
    const course = availableCourses.find((c) => c.id === addCourseId);
    if (!course || !addScore) return;
    setOverrides((prev) => ({
      ...prev,
      [course.id]: {
        course_id: course.id,
        course_code: course.code,
        course_title: course.title,
        unit: course.unit,
        score: addScore,
      },
    }));
    setAddCourseId('');
    setAddScore('');
  };

  const handleRemoveOverride = (courseId: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  const handleReset = () => {
    setOverrides({});
    setSimulation(null);
  };

  const handleSimulate = async () => {
    const rows = Object.values(overrides).filter((o) => o.score.trim() !== '');
    if (rows.length === 0) {
      notifyError('Nothing to Simulate', 'Enter at least one hypothetical score first.');
      return;
    }
    setSimulating(true);
    try {
      const result = await simulateCgpa(rows.map((r) => ({ course_id: r.course_id, score: Number(r.score) })));
      setSimulation(result);
    } catch (err: unknown) {
      notifyError('Simulation Failed', getErrorMessage(err, 'Could not run simulation'));
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary-500/10 shrink-0">
          <Sparkles className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">CGPA What-If Simulator</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Adjust a hypothetical score below and see what your CGPA would become — based on your real, approved
            results.
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          title="No approved results yet. Once your results are approved, you'll be able to simulate hypothetical scores here."
          className="py-8"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-4 py-2.5 font-medium text-surface-500 dark:text-surface-400">Course</th>
                <th className="text-left px-4 py-2.5 font-medium text-surface-500 dark:text-surface-400">Unit</th>
                <th className="text-left px-4 py-2.5 font-medium text-surface-500 dark:text-surface-400">
                  Actual Score
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-surface-500 dark:text-surface-400">
                  Hypothetical Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {results.map((r) => (
                <tr key={r.course_id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-surface-900 dark:text-surface-100">{r.course_code}</p>
                    <p className="text-xs text-surface-400">{r.course_title}</p>
                  </td>
                  <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{r.unit}</td>
                  <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">
                    {r.score.toFixed(1)} ({r.grade})
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder={r.score.toFixed(0)}
                      value={overrides[r.course_id]?.score ?? ''}
                      onChange={(e) => setOverrideScore(r, e.target.value)}
                      className="w-24 px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </td>
                </tr>
              ))}
              {Object.values(overrides)
                .filter((o) => !takenCourseIds.has(o.course_id))
                .map((o) => (
                  <tr key={o.course_id} className="bg-primary-50/30 dark:bg-primary-950/10">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-surface-900 dark:text-surface-100">{o.course_code}</p>
                      <p className="text-xs text-surface-400">{o.course_title} · not yet graded</p>
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{o.unit}</td>
                    <td className="px-4 py-2.5 text-surface-400">—</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{o.score}</span>
                        <button
                          onClick={() => handleRemoveOverride(o.course_id)}
                          className="text-danger-500 hover:text-danger-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {addableCourses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
          <span className="text-xs font-medium text-surface-500 shrink-0">
            Simulate a course you haven't taken yet:
          </span>
          <select
            value={addCourseId}
            onChange={(e) => setAddCourseId(e.target.value)}
            className="flex-1 w-full sm:w-auto px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900"
          >
            <option value="">Select a course...</option>
            {addableCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Score"
            value={addScore}
            onChange={(e) => setAddScore(e.target.value)}
            className="w-24 px-2 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900"
          />
          <button
            onClick={handleAddCourse}
            disabled={!addCourseId || !addScore}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {simulating ? 'Simulating...' : 'Run Simulation'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {simulation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
            <p className="text-xs text-surface-500 font-medium">Current CGPA</p>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
              {simulation.current_cgpa.toFixed(2)}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Projected CGPA</p>
            <p
              className={`text-2xl font-bold mt-1 ${simulation.projected_cgpa >= simulation.current_cgpa ? 'text-success-600' : 'text-danger-600'}`}
            >
              {simulation.projected_cgpa.toFixed(2)}
              <span className="text-sm ml-2 font-medium">
                ({simulation.projected_cgpa >= simulation.current_cgpa ? '+' : ''}
                {(simulation.projected_cgpa - simulation.current_cgpa).toFixed(2)})
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
