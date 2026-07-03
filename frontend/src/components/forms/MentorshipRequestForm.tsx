import React, { useState } from 'react';
import Button from '../ui/Button';

interface MentorshipRequestFormProps {
  onSubmit: (data: { studentMessage: string }) => void;
  alumniName: string;
  isLoading?: boolean;
}

const MentorshipRequestForm = ({ onSubmit, alumniName, isLoading }: MentorshipRequestFormProps) => {
  const [studentMessage, setStudentMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ studentMessage });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Why do you want mentorship from {alumniName}?
        </label>
        <textarea
          rows={4}
          value={studentMessage}
          onChange={(e) => setStudentMessage(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="State your career goals, area of interest, and why this mentor would be a good match..."
          required
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Send Mentorship Request
      </Button>
    </form>
  );
};

export default MentorshipRequestForm;
