import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { getRevenueForecast, type RevenueForecast } from '../../api/predictions';
import { getAllDues, getAllPayments } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { departmentAdminPath } from '../../config/departmentAdminPaths';

interface RevenueForecastWidgetProps {
  onViewForecast?: () => void;
  className?: string;
}

export const RevenueForecastWidget: React.FC<RevenueForecastWidgetProps> = ({ onViewForecast, className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const urlCode = user?.tenant?.urlCode;

  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [totalExpected, setTotalExpected] = useState<number>(0);
  const [totalCollected, setTotalCollected] = useState<number>(0);
  const [, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getRevenueForecast(), getAllDues({ limit: 100 }), getAllPayments({ limit: 200 })]).then(
      ([fRes, dRes, pRes]) => {
        if (!isMounted) return;
        if (fRes.status === 'fulfilled') {
          setForecast(fRes.value);
        }
        if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) {
          const sum = dRes.value.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
          setTotalExpected(sum);
        }
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) {
          const completed = pRes.value
            .filter((p) => p.status === 'completed')
            .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
          setTotalCollected(completed);
        }
        setLoading(false);
      },
    );
    return () => {
      isMounted = false;
    };
  }, []);

  const hasData = totalCollected > 0;
  const projectedNextMonth = hasData ? (forecast?.projected_next_month ?? 0) : 0;
  const monthsWithData = forecast?.months_with_data ?? (hasData ? 1 : 0);
  const confidence = hasData ? (monthsWithData >= 3 ? 'high' : 'medium') : 'low';
  const collectionRate =
    hasData && totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 0;

  const handleGoToForecast = () => {
    if (onViewForecast) {
      onViewForecast();
    } else {
      navigate(departmentAdminPath(urlCode, '/admin/revenue-forecast'));
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/70 dark:from-[#111622] dark:via-[#131722] dark:to-[#161b2a] p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info & Confidence */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1a66d6] text-white shadow-xs">
              <Sparkles className="w-3 h-3" />
              AI Revenue Forecast
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                confidence === 'high'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : confidence === 'medium'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {confidence === 'high'
                ? 'High confidence'
                : confidence === 'medium'
                  ? 'Medium confidence'
                  : 'Low confidence'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {totalCollected > 0
              ? `Based on active trends, your department is projected to collect ₦${projectedNextMonth.toLocaleString()} next month.`
              : 'Projections update automatically as students pay dues and historical trends form.'}
          </p>
        </div>

        {/* Right: Key Figures & Link */}
        <div className="flex items-center gap-4 sm:gap-6 self-start md:self-auto">
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Projected Next Month
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              ₦{projectedNextMonth.toLocaleString()}
            </p>
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Collection Rate
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">{collectionRate}%</p>
          </div>

          <button
            type="button"
            onClick={handleGoToForecast}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs transition-all shrink-0"
          >
            <span>View forecast</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
