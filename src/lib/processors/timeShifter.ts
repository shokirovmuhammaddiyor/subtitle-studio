import { SubtitleCue } from '../../types/subtitle';

export interface TimeShiftOptions {
  offsetMs: number; // Positive = delay (forward), Negative = earlier (backward)
  fpsSource?: number;
  fpsTarget?: number;
  linearSync?: {
    firstCueTargetMs: number;
    lastCueTargetMs: number;
  };
}

export const COMMON_FPS = [
  { label: '23.976 FPS (Film / NTSC)', value: 23.976 },
  { label: '24.000 FPS (Cinema standard)', value: 24.0 },
  { label: '25.000 FPS (PAL / European TV)', value: 25.0 },
  { label: '29.970 FPS (NTSC TV)', value: 29.97 },
  { label: '30.000 FPS (Standard Video)', value: 30.0 },
  { label: '60.000 FPS (High Frame Rate)', value: 60.0 },
];

export function shiftSubtitles(cues: SubtitleCue[], options: TimeShiftOptions): SubtitleCue[] {
  if (cues.length === 0) return [];

  const offsetSec = options.offsetMs / 1000;
  let fpsRatio = 1.0;
  if (options.fpsSource && options.fpsTarget && options.fpsSource > 0 && options.fpsTarget > 0) {
    fpsRatio = options.fpsSource / options.fpsTarget;
  }

  // Linear sync calculation
  let linearSlope = 1.0;
  let linearIntercept = 0.0;
  if (options.linearSync && cues.length >= 2) {
    const origFirst = cues[0].startTime;
    const origLast = cues[cues.length - 1].startTime;
    const targetFirst = options.linearSync.firstCueTargetMs / 1000;
    const targetLast = options.linearSync.lastCueTargetMs / 1000;

    if (origLast > origFirst) {
      linearSlope = (targetLast - targetFirst) / (origLast - origFirst);
      linearIntercept = targetFirst - (origFirst * linearSlope);
    }
  }

  return cues.map(cue => {
    let newStart = cue.startTime;
    let newEnd = cue.endTime;

    if (options.linearSync) {
      newStart = (newStart * linearSlope) + linearIntercept;
      newEnd = (newEnd * linearSlope) + linearIntercept;
    } else {
      newStart = (newStart * fpsRatio) + offsetSec;
      newEnd = (newEnd * fpsRatio) + offsetSec;
    }

    newStart = Math.max(0, newStart);
    newEnd = Math.max(newStart + 0.1, newEnd);

    return {
      ...cue,
      startTime: Number(newStart.toFixed(3)),
      endTime: Number(newEnd.toFixed(3))
    };
  });
}
