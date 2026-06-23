import React, { useState } from 'react';
import Button from '../ui/Button';

interface ConnectionRequestFormProps {
  onSubmit: (data: { message: string }) => void;
  recipientName: string;
  isLoading?: boolean;
}

const ConnectionRequestForm = ({ onSubmit, recipientName, isLoading }: ConnectionRequestFormProps) => {
  const [message, setMessage] = useState(`Hi ${recipientName}, I would like to connect with you on Aces Zone!`);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ message });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Personalized Note (Optional)
        </label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Add a friendly note to introduce yourself..."
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Send Connection Invitation
      </Button>
    </form>
  );
};

export default ConnectionRequestForm;
