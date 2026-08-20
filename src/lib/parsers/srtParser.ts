import { SubtitleCue } from '../../types/subtitle';

export function formatTimeSrt(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function parseTimeSrt(timeStr: string): number {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return 0;
  const hrs = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const secs = parseInt(match[3], 10);
  const ms = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);
  return hrs * 3600 + mins * 60 + secs + ms / 1000;
}

export function parseSrt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    // Check if line 0 is ID number or timestamp
    if (lines[0].includes('-->')) {
      timeLineIdx = 0;
    } else if (lines.length > 1 && lines[1].includes('-->')) {
      timeLineIdx = 1;
    } else {
      continue;
    }

    const timeLine = lines[timeLineIdx];
    const [startStr, endStr] = timeLine.split('-->');
    if (!startStr || !endStr) continue;

    const startTime = parseTimeSrt(startStr);
    const endTime = parseTimeSrt(endStr);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join('\n');

    if (text) {
      cues.push({
        id: cues.length + 1,
        startTime,
        endTime: Math.max(startTime + 0.1, endTime),
        text,
        rawText: text
      });
    }
  }

  return cues;
}

export function stringifySrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, idx) => {
      const id = idx + 1;
      const time = `${formatTimeSrt(cue.startTime)} --> ${formatTimeSrt(cue.endTime)}`;
      return `${id}\n${time}\n${cue.text}\n`;
    })
    .join('\n');
}
