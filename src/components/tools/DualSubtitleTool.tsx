import React, { useState, useMemo } from 'react';
import { Layers, Sparkles, Sliders, ArrowDownUp, CheckCircle2 } from 'lucide-react';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { createDualSubtitles, DualSubtitleOptions } from '../../lib/processors/subtitleMerger';
import { SubtitleCue } from '../../types/subtitle';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';

export const DualSubtitleTool: React.FC = () => {
  const [topCues, setTopCues] = useState<SubtitleCue[]>([]);
  const [bottomCues, setBottomCues] = useState<SubtitleCue[]>([]);
  const [topName, setTopName] = useState('Top (Inglizcha)');
  const [bottomName, setBottomName] = useState('Bottom (O\'zbekcha)');

  const [topColor, setTopColor] = useState('#FFFF00'); // Yellow
  const [bottomColor, setBottomColor] = useState('#FFFFFF'); // White
  const [formatMode, setFormatMode] = useState<'ass_styles' | 'combined_text'>('ass_styles');

  const handleTopFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      setTopCues(parseSubtitles(text, detected, file.name));
      setTopName(file.name);
    }
  };

  const handleBottomFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      setBottomCues(parseSubtitles(text, detected, file.name));
      setBottomName(file.name);
    }
  };

  const swapTracks = () => {
    const tempCues = [...topCues];
    const tempName = topName;
    setTopCues(bottomCues);
    setTopName(bottomName);
    setBottomCues(tempCues);
    setBottomName(tempName);
  };

  const mergedCues = useMemo(() => {
    if (topCues.length === 0 && bottomCues.length === 0) return [];
    if (topCues.length === 0) return bottomCues;
    if (bottomCues.length === 0) return topCues;

    const opts: DualSubtitleOptions = {
      topColor,
      bottomColor,
      formatMode
    };
    return createDualSubtitles(topCues, bottomCues, opts);
  }, [topCues, bottomCues, topColor, bottomColor, formatMode]);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Ikki Tilli Subtitr
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Bilingual & Dual Subtitle Generator
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Ikkita alohida tildagi subtitrni bitta faylga birlashtiring (masalan, yuqori qismda Inglizcha, pastki qismda O'zbekcha). Til o'rganuvchilar uchun qulay.
        </p>
      </div>

      {/* Dual Uploaders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top track */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
              1-Trek (Yuqori Subtitr)
            </span>
            <span className="text-[11px] text-slate-400">
              {topCues.length > 0 ? `${topCues.length} replika` : 'Yuklanmagan'}
            </span>
          </div>
          <input
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
            onChange={handleTopFile}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
          />
          <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
            <span>Rang:</span>
            <input
              type="color"
              value={topColor}
              onChange={(e) => setTopColor(e.target.value)}
              className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
            />
            <span className="font-mono text-slate-200">{topColor}</span>
          </div>
        </div>

        {/* Bottom track */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              2-Trek (Pastki Subtitr)
            </span>
            <span className="text-[11px] text-slate-400">
              {bottomCues.length > 0 ? `${bottomCues.length} replika` : 'Yuklanmagan'}
            </span>
          </div>
          <input
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
            onChange={handleBottomFile}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
          />
          <div className="flex items-center space-x-2 text-xs text-slate-400 pt-1">
            <span>Rang:</span>
            <input
              type="color"
              value={bottomColor}
              onChange={(e) => setBottomColor(e.target.value)}
              className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
            />
            <span className="font-mono text-slate-200">{bottomColor}</span>
          </div>
        </div>
      </div>

      {/* Controls & Mode */}
      {(topCues.length > 0 || bottomCues.length > 0) && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={swapTracks}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>O'rinlarini almashtirish</span>
              </button>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400">Birlashtirish usuli:</span>
                <select
                  value={formatMode}
                  onChange={(e) => setFormatMode(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="ass_styles">ASS Stillari (Yuqori + Pastki joylashuv)</option>
                  <option value="combined_text">Bitta blok (Yuqoridagi / Pastdagi matn)</option>
                </select>
              </div>
            </div>

            <DownloadButton
              cues={mergedCues}
              filename="dual_bilingual_subtitles"
              defaultFormat="ass"
            />
          </div>

          <SubtitlePreviewTable cues={mergedCues} />
        </div>
      )}
    </div>
  );
};
