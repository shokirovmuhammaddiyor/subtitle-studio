export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa' | 'lrc' | 'sami' | 'json' | 'txt';

export interface SubtitleCue {
  id: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  rawText?: string;
  speaker?: string;
  style?: {
    alignment?: number; // 1-9 numpad alignment (ASS style)
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    position?: { x: number; y: number };
  };
}

export interface SubtitleTrack {
  id: string | number;
  trackNumber: number;
  title: string;
  language: string;
  codec: string;
  format: SubtitleFormat;
  default?: boolean;
  forced?: boolean;
  codecPrivate?: string; // ASS Header, styles etc.
  cues: SubtitleCue[];
  rawContent?: string;
  sampleCount?: number;
}

export interface ExtractionStats {
  totalFileSize: number;
  bytesRead: number;
  savedPercentage: number;
  durationMs: number;
  trackCount: number;
  cuesCount: number;
}

export interface CleaningOptions {
  stripHtml: boolean;
  allowedHtmlTags: string[]; // e.g. ['i', 'b']
  stripAssTags: boolean;
  stripParentheses: boolean;    // (...)
  stripSquareBrackets: boolean; // [...]
  stripCurlyBraces: boolean;    // {...}
  stripAngleBrackets: boolean;  // <...>
  stripSdhSpeakers: boolean;    // JOHN: Hello -> Hello
  stripMusicSymbols: boolean;   // 🎵, 🎶, #
  stripWatermarks: boolean;     // site urls, promotional text
  customWatermarks: string[];
  caseTransform: 'none' | 'sentence' | 'title' | 'lowercase' | 'uppercase';
  removeEmptyLines: boolean;
  trimSpaces: boolean;
}

export interface ValidationIssue {
  id: string;
  cueId: number;
  type: 'overlap' | 'cps_too_high' | 'too_short' | 'too_long' | 'empty_text';
  severity: 'error' | 'warning' | 'info';
  message: string;
  timeRange: string;
  details?: any;
}
