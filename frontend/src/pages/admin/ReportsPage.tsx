import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { BarChart3, Download, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { getDashboardStats, getPerformanceTrend } from '../../api/analytics';

const ReportsPage = () => {
  const { success } = useNotification();
  const [stats, setStats] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('enrollment');
  const [session, setSession] = useState('2025/2026');
  const [semester, setSemester] = useState('harmattan');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setAnalyticsError(null);
      const [s, t] = await Promise.allSettled([getDashboardStats(), getPerformanceTrend()]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (t.status === 'fulfilled') setTrend(t.value);
      if (s.status === 'rejected' && t.status === 'rejected') {
        setAnalyticsError('Failed to fetch analytics data. Please try again later.');
      }
    } catch (err: any) {
      setAnalyticsError(err?.message || 'Failed to fetch analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      // Load and resize logo (smaller)
      let logoDataUrl: string | null = null;
      try {
        const img = new Image();
        img.src = '/aces-logo.png';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
        });
        const canvas = document.createElement('canvas');
        const maxW = 28;
        const maxH = 24;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        logoDataUrl = canvas.toDataURL('image/png');
      } catch {
        // logo not available
      }

      // Header
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 14, 10, 15, 13);
        doc.setFontSize(16);
        doc.text('Department of Computer Engineering', 32, 17);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Report', 32, 24);
      } else {
        doc.setFontSize(16);
        doc.text('Department of Computer Engineering Report', 14, 20);
      }
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      const headerY = 34;
      doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, headerY);
      doc.text(`Session: ${session} | Semester: ${semester.charAt(0).toUpperCase() + semester.slice(1)}`, 14, headerY + 7);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, headerY + 14);

      // Separator line
      doc.setDrawColor(200);
      doc.line(14, headerY + 18, 196, headerY + 18);

      // Overview section with details
      let y = headerY + 26;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Overview', 14, y);
      y += 8;

      const reportTypeLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);

      if (stats) {
        const statEntries = Object.entries(stats).filter(([k]) => !k.includes('Trend') && !k.includes('trend'));
        const labelMap: Record<string, string> = {
          totalStudents: 'Total number of enrolled students in the department',
          totalUsers: 'Total registered users across all roles',
          totalCourses: 'Courses currently available in the system',
          activeComplaints: 'Open complaints requiring attention',
          pendingResults: 'Results awaiting approval or publication',
          pendingApprovals: 'User accounts pending admin approval',
          totalResults: 'Total results recorded in the system',
          averageCGPA: 'Departmental average CGPA across all levels',
          paymentCollected: 'Total payments collected this session',
        };

        statEntries.slice(0, 10).forEach(([key, val]) => {
          const friendlyLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          doc.setFont('helvetica', 'bold');
          doc.text(`${friendlyLabel}:`, 14, y);
          doc.setFont('helvetica', 'normal');
          doc.text(String(val), 80, y);
          y += 6;
        });

        y += 4;
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        doc.text(`This ${reportTypeLabel} report provides a summary of departmental`, 14, y);
        y += 5;
        doc.text(`activities for the ${session} academic session (${semester} semester).`, 14, y);
        y += 5;
        doc.text('All figures are current as of the generation date above.', 14, y);
        y += 5;
      } else {
        doc.text('No statistics data available. Connect to the backend to populate this report.', 14, y);
        y += 8;
      }

      // Performance trends
      if (trend && Array.isArray(trend) && trend.length > 0) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(0);
        doc.text('Performance Trends', 14, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        trend.forEach((t: any) => {
          doc.text(`${t.session || 'N/A'} — Average CGPA: ${t.averageCGPA || 'N/A'} | Pass Rate: ${t.passRate || 'N/A'}%`, 14, y);
          y += 6;
        });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('ACES Zone — Department of Computer Engineering', 14, pageHeight - 10);
      doc.text(`Page 1 of ${doc.getNumberOfPages()}`, 180, pageHeight - 10);

      const fileName = `computer_engineering_${reportType}_report_${session}_${semester}.pdf`;
      doc.save(fileName);
      success('Report Generated', `${fileName} has been downloaded`);
    } catch (err: any) {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Generate, preview and download academic and administrative reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            Report Generator
          </CardTitle>
          <CardDescription>Select parameters and generate a report</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <Select
            label="Report Type"
            options={[
              { value: 'enrollment', label: 'Student Enrollment Summary' },
              { value: 'results', label: 'Results Analysis' },
              { value: 'cgpa', label: 'CGPA Distribution' },
              { value: 'attendance', label: 'Attendance Summary' },
              { value: 'complaints', label: 'Complaints Report' },
              { value: 'financial', label: 'Financial Summary' },
              { value: 'alumni', label: 'Alumni Statistics' },
            ]}
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Academic Session"
              options={[{ value: '2025/2026', label: '2025/2026' }, { value: '2024/2025', label: '2024/2025' }]}
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
            <Select
              label="Semester"
              options={[
                { value: 'harmattan', label: 'Harmattan' },
                { value: 'rain', label: 'Rain' },
              ]}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            isLoading={generating}
            leftIcon={generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            onClick={handleGenerate}
          >
            Generate Report
          </Button>
        </div>
      </Card>

      {!loading && analyticsError && (
        <Card>
          <div className="p-6 flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-warning-500 mb-3" />
            <p className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Analytics Unavailable</p>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">{analyticsError}</p>
            <Button size="sm" variant="outline" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={fetchData}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {!loading && stats && (
        <Card>
          <CardHeader>
            <CardTitle>Current Session Overview</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 grid grid-cols-2 gap-4">
            {Object.entries(stats).filter(([k]) => !k.includes('Trend') && !k.includes('trend')).slice(0, 8).map(([key, val]) => (
              <div key={key} className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
                <p className="text-[10px] text-surface-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-lg font-bold text-surface-900 dark:text-white">{String(val)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
