import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import Button from '../../components/ui/Button';
import { Users, ClipboardList, ShieldCheck, Printer, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNotification } from '../../hooks/useNotification';

const ClassRepDashboard = () => {
  const { success } = useNotification();
  const [registrations, setRegistrations] = useState([
    { id: '1', name: 'Bob Alabi', matricNumber: 'ENG/2021/003', courses: 6 },
  ]);

  const handleApprove = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      success('Approved', `Verified and approved course registration form for ${name}`);
    } catch {
      // error
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class Representative Portal</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage class rosters, verify registration lists, and print workbook packages.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Total Class Size" value="78 Students" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Class Attendance Rate" value="88%" icon={<ClipboardList className="w-5 h-5" />} />
        <KpiCard title="Pending Verifications" value={`${registrations.length} Forms`} icon={<ShieldCheck className="w-5 h-5" />} />
        <KpiCard title="Manual Print Queue" value="3 Files" icon={<Printer className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verify Course Forms</CardTitle>
              <CardDescription>Verify course registrations forms before submitting to HOD approval</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 divide-y divide-surface-150 dark:divide-surface-800">
              {registrations.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-6">All course forms verified.</p>
              ) : (
                registrations.map((reg) => (
                  <div key={reg.id} className="flex justify-between items-center py-3">
                    <div>
                      <h4 className="font-semibold text-sm">{reg.name}</h4>
                      <p className="text-xs text-surface-400">{reg.matricNumber} · {reg.courses} courses selected</p>
                    </div>
                    <Button size="xs" onClick={() => handleApprove(reg.id, reg.name)}>
                      Approve Form
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Tasks</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-3">
              <Link to="/class-rep/attendance" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<ClipboardList className="w-4 h-4" />}>
                  Take Class Attendance
                </Button>
              </Link>
              <Link to="/class-rep/assignments" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<ClipboardList className="w-4 h-4" />}>
                  Submit Lecture Workbooks
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClassRepDashboard;
