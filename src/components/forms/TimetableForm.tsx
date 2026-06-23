import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface TimetableFormProps {
  onSubmit: (data: { courseId: string; dayOfWeek: string; startTime: string; endTime: string; venue: string; type: 'lecture' | 'practical' | 'exam' }) => void;
  isLoading?: boolean;
}

const TimetableForm = ({ onSubmit, isLoading }: TimetableFormProps) => {
  const [courseId, setCourseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [type, setType] = useState<'lecture' | 'practical' | 'exam'>('lecture');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ courseId, dayOfWeek, startTime, endTime, venue, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Course ID / Code"
        placeholder="e.g. CPE511"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Day of Week"
          options={[
            { value: 'Monday', label: 'Monday' },
            { value: 'Tuesday', label: 'Tuesday' },
            { value: 'Wednesday', label: 'Wednesday' },
            { value: 'Thursday', label: 'Thursday' },
            { value: 'Friday', label: 'Friday' },
          ]}
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
        />
        <Select
          label="Event Category"
          options={[
            { value: 'lecture', label: 'Lecture Session' },
            { value: 'practical', label: 'Practical Lab Session' },
            { value: 'exam', label: 'Examination Schedule' },
          ]}
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
        <Input
          label="End Time"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>
      <Input
        label="Venue / Classroom"
        placeholder="e.g. Engineering Lecture Hall 2"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        required
      />
      <Button type="submit" isLoading={isLoading} className="w-full">
        Save Timetable Schedule
      </Button>
    </form>
  );
};

export default TimetableForm;
