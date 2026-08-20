import React, { useState, useMemo } from 'react';
import { Clock, Sliders, Play, RotateCcw, FastForward, CheckCircle2 } from 'lucide-react';
import { FileOrUrlInput } from '../shared/FileOrUrlInput';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { shiftSubtitles, COMMON_FPS, TimeShiftOptions } from '../../lib/processors/timeShifter';
import { SubtitleCue } from '../../types/subtitle';
import { HttpRangeReader } from '../../lib/rangeReader';

export const ResyncTool: React.FC = () => {
  const [originalCues, setOriginalCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState('subtitles');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time shift options
  const [offsetMs, setOffsetMs] = useState<number>(0);
  const [enableFps, setEnableFps] = useState(false);
  const [fpsSource, setFpsSource] = useState(23.976);
  const [fpsTarget, setFpsTarget] = useState(25.0);

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
      setOffsetMs(0);
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
      setOffsetMs(0);
    } catch (err: any) {
      setError(err?.message || 'Havolani ochishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const addOffset = (deltaMs: number) => {
    setOffsetMs(prev => prev + deltaMs);
  };

  const shiftedCues = useMemo(() => {
    if (originalCues.length === 0) return [];
    const opts: TimeShiftOptions = {
      offsetMs,
      fpsSource: enableFps ? fpsSource : undefined,
      fpsTarget: enableFps ? fpsTarget : undefined,
    };
    return shiftSubtitles(originalCues, opts);
  }, [originalCues, offsetMs, enableFps, fpsSource, fpsTarget]);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Vaqt & Sinxronizatsiya
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle Time Shifter & FPS Resync
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Subtitr vaqtini millisekund yoki soniyalarda oldinga/orqaga suring yoki video kadrlash tezligiga (FPS) qarab avtomatik proporsional moslang.
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
          {/* Controls Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Vaqtni Surish Sozlamalari</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Offset Shift Slider & Buttons */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Vaqt Farqi (Offset):</span>
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {offsetMs >= 0 ? `+${(offsetMs / 1000).toFixed(3)}s` : `${(offsetMs / 1000).toFixed(3)}s`} ({offsetMs} ms)
                  </span>
                </div>

                <input
                  type="range"
                  min="-30000"
                  max="30000"
                  step="100"
                  value={offsetMs}
                  onChange={(e) => setOffsetMs(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => addOffset(-5000)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    -5.0s
                  </button>
                  <button
                    onClick={() => addOffset(-1000)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    -1.0s
                  </button>
                  <button
                    onClick={() => addOffset(-200)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    -200ms
                  </button>
                  <button
                    onClick={() => setOffsetMs(0)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>0</span>
                  </button>
                  <button
                    onClick={() => addOffset(200)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    +200ms
                  </button>
                  <button
                    onClick={() => addOffset(1000)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    +1.0s
                  </button>
                  <button
                    onClick={() => addOffset(5000)}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs"
                  >
                    +5.0s
                  </button>
                </div>
              </div>

              {/* Framerate conversion */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <label className="flex items-center space-x-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFps}
                    onChange={(e) => setEnableFps(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                  />
                  <span>FPS Konvertatsiyasi (Kadrlash tezligi)</span>
                </label>

                {enableFps && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Manba (Original) FPS:</span>
                      <select
                        value={fpsSource}
                        onChange={(e) => setFpsSource(parseFloat(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      >
                        {COMMON_FPS.map(f => (
                          <option key={`src-${f.value}`} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">Maqsad (Target) FPS:</span>
                      <select
                        value={fpsTarget}
                        onChange={(e) => setFpsTarget(parseFloat(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      >
                        {COMMON_FPS.map(f => (
                          <option key={`tgt-${f.value}`} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  {enableFps ? `Nisbat: ${(fpsSource / fpsTarget).toFixed(4)}x tezlikka moslanadi` : 'O\'chirilgan (standart tezlik)'}
                </p>
              </div>
            </div>

            {/* Action & Download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                Sinxronlangan replikalar: <strong className="text-white">{shiftedCues.length}</strong> ta
              </div>

              <DownloadButton
                cues={shiftedCues}
                filename={`${filename}_resynced`}
                defaultFormat="srt"
              />
            </div>
          </div>

          <SubtitlePreviewTable cues={shiftedCues} />
        </div>
      )}
    </div>
  );
};
