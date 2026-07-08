import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import Button from '../../components/ui/Button';
import { Briefcase, Users, DollarSign, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { Link } from 'react-router-dom';

const AlumniDashboard = () => {
  const { user } = useAuth();
  const { success } = useNotification();
  const [mentees, setMentees] = useState([
    { id: '1', name: 'John Doe', matricNumber: 'ENG/2021/001', topic: 'Embedded Hardware Careers' },
  ]);

  const handleAcceptMentee = async (id: string, name: string) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      setMentees((prev) => prev.filter((m) => m.id !== id));
      success('Mentee Accepted', `You have accepted ${name} for mentorship. Added to connections.`);
    } catch {
      //
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Connect Hub</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Welcome back, {user?.firstName}. Share your expertise, post job opportunities, and give back.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Active Mentees" value="2 Students" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Jobs Posted" value="3 Referrals" icon={<Briefcase className="w-5 h-5" />} />
        <KpiCard title="Total Contributed" value="₦250,000" icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Registered Events" value="1 Event" icon={<Calendar className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mentorship Requests</CardTitle>
              <CardDescription>Undergraduate students seeking career development mentorship</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 divide-y divide-surface-150 dark:divide-surface-800">
              {mentees.length === 0 ? (
                <p className="text-xs text-surface-400 text-center py-6">No pending requests.</p>
              ) : (
                mentees.map((m) => (
                  <div key={m.id} className="flex justify-between items-center py-3">
                    <div>
                      <h4 className="font-semibold text-sm">{m.name}</h4>
                      <p className="text-xs text-surface-500">{m.matricNumber} · Topic: {m.topic}</p>
                    </div>
                    <Button size="xs" onClick={() => handleAcceptMentee(m.id, m.name)}>
                      Accept Request
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
              <CardTitle>Quick Utilities</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-3">
              <Link to="/alumni/jobs" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Briefcase className="w-4 h-4" />}>
                  Post Job Listing
                </Button>
              </Link>
              <Link to="/alumni/give-back" className="block">
                <Button variant="outline" className="w-full justify-start" leftIcon={<DollarSign className="w-4 h-4" />}>
                  Association Donations
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AlumniDashboard;
