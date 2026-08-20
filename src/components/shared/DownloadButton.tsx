import React, { useState } from 'react';
import { Download, Copy, Check, ChevronDown, FileText } from 'lucide-react';
import { SubtitleCue, SubtitleFormat, SubtitleTrack } from '../../types/subtitle';
import { stringifySubtitles } from '../../lib/parsers/universalParser';
import JSZip from 'jszip';

interface DownloadButtonProps {
  cues: SubtitleCue[];
  filename?: string;
  defaultFormat?: SubtitleFormat;
  tracks?: SubtitleTrack[]; // optional if downloading multiple tracks as zip
  customHeader?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  cues,
  filename = 'subtitles',
  defaultFormat = 'srt',
  tracks,
  customHeader
}) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const cleanBaseName = filename.replace(/\.[^/.]+$/, '');

  const handleDownload = (format: SubtitleFormat) => {
    const content = stringifySubtitles(cues, format, customHeader);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanBaseName}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleDownloadZip = async () => {
    if (!tracks || tracks.length === 0) return;
    const zip = new JSZip();

    for (const track of tracks) {
      const format = track.format || 'srt';
      const content = stringifySubtitles(track.cues, format, track.codecPrivate);
      const trackLang = track.language || 'und';
      const trackName = `${cleanBaseName}_track_${track.trackNumber}_${trackLang}.${format}`;
      zip.file(trackName, content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanBaseName}_all_subtitles.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  const handleCopy = () => {
    const content = stringifySubtitles(cues, defaultFormat, customHeader);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-flex items-center space-x-2">
      {/* Primary Download Button */}
      <div className="inline-flex rounded-xl shadow-lg shadow-indigo-600/20">
        <button
          onClick={() => handleDownload(defaultFormat)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-l-xl transition"
        >
          <Download className="w-4 h-4" />
          <span>Yuklab olish ({defaultFormat.toUpperCase()})</span>
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-2.5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-r-xl border-l border-indigo-500/30 transition"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="flex items-center space-x-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
        title="Matnni nusxalash"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
        <span>{copied ? 'Nusxalandi!' : 'Nusxalash'}</span>
      </button>

      {/* Format Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1.5 divide-y divide-slate-800 animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Formatni tanlang
            </div>
            <div className="py-1">
              {(['srt', 'vtt', 'ass', 'ssa', 'lrc', 'txt', 'json'] as SubtitleFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleDownload(fmt)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{fmt.toUpperCase()} formatida</span>
                  </div>
                  {fmt === defaultFormat && (
                    <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-200">
                      Asosiy
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tracks && tracks.length > 1 && (
              <div className="py-1">
                <button
                  onClick={handleDownloadZip}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-amber-300 hover:bg-amber-600 hover:text-white transition font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Barcha treklarni ZIP qilish ({tracks.length} ta)</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
