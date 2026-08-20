import { SubtitleCue } from '../../types/subtitle';

export function parseSami(content: string): SubtitleCue[] {
  const syncRegex = /<SYNC\s+Start=(\d+)[^>]*>([\s\S]*?)(?=<SYNC|$)/gi;
  const cues: SubtitleCue[] = [];
  let match: RegExpExecArray | null;

  while ((match = syncRegex.exec(content)) !== null) {
    const startMs = parseInt(match[1], 10);
    let body = match[2];

    // Strip HTML paragraph/span/break tags
    body = body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (body && body !== '&nbsp;') {
      const startTime = startMs / 1000;
      cues.push({
        id: cues.length + 1,
        startTime,
        endTime: startTime + 3.0, // Default duration if not specified
        text: body
      });
    }
  }

  // Adjust end times based on next cue start
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].endTime > cues[i + 1].startTime) {
      cues[i].endTime = Math.max(cues[i].startTime + 0.1, cues[i + 1].startTime);
    }
  }

  return cues;
}
