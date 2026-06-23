import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface UserCreateFormProps {
  onSubmit: (data: { email: string; firstName: string; lastName: string; role: string; accountType: string }) => void;
  isLoading?: boolean;
}

const UserCreateForm = ({ onSubmit, isLoading }: UserCreateFormProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('student');
  const [accountType, setAccountType] = useState('student');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, firstName, lastName, role, accountType });
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
        <Select
          label="System Access Role"
          options={[
            { value: 'student', label: 'Student' },
            { value: 'lecturer', label: 'Lecturer' },
            { value: 'class_rep', label: 'Class Rep' },
            { value: 'class_bursar', label: 'Class Bursar' },
            { value: 'dept_bursar', label: 'Dept Bursar' },
            { value: 'delegated_admin', label: 'Delegated Admin' },
          ]}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Select
          label="User Classification"
          options={[
            { value: 'student', label: 'Student Classify' },
            { value: 'staff', label: 'Staff Classify' },
            { value: 'alumni', label: 'Alumni Classify' },
          ]}
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Create User Account
      </Button>
    </form>
  );
};

export default UserCreateForm;
