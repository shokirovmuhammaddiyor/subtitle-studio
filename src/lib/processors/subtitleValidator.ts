import { SubtitleCue, ValidationIssue } from '../../types/subtitle';
import { formatTimeSrt } from '../parsers/srtParser';

export function validateSubtitles(cues: SubtitleCue[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const duration = cue.endTime - cue.startTime;
    const cleanContent = cue.text.replace(/<[^>]*>/g, '').trim();
    const charCount = cleanContent.length;
    const timeRange = `${formatTimeSrt(cue.startTime)} → ${formatTimeSrt(cue.endTime)}`;

    // 1. Empty text check
    if (!cleanContent) {
      issues.push({
        id: `empty-${cue.id}`,
        cueId: cue.id,
        type: 'empty_text',
        severity: 'warning',
        message: `#${cue.id} replika matni bo'sh`,
        timeRange
      });
    }

    // 2. Too short duration (< 0.5 sec)
    if (duration < 0.5 && charCount > 0) {
      issues.push({
        id: `short-${cue.id}`,
        cueId: cue.id,
        type: 'too_short',
        severity: 'info',
        message: `#${cue.id} replika davomiyligi juda qisqa (${duration.toFixed(2)}s)`,
        timeRange
      });
    }

    // 3. Too long duration (> 8 sec)
    if (duration > 8.0) {
      issues.push({
        id: `long-${cue.id}`,
        cueId: cue.id,
        type: 'too_long',
        severity: 'info',
        message: `#${cue.id} replika davomiyligi haddan tashqari uzun (${duration.toFixed(1)}s)`,
        timeRange
      });
    }

    // 4. CPS (Characters Per Second) check (> 25 CPS)
    if (duration > 0 && charCount > 0) {
      const cps = charCount / duration;
      if (cps > 25) {
        issues.push({
          id: `cps-${cue.id}`,
          cueId: cue.id,
          type: 'cps_too_high',
          severity: 'warning',
          message: `#${cue.id} o'qish tezligi juda yuqori: ${cps.toFixed(1)} belgi/sek (Tavsiya: < 22)`,
          timeRange,
          details: { cps, charCount, duration }
        });
      }
    }

    // 5. Overlap check with next cue
    if (i < cues.length - 1) {
      const nextCue = cues[i + 1];
      if (cue.endTime > nextCue.startTime) {
        const overlapMs = Math.round((cue.endTime - nextCue.startTime) * 1000);
        issues.push({
          id: `overlap-${cue.id}-${nextCue.id}`,
          cueId: cue.id,
          type: 'overlap',
          severity: 'error',
          message: `#${cue.id} va #${nextCue.id} replikalari bir-biri bilan to'qnashgan (${overlapMs}ms overlap)`,
          timeRange: `${formatTimeSrt(cue.startTime)} - ${formatTimeSrt(nextCue.startTime)}`,
          details: { nextCueId: nextCue.id, overlapMs }
        });
      }
    }
  }

  return issues;
}

export function autoFixValidationIssues(cues: SubtitleCue[]): SubtitleCue[] {
  const result: SubtitleCue[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = { ...cues[i] };
    const cleanContent = cue.text.trim();

    // Skip empty cues
    if (!cleanContent) continue;

    // Fix overlap with next cue
    if (i < cues.length - 1) {
      const nextCue = cues[i + 1];
      if (cue.endTime > nextCue.startTime) {
        // Shorten current cue's end time to just before next cue start (gap 50ms)
        cue.endTime = Math.max(cue.startTime + 0.1, Number((nextCue.startTime - 0.05).toFixed(3)));
      }
    }

    result.push(cue);
  }

  return result.map((c, idx) => ({ ...c, id: idx + 1 }));
}
