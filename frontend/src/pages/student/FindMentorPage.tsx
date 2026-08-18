import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, Briefcase, MapPin, Send, GraduationCap } from 'lucide-react';
import { getMentors, requestMentorship, getMyMentorshipRequests } from '../../api/alumni';
import { getErrorMessage } from '../../utils/errors';
import type { MentorItem, MentorshipRequestItem } from '../../types';

type StatusVariant = 'primary' | 'success' | 'danger' | 'warning' | 'default';

const statusVariants: Record<string, StatusVariant> = {
  pending: 'warning',
  accepted: 'primary',
  active: 'success',
  completed: 'default',
  declined: 'danger',
};

const FindMentorPage = () => {
  const { success, error: notifyError } = useNotification();
  const [mentors, setMentors] = useState<MentorItem[]>([]);
  const [myRequests, setMyRequests] = useState<MentorshipRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorItem | null>(null);
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.allSettled([getMentors(), getMyMentorshipRequests()]).then(([mentorsRes, requestsRes]) => {
      setMentors(mentorsRes.status === 'fulfilled' && Array.isArray(mentorsRes.value) ? mentorsRes.value : []);
      setMyRequests(requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value) ? requestsRes.value : []);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const requestedMentorIds = new Set(myRequests.map((r) => r.mentor_id));

  const filtered = mentors.filter((m) => {
    const q = search.toLowerCase();
    return (
      !q ||
      m.full_name.toLowerCase().includes(q) ||
      (m.current_company || '').toLowerCase().includes(q) ||
      (m.mentor_specialization || '').toLowerCase().includes(q)
    );
  });

  const openRequest = (mentor: MentorItem) => {
    setSelectedMentor(mentor);
    setTopic('');
    setMessage('');
    setRequestOpen(true);
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentor || !topic.trim()) return;
    try {
      setSubmitting(true);
      await requestMentorship(selectedMentor.user_id, topic.trim(), message.trim() || undefined);
      setRequestOpen(false);
      success('Request Sent', `Your mentorship request to ${selectedMentor.full_name} has been sent`);
      load();
    } catch (err) {
      notifyError('Request Failed', getErrorMessage(err, 'Could not send mentorship request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Find a Mentor</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Connect with ACES alumni for career guidance and industry insight
        </p>
      </div>

      {myRequests.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">My Requests</h2>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-surface-150 dark:border-surface-700"
              >
                <div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{r.topic}</p>
                  <p className="text-xs text-surface-500">To {r.mentor_name || 'mentor'}</p>
                </div>
                <Badge variant={statusVariants[r.status] || 'default'}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
        <input
          type="text"
          placeholder="Search by name, company, or specialization..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-500">Loading mentors...</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-400">
            <GraduationCap className="w-10 h-10 mx-auto text-surface-300 mb-2" />
            No mentors available right now — check back later.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((m) => {
            const alreadyRequested = requestedMentorIds.has(m.user_id);
            return (
              <Card key={m.id} className="p-5">
                <h3 className="text-base font-semibold text-surface-900 dark:text-white">{m.full_name}</h3>
                {(m.current_position || m.current_company) && (
                  <p className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-1 mt-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {[m.current_position, m.current_company].filter(Boolean).join(' at ')}
                  </p>
                )}
                {m.location && (
                  <p className="text-xs text-surface-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {m.location}
                  </p>
                )}
                {m.mentor_specialization && (
                  <p className="text-xs text-surface-500 mt-2">
                    <span className="font-medium">Specializes in:</span> {m.mentor_specialization}
                  </p>
                )}
                {m.bio && <p className="text-sm text-surface-600 dark:text-surface-400 mt-3 line-clamp-2">{m.bio}</p>}
                <Button
                  size="sm"
                  className="w-full mt-4"
                  disabled={alreadyRequested}
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                  onClick={() => openRequest(m)}
                >
                  {alreadyRequested ? 'Request Sent' : 'Request Mentorship'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title={`Request Mentorship: ${selectedMentor?.full_name || ''}`}
      >
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Topic</label>
            <input
              type="text"
              required
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              placeholder="e.g. Breaking into backend engineering"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message (optional)</label>
            <textarea
              className="w-full mt-1 h-28 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              placeholder="A bit about what you're hoping to get out of this..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
            Send Request
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default FindMentorPage;
