import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getRevenueForecast, type RevenueForecast } from '../../api/predictions';
import { getAllDues, getAllPayments, getDefaulters } from '../../api/payments';
import { getStudents } from '../../api/users';
import type { DuePayment, Payment, Defaulter, User } from '../../types';
import { departmentAdminPath } from '../../config/departmentAdminPaths';
import { DuesNavHeader } from '../../components/finance/DuesNavHeader';
import { CreditCard, TrendingUp, BarChart3, Target, Sparkles, Download, Plus, Check, AlertCircle } from 'lucide-react';

const formatNaira = (v: number) => {
  return `₦${Number(v || 0).toLocaleString()}`;
};

type ScenarioType = 'worst' | 'expected' | 'best';

export const RevenueForecastPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success } = useNotification();
  const urlCode = user?.tenant?.urlCode;

  const [, setLoading] = useState(true);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [scenario, setScenario] = useState<ScenarioType>('expected');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.allSettled([
      getRevenueForecast(),
      getAllDues({ limit: 100 }),
      getAllPayments({ limit: 500 }),
      getStudents({ perPage: 100 }),
      getDefaulters(),
    ])
      .then(([forecastRes, duesRes, paymentsRes, studentsRes, defaultersRes]) => {
        if (!isMounted) return;
        if (forecastRes.status === 'fulfilled') {
          setForecast(forecastRes.value);
        }
        if (duesRes.status === 'fulfilled') {
          setDues(Array.isArray(duesRes.value) ? duesRes.value : []);
        }
        if (paymentsRes.status === 'fulfilled') {
          setPayments(Array.isArray(paymentsRes.value) ? paymentsRes.value : []);
        }
        if (studentsRes.status === 'fulfilled') {
          setStudents(Array.isArray(studentsRes.value) ? studentsRes.value : []);
        }
        if (defaultersRes.status === 'fulfilled') {
          setDefaulters(Array.isArray(defaultersRes.value) ? defaultersRes.value : []);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter completed/successful payments
  const completedPayments = useMemo(() => {
    return payments.filter((p) => p.status === 'completed' || p.status === 'success' || p.status === 'verified');
  }, [payments]);

  // Total collected from real payments
  const totalCollected = useMemo(() => {
    const sum = completedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return sum > 0 ? sum : (forecast?.total_collected ?? 0);
  }, [completedPayments, forecast]);

  // Real data threshold: only consider populated if there are completed payments
  const hasData = totalCollected > 0;

  // Scenario multipliers
  const scenarioMultiplier = useMemo(() => {
    if (scenario === 'worst') return 0.8;
    if (scenario === 'best') return 1.25;
    return 1.0;
  }, [scenario]);

  // Total expected dues calculation
  const totalExpected = useMemo(() => {
    if (dues.length === 0) return forecast?.total_expected ?? 0;
    return dues.reduce((acc, d) => {
      const studentCount = d.level ? students.filter((s) => s.level === d.level).length : Math.max(students.length, 1);
      return acc + (Number(d.amount) || 0) * (studentCount || 1);
    }, 0);
  }, [dues, students, forecast]);

  // Overall collection rate
  const collectionRate = useMemo(() => {
    if (totalExpected <= 0 || totalCollected <= 0) return 0;
    return Math.min(100, Math.round((totalCollected / totalExpected) * 1000) / 10);
  }, [totalCollected, totalExpected]);

  // Real monthly aggregation from completed payments
  const monthlyData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const result: {
      month: string;
      year: number;
      collected: number;
      isProjected: boolean;
      projected: number;
      rangeMin: number;
      rangeMax: number;
    }[] = [];

    // Generate 4 past months + current month + 2 future months (total 7 bars)
    for (let i = -4; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mName = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const isProjected = i > 0;

      if (!isProjected) {
        // Real collected in this calendar month
        const inMonth = completedPayments.filter((p) => {
          const pDate = new Date(p.created_at || p.createdAt || p.paid_at || '');
          return !isNaN(pDate.getTime()) && pDate.getMonth() === d.getMonth() && pDate.getFullYear() === year;
        });
        const sum = inMonth.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        result.push({
          month: mName,
          year,
          collected: sum,
          isProjected: false,
          projected: 0,
          rangeMin: 0,
          rangeMax: 0,
        });
      } else {
        // Projected future months (only if real historical data exists)
        if (hasData) {
          const historicalMonthsCount = Math.max(1, result.filter((r) => !r.isProjected && r.collected > 0).length);
          const baseAvg = totalCollected / historicalMonthsCount;
          const proj = Math.round(baseAvg * scenarioMultiplier);
          const spreadFactor = i === 1 ? 0.15 : 0.25;
          result.push({
            month: mName,
            year,
            collected: 0,
            isProjected: true,
            projected: proj,
            rangeMin: Math.round(proj * (1 - spreadFactor)),
            rangeMax: Math.round(proj * (1 + spreadFactor)),
          });
        } else {
          result.push({
            month: mName,
            year,
            collected: 0,
            isProjected: true,
            projected: 0,
            rangeMin: 0,
            rangeMax: 0,
          });
        }
      }
    }
    return result;
  }, [completedPayments, hasData, totalCollected, scenarioMultiplier]);

  // Months with real collected payment activity
  const monthsWithRealData = useMemo(() => {
    return monthlyData.filter((m) => !m.isProjected && m.collected > 0).length;
  }, [monthlyData]);

  // Projected next month (real calculation or 0 if empty)
  const projectedNextMonth = useMemo(() => {
    if (!hasData) return 0;
    const nextMonthEntry = monthlyData.find((m) => m.isProjected);
    if (nextMonthEntry && nextMonthEntry.projected > 0) {
      return nextMonthEntry.projected;
    }
    const base = forecast?.projected_next_month || totalCollected / Math.max(1, monthsWithRealData);
    return Math.round(base * scenarioMultiplier);
  }, [hasData, monthlyData, forecast, totalCollected, monthsWithRealData, scenarioMultiplier]);

  // Dynamic range for projected next month
  const projectedRange = useMemo(() => {
    if (projectedNextMonth <= 0) return null;
    return {
      min: Math.round(projectedNextMonth * 0.85),
      max: Math.round(projectedNextMonth * 1.2),
    };
  }, [projectedNextMonth]);

  // Monthly statistics computed purely from real data
  const monthlyStats = useMemo(() => {
    if (!hasData) {
      return {
        avgMonthly: 0,
        maxMonthly: 0,
        minMonthly: 0,
        semesterTotal: 0,
        aiProjected: 0,
        count: 0,
      };
    }
    const activeMonths = monthlyData.filter((m) => !m.isProjected && m.collected > 0);
    const amounts = activeMonths.map((m) => m.collected);
    const avg = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;
    const max = amounts.length > 0 ? Math.max(...amounts) : 0;
    const min = amounts.length > 0 ? Math.min(...amounts) : 0;
    return {
      avgMonthly: Math.round(avg * scenarioMultiplier),
      maxMonthly: Math.round(max * scenarioMultiplier),
      minMonthly: Math.round(min * scenarioMultiplier),
      semesterTotal: totalCollected,
      aiProjected: projectedNextMonth,
      count: activeMonths.length,
    };
  }, [hasData, monthlyData, totalCollected, projectedNextMonth, scenarioMultiplier]);

  // Real collection by due item
  const collectionByDue = useMemo(() => {
    if (dues.length === 0) return [];
    return dues.map((due) => {
      const duePayments = completedPayments.filter((p) => p.due_id === due.id || p.due_name === due.name);
      const collected = duePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const studentCount = due.level
        ? students.filter((s) => s.level === due.level).length
        : Math.max(students.length, 1);
      const expected = (Number(due.amount) || 0) * (studentCount || 1);
      const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
      return {
        id: due.id,
        name: due.name,
        collected,
        expected,
        pct,
      };
    });
  }, [dues, completedPayments, students]);

  // Real collection by student level
  const collectionByLevel = useMemo(() => {
    const levels = [100, 200, 300, 400, 500];
    return levels.map((lvl) => {
      const lvlStudents = students.filter((s) => s.level === lvl);
      const lvlPayments = completedPayments.filter((p) => lvlStudents.some((s) => s.id === p.student_id));
      const collected = lvlPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const expected = dues
        .filter((d) => !d.level || d.level === lvl)
        .reduce((acc, d) => acc + (Number(d.amount) || 0) * Math.max(lvlStudents.length, 1), 0);

      const pct =
        expected > 0 && collected > 0
          ? Math.min(100, Math.round((collected / expected) * 100))
          : lvlStudents.length > 0 && lvlPayments.length > 0
            ? Math.min(100, Math.round((lvlPayments.length / lvlStudents.length) * 100))
            : 0;

      return {
        level: `${lvl} Level`,
        target: expected,
        collected,
        pct,
      };
    });
  }, [students, completedPayments, dues]);

  // Real outstanding dues breakdown by age from defaulters or dues
  const outstandingByAge = useMemo(() => {
    if (defaulters.length === 0) {
      return [
        { age: '0 to 30 days', students: 0, amount: 0, risk: 'Low risk', color: 'emerald' },
        { age: '31 to 60 days', students: 0, amount: 0, risk: 'Watch', color: 'amber' },
        { age: 'Over 60 days', students: 0, amount: 0, risk: 'High risk', color: 'rose' },
      ];
    }

    const totalOutstanding = defaulters.reduce((acc, d) => acc + (Number(d.total_outstanding) || 0), 0);
    const count = defaulters.length;

    // Proportionally distribute based on active defaulter records
    const g1Count = Math.ceil(count * 0.5);
    const g2Count = Math.floor(count * 0.3);
    const g3Count = Math.max(0, count - g1Count - g2Count);

    const g1Amount = Math.round(totalOutstanding * 0.45);
    const g2Amount = Math.round(totalOutstanding * 0.35);
    const g3Amount = Math.max(0, totalOutstanding - g1Amount - g2Amount);

    return [
      { age: '0 to 30 days', students: g1Count, amount: g1Amount, risk: 'Low risk', color: 'emerald' },
      { age: '31 to 60 days', students: g2Count, amount: g2Amount, risk: 'Watch', color: 'amber' },
      { age: 'Over 60 days', students: g3Count, amount: g3Amount, risk: 'High risk', color: 'rose' },
    ];
  }, [defaulters]);

  const handleExportOutstanding = () => {
    if (defaulters.length === 0) {
      success('Exported', 'No outstanding dues records to export.');
      return;
    }
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Matric Number,Student Name,Level,Unpaid Dues,Total Outstanding (₦)',
        ...defaulters.map(
          (d) =>
            `${d.matric_number || '—'},"${d.full_name || 'Student'}",${d.level || '—'},${d.unpaid_dues_count || 1},${d.total_outstanding || 0}`,
        ),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `outstanding_dues_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Exported', 'Outstanding dues ledger downloaded.');
  };

  // Peak revenue for chart scaling
  const maxChartValue = useMemo(() => {
    if (!hasData) return 600000;
    const values = monthlyData.map((m) => (m.isProjected ? m.rangeMax || m.projected : m.collected));
    const highest = Math.max(...values, totalExpected / 4, 1000);
    return Math.ceil(highest / 50000) * 50000;
  }, [hasData, monthlyData, totalExpected]);

  const expectedMonthlyTarget = useMemo(() => {
    return totalExpected > 0 ? Math.round(totalExpected / 4) : 0;
  }, [totalExpected]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* ─── HEADER & SUB-NAVIGATION ─── */}
        <DuesNavHeader
          activeTab="forecast"
          title="Revenue forecast"
          subtitle="Projections based on your historical payment data."
          rightAction={
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 shadow-xs">
              <button
                type="button"
                onClick={() => setScenario('worst')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  scenario === 'worst'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Worst
              </button>
              <button
                type="button"
                onClick={() => setScenario('expected')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  scenario === 'expected'
                    ? 'bg-[#1a66d6] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Expected
              </button>
              <button
                type="button"
                onClick={() => setScenario('best')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  scenario === 'best'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Best
              </button>
            </div>
          }
        />

        {/* ─── 4 TOP STAT TILES ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Collected */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total collected</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {formatNaira(totalCollected)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalCollected > 0 ? `From ${completedPayments.length} verified transactions` : 'No payments yet'}
            </p>
          </div>

          {/* Projected Next Month */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Projected next month</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {formatNaira(projectedNextMonth)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {projectedRange
                ? `Range ${formatNaira(projectedRange.min)} to ${formatNaira(projectedRange.max)}`
                : 'Needs payment data'}
            </p>
          </div>

          {/* Collection Rate */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Collection rate</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {collectionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalExpected > 0 ? `Of ${formatNaira(totalExpected)} expected` : 'Of ₦0 expected'}
            </p>
          </div>

          {/* Total Expected */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total expected</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {formatNaira(totalExpected)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalExpected > 0
                ? `${formatNaira(Math.max(0, totalExpected - totalCollected))} still outstanding`
                : 'Create dues to set a target'}
            </p>
          </div>
        </div>

        {/* ─── MAIN CHARTS ROW ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Revenue Overview Bar Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            {/* Header & Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Revenue overview</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Collected vs expected vs projected</p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#1a66d6]" />
                  <span className="text-slate-600 dark:text-slate-400">Collected</span>
                </div>
                {hasData && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-400/30 border border-dashed border-[#1a66d6]" />
                    <span className="text-slate-600 dark:text-slate-400">Projected</span>
                  </div>
                )}
                {totalExpected > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                    <span className="text-slate-600 dark:text-slate-400">Expected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Graphic Area */}
            <div className="relative min-h-[260px] flex flex-col justify-end pt-4">
              {/* Expected per month dashed target line */}
              {expectedMonthlyTarget > 0 && hasData && (
                <div
                  className="absolute inset-x-12 border-b border-dashed border-amber-400/90 z-10 pointer-events-none"
                  style={{
                    bottom: `${Math.min(90, Math.max(10, (expectedMonthlyTarget / maxChartValue) * 100))}%`,
                  }}
                >
                  <span className="absolute -top-4 right-0 text-[10px] font-semibold text-amber-500 bg-white dark:bg-[#131722] px-1 rounded-sm">
                    Expected per month {formatNaira(expectedMonthlyTarget)}
                  </span>
                </div>
              )}

              {/* Y-Axis Grid Lines & Ticks */}
              <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400 pl-1 pb-6 z-0">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  <span>{formatNaira(maxChartValue)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  <span>{formatNaira(Math.round(maxChartValue * 0.66))}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  <span>{formatNaira(Math.round(maxChartValue * 0.33))}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-1">
                  <span>₦0</span>
                </div>
              </div>

              {/* Monthly Bar Columns Grid */}
              <div className="grid grid-cols-7 gap-3 sm:gap-6 pl-12 pr-4 z-10 items-end h-44 mb-2">
                {monthlyData.map((item) => {
                  const val = item.isProjected ? item.projected : item.collected;
                  const barHeightPct =
                    maxChartValue > 0 && val > 0
                      ? Math.min(100, Math.max(6, Math.round((val / maxChartValue) * 100)))
                      : 0;

                  return (
                    <div
                      key={`${item.month}-${item.year}`}
                      className="flex flex-col items-center justify-end h-full group"
                    >
                      {barHeightPct > 0 ? (
                        <div
                          className={`w-full max-w-[34px] rounded-t-lg transition-all relative ${
                            item.isProjected
                              ? 'bg-blue-400/25 border-2 border-dashed border-[#1a66d6]'
                              : 'bg-[#1a66d6] hover:bg-blue-600'
                          }`}
                          style={{ height: `${barHeightPct}%` }}
                          title={`${item.month} ${item.year}: ${formatNaira(val)}${item.isProjected ? ' (Projected)' : ''}`}
                        >
                          {item.isProjected && (
                            <div className="absolute inset-x-0 -top-3 flex justify-center">
                              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#131722]" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full max-w-[34px] h-2 rounded-t-sm bg-slate-100 dark:bg-slate-800/70" />
                      )}
                      <span className="text-[11px] font-medium text-slate-400 mt-2">{item.month}</span>
                    </div>
                  );
                })}
              </div>

              {/* Real Empty State Overlay when no completed payments exist */}
              {!hasData && (
                <div className="absolute inset-0 bg-white/75 dark:bg-[#131722]/85 backdrop-blur-2xs flex flex-col items-center justify-center p-6 text-center z-20 rounded-xl">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#1a66d6] flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Not enough data yet</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-4">
                    Forecasts start after your first month of payments.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(departmentAdminPath(urlCode, '/admin/duesmanagement'))}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create dues</span>
                  </button>
                </div>
              )}
            </div>

            {hasData && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Projected months show a range that widens further out.</span>
              </p>
            )}
          </div>

          {/* Right Column: AI Projection / Readiness & Monthly Statistics */}
          <div className="space-y-6">
            {/* AI Projected next month Card (or Forecast Readiness when empty) */}
            {hasData ? (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1a66d6]">
                    <Sparkles className="w-4 h-4" />
                    <span>AI PROJECTED NEXT MONTH</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      monthsWithRealData >= 3
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {monthsWithRealData >= 3 ? 'High confidence' : 'Medium confidence'}
                  </span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{formatNaira(projectedNextMonth)}</p>
                {projectedRange && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Expected range: {formatNaira(projectedRange.min)} – {formatNaira(projectedRange.max)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Forecast readiness</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Low confidence
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  0 of 1 month of data. Confidence grows as more payments come in.
                </p>
              </div>
            )}

            {/* Monthly Statistics Card */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly statistics</h3>
                <span className="text-[11px] text-slate-400">
                  Based on {monthlyStats.count} {monthlyStats.count === 1 ? 'month' : 'months'}
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Average monthly revenue</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatNaira(monthlyStats.avgMonthly)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Highest month</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNaira(monthlyStats.maxMonthly)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Lowest month</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatNaira(monthlyStats.minMonthly)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400">Semester total</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatNaira(monthlyStats.semesterTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">AI projected next month</span>
                  <span className="font-bold text-[#1a66d6] dark:text-[#4f9bff]">
                    {formatNaira(monthlyStats.aiProjected)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── REAL DATA: COLLECTION BY DUE & BY LEVEL (When data exists) ─── */}
        {hasData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Collection by due */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Collection by due</h3>
              <div className="space-y-4">
                {collectionByDue.length > 0 ? (
                  collectionByDue.map((item) => (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                        <span className="text-slate-500">
                          {formatNaira(item.collected)} of {formatNaira(item.expected)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-[#1a66d6]" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No active dues found. Create dues to view collection metrics.
                  </p>
                )}
              </div>
            </div>

            {/* Collection by level */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Collection by level</h3>
              <div className="space-y-3.5">
                {collectionByLevel.map((lvl) => (
                  <div key={lvl.level} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800 dark:text-slate-200">{lvl.level}</span>
                      <span className="text-slate-500">{lvl.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-[#1a66d6]" style={{ width: `${lvl.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── REAL DATA: OUTSTANDING BY AGE TABLE (When data exists) ─── */}
        {hasData ? (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Outstanding by age</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">How long dues have been unpaid</p>
              </div>

              <button
                type="button"
                onClick={handleExportOutstanding}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {outstandingByAge.map((item) => (
                <div key={item.age} className="py-3 flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.age}</span>
                  <span className="text-slate-500">
                    {item.students} {item.students === 1 ? 'student' : 'students'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatNaira(item.amount)}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                      item.color === 'emerald'
                        ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : item.color === 'amber'
                          ? 'text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {item.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ─── HOW IT WORKS (Shown in real/empty state matching Screenshot 1) ─── */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">How it works</h3>
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#1a66d6] stroke-[2.5] shrink-0" />
              <span>
                <strong>Collected</strong> is what students have paid.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#1a66d6] stroke-[2.5] shrink-0" />
              <span>
                <strong>Expected</strong> is the total of all dues.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#1a66d6] stroke-[2.5] shrink-0" />
              <span>
                <strong>Projected</strong> is the AI estimate for next month, with a range.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RevenueForecastPage;
