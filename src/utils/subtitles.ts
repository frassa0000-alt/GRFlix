export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export type SubtitleSizeOption = 'sm' | 'md' | 'lg' | 'xl';

export interface SubtitleColorOption {
  id: string;
  label: string;
  value: string;
}

export const SUBTITLE_COLORS: SubtitleColorOption[] = [
  { id: 'white', label: 'أبيض', value: '#ffffff' },
  { id: 'gold', label: 'ذهبي', value: '#facc15' },
  { id: 'cyan', label: 'سماوي', value: '#38bdf8' },
  { id: 'green', label: 'أخضر', value: '#4ade80' },
];

export const SUBTITLE_SIZES: { id: SubtitleSizeOption; label: string; className: string }[] = [
  { id: 'sm', label: 'صغير', className: 'text-xs sm:text-sm' },
  { id: 'md', label: 'متوسط', className: 'text-sm sm:text-lg' },
  { id: 'lg', label: 'كبير', className: 'text-base sm:text-xl md:text-2xl' },
  { id: 'xl', label: 'ضخم', className: 'text-lg sm:text-2xl md:text-3xl' },
];

/**
 * Parses SRT/VTT timestamps like "01:02:03,450", "01:02:03.450", or "02:03.450" into seconds.
 */
export function parseSubtitleTimestamp(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;

  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function cleanCueText(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\{\\[^}]*\}/g, '') // Strip ASS/SSA override tags like {\an8}
    .replace(/<[^>]+>/g, '') // Strip HTML/VTT tags like <i>, <c>
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses both .srt and .vtt subtitle file contents into sorted SubtitleCue objects.
 */
export function parseSubtitleText(content: string): SubtitleCue[] {
  if (!content || typeof content !== 'string') return [];

  const normalized = content
    .replace(/^\uFEFF/, '') // Remove UTF-8 BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and WebVTT non-cue header blocks
    if (
      !line ||
      line.startsWith('WEBVTT') ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:')
    ) {
      i += 1;
      continue;
    }

    if (line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      while (i < lines.length && lines[i].trim() !== '') {
        i += 1;
      }
      i += 1;
      continue;
    }

    // Check if this line is a numeric/named cue identifier followed by a timestamp line
    let timestampLine = line;
    if (!line.includes('-->') && i + 1 < lines.length && lines[i + 1].includes('-->')) {
      i += 1;
      timestampLine = lines[i].trim();
    }

    if (!timestampLine.includes('-->')) {
      i += 1;
      continue;
    }

    const arrowParts = timestampLine.split('-->');
    if (arrowParts.length < 2) {
      i += 1;
      continue;
    }

    const start = parseSubtitleTimestamp(arrowParts[0]);
    // End token may have VTT positioning metadata separated by space/tab
    const endToken = arrowParts[1].trim().split(/\s+/)[0] || '';
    const end = parseSubtitleTimestamp(endToken);

    i += 1;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i += 1;
    }

    if (start !== null && end !== null && end > start) {
      const text = cleanCueText(textLines);
      if (text) {
        cues.push({ start, end, text });
      }
    }
  }

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Finds active cue text(s) at the specified video time in seconds.
 */
export function getActiveSubtitleText(cues: SubtitleCue[], currentTime: number): string {
  if (!cues.length || Number.isNaN(currentTime)) return '';

  // Binary search to locate the upper bound quickly, then scan nearby overlapping cues
  let low = 0;
  let high = cues.length - 1;
  let candidateIndex = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= currentTime) {
      candidateIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Walk slightly backward to catch overlapping cues that started earlier
  let scanStart = candidateIndex;
  while (scanStart > 0 && cues[scanStart - 1].end >= currentTime) {
    scanStart -= 1;
  }

  const activeTexts: string[] = [];
  for (let idx = scanStart; idx <= candidateIndex && idx < cues.length; idx += 1) {
    const cue = cues[idx];
    if (currentTime >= cue.start && currentTime <= cue.end) {
      activeTexts.push(cue.text);
    }
  }

  return activeTexts.join('\n');
}
