import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface ScoreInputFormProps {
  onSubmit: (data: { studentId: string; courseId: string; caScore: number; examScore: number }) => void;
  initialValues?: { studentId: string; courseId: string; caScore: number; examScore: number };
  isLoading?: boolean;
}

const ScoreInputForm = ({ onSubmit, initialValues, isLoading }: ScoreInputFormProps) => {
  const [studentId, setStudentId] = useState(initialValues?.studentId || '');
  const [courseId, setCourseId] = useState(initialValues?.courseId || '');
  const [caScore, setCaScore] = useState(initialValues?.caScore?.toString() || '');
  const [examScore, setExamScore] = useState(initialValues?.examScore?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      studentId,
      courseId,
      caScore: parseInt(caScore || '0'),
      examScore: parseInt(examScore || '0'),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Student ID / Matric"
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        required
      />
      <Input
        label="Course ID"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="CA Score (max 30)"
          type="number"
          min={0}
          max={30}
          value={caScore}
          onChange={(e) => setCaScore(e.target.value)}
          required
        />
        <Input
          label="Exam Score (max 70)"
          type="number"
          min={0}
          max={70}
          value={examScore}
          onChange={(e) => setExamScore(e.target.value)}
          required
        />
      </div>
      <Button type="submit" isLoading={isLoading} className="w-full">
        Submit Scores
      </Button>
    </form>
  );
};

export default ScoreInputForm;
