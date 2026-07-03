import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface AssignmentFormProps {
  onSubmit: (data: { title: string; description: string; dueDate: string; points: number }) => void;
  isLoading?: boolean;
}

const AssignmentForm = ({ onSubmit, isLoading }: AssignmentFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [points, setPoints] = useState('100');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      dueDate,
      points: parseInt(points || '100'),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Assignment Title"
        placeholder="e.g. Lab Exercise 1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Due Date & Time"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
        <Input
          label="Grading Scale Points"
          type="number"
          min={0}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Instructions & Requirements
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Enter grading constraints or instructions..."
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Create Assignment Task
      </Button>
    </form>
  );
};

export default AssignmentForm;
