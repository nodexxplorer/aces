import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface AnnouncementFormProps {
  onSubmit: (data: { title: string; content: string; isPinned: boolean }) => void;
  isLoading?: boolean;
}

const AnnouncementForm = ({ onSubmit, isLoading }: AnnouncementFormProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, content, isPinned });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Announcement Title"
        placeholder="e.g. Rescheduling of CPE 511 Exams"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Detailed Message Content
        </label>
        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Type your official announcement here..."
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="pin-announcement"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          className="rounded border-surface-300 dark:border-surface-700 text-primary-500 focus:ring-primary-500"
        />
        <label htmlFor="pin-announcement" className="text-sm text-surface-700 dark:text-surface-300">
          Pin this announcement to top of dashboard page
        </label>
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Broadcast Announcement
      </Button>
    </form>
  );
};

export default AnnouncementForm;
