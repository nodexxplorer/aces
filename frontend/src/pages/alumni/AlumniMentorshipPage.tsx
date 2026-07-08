import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Search, GraduationCap, Send } from 'lucide-react';

interface Mentor {
  id: string;
  name: string;
  gradYear: string;
  company: string;
  domain: string;
  bio: string;
}

const mockMentors: Mentor[] = [
  { id: '1', name: 'Engr. Victor Udoh', gradYear: 'Class of 2020', company: 'Google Silicon Valley', domain: 'Embedded Systems & IC Design', bio: 'Helping students bridge theory and industry design tasks.' },
];

const AlumniMentorshipPage = () => {
  const { success } = useNotification();
  const [search, setSearch] = useState('');
  const [mentors] = useState<Mentor[]>(mockMentors);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [topic, setTopic] = useState('');

  const handleSendRequest = () => {
    success('Mentorship Requested', `Your mentorship request has been submitted to ${selectedMentor?.name}`);
    setRequestOpen(false);
    setTopic('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Mentorship Hub</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Connect with graduated engineering alumni working in global tech companies.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search domains or names..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map((m) => (
          <Card key={m.id} hover>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-500 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-surface-900 dark:text-white">{m.name}</h4>
                <p className="text-xs text-surface-500">{m.gradYear} · {m.company}</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-primary-500 mb-2">{m.domain}</p>
            <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-3 mb-4">{m.bio}</p>
            <Button
              className="w-full"
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => {
                setSelectedMentor(m);
                setRequestOpen(true);
              }}
            >
              Request Connection
            </Button>
          </Card>
        ))}
      </div>

      <Modal isOpen={requestOpen} onClose={() => setRequestOpen(false)} title="Request Mentorship Connection">
        {selectedMentor && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-base">{selectedMentor.name}</h4>
              <p className="text-xs text-surface-500">{selectedMentor.domain}</p>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-800 pt-4 space-y-4">
              <Input
                label="Mentorship Topic / Focus Area"
                placeholder="e.g. Embedded Firmware careers, CV reviews..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message proposal</label>
                <textarea
                  placeholder="Introduce yourself and explain what guidance you need..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                />
              </div>
              <Button className="w-full" leftIcon={<Send className="w-4 h-4" />} onClick={handleSendRequest}>
                Submit Request
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AlumniMentorshipPage;
