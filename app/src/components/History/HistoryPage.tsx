import { Clock, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useImportGeneration } from '@/lib/hooks/useHistory';
import { HistoryTable } from './HistoryTable';

export function HistoryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const importGeneration = useImportGeneration();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.voicebox.zip')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a valid .voicebox.zip file',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setImportDialogOpen(true);
    }
  };

  const handleImportConfirm = () => {
    if (selectedFile) {
      importGeneration.mutate(selectedFile, {
        onSuccess: (data) => {
          setImportDialogOpen(false);
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          toast({
            title: 'Generation imported',
            description: data.message || 'Generation imported successfully',
          });
        },
        onError: (error) => {
          toast({
            title: 'Failed to import',
            description: error.message,
            variant: 'destructive',
          });
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">History</h1>
        </div>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".voicebox.zip"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* History list (reuses existing HistoryTable) */}
      <div className="flex-1 min-h-0">
        <HistoryTable />
      </div>

      {/* Import dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Generation</DialogTitle>
            <DialogDescription>
              Import the generation from "{selectedFile?.name}".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setSelectedFile(null); }}>
              Cancel
            </Button>
            <Button onClick={handleImportConfirm} disabled={importGeneration.isPending || !selectedFile}>
              {importGeneration.isPending ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
