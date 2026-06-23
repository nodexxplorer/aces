import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface CourseSubcategoryFormProps {
  onSubmit: (data: { name: string; description?: string }) => void;
  initialValues?: { name: string; description?: string };
  isLoading?: boolean;
}

const CourseSubcategoryForm = ({ onSubmit, initialValues, isLoading }: CourseSubcategoryFormProps) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Subcategory Name"
        placeholder="e.g. Practical Lab, Elective, Core Course"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Description
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Describe classification rules or details..."
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Save Subcategory Configuration
      </Button>
    </form>
  );
};

export default CourseSubcategoryForm;
