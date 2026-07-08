import { useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';

const SearchResultsPage = () => {
  const [params] = useSearchParams();
  const query = params.get('q') || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Search Results</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Showing matching results for query: "{query}"
        </p>
      </div>

      <Card className="p-6 text-center text-surface-400">
        <p className="text-sm">No items matching "{query}" found in this dashboard view.</p>
      </Card>
    </div>
  );
};

export default SearchResultsPage;
