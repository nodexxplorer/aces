import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface RolePromotionFormProps {
  onSubmit: (data: { userId: string; newRole: string }) => void;
  isLoading?: boolean;
}

const RolePromotionForm = ({ onSubmit, isLoading }: RolePromotionFormProps) => {
  const [userId, setUserId] = useState('');
  const [newRole, setNewRole] = useState('class_rep');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ userId, newRole });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Target Student / User ID"
        placeholder="Enter user unique identifier"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        required
      />
      <Select
        label="Promote to Role"
        options={[
          { value: 'class_rep', label: 'Class Representative' },
          { value: 'class_bursar', label: 'Class Bursar' },
          { value: 'dept_bursar', label: 'Departmental Bursar' },
          { value: 'delegated_admin', label: 'Delegated Administrator' },
        ]}
        value={newRole}
        onChange={(e) => setNewRole(e.target.value)}
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Apply Role Promotion
      </Button>
    </form>
  );
};

export default RolePromotionForm;
