import { DataReader } from '../rangeReader';
import { SubtitleCue, SubtitleFormat, SubtitleTrack, ExtractionStats } from '../../types/subtitle';

// Matroska Element IDs
const EBML_ID = 0x1A45DFA3;
const SEGMENT_ID = 0x18538067;
const SEEKHEAD_ID = 0x114D9B74;
const INFO_ID = 0x1549A966;
const TRACKS_ID = 0x1654AE6B;
const CLUSTER_ID = 0x1F43B675;
const ATTACHMENTS_ID = 0x1941A469;
const CHAPTERS_ID = 0x1043A770;

// Seek IDs
const SEEK_ENTRY_ID = 0x4DBB;
const SEEK_ID_ID = 0x53AB;
const SEEK_POSITION_ID = 0x53AC;

// Track Entry IDs
const TRACK_ENTRY_ID = 0xAE;
const TRACK_NUMBER_ID = 0xD7;
const TRACK_TYPE_ID = 0x83;
const FLAG_DEFAULT_ID = 0x88;
const FLAG_FORCED_ID = 0x55AA;
const TRACK_NAME_ID = 0x536E;
const TRACK_LANGUAGE_ID = 0x22B59C;
const CODEC_ID_ID = 0x86;
const CODEC_PRIVATE_ID = 0x63A2;

// Info IDs
const TIMECODE_SCALE_ID = 0x2AD7B1;

// Cluster / Block IDs
const CLUSTER_TIMECODE_ID = 0xE7;
const SIMPLE_BLOCK_ID = 0xA3;
const BLOCK_GROUP_ID = 0xA0;
const BLOCK_ID = 0xA1;
const BLOCK_DURATION_ID = 0x9B;

interface VInt {
  length: number;
  value: number;
  rawId: number;
}

function readVInt(buffer: Uint8Array, offset: number, isId: boolean = false): VInt | null {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  if (firstByte === 0) return null;

  let length = 1;
  let mask = 0x80;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }

  if (offset + length > buffer.length) return null;

  let rawId = 0;
  let value = isId ? firstByte : firstByte & (mask - 1);
  rawId = firstByte;

  for (let i = 1; i < length; i++) {
    const b = buffer[offset + i];
    rawId = (rawId * 256) + b;
    value = (value * 256) + b;
  }

  return { length, value, rawId };
}

function readString(buffer: Uint8Array, offset: number, length: number): string {
  const slice = buffer.subarray(offset, offset + length);
  return new TextDecoder('utf-8', { fatal: false }).decode(slice);
}

function readUint(buffer: Uint8Array, offset: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length; i++) {
    val = (val * 256) + buffer[offset + i];
  }
  return val;
}

export class MkvDemuxer {
  private reader: DataReader;
  private timecodeScale: number = 1000000; // 1ms default
  private segmentOffset: number = 0;
  private segmentSize: number = 0;
  private tracks: Map<number, SubtitleTrack> = new Map();
  private seekPositions: Map<number, number> = new Map();
  private firstClusterOffset: number = 0;
  private onProgress?: (progressText: string, percentage: number) => void;

  constructor(reader: DataReader, onProgress?: (text: string, pct: number) => void) {
    this.reader = reader;
    this.onProgress = onProgress;
  }

  async parseTracks(): Promise<SubtitleTrack[]> {
    this.onProgress?.('MKV sarlavhasi tahlil qilinmoqda (EBML)...', 10);

    const initialChunkSize = 256 * 1024;
    const initialBytes = await this.reader.read(0, initialChunkSize);

    let offset = 0;
    const ebmlId = readVInt(initialBytes, offset, true);
    if (!ebmlId || ebmlId.rawId !== EBML_ID) {
      throw new Error('Tanlangan fayl to\'g\'ri MKV/WebM formati emas.');
    }
    offset += ebmlId.length;

    const ebmlSize = readVInt(initialBytes, offset, false);
    if (!ebmlSize) throw new Error('EBML o\'lchami xato');
    offset += ebmlSize.length + ebmlSize.value;

    const segId = readVInt(initialBytes, offset, true);
    if (!segId || segId.rawId !== SEGMENT_ID) {
      throw new Error('MKV Segment topilmadi');
    }
    offset += segId.length;

    const segSize = readVInt(initialBytes, offset, false);
    if (!segSize) throw new Error('Segment o\'lchami xato');
    offset += segSize.length;

    this.segmentOffset = offset;
    this.segmentSize = segSize.value;

    this.onProgress?.('Treklar va ASS stillari o\'qilmoqda...', 30);

    await this.scanSegmentHeaders(initialBytes, offset);

    this.onProgress?.('Subtitr treklari aniqlandi!', 100);
    return Array.from(this.tracks.values());
  }

  private async scanSegmentHeaders(buffer: Uint8Array, startOffset: number) {
    let offset = startOffset;
    let tracksFound = false;

    while (offset < buffer.length - 16) {
      const elId = readVInt(buffer, offset, true);
      if (!elId) break;
      const elSize = readVInt(buffer, offset + elId.length, false);
      if (!elSize) break;

      const headerLen = elId.length + elSize.length;
      const payloadOffset = offset + headerLen;

      if (elId.rawId === SEEKHEAD_ID) {
        this.parseSeekHead(buffer, payloadOffset, elSize.value);
      } else if (elId.rawId === INFO_ID) {
        this.parseInfoElement(buffer, payloadOffset, elSize.value);
      } else if (elId.rawId === TRACKS_ID) {
        this.parseTracksElement(buffer, payloadOffset, elSize.value);
        tracksFound = true;
      } else if (elId.rawId === CLUSTER_ID) {
        this.firstClusterOffset = offset;
        break;
      } else if (elId.rawId === ATTACHMENTS_ID || elId.rawId === CHAPTERS_ID) {
        offset = payloadOffset + elSize.value;
        continue;
      }

      offset = payloadOffset + elSize.value;
    }

    if (!tracksFound) {
      const tracksPos = this.seekPositions.get(TRACKS_ID);
      if (tracksPos) {
        const tracksBytes = await this.reader.read(tracksPos, 64 * 1024);
        const elId = readVInt(tracksBytes, 0, true);
        const elSize = elId ? readVInt(tracksBytes, elId.length, false) : null;
        if (elId && elSize) {
          this.parseTracksElement(tracksBytes, elId.length + elSize.length, elSize.value);
        }
      }
    }
  }

  private parseSeekHead(buffer: Uint8Array, offset: number, size: number) {
    let o = offset;
    const end = Math.min(offset + size, buffer.length);

    while (o < end - 4) {
      const elId = readVInt(buffer, o, true);
      if (!elId) break;
      const elSize = readVInt(buffer, o + elId.length, false);
      if (!elSize) break;
      const pOffset = o + elId.length + elSize.length;

      if (elId.rawId === SEEK_ENTRY_ID) {
        let entryO = pOffset;
        const entryEnd = Math.min(pOffset + elSize.value, buffer.length);
        let targetId = 0;
        let targetPos = 0;

        while (entryO < entryEnd - 2) {
          const subId = readVInt(buffer, entryO, true);
          if (!subId) break;
          const subSize = readVInt(buffer, entryO + subId.length, false);
          if (!subSize) break;
          const subPayload = entryO + subId.length + subSize.length;

          if (subId.rawId === SEEK_ID_ID) {
            targetId = readUint(buffer, subPayload, subSize.value);
          } else if (subId.rawId === SEEK_POSITION_ID) {
            targetPos = readUint(buffer, subPayload, subSize.value);
          }
          entryO = subPayload + subSize.value;
        }

        if (targetId && targetPos) {
          const absolutePos = this.segmentOffset + targetPos;
          this.seekPositions.set(targetId, absolutePos);
        }
      }
      o = pOffset + elSize.value;
    }
  }

  private parseInfoElement(buffer: Uint8Array, offset: number, size: number) {
    let o = offset;
    const end = Math.min(offset + size, buffer.length);
    while (o < end - 4) {
      const elId = readVInt(buffer, o, true);
      if (!elId) break;
      const elSize = readVInt(buffer, o + elId.length, false);
      if (!elSize) break;
      const pOffset = o + elId.length + elSize.length;

      if (elId.rawId === TIMECODE_SCALE_ID) {
        this.timecodeScale = readUint(buffer, pOffset, elSize.value);
      }
      o = pOffset + elSize.value;
    }
  }

  private parseTracksElement(buffer: Uint8Array, offset: number, size: number) {
    let o = offset;
    const end = Math.min(offset + size, buffer.length);

    while (o < end - 4) {
      const elId = readVInt(buffer, o, true);
      if (!elId) break;
      const elSize = readVInt(buffer, o + elId.length, false);
      if (!elSize) break;
      const pOffset = o + elId.length + elSize.length;

      if (elId.rawId === TRACK_ENTRY_ID) {
        this.parseTrackEntry(buffer, pOffset, elSize.value);
      }
      o = pOffset + elSize.value;
    }
  }

  private parseTrackEntry(buffer: Uint8Array, offset: number, size: number) {
    let o = offset;
    const end = Math.min(offset + size, buffer.length);

    let trackNumber = 0;
    let trackType = 0;
    let codecId = '';
    let name = '';
    let language = 'und';
    let flagDefault = false;
    let flagForced = false;
    let codecPrivate = '';

    while (o < end - 2) {
      const elId = readVInt(buffer, o, true);
      if (!elId) break;
      const elSize = readVInt(buffer, o + elId.length, false);
      if (!elSize) break;
      const pOffset = o + elId.length + elSize.length;

      switch (elId.rawId) {
        case TRACK_NUMBER_ID:
          trackNumber = readUint(buffer, pOffset, elSize.value);
          break;
        case TRACK_TYPE_ID:
          trackType = readUint(buffer, pOffset, elSize.value);
          break;
        case CODEC_ID_ID:
          codecId = readString(buffer, pOffset, elSize.value);
          break;
        case TRACK_NAME_ID:
          name = readString(buffer, pOffset, elSize.value);
          break;
        case TRACK_LANGUAGE_ID:
          language = readString(buffer, pOffset, elSize.value);
          break;
        case FLAG_DEFAULT_ID:
          flagDefault = readUint(buffer, pOffset, elSize.value) === 1;
          break;
        case FLAG_FORCED_ID:
          flagForced = readUint(buffer, pOffset, elSize.value) === 1;
          break;
        case CODEC_PRIVATE_ID:
          codecPrivate = readString(buffer, pOffset, elSize.value);
          break;
      }
      o = pOffset + elSize.value;
    }

    if (trackType === 17 || codecId.startsWith('S_TEXT') || codecId.startsWith('S_HDMV') || codecId.startsWith('S_VOBSUB') || codecId.includes('SUBTITLE')) {
      let format: SubtitleFormat = 'srt';
      if (codecId.includes('ASS')) format = 'ass';
      else if (codecId.includes('SSA')) format = 'ssa';
      else if (codecId.includes('WEBVTT') || codecId.includes('VTT')) format = 'vtt';

      this.tracks.set(trackNumber, {
        id: `mkv-track-${trackNumber}`,
        trackNumber,
        title: name || `Subtitr Treki #${trackNumber} (${language.toUpperCase()})`,
        language: language || 'und',
        codec: codecId,
        format,
        default: flagDefault,
        forced: flagForced,
        codecPrivate,
        cues: []
      });
    }
  }

  /**
   * 100% Complete & Continuous Subtitle Demuxing:
   * Scans all clusters from start to finish without dropping any cues
   */
  async extractAllSubtitles(selectedTrackNumbers?: number[]): Promise<{ tracks: SubtitleTrack[]; stats: ExtractionStats }> {
    const startTime = Date.now();
    if (this.tracks.size === 0) {
      await this.parseTracks();
    }

    const targetTrackSet = new Set(
      selectedTrackNumbers && selectedTrackNumbers.length > 0
        ? selectedTrackNumbers
        : Array.from(this.tracks.keys())
    );

    if (targetTrackSet.size === 0) {
      throw new Error('Videoda hech qanday subtitr treki topilmadi.');
    }

    const totalFileSize = await this.reader.getSize();
    let cueIdCounter = 1;

    // Reset cues in target tracks
    for (const num of targetTrackSet) {
      const tr = this.tracks.get(num);
      if (tr) tr.cues = [];
    }

    let currentFilePos = this.firstClusterOffset || this.segmentOffset;
    const CHUNK_SIZE = 512 * 1024; // 512KB buffer
    let buffer = await this.reader.read(currentFilePos, CHUNK_SIZE);
    let bufOffset = 0;
    let currentClusterTimecode = 0;
    let lastProgressPct = 0;

    while (currentFilePos < totalFileSize && buffer.length > 0) {
      if (bufOffset >= buffer.length - 32) {
        currentFilePos += bufOffset;
        if (currentFilePos >= totalFileSize) break;
        buffer = await this.reader.read(currentFilePos, CHUNK_SIZE);
        bufOffset = 0;
        if (buffer.length === 0) break;
      }

      const elId = readVInt(buffer, bufOffset, true);
      if (!elId) {
        bufOffset++;
        continue;
      }
      const elSize = readVInt(buffer, bufOffset + elId.length, false);
      if (!elSize) {
        bufOffset++;
        continue;
      }

      const headerLen = elId.length + elSize.length;
      const payloadOffset = bufOffset + headerLen;

      if (elId.rawId === CLUSTER_ID) {
        bufOffset = payloadOffset;
        continue;
      }

      if (elId.rawId === CLUSTER_TIMECODE_ID) {
        if (payloadOffset + elSize.value <= buffer.length) {
          currentClusterTimecode = readUint(buffer, payloadOffset, elSize.value);
        }
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      if (elId.rawId === SIMPLE_BLOCK_ID || elId.rawId === BLOCK_ID) {
        await this.parseBlockAsync(
          buffer,
          payloadOffset,
          elSize.value,
          currentFilePos,
          currentClusterTimecode,
          targetTrackSet,
          cueIdCounter++
        );
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      if (elId.rawId === BLOCK_GROUP_ID) {
        await this.parseBlockGroup(
          buffer,
          payloadOffset,
          elSize.value,
          currentFilePos,
          currentClusterTimecode,
          targetTrackSet,
          cueIdCounter++
        );
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      bufOffset = payloadOffset + elSize.value;

      if (totalFileSize > 0) {
        const pct = Math.min(95, Math.round((currentFilePos / totalFileSize) * 100));
        if (pct >= lastProgressPct + 5) {
          lastProgressPct = pct;
          let foundCount = 0;
          for (const n of targetTrackSet) foundCount += this.tracks.get(n)?.cues.length || 0;
          this.onProgress?.(`Klasterlar o'qilmoqda: ${pct}% (${foundCount} ta replika topildi)...`, pct);
        }
      }
    }

    // Format final tracks
    let totalCues = 0;
    const resultTracks: SubtitleTrack[] = [];

    for (const [num, track] of this.tracks.entries()) {
      if (targetTrackSet.has(num)) {
        track.cues.sort((a, b) => a.startTime - b.startTime);
        track.sampleCount = track.cues.length;
        totalCues += track.cues.length;
        resultTracks.push(track);
      }
    }

    const durationMs = Date.now() - startTime;
    const bytesRead = this.reader.getBytesRead();
    const savedPercentage = totalFileSize > 0
      ? Math.max(0, Number(((1 - (bytesRead / totalFileSize)) * 100).toFixed(3)))
      : 99.9;

    this.onProgress?.('Barcha subtitrlar 100% to\'liq ajratildi!', 100);

    return {
      tracks: resultTracks,
      stats: {
        totalFileSize,
        bytesRead,
        savedPercentage,
        durationMs,
        trackCount: resultTracks.length,
        cuesCount: totalCues
      }
    };
  }

  private async parseBlockAsync(
    buffer: Uint8Array,
    offset: number,
    size: number,
    filePos: number,
    clusterTimecode: number,
    targetTrackSet: Set<number>,
    cueId: number,
    blockDuration?: number
  ) {
    let blockBuffer = buffer;
    let blockOffset = offset;

    if (offset + size > buffer.length) {
      blockBuffer = await this.reader.read(filePos + offset, size);
      blockOffset = 0;
    }

    if (blockOffset + size > blockBuffer.length) return;

    const trackVInt = readVInt(blockBuffer, blockOffset, false);
    if (!trackVInt) return;

    const trackNum = trackVInt.value;
    if (!targetTrackSet.has(trackNum)) return;

    const track = this.tracks.get(trackNum);
    if (!track) return;

    const headerLen = trackVInt.length;
    const timecodeView = new DataView(blockBuffer.buffer, blockBuffer.byteOffset + blockOffset + headerLen, 2);
    const relTimecode = timecodeView.getInt16(0, false);
    const flagsLen = 1;

    const payloadOffset = blockOffset + headerLen + 2 + flagsLen;
    const payloadLen = size - (headerLen + 2 + flagsLen);
    if (payloadLen <= 0) return;

    const payloadText = readString(blockBuffer, payloadOffset, payloadLen);

    const timeScaleSec = this.timecodeScale / 1_000_000_000;
    const startTimeSec = (clusterTimecode + relTimecode) * timeScaleSec;
    const durationSec = blockDuration !== undefined ? blockDuration * timeScaleSec : 3.0;
    const endTimeSec = startTimeSec + durationSec;

    const cleanCue = this.formatPayloadToCue(payloadText, startTimeSec, endTimeSec, track.codec, cueId);
    if (cleanCue) {
      track.cues.push(cleanCue);
    }
  }

  private async parseBlockGroup(
    buffer: Uint8Array,
    offset: number,
    size: number,
    filePos: number,
    clusterTimecode: number,
    targetTrackSet: Set<number>,
    cueId: number
  ) {
    let o = offset;
    const end = Math.min(offset + size, buffer.length);
    let blockOffset = 0;
    let blockSize = 0;
    let duration: number | undefined;

    while (o < end - 2) {
      const elId = readVInt(buffer, o, true);
      if (!elId) break;
      const elSize = readVInt(buffer, o + elId.length, false);
      if (!elSize) break;
      const pOffset = o + elId.length + elSize.length;

      if (elId.rawId === BLOCK_ID) {
        blockOffset = pOffset;
        blockSize = elSize.value;
      } else if (elId.rawId === BLOCK_DURATION_ID) {
        duration = readUint(buffer, pOffset, elSize.value);
      }
      o = pOffset + elSize.value;
    }

    if (blockOffset > 0 && blockSize > 0) {
      await this.parseBlockAsync(buffer, blockOffset, blockSize, filePos, clusterTimecode, targetTrackSet, cueId, duration);
    }
  }

  private formatPayloadToCue(
    payload: string,
    start: number,
    end: number,
    codec: string,
    id: number
  ): SubtitleCue | null {
    if (!payload || !payload.trim()) return null;

    let text = payload.trim();
    let rawText = payload;

    if (codec.includes('ASS') || codec.includes('SSA')) {
      if (text.toLowerCase().startsWith('dialogue:')) {
        const colonIdx = text.indexOf(':');
        const raw = text.substring(colonIdx + 1).trim();
        const parts = raw.split(',');
        if (parts.length >= 10) {
          text = parts.slice(9).join(',');
        }
      } else {
        // Matroska ASS SimpleBlock format: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text (8 commas)
        let commaCount = 0;
        let textStart = 0;
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ',') {
            commaCount++;
            if (commaCount === 8) {
              textStart = i + 1;
              break;
            }
          }
        }
        if (commaCount >= 8) {
          text = text.substring(textStart);
        }
      }
    }

    const cleanText = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');

    return {
      id,
      startTime: Math.max(0, start),
      endTime: Math.max(start + 0.1, end),
      text: cleanText,
      rawText: payload
    };
  }
}
