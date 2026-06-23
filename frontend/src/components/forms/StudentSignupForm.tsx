import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface StudentSignupFormProps {
  onSubmit: (data: { email: string; firstName: string; lastName: string; matricNumber: string; level: number }) => void;
  isLoading?: boolean;
}

const StudentSignupForm = ({ onSubmit, isLoading }: StudentSignupFormProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [level, setLevel] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, firstName, lastName, matricNumber, level: parseInt(level) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      <Input
        label="Email Address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Matric Number"
          placeholder="ENG/202X/XXX"
          value={matricNumber}
          onChange={(e) => setMatricNumber(e.target.value)}
          required
        />
        <div>
          <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1">
            Current Level
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <option value="1">100 Level</option>
            <option value="2">200 Level</option>
            <option value="3">300 Level</option>
            <option value="4">400 Level</option>
            <option value="5">500 Level</option>
          </select>
        </div>
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Sign Up as Student
      </Button>
    </form>
  );
};

export default StudentSignupForm;
