import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getClassRepClassList, type ClassRepStudent } from '../../api/class-rep';
import { createClassNotice } from '../../api/additional-features';
import { getErrorMessage } from '../../utils/errors';
import { Search, Send, Megaphone } from 'lucide-react';

export default function NotifyStudentsPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeListTab, setActiveListTab] = useState<'everyone' | 'selected'>('everyone');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Compose form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pinned, setPinned] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getClassRepClassList()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        setSelectedIds(new Set(list.map((s) => s.id)));
      })
      .catch(() => notifyError('Error', 'Failed to load class list'))
      .finally(() => setLoading(false));
  }, []);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      !search.trim() ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number?.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeListTab === 'everyone' || selectedIds.has(s.id);
    return matchesSearch && matchesTab;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handlePostNotice = async () => {
    if (!title.trim() || !message.trim()) {
      notifyError('Validation', 'Title and message are required');
      return;
    }

    setSending(true);
    try {
      const targetUserIds =
        selectedIds.size > 0 && selectedIds.size < students.length
          ? Array.from(selectedIds)
              .map((id) => students.find((s) => s.id === id)?.user_id)
              .filter((id): id is string => !!id)
          : undefined;

      await createClassNotice({
        title: title.trim(),
        content: message.trim(),
        is_pinned: pinned,
        target_user_ids: targetUserIds,
      });

      success(
        'Notice Posted',
        targetUserIds && targetUserIds.length > 0
          ? `Sent to ${targetUserIds.length} selected student(s) in your level.`
          : 'Sent to everyone in your level.',
      );
      setTitle('');
      setMessage('');
      setPinned(false);
    } catch (e: unknown) {
      notifyError('Error', getErrorMessage(e, 'Failed to post notice'));
    } finally {
      setSending(false);
    }
  };

  const authorName = `${user?.firstName || 'Fortune'} ${user?.lastName ? user.lastName[0] + '.' : 'O.'}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Notify classmates</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Posts to the Class Notice Board, visible only to your level.
        </p>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Who should see it? */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white">Who should see it?</h2>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                Leave everyone selected to reach the whole class
              </p>
            </div>
            <button
              onClick={handleSelectAll}
              className="text-xs font-semibold text-[#1d68ec] dark:text-[#4f9bff] hover:underline cursor-pointer"
            >
              Select all
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students"
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-200 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
            />
          </div>

          {/* Tabs: Everyone vs Selected */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-100 dark:bg-[#0b101c] rounded-xl border border-surface-200 dark:border-[#1a2538] w-fit">
            <button
              onClick={() => setActiveListTab('everyone')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeListTab === 'everyone'
                  ? 'bg-[#1d68ec] text-white shadow-sm'
                  : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              Everyone
            </button>
            <button
              onClick={() => setActiveListTab('selected')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeListTab === 'selected'
                  ? 'bg-[#1d68ec] text-white shadow-sm'
                  : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              Selected {selectedIds.size}
            </button>
          </div>

          {/* Student selection list */}
          <div className="divide-y divide-surface-100 dark:divide-surface-800/60 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-xs text-surface-400">Loading students...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-10 text-center text-xs text-surface-400 dark:text-slate-500">
                No students match your filter
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = selectedIds.has(s.id);
                const initials =
                  s.full_name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'ST';

                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSelect(s.id)}
                    className="py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-50 dark:hover:bg-[#152033]/40 px-2 rounded-xl transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 rounded border-surface-300 dark:border-surface-700 text-[#1d68ec] cursor-pointer"
                    />
                    <div className="w-8 h-8 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white truncate">
                        {s.full_name}
                      </p>
                      <p className="text-[11px] font-mono text-surface-400 dark:text-slate-500">{s.matric_number}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Compose notice & Preview */}
        <div className="space-y-6">
          {/* Compose Card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-[#1d68ec]" />
              <h2 className="text-base font-bold text-surface-900 dark:text-white">Compose notice</h2>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting reminder"
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-200 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Message</label>
              <textarea
                rows={4}
                value={message}
                maxLength={500}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Class meeting tomorrow at 10 AM in LT 2. Please come on time."
                className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-200 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-surface-400 dark:text-slate-500">
                <span>Keep it short and clear.</span>
                <span>{message.length}/500</span>
              </div>
            </div>

            {/* Pin to top toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-[#1a2538] bg-surface-50/50 dark:bg-[#0b101c]/50">
              <span className="text-xs font-medium text-surface-700 dark:text-slate-300">
                Pin to top of the notice board
              </span>
              <button
                type="button"
                onClick={() => setPinned((p) => !p)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  pinned ? 'bg-[#1d68ec]' : 'bg-surface-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    pinned ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-surface-400 dark:text-slate-400">
              Goes to {selectedIds.size} of {students.length} students
            </p>

            {/* Submit Button */}
            <button
              onClick={handlePostNotice}
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Posting...' : 'Post notice'}</span>
            </button>
          </div>

          {/* Preview Card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-2">
            <p className="text-xs font-semibold text-surface-400 dark:text-slate-400">Preview</p>
            <div className="p-4 rounded-xl border border-surface-200 dark:border-[#1a2538] bg-surface-50/50 dark:bg-[#0b101c] space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#1d68ec] dark:text-[#4f9bff]">
                CLASS NOTICE · FROM {authorName}
              </p>
              <p className="text-sm font-bold text-surface-900 dark:text-white">{title || 'Meeting reminder'}</p>
              <p className="text-xs text-surface-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {message || 'Class meeting tomorrow at 10 AM in LT 2. Please come on time.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
