import { SubtitleCue, CleaningOptions } from '../../types/subtitle';

export const DEFAULT_CLEANING_OPTIONS: CleaningOptions = {
  stripHtml: true,
  allowedHtmlTags: [], // empty means strip all HTML tags. e.g. ['i', 'b'] to keep italics/bold
  stripAssTags: true,
  stripParentheses: true,    // (...)
  stripSquareBrackets: true, // [...]
  stripCurlyBraces: true,    // {...}
  stripAngleBrackets: false, // <...> (usually handled by stripHtml)
  stripSdhSpeakers: true,    // JOHN: Hello -> Hello
  stripMusicSymbols: true,   // 🎵, 🎶, #
  stripWatermarks: true,
  customWatermarks: [
    'opensubtitles',
    'subtitles by',
    'subtitles downloaded from',
    'sync & corrected by',
    'subscene',
    'yify',
    'yts',
    'addic7ed',
    'translated by',
    'tarjima qildi',
    'subtitle by'
  ],
  caseTransform: 'none',
  removeEmptyLines: true,
  trimSpaces: true
};

export function cleanText(rawText: string, options: CleaningOptions): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Strip ASS/SSA tags like {\an8}, {\pos(100,200)}, {\c&H0000FF&}
  if (options.stripAssTags) {
    text = text.replace(/\{[\\/][^}]*\}/g, '');
  }

  // 2. Strip HTML tags
  if (options.stripHtml) {
    if (options.allowedHtmlTags && options.allowedHtmlTags.length > 0) {
      // Regex that preserves allowed tags
      const allowed = options.allowedHtmlTags.join('|');
      const tagRegex = new RegExp(`<(?!/?(${allowed})\\b)[^>]*>`, 'gi');
      text = text.replace(tagRegex, '');
    } else {
      text = text.replace(/<[^>]*>/g, '');
    }
  }

  // 3. Strip Round brackets: (...)
  if (options.stripParentheses) {
    text = text.replace(/\([^)]*\)/g, '');
  }

  // 4. Strip Square brackets: [...]
  if (options.stripSquareBrackets) {
    text = text.replace(/\[[^\]]*\]/g, '');
  }

  // 5. Strip Curly braces: {...}
  if (options.stripCurlyBraces) {
    text = text.replace(/\{[^}]*\}/g, '');
  }

  // 6. Strip Angle brackets: <...>
  if (options.stripAngleBrackets) {
    text = text.replace(/<[^>]*>/g, '');
  }

  // 7. Strip SDH Speaker labels: e.g. "JOHN:", "NARRATOR (V.O.):", "MAN 1:"
  if (options.stripSdhSpeakers) {
    // Match uppercase speaker names at beginning of line or following punctuation/whitespace
    text = text.replace(/(?:^|[\n.!?]\s*|\s{2,})[A-Z0-9\s'-]+(?:\s*\([^)]*\))?\s*:\s*/gm, ' ');
  }

  // 8. Strip Music symbols
  if (options.stripMusicSymbols) {
    text = text.replace(/[♪♫♬♩#]/g, '');
  }

  // 9. Strip Watermarks & Ads
  if (options.stripWatermarks) {
    // Strip URL occurrences
    text = text.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi, '');

    // Strip custom watermark keywords
    for (const wm of options.customWatermarks) {
      if (wm && wm.trim()) {
        const escaped = wm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(^|\\s)${escaped}(?:\\s|$)`, 'gi');
        text = text.replace(reg, ' ');
      }
    }
  }

  // 10. Trim and whitespace normalization
  if (options.trimSpaces) {
    text = text
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(line => (options.removeEmptyLines ? Boolean(line) : true))
      .join('\n')
      .trim();
  }

  // 11. Casing transformations
  if (options.caseTransform !== 'none') {
    text = applyCaseTransform(text, options.caseTransform);
  }

  return text;
}

export function applyCaseTransform(text: string, transform: 'sentence' | 'title' | 'lowercase' | 'uppercase'): string {
  switch (transform) {
    case 'lowercase':
      return text.toLowerCase();
    case 'uppercase':
      return text.toUpperCase();
    case 'sentence':
      // Capitalize first letter of each sentence
      return text.replace(/(^\s*|[.!?]\s+)([a-zа-яё])/gu, (_, prefix, char) => prefix + char.toUpperCase());
    case 'title':
      return text.replace(/\b\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    default:
      return text;
  }
}

export function cleanSubtitleCues(cues: SubtitleCue[], options: CleaningOptions): SubtitleCue[] {
  const result: SubtitleCue[] = [];

  for (const cue of cues) {
    const cleaned = cleanText(cue.text, options);
    if (cleaned || !options.removeEmptyLines) {
      result.push({
        ...cue,
        text: cleaned
      });
    }
  }

  // Re-index cues
  return result.map((c, i) => ({ ...c, id: i + 1 }));
}
