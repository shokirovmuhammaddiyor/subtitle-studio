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
  private seekPositions: Map<number, number> = new Map(); // ElementID -> Absolute Offset
  private firstClusterOffset: number = 0;
  private clusterOffsets: number[] = [];
  private onProgress?: (progressText: string, percentage: number) => void;

  constructor(reader: DataReader, onProgress?: (text: string, pct: number) => void) {
    this.reader = reader;
    this.onProgress = onProgress;
  }

  /**
   * Fast 1-request track inspection:
   * Parses EBML, Segment, Info and Track definitions in < 0.5 seconds
   */
  async parseTracks(): Promise<SubtitleTrack[]> {
    this.onProgress?.('MKV sarlavhasi o\'qilmoqda (EBML)...', 10);

    const initialChunkSize = 256 * 1024;
    const initialBytes = await this.reader.read(0, initialChunkSize);

    let offset = 0;
    const ebmlId = readVInt(initialBytes, offset, true);
    if (!ebmlId || ebmlId.rawId !== EBML_ID) {
      throw new Error('Tanlangan fayl to\'g\'ri MKV/WebM formati emas (EBML topilmadi).');
    }
    offset += ebmlId.length;

    const ebmlSize = readVInt(initialBytes, offset, false);
    if (!ebmlSize) throw new Error('EBML o\'lchami xato');
    offset += ebmlSize.length + ebmlSize.value;

    // Find Segment
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

    this.onProgress?.('Treklar va metadata tahlil qilinmoqda...', 30);

    await this.scanSegmentHeaders(initialBytes, offset);

    // Read Cues table offset if available
    await this.tryLoadCuesTable();

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

  private async tryLoadCuesTable() {
    const cuesPos = this.seekPositions.get(CUES_ID);
    if (!cuesPos) return;

    try {
      // Read Cues table (typically 32KB - 128KB)
      const cuesBytes = await this.reader.read(cuesPos, 128 * 1024);
      if (cuesBytes.length < 8) return;

      const elId = readVInt(cuesBytes, 0, true);
      if (!elId || elId.rawId !== CUES_ID) return;

      const elSize = readVInt(cuesBytes, elId.length, false);
      if (!elSize) return;

      let p = elId.length + elSize.length;
      const end = Math.min(p + elSize.value, cuesBytes.length);
      const clusters = new Set<number>();

      while (p < end - 8) {
        if (cuesBytes[p] === 0xBB) { // CuePoint
          p++;
          const cpSize = readVInt(cuesBytes, p, false);
          if (!cpSize) break;
          p += cpSize.length;

          const cpEnd = Math.min(p + cpSize.value, cuesBytes.length);
          while (p < cpEnd && p < cuesBytes.length) {
            if (cuesBytes[p] === 0xB7) { // CueTrackPositions
              p++;
              const ctpSize = readVInt(cuesBytes, p, false);
              if (!ctpSize) break;
              p += ctpSize.length;
              const ctpEnd = Math.min(p + ctpSize.value, cuesBytes.length);

              while (p < ctpEnd && p < cuesBytes.length) {
                if (cuesBytes[p] === 0xF1) { // CueClusterPosition
                  p++;
                  const s2 = cuesBytes[p++] & 0x7F;
                  let clusterPos = 0;
                  for (let k = 0; k < s2; k++) clusterPos = (clusterPos * 256) + cuesBytes[p++];
                  clusters.add(this.segmentOffset + clusterPos);
                } else {
                  p++;
                }
              }
            } else {
              p++;
            }
          }
        } else {
          p++;
        }
      }

      this.clusterOffsets = Array.from(clusters).sort((a, b) => a - b);
    } catch (e) {
      console.warn('Could not parse Cues table, will fallback to sequential jump', e);
    }
  }

  /**
   * Fast Targeted Subtitle Dialogue Extraction:
   * Uses cluster offsets to read ONLY subtitle blocks in parallel chunks!
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

    // Method A: Targeted reading via Cues Table Index (Super-Fast: ~1-3s)
    if (this.clusterOffsets.length > 0) {
      const totalClusters = this.clusterOffsets.length;
      this.onProgress?.(`Klasterlar indeks bo'yicha tezkor o'qilmoqda (0/${totalClusters})...`, 10);

      // Process in batches of 10 clusters concurrently
      const BATCH_SIZE = 8;
      for (let i = 0; i < totalClusters; i += BATCH_SIZE) {
        const batch = this.clusterOffsets.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (pos) => {
            try {
              // Read first 32KB of cluster containing timecode & subtitle blocks
              const chunk = await this.reader.read(pos, 32 * 1024);
              this.parseClusterChunk(chunk, pos, targetTrackSet, cueIdCounter);
            } catch (err) {
              // Ignore single cluster errors
            }
          })
        );

        const pct = Math.min(95, Math.round(((i + BATCH_SIZE) / totalClusters) * 100));
        let foundCues = 0;
        for (const num of targetTrackSet) foundCues += this.tracks.get(num)?.cues.length || 0;
        this.onProgress?.(`Klasterlar o'qilmoqda: ${pct}% (${foundCues} ta replika topildi)...`, pct);
      }
    } else {
      // Method B: Cluster jump streaming
      this.onProgress?.('Klasterlar bo\'ylab tezkor sakrash...', 20);
      let currentFilePos = this.firstClusterOffset || this.segmentOffset;
      const CHUNK_SIZE = 64 * 1024;

      while (currentFilePos < totalFileSize) {
        const chunk = await this.reader.read(currentFilePos, CHUNK_SIZE);
        if (chunk.length < 8) break;

        const elId = readVInt(chunk, 0, true);
        if (!elId) {
          currentFilePos += CHUNK_SIZE;
          continue;
        }

        const elSize = readVInt(chunk, elId.length, false);
        if (!elSize) {
          currentFilePos += CHUNK_SIZE;
          continue;
        }

        if (elId.rawId === CLUSTER_ID) {
          this.parseClusterChunk(chunk, currentFilePos, targetTrackSet, cueIdCounter);
          // Jump to next cluster!
          currentFilePos += elId.length + elSize.length + elSize.value;
        } else {
          currentFilePos += elId.length + elSize.length + elSize.value;
        }

        const pct = Math.min(95, Math.round((currentFilePos / totalFileSize) * 100));
        this.onProgress?.(`Klasterlar o'qilmoqda: ${pct}%`, pct);
      }
    }

    // Format & sort final tracks
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

    this.onProgress?.('Barcha subtitrlar muvaffaqiyatli ajratildi!', 100);

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

  private parseClusterChunk(
    buffer: Uint8Array,
    filePos: number,
    targetTrackSet: Set<number>,
    startCueId: number
  ) {
    let offset = 0;
    const elId = readVInt(buffer, offset, true);
    if (!elId) return;
    offset += elId.length;

    const elSize = readVInt(buffer, offset, false);
    if (!elSize) return;
    offset += elSize.length;

    let currentClusterTimecode = 0;
    let cueId = startCueId;

    while (offset < buffer.length - 8) {
      const subId = readVInt(buffer, offset, true);
      if (!subId) break;
      const subSize = readVInt(buffer, offset + subId.length, false);
      if (!subSize) break;
      const payloadOffset = offset + subId.length + subSize.length;

      if (subId.rawId === CLUSTER_TIMECODE_ID) {
        if (payloadOffset + subSize.value <= buffer.length) {
          currentClusterTimecode = readUint(buffer, payloadOffset, subSize.value);
        }
      } else if (subId.rawId === SIMPLE_BLOCK_ID || subId.rawId === BLOCK_ID) {
        this.parseBlockFast(buffer, payloadOffset, subSize.value, currentClusterTimecode, targetTrackSet, cueId++);
      } else if (subId.rawId === BLOCK_GROUP_ID) {
        this.parseBlockGroupFast(buffer, payloadOffset, subSize.value, currentClusterTimecode, targetTrackSet, cueId++);
      }

      offset = payloadOffset + subSize.value;
    }
  }

  private parseBlockFast(
    buffer: Uint8Array,
    offset: number,
    size: number,
    clusterTimecode: number,
    targetTrackSet: Set<number>,
    cueId: number,
    blockDuration?: number
  ) {
    if (offset >= buffer.length) return;

    const trackVInt = readVInt(buffer, offset, false);
    if (!trackVInt) return;

    const trackNum = trackVInt.value;
    if (!targetTrackSet.has(trackNum)) return;

    const track = this.tracks.get(trackNum);
    if (!track) return;

    const headerLen = trackVInt.length;
    if (offset + headerLen + 3 > buffer.length) return;

    const timecodeView = new DataView(buffer.buffer, buffer.byteOffset + offset + headerLen, 2);
    const relTimecode = timecodeView.getInt16(0, false);
    const flagsLen = 1;

    const payloadOffset = offset + headerLen + 2 + flagsLen;
    const payloadLen = size - (headerLen + 2 + flagsLen);
    if (payloadLen <= 0 || payloadOffset + payloadLen > buffer.length) return;

    const payloadText = readString(buffer, payloadOffset, payloadLen);
    const timeScaleSec = this.timecodeScale / 1_000_000_000;
    const startTimeSec = (clusterTimecode + relTimecode) * timeScaleSec;
    const durationSec = blockDuration !== undefined ? blockDuration * timeScaleSec : 3.0;
    const endTimeSec = startTimeSec + durationSec;

    const cleanCue = this.formatPayloadToCue(payloadText, startTimeSec, endTimeSec, track.codec, cueId);
    if (cleanCue) {
      track.cues.push(cleanCue);
    }
  }

  private parseBlockGroupFast(
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
      this.parseBlockFast(buffer, blockOffset, blockSize, clusterTimecode, targetTrackSet, cueId, duration);
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
      if (text.startsWith('Dialogue:')) {
        const parts = text.split(',');
        if (parts.length >= 10) {
          text = parts.slice(9).join(',');
        }
      } else {
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
