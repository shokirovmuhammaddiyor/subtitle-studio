import React, { useState } from 'react';
import {
  FileVideo,
  Sparkles,
  Layers,
  HardDriveDownload,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Radio
} from 'lucide-react';
import { FileOrUrlInput } from '../shared/FileOrUrlInput';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { FileSliceReader, HttpRangeReader } from '../../lib/rangeReader';
import { MkvDemuxer } from '../../lib/demuxers/mkvDemuxer';
import { Mp4Demuxer } from '../../lib/demuxers/mp4Demuxer';
import { SubtitleTrack, ExtractionStats } from '../../types/subtitle';

export const VideoDemuxerTool: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [extractedTracks, setExtractedTracks] = useState<SubtitleTrack[]>([]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [sourceName, setSourceName] = useState('');

  const handleProcessReader = async (reader: FileSliceReader | HttpRangeReader) => {
    setIsLoading(true);
    setError(null);
    setProgressText('Fayl formati aniqlanmoqda...');
    setProgressPct(5);

    try {
      const name = reader.getSourceName().toLowerCase();
      setSourceName(reader.getSourceName());

      let tracks: SubtitleTrack[] = [];
      let resultStats: ExtractionStats;

      // Determine container type: MKV / WebM vs MP4 / MOV
      const isMp4 = name.endsWith('.mp4') || name.endsWith('.m4v') || name.endsWith('.mov');

      if (isMp4) {
        const demuxer = new Mp4Demuxer(reader, (txt, pct) => {
          setProgressText(txt);
          setProgressPct(pct);
        });
        const res = await demuxer.extractSubtitles();
        tracks = res.tracks;
        resultStats = res.stats;
      } else {
        // Default to MKV / WebM streaming demuxer
        const demuxer = new MkvDemuxer(reader, (txt, pct) => {
          setProgressText(txt);
          setProgressPct(pct);
        });
        const res = await demuxer.extractAllSubtitles();
        tracks = res.tracks;
        resultStats = res.stats;
      }

      if (tracks.length === 0) {
        throw new Error('Ushbu videoda hech qanday o\'rnatilgan (embedded) subtitr treklari topilmadi.');
      }

      setExtractedTracks(tracks);
      setSelectedTrackIndex(0);
      setStats(resultStats);
    } catch (err: any) {
      console.error('Demux error:', err);
      setError(err?.message || 'Subtitrlarni ajratib olishda xatolik yuz berdi.');
    } finally {
      setIsLoading(false);
      setProgressPct(100);
    }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileSliceReader(file);
    handleProcessReader(reader);
  };

  const handleUrlSubmit = (url: string, proxyId: string, customProxy?: string) => {
    const reader = new HttpRangeReader(url, proxyId, customProxy);
    handleProcessReader(reader);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const currentTrack = extractedTracks[selectedTrackIndex];

  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              Ultra-Tezkor Ekstraktor
            </span>
            <span className="text-slate-400 text-xs">&bull; HTTP Range Slicing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
            Video to Subtitle Extractor (MKV, MP4, WebM)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            10–50 GB lik videoni butunlay yuklab olmasdan, faqat bir necha KB metadata o'qish orqali barcha subtitrlarni (ASS, SRT, VTT) bir zumda ajratib oling.
          </p>
        </div>
      </div>

      {/* Input component */}
      <FileOrUrlInput
        mode="video"
        onFileSelect={handleFileSelect}
        onUrlSubmit={handleUrlSubmit}
        isLoading={isLoading}
      />

      {/* Loading Progress Bar */}
      {isLoading && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 animate-fade-in space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-300 font-medium flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping inline-block" />
              <span>{progressText}</span>
            </span>
            <span className="font-mono text-indigo-400 font-bold">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200">Xatolik:</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {stats && extractedTracks.length > 0 && currentTrack && (
        <div className="space-y-6 animate-slide-up">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <FileVideo className="w-3.5 h-3.5 text-indigo-400" />
                <span>Asl Video Hajmi</span>
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {formatBytes(stats.totalFileSize)}
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[11px] text-emerald-400 flex items-center space-x-1.5">
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>O'qilgan Trafik</span>
              </div>
              <div className="text-lg font-bold text-emerald-300 mt-1">
                {formatBytes(stats.bytesRead)}
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
              <div className="text-[11px] text-indigo-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tejalgan Trafik</span>
              </div>
              <div className="text-lg font-bold text-indigo-300 mt-1">
                {stats.savedPercentage}%
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span>Sarflangan Vaqt</span>
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {(stats.durationMs / 1000).toFixed(2)} sek
              </div>
            </div>
          </div>

          {/* Track Selector & Download */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Aniqlangan Subtitr Treklari ({extractedTracks.length} ta)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fayl: <span className="text-slate-200 font-mono">{sourceName}</span>
                </p>
              </div>

              <DownloadButton
                cues={currentTrack.cues}
                filename={`${sourceName}_${currentTrack.language}_track${currentTrack.trackNumber}`}
                defaultFormat={currentTrack.format}
                tracks={extractedTracks}
                customHeader={currentTrack.codecPrivate}
              />
            </div>

            {/* Track buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {extractedTracks.map((track, idx) => {
                const isSelected = selectedTrackIndex === idx;
                return (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTrackIndex(idx)}
                    className={`flex items-start justify-between p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Radio className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-600'}`} />
                        <span className="font-semibold text-xs text-white">
                          #{track.trackNumber} {track.language.toUpperCase()}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-indigo-300">
                          {track.format}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {track.cues.length} replika &bull; {track.codec}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtitle Viewer Table */}
          <SubtitlePreviewTable
            cues={currentTrack.cues}
            onCueChange={(updated) => {
              const newTracks = [...extractedTracks];
              newTracks[selectedTrackIndex].cues = updated;
              setExtractedTracks(newTracks);
            }}
          />
        </div>
      )}
    </div>
  );
};
