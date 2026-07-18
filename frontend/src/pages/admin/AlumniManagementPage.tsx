import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Search, Loader2, Eye, Users, Briefcase, Calendar, DollarSign, BarChart3, FileText } from 'lucide-react';
import { getAlumniProfiles, createAlumniProfile, getAlumniDashboardStats, listDonations, getMentors, getAlumniEvents } from '../../api/alumni';
import { formatCurrency } from '../../utils/formatters';
import type { AlumniProfile, AlumniDashboardStats, AlumniDonation, MentorItem, AlumniEventItem } from '../../types';

const AlumniManagementPage = () => {
  const { success, error: notifyError } = useNotification();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [dashboardStats, setDashboardStats] = useState<AlumniDashboardStats | null>(null);
  const [recentDonations, setRecentDonations] = useState<AlumniDonation[]>([]);
  const [mentors, setMentors] = useState<MentorItem[]>([]);
  const [events, setEvents] = useState<AlumniEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<AlumniProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'directory' | 'donations' | 'reports'>('overview');

  const [formGradYear, setFormGradYear] = useState('2024');
  const [formGradClass, setFormGradClass] = useState('');
  const [formIsMentor, setFormIsMentor] = useState(false);
  const [formCompany, setFormCompany] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formBio, setFormBio] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alumniData, statsData, donationsData, mentorsData, eventsData] = await Promise.allSettled([
        getAlumniProfiles(),
        getAlumniDashboardStats(),
        listDonations(),
        getMentors(),
        getAlumniEvents(),
      ]);
      if (alumniData.status === 'fulfilled') {
        const items = Array.isArray(alumniData.value) ? alumniData.value : (alumniData.value as any).items || [];
        setAlumni(items);
      }
      if (statsData.status === 'fulfilled') setDashboardStats(statsData.value);
      if (donationsData.status === 'fulfilled') setRecentDonations(Array.isArray(donationsData.value) ? donationsData.value : []);
      if (mentorsData.status === 'fulfilled') setMentors(Array.isArray(mentorsData.value) ? mentorsData.value : []);
      if (eventsData.status === 'fulfilled') setEvents(Array.isArray(eventsData.value) ? eventsData.value : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await createAlumniProfile({
        graduation_year: parseInt(formGradYear),
        graduation_class: formGradClass || undefined,
        is_mentor_available: formIsMentor,
        current_company: formCompany || undefined,
        current_position: formPosition || undefined,
        bio: formBio || undefined,
      } as any);
      setCreateOpen(false);
      setFormGradYear('2024');
      setFormGradClass('');
      setFormIsMentor(false);
      setFormCompany('');
      setFormPosition('');
      setFormBio('');
      success('Alumni Added', 'Alumni status has been created');
      fetchData();
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not create alumni record');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = alumni.filter((a: any) => {
    return (
      (a.current_company || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.current_position || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.mentor_specialization || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  const columns = [
    {
      key: 'user_id',
      label: 'User ID',
      render: (_: unknown, row: any) => (
        <span className="font-mono text-xs">{(row.user_id || row.userId || 'N/A').slice(0, 8)}...</span>
      ),
    },
    { key: 'graduation_year', label: 'Grad. Year' },
    { key: 'graduation_class', label: 'Class' },
    { key: 'current_company', label: 'Company' },
    { key: 'current_position', label: 'Position' },
    {
      key: 'is_mentor_available',
      label: 'Mentor',
      render: (val: unknown) => <StatusBadge status={val ? 'active' : 'pending'} />,
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => { setSelected(row); setViewOpen(true); }}>
          View
        </Button>
      ),
    },
  ];

  const upcomingEvents = events.filter((e) => e.end_date >= new Date().toISOString() || e.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Department-level alumni oversight, reports and moderation.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Add Alumni
        </Button>
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-2 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'directory', label: 'Directory', icon: Users },
          { key: 'donations', label: 'Donations', icon: DollarSign },
          { key: 'reports', label: 'Reports', icon: FileText },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.key as any)}
          >
            <tab.icon className="w-4 h-4 mr-1" /> {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-surface-500 mb-1">
                <Users className="w-4 h-4" /> Total Alumni
              </div>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{dashboardStats?.total_alumni || alumni.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-surface-500 mb-1">
                <Briefcase className="w-4 h-4" /> Active Mentors
              </div>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{dashboardStats?.active_mentors || mentors.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-surface-500 mb-1">
                <Calendar className="w-4 h-4" /> Upcoming Events
              </div>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{upcomingEvents.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-surface-500 mb-1">
                <DollarSign className="w-4 h-4" /> Donations
              </div>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{dashboardStats?.total_donations || recentDonations.length}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Donations</CardTitle>
              </CardHeader>
              <div className="space-y-2 p-4 pt-0">
                {recentDonations.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-4">No donations yet</p>
                ) : (
                  recentDonations.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{d.is_anonymous ? 'Anonymous' : d.donor_name || 'Alumni'}</p>
                        <p className="text-xs text-surface-500">{d.channel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(d.amount)}</p>
                        <Badge variant="outline" className="text-[10px]">{d.recognized_tier}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
              </CardHeader>
              <div className="space-y-2 p-4 pt-0">
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-surface-400 text-center py-4">No upcoming events</p>
                ) : (
                  upcomingEvents.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-surface-500">{new Date(e.start_date).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="info">{e.event_type}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'directory' && (
        <>
          <div className="flex gap-4 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by company, position or specialization..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alumni Directory</CardTitle>
              <CardDescription>{filtered.length} alumni record{filtered.length !== 1 && 's'}</CardDescription>
            </CardHeader>
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                <span className="ml-2 text-sm text-surface-500">Loading alumni...</span>
              </div>
            ) : (
              <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} />
            )}
          </Card>
        </>
      )}

      {activeTab === 'donations' && (
        <Card>
          <CardHeader>
            <CardTitle>All Donations</CardTitle>
            <CardDescription>Full donation history</CardDescription>
          </CardHeader>
          <div className="space-y-2 p-4 pt-0">
            {recentDonations.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-8">No donations recorded</p>
            ) : (
              recentDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{d.is_anonymous ? 'Anonymous' : d.donor_name || 'Alumni'}</p>
                      <p className="text-xs text-surface-500">{d.channel} &bull; {new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={(d.recognized_tier === 'platinum' ? 'primary' : d.recognized_tier === 'gold' ? 'warning' : 'secondary') as any}>{d.recognized_tier}</Badge>
                    <span className="text-sm font-semibold">{formatCurrency(d.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-3">Alumni Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-500">Total alumni records</span><span className="font-semibold">{alumni.length}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Active mentors</span><span className="font-semibold">{mentors.length}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Upcoming events</span><span className="font-semibold">{upcomingEvents.length}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Total donations</span><span className="font-semibold">{recentDonations.length}</span></div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold text-surface-900 dark:text-white mb-3">Donation Breakdown</h3>
            <div className="space-y-2 text-sm">
              {dashboardStats && (
                <>
                  <div className="flex justify-between"><span className="text-surface-500">Total raised</span><span className="font-semibold">{formatCurrency(dashboardStats.total_donations || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Mentorship requests</span><span className="font-semibold">{dashboardStats.pending_mentorship_requests || 0}</span></div>
                </>
              )}
              {!dashboardStats && <p className="text-surface-400">Stats not available</p>}
            </div>
          </Card>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Alumni Record">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Graduation Year" type="number" value={formGradYear} onChange={(e) => setFormGradYear(e.target.value)} required />
          <Input label="Graduation Class (e.g. First Class)" placeholder="Optional" value={formGradClass} onChange={(e) => setFormGradClass(e.target.value)} />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isMentor"
              checked={formIsMentor}
              onChange={(e) => setFormIsMentor(e.target.checked)}
              className="w-4 h-4 text-primary-600 bg-white border-surface-300 rounded"
            />
            <label htmlFor="isMentor" className="text-sm font-medium text-surface-700 dark:text-surface-300">Available as Mentor</label>
          </div>
          <Input label="Current Company" placeholder="e.g. Google" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
          <Input label="Current Position" placeholder="e.g. Software Engineer" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Bio</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-20"
              placeholder="Brief bio..."
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>Add Alumni</Button>
        </form>
      </Modal>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Alumni Profile">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-surface-500">Graduation Year</p><p className="font-semibold">{(selected as any).graduation_year}</p></div>
              <div><p className="text-xs text-surface-500">Class</p><p className="font-semibold">{(selected as any).graduation_class || 'N/A'}</p></div>
              <div><p className="text-xs text-surface-500">Company</p><p className="font-semibold">{(selected as any).current_company || 'N/A'}</p></div>
              <div><p className="text-xs text-surface-500">Position</p><p className="font-semibold">{(selected as any).current_position || 'N/A'}</p></div>
              <div><p className="text-xs text-surface-500">Mentor Available</p><p className="font-semibold">{(selected as any).is_mentor_available ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-surface-500">LinkedIn</p><p className="font-semibold">{(selected as any).linkedin_url || 'N/A'}</p></div>
            </div>
            {(selected as any).bio && (
              <div><p className="text-xs text-surface-500">Bio</p><p className="text-sm">{(selected as any).bio}</p></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AlumniManagementPage;
