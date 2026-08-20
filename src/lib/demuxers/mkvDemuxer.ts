import { DataReader } from '../rangeReader';
import { SubtitleCue, SubtitleFormat, SubtitleTrack, ExtractionStats } from '../../types/subtitle';

// Matroska Element IDs
const EBML_ID = 0x1A45DFA3;
const SEGMENT_ID = 0x18538067;
const SEEKHEAD_ID = 0x114D9B74;
const INFO_ID = 0x1549A966;
const TRACKS_ID = 0x1654AE6B;
const CUES_ID = 0x1C53BB6B;
const CLUSTER_ID = 0x1F43B675;

// Track Entry IDs
const TRACK_ENTRY_ID = 0xAE;
const TRACK_NUMBER_ID = 0xD7;
const TRACK_UID_ID = 0x73C5;
const TRACK_TYPE_ID = 0x83;
const FLAG_DEFAULT_ID = 0x88;
const FLAG_FORCED_ID = 0x55AA;
const TRACK_NAME_ID = 0x536E;
const TRACK_LANGUAGE_ID = 0x22B59C;
const CODEC_ID_ID = 0x86;
const CODEC_PRIVATE_ID = 0x63A2;

// Info IDs
const TIMECODE_SCALE_ID = 0x2AD7B1;
const DURATION_ID = 0x4489;

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
    rawId = (rawId << 8) | b;
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

function readFloat(buffer: Uint8Array, offset: number, length: number): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, length);
  if (length === 4) return view.getFloat32(0, false);
  if (length === 8) return view.getFloat64(0, false);
  return 0;
}

export class MkvDemuxer {
  private reader: DataReader;
  private timecodeScale: number = 1000000; // 1ms default
  private segmentOffset: number = 0;
  private segmentSize: number = 0;
  private tracks: Map<number, SubtitleTrack> = new Map();
  private onProgress?: (progressText: string, percentage: number) => void;

  constructor(reader: DataReader, onProgress?: (text: string, pct: number) => void) {
    this.reader = reader;
    this.onProgress = onProgress;
  }

  async parseTracks(): Promise<SubtitleTrack[]> {
    const startTime = Date.now();
    this.onProgress?.('MKV sarlavhasi o\'qilmoqda (EBML Header)...', 5);

    // 1. Read first 256KB to parse EBML, Segment and Tracks
    const initialChunkSize = 256 * 1024;
    const initialBytes = await this.reader.read(0, initialChunkSize);

    let offset = 0;
    const ebmlId = readVInt(initialBytes, offset, true);
    if (!ebmlId || ebmlId.rawId !== EBML_ID) {
      throw new Error('Tanlangan fayl to\'g\'ri MKV/WebM formati emas (EBML ID topilmadi).');
    }
    offset += ebmlId.length;

    const ebmlSize = readVInt(initialBytes, offset, false);
    if (!ebmlSize) throw new Error('EBML o\'lchami xato');
    offset += ebmlSize.length + ebmlSize.value;

    // Now find Segment
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

    this.onProgress?.('Treklar va metadata tahlil qilinmoqda...', 15);

    // Read inside segment for Tracks, Info, SeekHead
    await this.scanSegmentHeaders(initialBytes, offset);

    return Array.from(this.tracks.values());
  }

  private async scanSegmentHeaders(buffer: Uint8Array, startOffset: number) {
    let offset = startOffset;
    let tracksFound = false;

    // Scan the initial buffer elements
    while (offset < buffer.length - 16) {
      const elId = readVInt(buffer, offset, true);
      if (!elId) break;
      const elSize = readVInt(buffer, offset + elId.length, false);
      if (!elSize) break;

      const headerLen = elId.length + elSize.length;
      const payloadOffset = offset + headerLen;

      if (elId.rawId === INFO_ID) {
        this.parseInfoElement(buffer, payloadOffset, elSize.value);
      } else if (elId.rawId === TRACKS_ID) {
        this.parseTracksElement(buffer, payloadOffset, elSize.value);
        tracksFound = true;
      } else if (elId.rawId === CLUSTER_ID) {
        // We reached clusters, tracks must be before clusters
        break;
      }

      offset = payloadOffset + elSize.value;
    }

    if (!tracksFound) {
      // If Tracks wasn't in the first 256KB, let's check seekhead or fetch a bigger 2MB chunk
      const largerChunk = await this.reader.read(0, 2 * 1024 * 1024);
      let o = this.segmentOffset;
      while (o < largerChunk.length - 16) {
        const elId = readVInt(largerChunk, o, true);
        if (!elId) break;
        const elSize = readVInt(largerChunk, o + elId.length, false);
        if (!elSize) break;
        const hLen = elId.length + elSize.length;
        const pOffset = o + hLen;

        if (elId.rawId === TRACKS_ID) {
          this.parseTracksElement(largerChunk, pOffset, elSize.value);
          tracksFound = true;
          break;
        }
        o = pOffset + elSize.value;
      }
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

    // Subtitle track type is 17 (0x11)
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
   * Fast Range-based cluster scanning:
   * Skips huge video/audio clusters and only reads subtitle blocks
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
    this.onProgress?.('Subtitr bloklari klasterlardan ajratib olinmoqda...', 25);

    let currentFilePos = this.segmentOffset;
    let clusterCount = 0;
    let cueIdCounter = 1;

    // Scan file sequentially using streaming buffer chunks
    const CHUNK_SIZE = 128 * 1024; // 128KB chunks
    let buffer = await this.reader.read(currentFilePos, CHUNK_SIZE);
    let bufOffset = 0;

    let currentClusterTimecode = 0;

    while (currentFilePos < totalFileSize && buffer.length > 0) {
      if (bufOffset >= buffer.length - 32) {
        // Refill buffer
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
        clusterCount++;
        bufOffset = payloadOffset; // Step inside cluster
        continue;
      }

      if (elId.rawId === CLUSTER_TIMECODE_ID) {
        if (payloadOffset + elSize.value <= buffer.length) {
          currentClusterTimecode = readUint(buffer, payloadOffset, elSize.value);
        }
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      // Check for SimpleBlock or BlockGroup
      if (elId.rawId === SIMPLE_BLOCK_ID || elId.rawId === BLOCK_ID) {
        this.parseBlock(
          buffer,
          payloadOffset,
          elSize.value,
          currentClusterTimecode,
          targetTrackSet,
          cueIdCounter++
        );
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      if (elId.rawId === BLOCK_GROUP_ID) {
        this.parseBlockGroup(
          buffer,
          payloadOffset,
          elSize.value,
          currentClusterTimecode,
          targetTrackSet,
          cueIdCounter++
        );
        bufOffset = payloadOffset + elSize.value;
        continue;
      }

      // If it's a huge block (like video track), skip directly!
      bufOffset = payloadOffset + elSize.value;

      // Update progress periodically
      if (clusterCount % 20 === 0 && totalFileSize > 0) {
        const pct = Math.min(95, Math.round((currentFilePos / totalFileSize) * 100));
        this.onProgress?.(`Klasterlar o'qilmoqda: ${pct}% (Faqat subtitr baytlari o'qilmoqda)`, pct);
      }
    }

    // Format final subtitle tracks
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

    this.onProgress?.('Subtitrlar muvaffaqiyatli ajratildi!', 100);

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

  private parseBlock(
    buffer: Uint8Array,
    offset: number,
    size: number,
    clusterTimecode: number,
    targetTrackSet: Set<number>,
    cueId: number,
    blockDuration?: number
  ) {
    if (offset + size > buffer.length) return;

    const trackVInt = readVInt(buffer, offset, false);
    if (!trackVInt) return;

    const trackNum = trackVInt.value;
    if (!targetTrackSet.has(trackNum)) return;

    const track = this.tracks.get(trackNum);
    if (!track) return;

    const headerLen = trackVInt.length;
    // 2 bytes: relative timecode (int16 signed)
    const timecodeView = new DataView(buffer.buffer, buffer.byteOffset + offset + headerLen, 2);
    const relTimecode = timecodeView.getInt16(0, false);
    // 1 byte flags
    const flagsLen = 1;

    const payloadOffset = offset + headerLen + 2 + flagsLen;
    const payloadLen = size - (headerLen + 2 + flagsLen);
    if (payloadLen <= 0) return;

    const payloadText = readString(buffer, payloadOffset, payloadLen);

    // Calculate timestamps in seconds
    const timeScaleSec = this.timecodeScale / 1_000_000_000;
    const startTimeSec = (clusterTimecode + relTimecode) * timeScaleSec;
    const durationSec = blockDuration !== undefined ? blockDuration * timeScaleSec : 3.0; // default 3s if duration not set
    const endTimeSec = startTimeSec + durationSec;

    // Parse text based on codec
    const cleanCue = this.formatPayloadToCue(payloadText, startTimeSec, endTimeSec, track.codec, cueId);
    if (cleanCue) {
      track.cues.push(cleanCue);
    }
  }

  private parseBlockGroup(
    buffer: Uint8Array,
    offset: number,
    size: number,
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
      this.parseBlock(buffer, blockOffset, blockSize, clusterTimecode, targetTrackSet, cueId, duration);
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

    // ASS format: Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    if (codec.includes('ASS') || codec.includes('SSA')) {
      // If payload is already a Dialogue line
      if (text.startsWith('Dialogue:')) {
        const parts = text.split(',');
        if (parts.length >= 10) {
          text = parts.slice(9).join(',');
        }
      } else {
        // In MKV, ASS block payload is often: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
        const parts = text.split(',');
        if (parts.length >= 9) {
          text = parts.slice(8).join(',');
        }
      }
    }

    return {
      id,
      startTime: Math.max(0, start),
      endTime: Math.max(start + 0.1, end),
      text: text.replace(/\\N/g, '\n').replace(/\\n/g, '\n'),
      rawText
    };
  }
}
