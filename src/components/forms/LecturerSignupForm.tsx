import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface LecturerSignupFormProps {
  onSubmit: (data: { email: string; firstName: string; lastName: string; staffId: string; department: string }) => void;
  isLoading?: boolean;
}

const LecturerSignupForm = ({ onSubmit, isLoading }: LecturerSignupFormProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [department, setDepartment] = useState('Computer Engineering');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, firstName, lastName, staffId, department });
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
          label="Staff ID"
          placeholder="STF/XXXX"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          required
        />
        <Input
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Sign Up as Lecturer
      </Button>
    </form>
  );
};

export default LecturerSignupForm;
