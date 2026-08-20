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
  Radio,
  Download,
  Eye,
  Loader2
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
  const [isExtractingCues, setIsExtractingCues] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [activeDemuxer, setActiveDemuxer] = useState<MkvDemuxer | Mp4Demuxer | null>(null);
  const [discoveredTracks, setDiscoveredTracks] = useState<SubtitleTrack[]>([]);
  const [extractedTracks, setExtractedTracks] = useState<SubtitleTrack[]>([]);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [sourceName, setSourceName] = useState('');

  const handleProcessReader = async (reader: FileSliceReader | HttpRangeReader) => {
    setIsLoading(true);
    setIsExtractingCues(false);
    setError(null);
    setDiscoveredTracks([]);
    setExtractedTracks([]);
    setProgressText('Fayl sarlavhasi o\'qilmoqda...');
    setProgressPct(10);

    try {
      const name = reader.getSourceName().toLowerCase();
      setSourceName(reader.getSourceName());

      const isMp4 = name.endsWith('.mp4') || name.endsWith('.m4v') || name.endsWith('.mov');

      if (isMp4) {
        const demuxer = new Mp4Demuxer(reader, (txt, pct) => {
          setProgressText(txt);
          setProgressPct(pct);
        });
        setActiveDemuxer(demuxer);
        const res = await demuxer.extractSubtitles();
        setDiscoveredTracks(res.tracks);
        setExtractedTracks(res.tracks);
        setSelectedTrackIndex(0);
        setStats(res.stats);
      } else {
        // MKV / WebM
        const demuxer = new MkvDemuxer(reader, (txt, pct) => {
          setProgressText(txt);
          setProgressPct(pct);
        });
        setActiveDemuxer(demuxer);

        // Step 1: Parse tracks in < 0.5s
        const tracks = await demuxer.parseTracks();
        if (tracks.length === 0) {
          throw new Error('Ushbu videoda hech qanday o\'rnatilgan (embedded) subtitr treklari topilmadi.');
        }
        setDiscoveredTracks(tracks);

        // Step 2: Extract dialogue cues
        setIsExtractingCues(true);
        const res = await demuxer.extractAllSubtitles();
        setExtractedTracks(res.tracks);
        setSelectedTrackIndex(0);
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error('Demux error:', err);
      setError(err?.message || 'Subtitrlarni ajratib olishda xatolik yuz berdi.');
    } finally {
      setIsLoading(false);
      setIsExtractingCues(false);
      setProgressPct(100);
    }
  };

  const handleExtractSingleTrack = async (trackNumber: number) => {
    if (!activeDemuxer || !(activeDemuxer instanceof MkvDemuxer)) return;

    setIsExtractingCues(true);
    setProgressText(`Trek #${trackNumber} replikalari ajratilmoqda...`);
    setProgressPct(20);

    try {
      const res = await activeDemuxer.extractAllSubtitles([trackNumber]);
      setExtractedTracks(res.tracks);
      setSelectedTrackIndex(0);
      setStats(res.stats);
    } catch (err: any) {
      setError(err?.message || 'Trekni ajratishda xatolik');
    } finally {
      setIsExtractingCues(false);
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

  const currentTrack = extractedTracks[selectedTrackIndex] || discoveredTracks[selectedTrackIndex];

  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              Ultra-Tezkor Ekstraktor
            </span>
            <span className="text-slate-400 text-xs">&bull; HTTP Range & Cues Table Indexing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
            Video to Subtitle Extractor (MKV, MP4, WebM)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            10–50 GB lik videoni butunlay yuklab olmasdan, faqat bir necha KB metadata o'qish orqali barcha subtitrlarni (ASS, SRT, VTT) bir zumda ajratib oling.
          </p>
        </div>

        {stats && (
          <div className="flex items-center space-x-3 bg-slate-900/80 border border-emerald-500/30 p-3.5 rounded-xl text-xs">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-emerald-400 font-bold">
                {stats.savedPercentage}% Trafik Tejaldi!
              </p>
              <p className="text-slate-400 text-[11px]">
                {formatBytes(stats.bytesRead)} / {formatBytes(stats.totalFileSize)} o'qildi
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input section */}
      <FileOrUrlInput
        mode="video"
        onFileSelect={handleFileSelect}
        onUrlSubmit={handleUrlSubmit}
        isLoading={isLoading}
      />

      {/* Loading Progress bar */}
      {isLoading && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 space-y-3 animate-fade-in">
          <div className="flex justify-between text-xs">
            <span className="text-indigo-300 font-medium flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>{progressText}</span>
            </span>
            <span className="text-slate-400 font-mono">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3 text-xs text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-200">Xatolik:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Discovered Tracks List (Shows in < 0.5s) */}
      {discoveredTracks.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                Videoda Aniqlangan Subtitr Treklari ({discoveredTracks.length} ta til)
              </h2>
            </div>
            {isExtractingCues && (
              <span className="text-[11px] text-amber-400 flex items-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Replika matnlari ajratilmoqda...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {discoveredTracks.map((track, idx) => {
              const isSelected = selectedTrackIndex === idx;
              const extracted = extractedTracks.find(t => t.trackNumber === track.trackNumber);
              const cueCount = extracted?.cues.length || 0;

              return (
                <div
                  key={track.id}
                  onClick={() => setSelectedTrackIndex(idx)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white">{track.title}</span>
                        {track.default && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                            Asosiy
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Til: <span className="text-slate-300 uppercase font-mono">{track.language}</span> &bull; Format: <span className="text-indigo-400 uppercase font-bold">{track.format}</span>
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      #{track.trackNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-400">
                      {cueCount > 0 ? (
                        <span className="text-emerald-400 font-medium">{cueCount} ta replika</span>
                      ) : isExtractingCues ? (
                        <span className="text-amber-400">O'qilmoqda...</span>
                      ) : (
                        <span>Tayyor</span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTrackIndex(idx);
                        if (cueCount === 0) handleExtractSingleTrack(track.trackNumber);
                      }}
                      className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-semibold transition"
                    >
                      {cueCount > 0 ? 'Tanlandi' : 'Tezkor Ajratish'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extracted Track Preview and Download Area */}
      {currentTrack && currentTrack.cues && currentTrack.cues.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  {currentTrack.title} ({currentTrack.cues.length} ta replika)
                </h3>
                <p className="text-xs text-slate-400">
                  Format: <span className="uppercase text-indigo-300 font-bold">{currentTrack.format}</span> &bull; Manba: {sourceName || 'Video'}
                </p>
              </div>
            </div>

            <DownloadButton
              cues={currentTrack.cues}
              filename={`${sourceName.replace(/\.[^/.]+$/, '') || 'subtitle'}_${currentTrack.language}`}
              defaultFormat={currentTrack.format}
              tracks={extractedTracks.length > 1 ? extractedTracks : undefined}
              customHeader={currentTrack.codecPrivate}
            />
          </div>

          <SubtitlePreviewTable
            cues={currentTrack.cues}
          />
        </div>
      )}
    </div>
  );
};
