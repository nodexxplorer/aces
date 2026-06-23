import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface QRPrintFormProps {
  onSubmit: (data: { manualId: string; quantity: number }) => void;
  isLoading?: boolean;
}

const QRPrintForm = ({ onSubmit, isLoading }: QRPrintFormProps) => {
  const [manualId, setManualId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      manualId,
      quantity: parseInt(quantity || '1'),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Target Manual ID / Code"
        placeholder="e.g. m-1"
        value={manualId}
        onChange={(e) => setManualId(e.target.value)} // Wait, userId state is not defined, we should use setManualId!
        required
      />
      <Input
        label="Quantity to Print"
        type="number"
        min={1}
        max={100}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Generate Print Codes
      </Button>
    </form>
  );
};

export default QRPrintForm;
