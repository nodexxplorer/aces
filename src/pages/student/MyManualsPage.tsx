import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Download, Printer, BookOpen } from 'lucide-react';
import type { Manual } from '../../types';
import { useState } from 'react';

const mockBoughtManuals: Manual[] = [
  { id: 'm-1', title: 'CPE 511: Embedded Systems Design', description: 'Lab workbook and theory overview for CPE 511 course instruction.', price: 3500, level: 5, semester: 'first', isActive: true, coverImageUrl: '', authorId: 'lec-1', code: 'CPE511-M', createdAt: '' },
];

const MyManualsPage = () => {
  const { success } = useNotification();
  const [printingId, setPrintingId] = useState<string | null>(null);

  const handlePrint = async (manualId: string, title: string) => {
    setPrintingId(manualId);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      success('Sent to Queue', `"${title}" has been sent to the Department Print Queue. Take your receipt to class rep to pick it up.`);
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Manuals</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Access your digital library of purchased course workbooks and lecture manuals.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockBoughtManuals.map((m) => (
          <Card key={m.id} hover>
            <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3">
              <BookOpen className="w-12 h-12 text-primary-400" />
            </div>
            <h4 className="font-semibold text-surface-900 dark:text-white text-sm mb-1 line-clamp-2">{m.title}</h4>
            <p className="text-xs text-surface-500 mb-4">{m.code}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" leftIcon={<Download className="w-4 h-4" />} onClick={() => success('Downloaded', 'PDF download started.')}>
                Download
              </Button>
              <Button size="sm" className="flex-1" isLoading={printingId === m.id} leftIcon={<Printer className="w-4 h-4" />} onClick={() => handlePrint(m.id, m.title)}>
                Print Book
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyManualsPage;
