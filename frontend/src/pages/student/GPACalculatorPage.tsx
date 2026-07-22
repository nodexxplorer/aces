import { useState, useEffect } from 'react';
import { Calculator, Save, Trash2, Plus, TrendingUp, BarChart3 } from 'lucide-react';
import { createGPAScenario, listGPAScenarios, deleteGPAScenario, type GPAScenario } from '../../api/additional-features';

interface CourseRow {
  id: string;
  code: string;
  title: string;
  units: number;
  grade: string;
}

const gradeMap: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function newRow(): CourseRow {
  return { id: generateId(), code: '', title: '', units: 3, grade: 'A' };
}

export default function GPACalculatorPage() {
  const [courses, setCourses] = useState<CourseRow[]>([newRow()]);
  const [scenarioName, setScenarioName] = useState('');
  const [savedScenarios, setSavedScenarios] = useState<GPAScenario[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    try {
      const data = await listGPAScenarios();
      setSavedScenarios(data);
    } catch {
      setSavedScenarios([]);
    }
  }

  function updateCourse(id: string, field: keyof CourseRow, value: string | number) {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function removeCourse(id: string) {
    if (courses.length === 1) return;
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  function addCourse() {
    setCourses((prev) => [...prev, newRow()]);
  }

  const totalCredits = courses.reduce((sum, c) => sum + (c.units || 0), 0);
  const totalPoints = courses.reduce(
    (sum, c) => sum + (c.units || 0) * (gradeMap[c.grade] ?? 0),
    0
  );
  const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

  function gpaColor() {
    if (gpa >= 3.5) return 'text-emerald-500';
    if (gpa >= 2.5) return 'text-yellow-500';
    return 'text-red-500';
  }

  async function handleSave() {
    if (!scenarioName.trim()) return;
    setSaving(true);
    try {
      await createGPAScenario({
        name: scenarioName.trim(),
        courses: courses
          .filter((c) => c.code.trim())
          .map((c) => ({
            code: c.code,
            title: c.title,
            units: c.units,
            grade: c.grade,
          })),
      });
      setScenarioName('');
      await loadScenarios();
    } catch (err) {
      console.error('Failed to save scenario', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGPAScenario(id);
      await loadScenarios();
    } catch (err) {
      console.error('Failed to delete scenario', err);
    }
  }

  const gradeScale = [
    { grade: 'A', point: 5, desc: 'Excellent' },
    { grade: 'B', point: 4, desc: 'Very Good' },
    { grade: 'C', point: 3, desc: 'Good' },
    { grade: 'D', point: 2, desc: 'Pass' },
    { grade: 'E', point: 1, desc: 'Poor' },
    { grade: 'F', point: 0, desc: 'Fail' },
  ];

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
              GPA Calculator
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Scenario name..."
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleSave}
              disabled={saving || !scenarioName.trim()}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Scenario
            </button>
          </div>
        </div>

        {/* GPA Display */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="text-center">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">GPA</p>
              <p className={`text-6xl font-bold transition-colors duration-500 ${gpaColor()}`}>
                {gpa.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Credits</p>
              <p className="text-3xl font-semibold text-surface-900 dark:text-white">
                {totalCredits}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Total Points</p>
              <p className="text-3xl font-semibold text-surface-900 dark:text-white">
                {totalPoints}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">Courses</p>
              <p className="text-3xl font-semibold text-surface-900 dark:text-white">
                {courses.length}
              </p>
            </div>
          </div>
        </div>

        {/* Course Table */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              What-If Calculator
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-surface-500 dark:text-surface-400">
                  <th className="px-6 py-3 font-medium">Course Code</th>
                  <th className="px-6 py-3 font-medium">Course Title</th>
                  <th className="px-6 py-3 font-medium">Credit Units</th>
                  <th className="px-6 py-3 font-medium">Expected Grade</th>
                  <th className="px-6 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-t border-surface-100 dark:border-surface-800"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="e.g. MTH101"
                        value={course.code}
                        onChange={(e) => updateCourse(course.id, 'code', e.target.value)}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="e.g. Calculus I"
                        value={course.title}
                        onChange={(e) => updateCourse(course.id, 'title', e.target.value)}
                        className="w-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={course.units}
                        onChange={(e) =>
                          updateCourse(course.id, 'units', Math.max(1, Math.min(6, Number(e.target.value))))
                        }
                        className="w-20 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={course.grade}
                        onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}
                        className="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm"
                      >
                        {Object.entries(gradeMap).map(([g, pts]) => (
                          <option key={g} value={g}>
                            {g} ({pts})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeCourse(course.id)}
                        disabled={courses.length === 1}
                        className="p-2 text-surface-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-surface-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-surface-100 dark:border-surface-800">
            <button
              onClick={addCourse}
              className="flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          </div>
        </div>

        {/* Grade Scale & Saved Scenarios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Grade Scale */}
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" />
              Grade Scale Reference
            </h2>
            <div className="space-y-3">
              {gradeScale.map((item) => (
                <div
                  key={item.grade}
                  className="flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold">
                      {item.grade}
                    </span>
                    <span className="text-sm text-surface-600 dark:text-surface-300">
                      {item.desc}
                    </span>
                  </div>
                  <span className="font-semibold text-surface-900 dark:text-white">
                    {item.point} pt{item.point !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Scenarios */}
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5" />
              Saved Scenarios
            </h2>
            {savedScenarios.length === 0 ? (
              <div className="text-center py-12 text-surface-400 dark:text-surface-500">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No saved scenarios yet.</p>
                <p className="text-xs mt-1">Enter courses above and save a scenario.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedScenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">
                        {scenario.name}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        GPA: {(scenario as any).gpa?.toFixed(2) ?? 'N/A'} &middot;{' '}
                        {new Date(scenario.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(scenario.id)}
                      className="p-2 text-surface-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
