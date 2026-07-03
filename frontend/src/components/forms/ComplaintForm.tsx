import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface ComplaintFormProps {
  onSubmit: (data: { subject: string; description: string; category: string; priority: 'low' | 'medium' | 'high' }) => void;
  isLoading?: boolean;
}

const ComplaintForm = ({ onSubmit, isLoading }: ComplaintFormProps) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('academic');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ subject, description, category, priority });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Subject / Topic"
        placeholder="Briefly state the issue"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          options={[
            { value: 'academic', label: 'Academic / Grading' },
            { value: 'payment', label: 'Payment / Dues' },
            { value: 'manual', label: 'Course Manuals' },
            { value: 'facility', label: 'Facility / Technical' },
          ]}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Select
          label="Priority"
          options={[
            { value: 'low', label: 'Low Priority' },
            { value: 'medium', label: 'Medium Priority' },
            { value: 'high', label: 'High Priority' },
          ]}
          value={priority}
          onChange={(e) => setPriority(e.target.value as any)}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Detailed Description
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Provide additional details..."
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Submit Complaint
      </Button>
    </form>
  );
};

export default ComplaintForm;
