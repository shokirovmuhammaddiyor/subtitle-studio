import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Trash2,
  Settings2,
  CheckCircle2,
  Eye,
  Sliders,
  Type,
  ShieldAlert,
  FileCheck
} from 'lucide-react';
import { FileOrUrlInput } from '../shared/FileOrUrlInput';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { cleanSubtitleCues, DEFAULT_CLEANING_OPTIONS } from '../../lib/cleaners/tagCleaner';
import { SubtitleCue, CleaningOptions } from '../../types/subtitle';
import { HttpRangeReader } from '../../lib/rangeReader';

export const CleanerTool: React.FC = () => {
  const [originalCues, setOriginalCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState('subtitles');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<CleaningOptions>(DEFAULT_CLEANING_OPTIONS);
  const [allowedHtmlInput, setAllowedHtmlInput] = useState('i, b');
  const [watermarksInput, setWatermarksInput] = useState(DEFAULT_CLEANING_OPTIONS.customWatermarks.join(', '));

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const parsed = parseSubtitles(text, detected, file.name);
      if (parsed.length === 0) throw new Error('Subtitr faylidan replikalar topilmadi.');

      setOriginalCues(parsed);
      setFilename(file.name);
    } catch (err: any) {
      setError(err?.message || 'Faylni ochishda xatolik');
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
      const readSize = Math.min(size || 2 * 1024 * 1024, 5 * 1024 * 1024);
      const bytes = await reader.read(0, readSize);
      const text = new TextDecoder('utf-8').decode(bytes);

      const name = reader.getSourceName();
      const detected = detectFormat(text, name);
      const parsed = parseSubtitles(text, detected, name);
      if (parsed.length === 0) throw new Error('Subtitr topilmadi.');

      setOriginalCues(parsed);
      setFilename(name);
    } catch (err: any) {
      setError(err?.message || 'Havolani ochishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Compute cleaned cues live
  const cleanedCues = useMemo(() => {
    if (originalCues.length === 0) return [];
    const activeOpts: CleaningOptions = {
      ...options,
      allowedHtmlTags: allowedHtmlInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      customWatermarks: watermarksInput.split(',').map(s => s.trim()).filter(Boolean)
    };
    return cleanSubtitleCues(originalCues, activeOpts);
  }, [originalCues, options, allowedHtmlInput, watermarksInput]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Tozalovchi & Tag Stripper
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle Cleaner & HTML Formatter
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          HTML teglari (&lt;i&gt;, &lt;b&gt;, &lt;font&gt;), ASS style teglari ({'{\\an8}'}), qavslar ichidagi matnlar (musiqa, kuladi), eshitishida nuqsoni borlar (SDH) belgilari va keraksiz reklamalarni tozalang.
        </p>
      </div>

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

      {originalCues.length > 0 && (
        <div className="space-y-6 animate-slide-up">
          {/* Options Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Tozalash Sozlamalari (Filterlar)</span>
            </h3>

            {/* Grid of Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* HTML Tags */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripHtml}
                    onChange={(e) => setOptions({ ...options, stripHtml: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>HTML Teglarini Tozalash</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  &lt;i&gt;, &lt;b&gt;, &lt;u&gt;, &lt;font color="..."&gt;, &lt;span&gt; va b.
                </p>
                {options.stripHtml && (
                  <div className="pt-1">
                    <span className="text-[10px] text-slate-400">Saqlab qolinadigan teglar (vergul bilan):</span>
                    <input
                      type="text"
                      value={allowedHtmlInput}
                      onChange={(e) => setAllowedHtmlInput(e.target.value)}
                      placeholder="masalan: i, b"
                      className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-indigo-200"
                    />
                  </div>
                )}
              </div>

              {/* ASS/SSA Tags */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripAssTags}
                    onChange={(e) => setOptions({ ...options, stripAssTags: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>ASS/SSA Style Teglari</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  {`{\\an8}, {\\pos(x,y)}, {\\c&H...&}, {\\fad(t1,t2)}`} kabi formatlashni tozalash
                </p>
              </div>

              {/* Parentheses */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripParentheses}
                    onChange={(e) => setOptions({ ...options, stripParentheses: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>Dumaloq Qavslar (...)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  (musiqa chalmoqda), (pansionatda), (kuladi) kabi izohlarni o'chirish
                </p>
              </div>

              {/* Square Brackets */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripSquareBrackets}
                    onChange={(e) => setOptions({ ...options, stripSquareBrackets: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>To'rtburchak Qavslar [...]</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  [APPLAUSE], [MUSIC PLAYING], [SHOUTING] kabi izohlarni o'chirish
                </p>
              </div>

              {/* SDH Speakers */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripSdhSpeakers}
                    onChange={(e) => setOptions({ ...options, stripSdhSpeakers: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>So'zlovchi Ismlari (SDH)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  "JOHN: Hello", "NARRATOR (V.O.): Once upon a time" prefikslarini tozalash
                </p>
              </div>

              {/* Music Symbols */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripMusicSymbols}
                    onChange={(e) => setOptions({ ...options, stripMusicSymbols: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>Musiqa Belgilari (🎵, 🎶, #)</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Qo'shiq yoki notalarni bildiruvchi belgilarni tozalash
                </p>
              </div>

              {/* Watermarks */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 sm:col-span-2">
                <label className="flex items-center space-x-2.5 text-slate-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.stripWatermarks}
                    onChange={(e) => setOptions({ ...options, stripWatermarks: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>Suv Belgilari & Reklamalarni O'chirish</span>
                </label>
                <input
                  type="text"
                  value={watermarksInput}
                  onChange={(e) => setWatermarksInput(e.target.value)}
                  placeholder="opensubtitles, yify, addic7ed, subscene, www..."
                  className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-indigo-200"
                />
              </div>

              {/* Case transform */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <label className="block text-slate-200 font-semibold">
                  Matn Registrini O'zgartirish
                </label>
                <select
                  value={options.caseTransform}
                  onChange={(e) => setOptions({ ...options, caseTransform: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200"
                >
                  <option value="none">Asl holatda qoldirish</option>
                  <option value="sentence">Har bir gapni bosh harf bilan boshlash</option>
                  <option value="title">Title Case (Har Bir So'z Katta)</option>
                  <option value="lowercase">kichik harflar (lowercase)</option>
                  <option value="uppercase">KATTA HARFLAR (UPPERCASE)</option>
                </select>
              </div>
            </div>

            {/* Action & Download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                Tozalangan replikalar: <strong className="text-white">{cleanedCues.length}</strong> ta
              </div>

              <DownloadButton
                cues={cleanedCues}
                filename={`${filename}_cleaned`}
                defaultFormat="srt"
              />
            </div>
          </div>

          {/* Table Preview */}
          <SubtitlePreviewTable cues={cleanedCues} />
        </div>
      )}
    </div>
  );
};
