import MP4Box from 'mp4box';
import { DataReader } from '../rangeReader';
import { SubtitleCue, SubtitleTrack, ExtractionStats } from '../../types/subtitle';

export class Mp4Demuxer {
  private reader: DataReader;
  private onProgress?: (text: string, pct: number) => void;

  constructor(reader: DataReader, onProgress?: (text: string, pct: number) => void) {
    this.reader = reader;
    this.onProgress = onProgress;
  }

  async extractSubtitles(): Promise<{ tracks: SubtitleTrack[]; stats: ExtractionStats }> {
    const startTime = Date.now();
    this.onProgress?.('MP4 metadata (moov atom) o\'qilmoqda...', 10);

    const totalFileSize = await this.reader.getSize();
    const mp4boxfile = MP4Box.createFile();

    let subtitleTracks: SubtitleTrack[] = [];
    const sampleResults = new Map<number, SubtitleCue[]>();

    const readyPromise = new Promise<any>((resolve, reject) => {
      mp4boxfile.onReady = (info: any) => {
        resolve(info);
      };
      mp4boxfile.onError = (e: any) => {
        reject(new Error(`MP4 tahlil qilishda xatolik: ${e}`));
      };
    });

    // Feed the first 1MB to mp4box
    const initialChunkSize = Math.min(1024 * 1024, totalFileSize || 1024 * 1024);
    const initialBytes = await this.reader.read(0, initialChunkSize);
    const ab = initialBytes.buffer.slice(initialBytes.byteOffset, initialBytes.byteOffset + initialBytes.byteLength) as ArrayBuffer & { fileStart: number };
    ab.fileStart = 0;
    mp4boxfile.appendBuffer(ab);

    // If onReady not fired yet and moov might be at the end of file
    let info: any;
    try {
      info = await Promise.race([
        readyPromise,
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1500))
      ]);
    } catch {
      // Try reading the last 2MB for trailing moov atom
      this.onProgress?.('Fayl oxiridagi moov atomi qidirilmoqda...', 25);
      if (totalFileSize > initialChunkSize) {
        const tailSize = Math.min(2 * 1024 * 1024, totalFileSize);
        const tailStart = totalFileSize - tailSize;
        const tailBytes = await this.reader.read(tailStart, tailSize);
        const tailAb = tailBytes.buffer.slice(tailBytes.byteOffset, tailBytes.byteOffset + tailBytes.byteLength) as ArrayBuffer & { fileStart: number };
        tailAb.fileStart = tailStart;
        mp4boxfile.appendBuffer(tailAb);
      }

      info = await readyPromise;
    }

    this.onProgress?.('Subtitr treklari aniqlandi, namunalar olinmoqda...', 45);

    // Filter subtitle/text tracks
    const rawSubtitleTracks = (info.tracks || []).filter((t: any) => {
      const type = (t.type || '').toLowerCase();
      const codec = (t.codec || '').toLowerCase();
      return (
        type.includes('subt') ||
        type.includes('text') ||
        type.includes('sbtl') ||
        codec.includes('tx3g') ||
        codec.includes('wvtt') ||
        codec.includes('stpp') ||
        codec.includes('c608')
      );
    });

    if (rawSubtitleTracks.length === 0) {
      throw new Error('MP4 faylida hech qanday subtitr yoki matn treki topilmadi.');
    }

    for (const t of rawSubtitleTracks) {
      const trackId = t.id;
      sampleResults.set(trackId, []);

      subtitleTracks.push({
        id: `mp4-track-${trackId}`,
        trackNumber: trackId,
        title: t.name || `Subtitr Treki #${trackId} (${(t.language || 'und').toUpperCase()})`,
        language: t.language || 'und',
        codec: t.codec || 'tx3g',
        format: t.codec === 'wvtt' ? 'vtt' : 'srt',
        cues: [],
        sampleCount: t.nb_samples
      });

      // Request extraction for this track
      mp4boxfile.setExtractionOptions(trackId, null, { nbSamples: 10000 });
    }

    const samplesPromise = new Promise<void>((resolve) => {
      let pendingTracks = new Set(rawSubtitleTracks.map((t: any) => t.id));

      mp4boxfile.onSamples = (id: number, _user: any, samples: any[]) => {
        const cues = sampleResults.get(id) || [];
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const startTimeSec = s.cts / s.timescale;
          const endTimeSec = (s.cts + s.duration) / s.timescale;

          // Parse sample data
          let text = '';
          if (s.data) {
            const dataBytes = new Uint8Array(s.data);
            if (dataBytes.length > 2) {
              // tx3g 2-byte text length prefix
              const textLen = (dataBytes[0] << 8) | dataBytes[1];
              if (textLen > 0 && textLen <= dataBytes.length - 2) {
                text = new TextDecoder('utf-8').decode(dataBytes.subarray(2, 2 + textLen));
              } else {
                text = new TextDecoder('utf-8').decode(dataBytes);
              }
            }
          }

          if (text && text.trim()) {
            cues.push({
              id: cues.length + 1,
              startTime: startTimeSec,
              endTime: Math.max(startTimeSec + 0.1, endTimeSec),
              text: text.trim()
            });
          }
        }

        sampleResults.set(id, cues);
        pendingTracks.delete(id);
        if (pendingTracks.size === 0) {
          resolve();
        }
      };

      // Fallback timeout in case onSamples doesn't trigger for empty tracks
      setTimeout(() => resolve(), 3000);
    });

    mp4boxfile.start();
    await samplesPromise;

    // Attach cues to tracks
    let totalCues = 0;
    for (const track of subtitleTracks) {
      const cues = sampleResults.get(Number(track.trackNumber)) || [];
      track.cues = cues.sort((a, b) => a.startTime - b.startTime);
      track.sampleCount = track.cues.length;
      totalCues += track.cues.length;
    }

    const durationMs = Date.now() - startTime;
    const bytesRead = this.reader.getBytesRead();
    const savedPercentage = totalFileSize > 0
      ? Math.max(0, Number(((1 - (bytesRead / totalFileSize)) * 100).toFixed(3)))
      : 99.9;

    this.onProgress?.('MP4 subtitrlari muvaffaqiyatli ajratildi!', 100);

    return {
      tracks: subtitleTracks,
      stats: {
        totalFileSize,
        bytesRead,
        savedPercentage,
        durationMs,
        trackCount: subtitleTracks.length,
        cuesCount: totalCues
      }
    };
  }
}
