import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, GraduationCap, Send, Users, CheckCircle, Clock, MapPin } from 'lucide-react';
import { getMentors, requestMentorship, getMyMentorshipRequests, respondToMentorship } from '../../api/alumni';
import type { MentorItem, MentorshipRequestItem } from '../../types';

const MentorshipHubPage = () => {
  const { success, error: notifyError } = useNotification();
  const [mentors, setMentors] = useState<MentorItem[]>([]);
  const [myRequests, setMyRequests] = useState<MentorshipRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMentor, setSelectedMentor] = useState<MentorItem | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-requests'>('browse');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mentorsData, requestsData] = await Promise.allSettled([
          getMentors(),
          getMyMentorshipRequests(),
        ]);
        if (mentorsData.status === 'fulfilled') setMentors(Array.isArray(mentorsData.value) ? mentorsData.value : []);
        if (requestsData.status === 'fulfilled') setMyRequests(Array.isArray(requestsData.value) ? requestsData.value : []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMentors = mentors.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.full_name?.toLowerCase().includes(q) || m.mentor_specialization?.toLowerCase().includes(q) || m.current_company?.toLowerCase().includes(q);
  });

  const handleSendRequest = async () => {
    if (!selectedMentor || !topic) return;
    setSubmitting(true);
    try {
      await requestMentorship(selectedMentor.user_id, topic, message || undefined);
      success('Request Sent', `Your mentorship request has been sent to ${selectedMentor.full_name}`);
      setRequestOpen(false);
      setTopic('');
      setMessage('');
      setSelectedMentor(null);
      const refreshed = await getMyMentorshipRequests();
      setMyRequests(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not send request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (requestId: string, status: string) => {
    try {
      await respondToMentorship(requestId, status);
      success('Updated', `Mentorship request ${status}`);
      setMyRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status } : r));
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not update');
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'warning',
    accepted: 'success',
    active: 'success',
    completed: 'info',
    declined: 'danger',
    rejected: 'danger',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Mentorship Hub</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Connect with alumni mentors for career guidance and professional development.
        </p>
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-2">
        <Button variant={activeTab === 'browse' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('browse')}>
          <GraduationCap className="w-4 h-4 mr-1" /> Browse Mentors
        </Button>
        <Button variant={activeTab === 'my-requests' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('my-requests')}>
          <Clock className="w-4 h-4 mr-1" /> My Requests ({myRequests.length})
        </Button>
      </div>

      {activeTab === 'browse' && (
        <>
          <div className="flex gap-4 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by name, specialization, or company..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <Card><div className="p-12 text-center text-sm text-surface-500">Loading mentors...</div></Card>
          ) : filteredMentors.length === 0 ? (
            <Card><div className="p-12 text-center text-sm text-surface-400">No mentors available at the moment</div></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMentors.map((m) => (
                <Card key={m.id} hover className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500 shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-surface-900 dark:text-white">{m.full_name}</h4>
                      <p className="text-xs text-surface-500">Class of {m.graduation_year} &bull; {m.current_company || 'Unknown'}</p>
                    </div>
                  </div>
                  {m.mentor_specialization && (
                    <p className="text-xs font-semibold text-primary-500 mb-2">{m.mentor_specialization}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-surface-500 mb-3">
                    {m.industry && <span>{m.industry}</span>}
                    {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</span>}
                  </div>
                  {m.bio && (
                    <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-3 mb-4">{m.bio}</p>
                  )}
                  <Button
                    className="w-full"
                    size="sm"
                    leftIcon={<Send className="w-4 h-4" />}
                    onClick={() => { setSelectedMentor(m); setRequestOpen(true); }}
                  >
                    Request Mentorship
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'my-requests' && (
        <div className="space-y-3">
          {myRequests.length === 0 ? (
            <Card><div className="p-12 text-center text-sm text-surface-400">No mentorship requests yet</div></Card>
          ) : (
            myRequests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{r.topic}</h4>
                    <p className="text-xs text-surface-500">
                      {r.student_name} &bull; {new Date(r.created_at).toLocaleDateString()}
                    </p>
                    {r.message && <p className="text-xs text-surface-500 mt-1 line-clamp-2">{r.message}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={(statusColors[r.status] || 'secondary') as any}>{r.status}</Badge>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="xs" variant="success" onClick={() => handleRespond(r.id, 'accepted')}>Accept</Button>
                        <Button size="xs" variant="danger" onClick={() => handleRespond(r.id, 'declined')}>Decline</Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)} title="Request Mentorship">
        {selectedMentor && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-base">{selectedMentor.full_name}</h4>
                <p className="text-xs text-surface-500">{selectedMentor.mentor_specialization || 'General mentorship'}</p>
              </div>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-800 pt-4 space-y-4">
              <Input
                label="Mentorship Topic"
                placeholder="e.g. Embedded Firmware careers, CV reviews..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message</label>
                <textarea
                  placeholder="Introduce yourself and explain what guidance you need..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <Button className="w-full" leftIcon={<Send className="w-4 h-4" />} isLoading={submitting} onClick={handleSendRequest}>
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MentorshipHubPage;
