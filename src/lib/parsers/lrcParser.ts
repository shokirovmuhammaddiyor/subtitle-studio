import { SubtitleCue } from '../../types/subtitle';

export function parseLrc(content: string): SubtitleCue[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const tempCues: { time: number; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
    const match = trimmed.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)$/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const msPart = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const time = mins * 60 + secs + msPart / 1000;
      const text = match[4].trim();
      if (text) {
        tempCues.push({ time, text });
      }
    }
  }

  tempCues.sort((a, b) => a.time - b.time);

  const cues: SubtitleCue[] = [];
  for (let i = 0; i < tempCues.length; i++) {
    const cur = tempCues[i];
    const nextTime = i < tempCues.length - 1 ? tempCues[i + 1].time : cur.time + 4.0;
    cues.push({
      id: i + 1,
      startTime: cur.time,
      endTime: Math.max(cur.time + 0.5, nextTime),
      text: cur.text
    });
  }

  return cues;
}

export function stringifyLrc(cues: SubtitleCue[]): string {
  return cues.map(c => {
    const totalMs = Math.round(c.startTime * 1000);
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const cs = Math.floor((totalMs % 1000) / 10);
    return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}]${c.text.replace(/\n/g, ' ')}`;
  }).join('\n');
}
