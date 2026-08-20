import { SubtitleCue, SubtitleFormat } from '../../types/subtitle';
import { parseSrt, stringifySrt } from './srtParser';
import { parseVtt, stringifyVtt } from './vttParser';
import { parseAss, stringifyAss } from './assParser';
import { parseLrc, stringifyLrc } from './lrcParser';
import { parseSami } from './samiParser';

export function detectFormat(content: string, filename?: string): SubtitleFormat {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'srt') return 'srt';
    if (ext === 'vtt') return 'vtt';
    if (ext === 'ass') return 'ass';
    if (ext === 'ssa') return 'ssa';
    if (ext === 'lrc') return 'lrc';
    if (ext === 'smi' || ext === 'sami') return 'sami';
    if (ext === 'json') return 'json';
    if (ext === 'txt') return 'txt';
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('WEBVTT')) return 'vtt';
  if (trimmed.includes('[Script Info]') || trimmed.includes('[V4+ Styles]') || trimmed.includes('[Events]')) return 'ass';
  if (trimmed.includes('<SYNC Start=')) return 'sami';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // not json
    }
  }
  if (/^\[\d{1,2}:\d{2}/m.test(trimmed)) return 'lrc';
  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/.test(trimmed)) {
    return trimmed.includes(',') ? 'srt' : 'vtt';
  }

  return 'srt'; // default fallback
}

export function parseSubtitles(content: string, format?: SubtitleFormat, filename?: string): SubtitleCue[] {
  const detected = format || detectFormat(content, filename);

  switch (detected) {
    case 'vtt':
      return parseVtt(content);
    case 'ass':
    case 'ssa':
      return parseAss(content);
    case 'lrc':
      return parseLrc(content);
    case 'sami':
      return parseSami(content);
    case 'json':
      try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) return data;
      } catch {
        return [];
      }
      return [];
    case 'txt': {
      // Plain text transcript - split into 3s blocks
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      return lines.map((line, idx) => ({
        id: idx + 1,
        startTime: idx * 3.0,
        endTime: (idx + 1) * 3.0,
        text: line
      }));
    }
    case 'srt':
    default:
      return parseSrt(content);
  }
}

export function stringifySubtitles(cues: SubtitleCue[], targetFormat: SubtitleFormat, customHeader?: string): string {
  switch (targetFormat) {
    case 'vtt':
      return stringifyVtt(cues);
    case 'ass':
    case 'ssa':
      return stringifyAss(cues, customHeader);
    case 'lrc':
      return stringifyLrc(cues);
    case 'json':
      return JSON.stringify(cues, null, 2);
    case 'txt':
      return cues.map(c => c.text).join('\n\n');
    case 'srt':
    default:
      return stringifySrt(cues);
  }
}
