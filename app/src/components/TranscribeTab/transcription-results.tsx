import { ClipboardCopy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import type { DiarizedTranscriptionResponse, TranscriptionSegment } from '@/lib/api/types';

/** Color classes for distinguishing speakers */
const SPEAKER_COLORS = [
  'text-blue-400',
  'text-green-400',
  'text-purple-400',
  'text-orange-400',
  'text-pink-400',
  'text-cyan-400',
  'text-yellow-400',
  'text-red-400',
];

function getSpeakerColor(speaker: string | null, speakers: string[]): string {
  if (!speaker) return 'text-foreground';
  const idx = speakers.indexOf(speaker);
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

/** Format seconds as mm:ss */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format seconds as HH:MM:SS,mmm for SRT */
function formatTimeSRT(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatSRT(segments: TranscriptionSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = formatTimeSRT(seg.start);
      const end = formatTimeSRT(seg.end);
      const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
      return `${i + 1}\n${start} --> ${end}\n${speaker}${seg.text}\n`;
    })
    .join('\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface TranscriptionResultsProps {
  result: DiarizedTranscriptionResponse;
}

export function TranscriptionResults({ result }: TranscriptionResultsProps) {
  const { toast } = useToast();
  const hasSpeakers = result.speakers.length > 0;

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard' });
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>Duration: {formatTime(result.duration)}</span>
        <span>Language: {result.language}</span>
        {hasSpeakers && <span>{result.speakers.length} speaker(s) detected</span>}
      </div>

      <Tabs defaultValue="text">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="text">Full Text</TabsTrigger>
            {result.segments.length > 0 && <TabsTrigger value="segments">Segments</TabsTrigger>}
          </TabsList>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleCopy(result.text)}>
              <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadFile(result.text, 'transcript.txt', 'text/plain')}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              TXT
            </Button>
            {result.segments.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadFile(formatSRT(result.segments), 'transcript.srt', 'text/srt')
                }
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                SRT
              </Button>
            )}
          </div>
        </div>

        {/* Full text view */}
        <TabsContent value="text">
          <Textarea
            readOnly
            value={result.text}
            className="min-h-[200px] bg-card border-border resize-y"
          />
        </TabsContent>

        {/* Segments view */}
        {result.segments.length > 0 && (
          <TabsContent value="segments">
            <div className="space-y-1 max-h-[400px] overflow-y-auto rounded-md border border-border bg-card p-3">
              {result.segments.map((seg, i) => (
                <div key={i} className="flex gap-3 text-sm py-1">
                  <span className="text-muted-foreground shrink-0 font-mono text-xs pt-0.5">
                    {formatTime(seg.start)}
                  </span>
                  {seg.speaker && (
                    <span
                      className={`shrink-0 font-medium text-xs pt-0.5 ${getSpeakerColor(seg.speaker, result.speakers)}`}
                    >
                      {seg.speaker}
                    </span>
                  )}
                  <span className="text-foreground">{seg.text}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
