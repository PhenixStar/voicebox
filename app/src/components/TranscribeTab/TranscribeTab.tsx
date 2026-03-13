import { FileText } from 'lucide-react';
import { useState } from 'react';
import { BOTTOM_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import { cn } from '@/lib/utils/cn';
import { usePlayerStore } from '@/stores/playerStore';
import type { DiarizedTranscriptionResponse } from '@/lib/api/types';
import { TranscriptionForm } from './transcription-form';
import { TranscriptionResults } from './transcription-results';

export function TranscribeTab() {
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlayerVisible = !!audioUrl;
  const [result, setResult] = useState<DiarizedTranscriptionResponse | null>(null);

  return (
    <div className="h-full flex flex-col py-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0 mb-6">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Transcribe</h1>
      </div>

      {/* Scrollable content */}
      <div className={cn('flex-1 overflow-y-auto', isPlayerVisible && BOTTOM_SAFE_AREA_PADDING)}>
        <TranscriptionForm onResult={setResult} />

        {/* Results */}
        {result && (
          <div className="mt-6 max-w-2xl">
            <TranscriptionResults result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
