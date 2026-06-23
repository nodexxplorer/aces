import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';

const mockRatings = [
  { id: '1', reviewerName: 'John Doe', rating: '4.8 / 5', remarks: 'Awesome code help, very professional.' },
];

const RatingsPage = () => {
  const columns = [
    { key: 'reviewerName', label: 'Reviewer' },
    { key: 'rating', label: 'Rating Score' },
    { key: 'remarks', label: 'Feedback Comment' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Peer Review Ratings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review feedback received from student swap partners.
        </p>
      </div>

      <Card>
        <DataTable columns={columns} data={mockRatings} />
      </Card>
    </div>
  );
};

export default RatingsPage;
