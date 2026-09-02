import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useNotification } from '../../hooks/useNotification';
import { GraduationCap, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { getStudents, getStudentCGPA } from '../../api/users';
import type { User } from '../../types';

// The backend's student record occasionally includes a legacy `regNo` field
// that isn't part of the shared `User` type — kept here for the defensive
// fallback chain below without widening the shared type.
type StudentRecord = User & { regNo?: string };

// Some CGPA endpoints have historically responded with slightly different
// field names; this keeps the defensive `?? ` fallback chain type-safe
// without asserting `any`.
interface CGPAResponse {
  cgpa?: number | null;
  average?: number | null;
  total_credits_earned?: number;
  totalCredits?: number;
}

interface GraduationStatus {
  studentId: string;
  name: string;
  regNo: string;
  cgpa: number | null;
  totalCredits: number;
  requiredCredits: number;
  qualifies: boolean;
  missingCredits: number;
}

export default function AcademicsHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <GraduationCap className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Academics</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Graduation eligibility checks.</p>
        </div>
      </div>

      <GraduationTab />
    </div>
  );
}

function GraduationTab() {
  const { success } = useNotification();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [results, setResults] = useState<GraduationStatus[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await getStudents({ page: 1, perPage: 100 });
      const items = Array.isArray(data) ? data : (data as unknown as { items?: StudentRecord[] }).items || [];
      setStudents(items);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      const filtered = search
        ? students.filter(
            (s) =>
              s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
              s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
              s.firstName?.toLowerCase().includes(search.toLowerCase()) ||
              s.lastName?.toLowerCase().includes(search.toLowerCase()) ||
              s.matricNumber?.toLowerCase().includes(search.toLowerCase()) ||
              s.matric_number?.toLowerCase().includes(search.toLowerCase()) ||
              s.email?.toLowerCase().includes(search.toLowerCase()),
          )
        : students.slice(0, 50);

      const graduationResults: GraduationStatus[] = [];
      for (const student of filtered) {
        try {
          const cgpaData = (await getStudentCGPA(student.id)) as unknown as CGPAResponse;
          const cgpa = cgpaData?.cgpa ?? cgpaData?.average ?? null;
          const totalCredits = cgpaData?.total_credits_earned ?? cgpaData?.totalCredits ?? 0;
          const requiredCredits = 140;
          graduationResults.push({
            studentId: student.id,
            name:
              student.fullName ||
              student.full_name ||
              `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
              student.email,
            regNo: student.matricNumber || student.matric_number || student.regNo || 'N/A',
            cgpa,
            totalCredits,
            requiredCredits,
            qualifies: cgpa !== null && cgpa >= 1.0 && totalCredits >= requiredCredits,
            missingCredits: Math.max(0, requiredCredits - totalCredits),
          });
        } catch {
          graduationResults.push({
            studentId: student.id,
            name:
              student.fullName ||
              student.full_name ||
              `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
              student.email,
            regNo: student.matricNumber || student.matric_number || student.regNo || 'N/A',
            cgpa: null,
            totalCredits: 0,
            requiredCredits: 140,
            qualifies: false,
            missingCredits: 140,
          });
        }
      }
      setResults(graduationResults);
      success('Check Complete', `Evaluated ${graduationResults.length} student(s)`);
    } catch {
      /* silent */
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary-500" /> Eligibility Checker
          </CardTitle>
          <CardDescription>Search for a specific student or check all eligible students</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by name or registration number..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={handleCheck} isLoading={checking} leftIcon={<GraduationCap className="w-4 h-4" />}>
              Run Check
            </Button>
          </div>
        </div>
      </Card>

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-success-600">{results.filter((r) => r.qualifies).length}</p>
              <p className="text-[10px] text-surface-500 mt-1">Qualified</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-warning-600">
                {results.filter((r) => !r.qualifies && r.cgpa !== null).length}
              </p>
              <p className="text-[10px] text-surface-500 mt-1">Ineligible</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-surface-400">{results.filter((r) => r.cgpa === null).length}</p>
              <p className="text-[10px] text-surface-500 mt-1">No Data</p>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>{results.length} student(s) evaluated</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 space-y-2">
              {results.map((r) => (
                <div
                  key={r.studentId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${r.qualifies ? 'border-success-200 bg-success-50 dark:bg-success-900/10' : r.cgpa === null ? 'border-surface-200 bg-surface-50 dark:bg-surface-800' : 'border-warning-200 bg-warning-50 dark:bg-warning-900/10'}`}
                >
                  <div className="flex items-center gap-3">
                    {r.qualifies ? (
                      <CheckCircle className="w-5 h-5 text-success-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-warning-600" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-[10px] text-surface-500 font-mono">{r.regNo}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p>
                      CGPA: <span className="font-semibold">{r.cgpa !== null ? r.cgpa.toFixed(2) : 'N/A'}</span>
                    </p>
                    <p>
                      Credits: {r.totalCredits}/{r.requiredCredits}
                    </p>
                  </div>
                  <StatusBadge status={r.qualifies ? 'active' : r.cgpa === null ? 'pending' : 'suspended'} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!loading && results.length === 0 && !checking && <EmptyState title='Click "Run Check" to evaluate students.' />}
    </div>
  );
}
