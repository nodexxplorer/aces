import React, { useState } from 'react';
import Button from '../ui/Button';
import type { Course } from '../../types';

interface CourseRegistrationFormProps {
  availableCourses: Course[];
  onSubmit: (registeredIds: string[]) => void;
  isLoading?: boolean;
}

const CourseRegistrationForm = ({ availableCourses, onSubmit, isLoading }: CourseRegistrationFormProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedIds);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-surface-200 dark:border-surface-800 rounded-lg divide-y divide-surface-200 dark:divide-surface-800 max-h-96 overflow-y-auto">
        {availableCourses.map((c) => (
          <div key={c.id} className="p-3 flex items-start gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/40">
            <input
              type="checkbox"
              id={`register-${c.id}`}
              checked={selectedIds.includes(c.id)}
              onChange={() => handleToggle(c.id)}
              className="mt-1 rounded border-surface-300 dark:border-surface-700 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor={`register-${c.id}`} className="flex-1 cursor-pointer">
              <span className="block text-sm font-semibold text-surface-900 dark:text-white">
                {c.code}: {c.title}
              </span>
              <span className="text-xs text-surface-500 dark:text-surface-400">
                Credits: {c.unit} | Level {c.level} | Semester: {c.semester}
              </span>
            </label>
          </div>
        ))}
      </div>
      <Button type="submit" isLoading={isLoading} disabled={selectedIds.length === 0} className="w-full">
        Register Courses ({selectedIds.length} Selected)
      </Button>
    </form>
  );
};

export default CourseRegistrationForm;
