import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';

const mockPracticals = [
  {
    id: 'prac-1',
    courseId: 'c-1',
    title: 'Microcontroller Architecture & Assembly Programming',
    instructor: 'Dr. Jane Smith',
    labRoom: 'ETF Lab II',
    dayOfWeek: 'Thursday',
    timeSlot: '11:00 AM - 01:00 PM',
    instructions: 'Bring your pre-assembled development boards and breadboards for testing.',
    isActive: true,
  },
];

const PracticalsPage = () => {
  const columns = [
    { key: 'title', label: 'Experiment Title', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'dayOfWeek', label: 'Day / Time', render: (_: unknown, row: any) => `${row.dayOfWeek} (${row.timeSlot})` },
    { key: 'labRoom', label: 'Lab Room' },
    { key: 'instructor', label: 'Instructor' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Practicals & Labs</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Monitor your scheduled engineering experiments and workbook submissions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lab Sessions</CardTitle>
            <CardDescription>Scheduled practical tasks for registered engineering modules</CardDescription>
          </CardHeader>
          <DataTable columns={columns} data={mockPracticals as unknown as Record<string, unknown>[]} />
        </Card>
      </div>
    </div>
  );
};

export default PracticalsPage;
