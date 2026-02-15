import { useState, useMemo } from 'react';
import { format, subWeeks } from 'date-fns';
import { FileText, FileSpreadsheet, Download, Loader2, Calendar, X, StickyNote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUserData, CheckIn } from '@/contexts/UserDataContext';
import { useSubscription } from '@/hooks/useSubscription';
import PaywallGuard from '@/components/PaywallGuard';
import { generateCSV, generateClinicianPDF, downloadCSV, downloadPDF } from '@/utils/exportData';
import { toast } from 'sonner';

interface ExportDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportType = 'pdf' | 'csv';
type DatePreset = '2w' | '4w' | '8w' | '12w' | 'custom';

const presets: { value: DatePreset; label: string }[] = [
  { value: '2w', label: '2 weeks' },
  { value: '4w', label: '4 weeks' },
  { value: '8w', label: '8 weeks' },
  { value: '12w', label: '12 weeks' },
  { value: 'custom', label: 'Custom' },
];

const weeksMap: Record<string, number> = { '2w': 2, '4w': 4, '8w': 8, '12w': 12 };

const ExportDataModal = ({ open, onOpenChange }: ExportDataModalProps) => {
  const { isPremium } = useSubscription();
  const { checkIns } = useUserData();

  const [exportType, setExportType] = useState<ExportType>('pdf');
  const [datePreset, setDatePreset] = useState<DatePreset>('4w');
  const [customStart, setCustomStart] = useState(format(subWeeks(new Date(), 4), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [includeNotes, setIncludeNotes] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'custom') {
      return { startDate: new Date(customStart), endDate: new Date(customEnd) };
    }
    const weeks = weeksMap[datePreset] ?? 4;
    return { startDate: subWeeks(new Date(), weeks), endDate: new Date() };
  }, [datePreset, customStart, customEnd]);

  const matchingCount = useMemo(() => {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    return checkIns.filter((c) => {
      const d = format(new Date(c.timestamp), 'yyyy-MM-dd');
      return d >= start && d <= end;
    }).length;
  }, [checkIns, startDate, endDate]);

  const handleExport = async () => {
    if (matchingCount === 0) {
      toast.error('No check-ins found in this date range.');
      return;
    }

    setIsExporting(true);
    try {
      const options = { checkIns, startDate, endDate, includeNotes };
      const dateLabel = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;

      if (exportType === 'csv') {
        const csv = generateCSV(options);
        await downloadCSV(csv, `TrackTSW_Data_${dateLabel}.csv`);
        toast.success('CSV exported successfully.');
      } else {
        const doc = generateClinicianPDF(options);
        await downloadPDF(doc, `TrackTSW_Summary_${dateLabel}.pdf`);
        toast.success('PDF exported successfully.');
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // If not premium, show paywall inside modal
  if (!isPremium) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Export My Data</DialogTitle>
          </DialogHeader>
          <PaywallGuard feature="Export your insights and logs for appointments or personal records">
            <div />
          </PaywallGuard>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Export My Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Export type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Export type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportType('pdf')}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                  exportType === 'pdf'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <FileText className={cn('w-5 h-5', exportType === 'pdf' ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">Clinician PDF</span>
                <span className="text-xs text-muted-foreground">Summary for appointments</span>
              </button>
              <button
                onClick={() => setExportType('csv')}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                  exportType === 'csv'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <FileSpreadsheet className={cn('w-5 h-5', exportType === 'csv' ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">Raw Data CSV</span>
                <span className="text-xs text-muted-foreground">All fields, spreadsheet-ready</span>
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Date range
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    datePreset === p.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex gap-2 mt-2">
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="flex-1" />
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="flex-1" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {matchingCount} check-in{matchingCount !== 1 ? 's' : ''} in this range
            </p>
          </div>

          {/* Include notes toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Include notes</span>
            </div>
            <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} />
          </div>

          {/* Export button */}
          <Button
            onClick={handleExport}
            disabled={isExporting || matchingCount === 0}
            className="w-full gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download {exportType === 'pdf' ? 'PDF' : 'CSV'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDataModal;
