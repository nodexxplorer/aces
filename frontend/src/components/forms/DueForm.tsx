import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface DueFormProps {
  onSubmit: (data: { purpose: string; amount: number; level?: number; type: 'class' | 'department' }) => void;
  isLoading?: boolean;
}

const DueForm = ({ onSubmit, isLoading }: DueFormProps) => {
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [level, setLevel] = useState('5');
  const [type, setType] = useState<'class' | 'department'>('class');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      purpose,
      amount: parseFloat(amount || '0'),
      level: type === 'class' ? parseInt(level) : undefined,
      type,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Dues Title / Purpose"
        placeholder="e.g. 500 Level First Semester Class Dues"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount (NGN)"
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          label="Dues Scope / Type"
          options={[
            { value: 'class', label: 'Class Level Dues' },
            { value: 'department', label: 'Departmental General Dues' },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        />
      </div>
      {type === 'class' && (
        <Select
          label="Target Student Academic Level"
          options={[
            { value: '1', label: '100 Level' },
            { value: '2', label: '200 Level' },
            { value: '3', label: '300 Level' },
            { value: '4', label: '400 Level' },
            { value: '5', label: '500 Level' },
          ]}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        />
      )}
      <Button type="submit" isLoading={isLoading} className="w-full">
        Publish Dues Requirement
      </Button>
    </form>
  );
};

export default DueForm;
