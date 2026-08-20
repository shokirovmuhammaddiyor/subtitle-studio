import { SubtitleCue } from '../../types/subtitle';

export interface DualSubtitleOptions {
  topLanguageLabel?: string;
  bottomLanguageLabel?: string;
  topColor?: string;     // e.g. '#FFFF00' (Yellow)
  bottomColor?: string;  // e.g. '#FFFFFF' (White)
  formatMode: 'combined_text' | 'ass_styles'; // combined_text: top\nbottom, ass_styles: uses {\an8} on top
}

export function createDualSubtitles(
  topCues: SubtitleCue[],
  bottomCues: SubtitleCue[],
  options: DualSubtitleOptions = { formatMode: 'ass_styles' }
): SubtitleCue[] {
  const result: SubtitleCue[] = [];

  // If using ASS positioning styles:
  // Top cues get {\an8} (Alignment: top center)
  // Bottom cues get default alignment (bottom center)
  if (options.formatMode === 'ass_styles') {
    for (const cue of topCues) {
      result.push({
        id: 0,
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: `{\\an8}${options.topColor ? `{\\c&H${colorToAssHex(options.topColor)}&}` : ''}${cue.text}`,
        style: { alignment: 8, color: options.topColor }
      });
    }
    for (const cue of bottomCues) {
      result.push({
        id: 0,
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: options.bottomColor ? `{\\c&H${colorToAssHex(options.bottomColor)}&}${cue.text}` : cue.text,
        style: { alignment: 2, color: options.bottomColor }
      });
    }

    result.sort((a, b) => a.startTime - b.startTime);
    return result.map((c, i) => ({ ...c, id: i + 1 }));
  }

  // Combined text mode: match overlapping cues
  const allEvents: { time: number; type: 'start' | 'end'; source: 'top' | 'bot'; cue: SubtitleCue }[] = [];
  topCues.forEach(c => {
    allEvents.push({ time: c.startTime, type: 'start', source: 'top', cue: c });
    allEvents.push({ time: c.endTime, type: 'end', source: 'top', cue: c });
  });
  bottomCues.forEach(c => {
    allEvents.push({ time: c.startTime, type: 'start', source: 'bot', cue: c });
    allEvents.push({ time: c.endTime, type: 'end', source: 'bot', cue: c });
  });

  allEvents.sort((a, b) => a.time - b.time);

  let currentTop: SubtitleCue | null = null;
  let currentBot: SubtitleCue | null = null;
  let lastTime = 0;

  for (const event of allEvents) {
    if (event.time > lastTime && (currentTop || currentBot)) {
      const topText = currentTop ? currentTop.text : '';
      const botText = currentBot ? currentBot.text : '';
      const combined = [topText, botText].filter(Boolean).join('\n');

      if (combined.trim()) {
        result.push({
          id: result.length + 1,
          startTime: Number(lastTime.toFixed(3)),
          endTime: Number(event.time.toFixed(3)),
          text: combined
        });
      }
    }

    if (event.source === 'top') {
      currentTop = event.type === 'start' ? event.cue : null;
    } else {
      currentBot = event.type === 'start' ? event.cue : null;
    }

    lastTime = event.time;
  }

  return result;
}

function colorToAssHex(hex: string): string {
  // Convert #RRGGBB to BBGGRR (ASS color order)
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `${b}${g}${r}`.toUpperCase();
  }
  return '00FFFF'; // default yellow
}

export function joinSubtitles(
  parts: { cues: SubtitleCue[]; offsetSec?: number }[]
): SubtitleCue[] {
  const result: SubtitleCue[] = [];
  let currentOffset = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const offset = part.offsetSec !== undefined ? part.offsetSec : currentOffset;

    for (const cue of part.cues) {
      result.push({
        id: result.length + 1,
        startTime: Number((cue.startTime + offset).toFixed(3)),
        endTime: Number((cue.endTime + offset).toFixed(3)),
        text: cue.text
      });
    }

    if (part.cues.length > 0) {
      const lastCue = part.cues[part.cues.length - 1];
      currentOffset = offset + lastCue.endTime + 2.0; // default 2s gap if auto
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime).map((c, i) => ({ ...c, id: i + 1 }));
}

export function splitSubtitles(
  cues: SubtitleCue[],
  splitTimeSec: number,
  resetSecondPartTimestamp: boolean = true
): { part1: SubtitleCue[]; part2: SubtitleCue[] } {
  const part1: SubtitleCue[] = [];
  const part2: SubtitleCue[] = [];

  for (const cue of cues) {
    if (cue.endTime <= splitTimeSec) {
      part1.push({ ...cue });
    } else if (cue.startTime >= splitTimeSec) {
      const offset = resetSecondPartTimestamp ? splitTimeSec : 0;
      part2.push({
        ...cue,
        startTime: Number(Math.max(0, cue.startTime - offset).toFixed(3)),
        endTime: Number(Math.max(0.1, cue.endTime - offset).toFixed(3))
      });
    } else {
      // Cue straddles the split point - divide it
      part1.push({
        ...cue,
        endTime: splitTimeSec
      });
      const offset = resetSecondPartTimestamp ? splitTimeSec : 0;
      part2.push({
        ...cue,
        startTime: 0,
        endTime: Number((cue.endTime - offset).toFixed(3))
      });
    }
  }

  return {
    part1: part1.map((c, i) => ({ ...c, id: i + 1 })),
    part2: part2.map((c, i) => ({ ...c, id: i + 1 }))
  };
}
