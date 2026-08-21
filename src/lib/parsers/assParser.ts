import { SubtitleCue } from '../../types/subtitle';

export function formatTimeAss(seconds: number): string {
  const totalCs = Math.max(0, Math.round(seconds * 100)); // centiseconds (10ms)
  const hrs = Math.floor(totalCs / 360000);
  const mins = Math.floor((totalCs % 360000) / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;

  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function parseTimeAss(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[.](\d{1,3})/);
  if (!match) return 0;
  const hrs = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const secs = parseInt(match[3], 10);
  const rawCs = match[4];
  const cs = rawCs.length === 3 ? parseInt(rawCs, 10) / 10 : parseInt(rawCs.padEnd(2, '0').slice(0, 2), 10);
  return hrs * 3600 + mins * 60 + secs + cs / 100;
}

/**
 * Robust ASS / SSA parser that handles all format headers, commas in text, and override tags
 */
export function parseAss(content: string): SubtitleCue[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: SubtitleCue[] = [];
  let inEvents = false;
  let formatFields: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toLowerCase() === '[events]') {
      inEvents = true;
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']') && line.toLowerCase() !== '[events]') {
      inEvents = false;
      continue;
    }

    if (inEvents && line.toLowerCase().startsWith('format:')) {
      const colonIdx = line.indexOf(':');
      formatFields = line.substring(colonIdx + 1).split(',').map(s => s.trim().toLowerCase());
      continue;
    }

    if (inEvents && (line.toLowerCase().startsWith('dialogue:') || line.toLowerCase().startsWith('comment:'))) {
      const isDialogue = line.toLowerCase().startsWith('dialogue:');
      const colonIdx = line.indexOf(':');
      const rawData = line.substring(colonIdx + 1).trim();

      // In ASS, text is the last field and can contain unlimited commas
      let startTime = 0;
      let endTime = 0;
      let text = '';
      let styleName = 'Default';

      if (formatFields.length > 0) {
        const textIdx = formatFields.indexOf('text');
        const numPrefixFields = textIdx >= 0 ? textIdx : formatFields.length - 1;

        // Split only up to numPrefixFields
        const parts: string[] = [];
        let cur = '';
        let commaCount = 0;

        for (let c = 0; c < rawData.length; c++) {
          const char = rawData[c];
          if (char === ',' && commaCount < numPrefixFields) {
            parts.push(cur.trim());
            cur = '';
            commaCount++;
          } else {
            cur += char;
          }
        }
        parts.push(cur); // last part contains the full text

        const startIdx = formatFields.indexOf('start');
        const endIdx = formatFields.indexOf('end');
        const styleIdx = formatFields.indexOf('style');

        if (startIdx >= 0 && parts[startIdx]) startTime = parseTimeAss(parts[startIdx]);
        if (endIdx >= 0 && parts[endIdx]) endTime = parseTimeAss(parts[endIdx]);
        if (styleIdx >= 0 && parts[styleIdx]) styleName = parts[styleIdx] || 'Default';
        if (parts.length > numPrefixFields) {
          text = parts[numPrefixFields] || '';
        }
      } else {
        // Fallback standard ASS field order: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text (9 commas)
        const parts: string[] = [];
        let cur = '';
        let commaCount = 0;

        for (let c = 0; c < rawData.length; c++) {
          const char = rawData[c];
          if (char === ',' && commaCount < 9) {
            parts.push(cur.trim());
            cur = '';
            commaCount++;
          } else {
            cur += char;
          }
        }
        parts.push(cur);

        if (parts.length >= 3) {
          startTime = parseTimeAss(parts[1]);
          endTime = parseTimeAss(parts[2]);
          styleName = parts[3] || 'Default';
          text = parts[9] || parts[parts.length - 1] || '';
        }
      }

      // Format text
      const cleanText = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');

      cues.push({
        id: cues.length + 1,
        startTime,
        endTime: Math.max(startTime + 0.1, endTime),
        text: cleanText,
        rawText: text
      });
    }
  }

  // Fallback: If no [Events] section was explicitly labeled, parse lines starting with Dialogue:
  if (cues.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('dialogue:')) {
        const colonIdx = line.indexOf(':');
        const rawData = line.substring(colonIdx + 1).trim();
        const parts = rawData.split(',');
        if (parts.length >= 10) {
          const startTime = parseTimeAss(parts[1]);
          const endTime = parseTimeAss(parts[2]);
          const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/\\n/g, '\n');
          cues.push({
            id: cues.length + 1,
            startTime,
            endTime: Math.max(startTime + 0.1, endTime),
            text,
            rawText: parts.slice(9).join(',')
          });
        }
      }
    }
  }

  return cues;
}

export function stringifyAss(cues: SubtitleCue[], customHeader?: string): string {
  if (customHeader && customHeader.includes('[Events]')) {
    const eventHeader = customHeader.substring(0, customHeader.indexOf('[Events]') + 8);
    const eventLines = cues.map(cue => {
      const s = formatTimeAss(cue.startTime);
      const e = formatTimeAss(cue.endTime);
      const text = (cue.rawText && cue.rawText.includes('{\\') ? cue.rawText : cue.text).replace(/\n/g, '\\N');
      return `Dialogue: 0,${s},${e},Default,,0,0,0,,${text}`;
    }).join('\n');

    return `${eventHeader}\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${eventLines}`;
  }

  const defaultHeader = `[Script Info]
; Script generated by Subtitle Studio Pro
Title: Subtitle
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,30,1
Style: Top,Arial,48,&H00FFFF00,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,8,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues.map(cue => {
    const s = formatTimeAss(cue.startTime);
    const e = formatTimeAss(cue.endTime);
    const style = cue.style?.alignment === 8 ? 'Top' : 'Default';
    const text = (cue.rawText && cue.rawText.includes('{\\') ? cue.rawText : cue.text).replace(/\n/g, '\\N');
    return `Dialogue: 0,${s},${e},${style},,0,0,0,,${text}`;
  }).join('\n');

  return defaultHeader + events;
}
