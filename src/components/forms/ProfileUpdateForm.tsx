import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface ProfileUpdateFormProps {
  initialValues: { firstName: string; lastName: string; phone?: string; emergencyContactName?: string; emergencyContactPhone?: string };
  onSubmit: (data: { firstName: string; lastName: string; phone?: string; emergencyContactName?: string; emergencyContactPhone?: string }) => void;
  isLoading?: boolean;
}

const ProfileUpdateForm = ({ initialValues, onSubmit, isLoading }: ProfileUpdateFormProps) => {
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [phone, setPhone] = useState(initialValues.phone || '');
  const [emergencyContactName, setEmergencyContactName] = useState(initialValues.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialValues.emergencyContactPhone || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ firstName, lastName, phone, emergencyContactName, emergencyContactPhone });
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
        label="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="border-t border-surface-200 dark:border-surface-800 pt-4 mt-2">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">Emergency Contact</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Guardian/Next of Kin Name"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
          />
          <Input
            label="Guardian/Next of Kin Phone"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Save Profile Updates
      </Button>
    </form>
  );
};

export default ProfileUpdateForm;
