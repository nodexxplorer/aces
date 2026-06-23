import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface JobPostFormProps {
  onSubmit: (data: { title: string; company: string; location?: string; type: 'full_time' | 'part_time' | 'internship' | 'contract'; description: string; requirements?: string; salaryRange?: string; applicationUrl?: string; applicationEmail?: string }) => void;
  isLoading?: boolean;
}

const JobPostForm = ({ onSubmit, isLoading }: JobPostFormProps) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'full_time' | 'part_time' | 'internship' | 'contract'>('full_time');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [applicationEmail, setApplicationEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      company,
      location,
      type,
      description,
      requirements,
      salaryRange,
      applicationUrl,
      applicationEmail,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Job Title"
        placeholder="e.g. Graduate Software Engineer, Embedded Systems Intern"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Company Name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
        <Select
          label="Employment Type"
          options={[
            { value: 'full_time', label: 'Full Time' },
            { value: 'part_time', label: 'Part Time' },
            { value: 'internship', label: 'Internship' },
            { value: 'contract', label: 'Contract' },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Location (City/State, Remote)"
          placeholder="e.g. Lagos, Remote"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input
          label="Salary Range (Optional)"
          placeholder="e.g. 150,000 - 250,000 NGN / month"
          value={salaryRange}
          onChange={(e) => setSalaryRange(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Detailed Description of Job role
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="Describe duties, tech stack, team goals..."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
          Role Requirements & Skills
        </label>
        <textarea
          rows={3}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="List qualifications, required skills..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Application Link/URL (Optional)"
          placeholder="https://company.com/careers/apply"
          value={applicationUrl}
          onChange={(e) => setApplicationUrl(e.target.value)}
        />
        <Input
          label="Application Email (Optional)"
          type="email"
          placeholder="jobs@company.com"
          value={applicationEmail}
          onChange={(e) => setApplicationEmail(e.target.value)}
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Publish Job Opening
      </Button>
    </form>
  );
};

export default JobPostForm;
