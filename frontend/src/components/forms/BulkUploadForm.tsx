import React, { useState } from 'react';
import Button from '../ui/Button';
import { Upload } from 'lucide-react';

interface BulkUploadFormProps {
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

const BulkUploadForm = ({ onUpload, isLoading }: BulkUploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      onUpload(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors">
        <input
          type="file"
          accept=".csv,.xlsx"
          id="bulk-file-upload"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <label htmlFor="bulk-file-upload" className="cursor-pointer space-y-2 block">
          <Upload className="w-10 h-10 mx-auto text-surface-400" />
          <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
            {file ? file.name : 'Click to select CSV or Excel file'}
          </p>
          <p className="text-xs text-surface-400">Supported formats: .csv, .xlsx</p>
        </label>
      </div>
      <Button type="submit" disabled={!file} isLoading={isLoading} className="w-full">
        Upload Registry sheet
      </Button>
    </form>
  );
};

export default BulkUploadForm;
