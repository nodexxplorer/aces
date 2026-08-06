import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import DataTable, { type Column } from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { GraduationCap, FileText, Search, Loader2, CheckCircle, AlertTriangle, Printer, Eye, Send } from 'lucide-react';
import { getStudents, getStudentCGPA } from '../../api/users';
import { getTranscriptRequests, approveTranscriptRequest, markTranscriptPrinted } from '../../api/transcripts';
import type { TranscriptRequest, TranscriptStatus, User } from '../../types';

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

type Tab = 'graduation' | 'transcripts';

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
  const [activeTab, setActiveTab] = useState<Tab>('graduation');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <GraduationCap className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Academics</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Graduation checks and transcript requests.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {[
          { key: 'graduation' as Tab, label: 'Graduation Check', icon: GraduationCap },
          { key: 'transcripts' as Tab, label: 'Transcript Queue', icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'graduation' && <GraduationTab />}
      {activeTab === 'transcripts' && <TranscriptsTab />}
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

      {!loading && results.length === 0 && !checking && (
        <div className="text-center py-12 text-surface-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-surface-300" />
          <p className="text-sm">Click "Run Check" to evaluate students.</p>
        </div>
      )}
    </div>
  );
}

function TranscriptsTab() {
  const { success } = useNotification();
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<TranscriptRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getTranscriptRequests();
      const items = Array.isArray(data) ? data : (data as unknown as { items?: TranscriptRequest[] }).items || [];
      setRequests(items);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveTranscriptRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'approved' as TranscriptStatus } : r)));
      success('Request Approved', 'Student can now collect transcript');
      setViewOpen(false);
    } catch {
      /* silent */
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPrinted = async (id: string) => {
    try {
      setActionLoading(id);
      await markTranscriptPrinted(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'printed' as TranscriptStatus } : r)));
      success('Marked Printed', 'Transcript ready for collection');
      setViewOpen(false);
    } catch {
      /* silent */
    } finally {
      setActionLoading(null);
    }
  };

  const columns: Column<TranscriptRequest>[] = [
    {
      key: 'studentId',
      label: 'Student',
      render: (_: unknown, row: TranscriptRequest) => (
        <div>
          <p className="font-semibold">{row.studentName || 'Student'}</p>
          <p className="text-[10px] text-surface-500 font-mono">{row.studentId}</p>
        </div>
      ),
    },
    { key: 'purpose', label: 'Purpose' },
    { key: 'copies', label: 'Copies', render: (val: unknown) => String((val as number | undefined) || 1) },
    {
      key: 'requestedAt',
      label: 'Requested',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
    {
      key: 'estimatedCost',
      label: 'Cost',
      render: (val: unknown) => (val ? `₦${Number(val).toLocaleString()}` : 'N/A'),
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: TranscriptRequest) => (
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          onClick={() => {
            setSelected(row);
            setViewOpen(true);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary-600">{requests.filter((r) => r.status === 'pending').length}</p>
          <p className="text-[10px] text-surface-500 mt-1">Pending</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-warning-600">
            {requests.filter((r) => r.status === 'approved').length}
          </p>
          <p className="text-[10px] text-surface-500 mt-1">Approved</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-success-600">
            {requests.filter((r) => r.status === 'printed' || r.status === 'collected').length}
          </p>
          <p className="text-[10px] text-surface-500 mt-1">Printed</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>All transcript requests and their current status</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <DataTable columns={columns} data={requests} />
        )}
      </Card>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Transcript Request Details">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-500">Student</p>
                <p className="font-semibold">{selected.studentName || 'Student'}</p>
                <p className="text-xs text-surface-400">{selected.studentId}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Status</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Purpose</p>
                <p className="font-semibold">{selected.purpose}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Copies</p>
                <p className="font-semibold">{selected.copies || 1}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {selected.status === 'pending' && (
                <Button
                  variant="success"
                  className="flex-1"
                  isLoading={actionLoading === selected.id}
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => handleApprove(selected.id)}
                >
                  Approve Request
                </Button>
              )}
              {selected.status === 'approved' && (
                <Button
                  variant="success"
                  className="flex-1"
                  isLoading={actionLoading === selected.id}
                  leftIcon={<Printer className="w-4 h-4" />}
                  onClick={() => handleMarkPrinted(selected.id)}
                >
                  Mark as Printed
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
