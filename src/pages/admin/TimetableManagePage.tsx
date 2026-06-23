import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { CalendarRange, Plus } from 'lucide-react';

const TimetableManagePage = () => {
  const { success } = useNotification();
  const [course, setCourse] = useState('cpe511');
  const [day, setDay] = useState('Monday');
  const [time, setTime] = useState('09:00 - 11:00');
  const [venue, setVenue] = useState('ETF Hall');

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    success('Timetable Updated', 'Successfully added slot schedule context.');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Timetable Manager</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Adjust lecture sessions, dates, and classroom venue allocations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary-500" />
            <CardTitle>Schedule Lecture Slot</CardTitle>
          </div>
          <CardDescription>Assign courses to timeslots</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdate} className="p-4 pt-0 space-y-4">
          <Select
            label="Course Target"
            options={[
              { value: 'cpe511', label: 'CPE 511 (Embedded Systems)' },
              { value: 'cpe513', label: 'CPE 513 (Computer Architecture II)' },
            ]}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
          <Select
            label="Day of Week"
            options={[
              { value: 'Monday', label: 'Monday' },
              { value: 'Tuesday', label: 'Tuesday' },
              { value: 'Wednesday', label: 'Wednesday' },
              { value: 'Thursday', label: 'Thursday' },
              { value: 'Friday', label: 'Friday' },
            ]}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <Input label="Time Period" placeholder="e.g. 09:00 AM - 11:00 AM" value={time} onChange={(e) => setTime(e.target.value)} required />
          <Input label="Venue / Classroom" placeholder="e.g. ETF Hall II" value={venue} onChange={(e) => setVenue(e.target.value)} required />
          <Button type="submit" className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
            Assign Schedule Slot
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default TimetableManagePage;
