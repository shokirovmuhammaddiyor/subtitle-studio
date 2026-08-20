import React, { useState } from 'react';
import { RefreshCw, ArrowRight, FileText, CheckCircle2, Download, Layers } from 'lucide-react';
import { FileOrUrlInput } from '../shared/FileOrUrlInput';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { parseSubtitles, stringifySubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { SubtitleCue, SubtitleFormat } from '../../types/subtitle';
import { HttpRangeReader, FileSliceReader } from '../../lib/rangeReader';

export const ConverterTool: React.FC = () => {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [sourceFormat, setSourceFormat] = useState<SubtitleFormat>('srt');
  const [targetFormat, setTargetFormat] = useState<SubtitleFormat>('vtt');
  const [filename, setFilename] = useState<string>('subtitles');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableFormats: { id: SubtitleFormat; label: string; desc: string }[] = [
    { id: 'srt', label: 'SRT (SubRip)', desc: 'Eng keng tarqalgan universal format' },
    { id: 'vtt', label: 'VTT (WebVTT)', desc: 'HTML5 video va veb uchun standart' },
    { id: 'ass', label: 'ASS (Advanced SSA)', desc: 'Ranglar, stillar va koordinatalar' },
    { id: 'ssa', label: 'SSA (SubStation Alpha)', desc: 'Klassik SSA formati' },
    { id: 'lrc', label: 'LRC (Lyrics)', desc: 'Qo\'shiq matnlari va karaoke' },
    { id: 'json', label: 'JSON (Strukturalangan)', desc: 'Dasturchilar va API lar uchun' },
    { id: 'txt', label: 'TXT (Toza Matn / Transcript)', desc: 'Faqatgina matn transkripti' },
  ];

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const parsed = parseSubtitles(text, detected, file.name);
      if (parsed.length === 0) throw new Error('Subtitr faylidan replikalar topilmadi.');

      setCues(parsed);
      setSourceFormat(detected);
      setFilename(file.name);
      // Auto pick a different target format
      if (detected === 'srt') setTargetFormat('vtt');
      else if (detected === 'vtt') setTargetFormat('srt');
      else setTargetFormat('srt');
    } catch (err: any) {
      setError(err?.message || 'Faylni o\'qishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async (url: string, proxyId: string, customProxy?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const reader = new HttpRangeReader(url, proxyId, customProxy);
      const size = await reader.getSize();
      // Read first 5MB max for subtitle
      const readSize = Math.min(size || 2 * 1024 * 1024, 5 * 1024 * 1024);
      const bytes = await reader.read(0, readSize);
      const text = new TextDecoder('utf-8').decode(bytes);

      const name = reader.getSourceName();
      const detected = detectFormat(text, name);
      const parsed = parseSubtitles(text, detected, name);
      if (parsed.length === 0) throw new Error('Havoladan to\'g\'ri subtitr ma\'lumoti topilmadi.');

      setCues(parsed);
      setSourceFormat(detected);
      setFilename(name);
      if (detected === 'srt') setTargetFormat('vtt');
      else setTargetFormat('srt');
    } catch (err: any) {
      setError(err?.message || 'Havolani o\'qishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Universal Konvertor
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle to Subtitle Converter
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          SRT, VTT, ASS, SSA, LRC, SAMI, JSON va TXT formatlari orasida bir zumda va sifat yo'qotishsiz konvertatsiya qiling.
        </p>
      </div>

      {/* Upload/URL */}
      <FileOrUrlInput
        mode="subtitle"
        onFileSelect={handleFileSelect}
        onUrlSubmit={handleUrlSubmit}
        isLoading={isLoading}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {cues.length > 0 && (
        <div className="space-y-6 animate-slide-up">
          {/* Format converter panel */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              <span>Konvertatsiya sozlamalari</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Source format info */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Asl Format
                </span>
                <div className="text-lg font-bold text-indigo-300 mt-1">
                  {sourceFormat.toUpperCase()}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Fayl: <span className="font-mono text-slate-200">{filename}</span> ({cues.length} replika)
                </p>
              </div>

              {/* Target Format selector */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/40">
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Aylantiriladigan Format
                </span>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value as SubtitleFormat)}
                  className="w-full mt-2 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableFormats.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>
                      {fmt.label} - {fmt.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{cues.length} ta replika muvaffaqiyatli konvertatsiya qilindi</span>
              </div>

              <DownloadButton
                cues={cues}
                filename={`${filename}_converted`}
                defaultFormat={targetFormat}
              />
            </div>
          </div>

          {/* Table Preview */}
          <SubtitlePreviewTable cues={cues} onCueChange={setCues} />
        </div>
      )}
    </div>
  );
};
