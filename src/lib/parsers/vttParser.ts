import { SubtitleCue } from '../../types/subtitle';

export function formatTimeVtt(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function parseTimeVtt(timeStr: string): number {
  const match = timeStr.trim().match(/(?:(\d{1,2}):)?(\d{2}):(\d{2})[.](\d{1,3})/);
  if (!match) return 0;
  const hrs = match[1] ? parseInt(match[1], 10) : 0;
  const mins = parseInt(match[2], 10);
  const secs = parseInt(match[3], 10);
  const ms = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);
  return hrs * 3600 + mins * 60 + secs + ms / 1000;
}

export function parseVtt(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];

  let currentCue: Partial<SubtitleCue> | null = null;
  let textBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')) {
      continue;
    }

    if (line.includes('-->')) {
      if (currentCue && textBuffer.length > 0) {
        cues.push({
          id: cues.length + 1,
          startTime: currentCue.startTime || 0,
          endTime: currentCue.endTime || 0,
          text: textBuffer.join('\n'),
          rawText: textBuffer.join('\n')
        });
        textBuffer = [];
      }

      const [startPart, rest] = line.split('-->');
      const endPart = (rest || '').trim().split(/\s+/)[0]; // strip cue settings

      const startTime = parseTimeVtt(startPart);
      const endTime = parseTimeVtt(endPart);

      currentCue = {
        id: cues.length + 1,
        startTime,
        endTime: Math.max(startTime + 0.1, endTime)
      };
    } else if (currentCue && line) {
      textBuffer.push(line);
    } else if (!line && currentCue && textBuffer.length > 0) {
      cues.push({
        id: cues.length + 1,
        startTime: currentCue.startTime || 0,
        endTime: currentCue.endTime || 0,
        text: textBuffer.join('\n'),
        rawText: textBuffer.join('\n')
      });
      currentCue = null;
      textBuffer = [];
    }
  }

  if (currentCue && textBuffer.length > 0) {
    cues.push({
      id: cues.length + 1,
      startTime: currentCue.startTime || 0,
      endTime: currentCue.endTime || 0,
      text: textBuffer.join('\n'),
      rawText: textBuffer.join('\n')
    });
  }

  return cues;
}

export function stringifyVtt(cues: SubtitleCue[]): string {
  const body = cues
    .map((cue, idx) => {
      const id = idx + 1;
      const time = `${formatTimeVtt(cue.startTime)} --> ${formatTimeVtt(cue.endTime)}`;
      return `${id}\n${time}\n${cue.text}\n`;
    })
    .join('\n');

  return `WEBVTT\n\n${body}`;
}
