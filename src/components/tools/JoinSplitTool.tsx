import React, { useState } from 'react';
import { Scissors, Plus, CheckCircle2, Download, Trash2, ArrowRight } from 'lucide-react';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { joinSubtitles, splitSubtitles } from '../../lib/processors/subtitleMerger';
import { SubtitleCue } from '../../types/subtitle';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { formatTimeSrt, parseTimeSrt } from '../../lib/parsers/srtParser';

export const JoinSplitTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'join' | 'split'>('join');

  // Joiner state
  const [joinParts, setJoinParts] = useState<{ id: string; name: string; cues: SubtitleCue[]; offsetSec: number }[]>([]);

  // Splitter state
  const [splitCues, setSplitCues] = useState<SubtitleCue[]>([]);
  const [splitFilename, setSplitFilename] = useState('subtitles');
  const [splitTimeInput, setSplitTimeInput] = useState('00:45:00,000');
  const [resetTimestamp, setResetTimestamp] = useState(true);

  // Joiner handlers
  const handleAddJoinFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const cues = parseSubtitles(text, detected, file.name);

      setJoinParts(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          name: file.name,
          cues,
          offsetSec: prev.length === 0 ? 0 : (prev[prev.length - 1].cues.slice(-1)[0]?.endTime || 0) + 2.0
        }
      ]);
    }
  };

  const removeJoinPart = (id: string) => {
    setJoinParts(prev => prev.filter(p => p.id !== id));
  };

  const joinedResult = React.useMemo(() => {
    if (joinParts.length === 0) return [];
    return joinSubtitles(joinParts);
  }, [joinParts]);

  // Splitter handlers
  const handleSplitFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const cues = parseSubtitles(text, detected, file.name);
      setSplitCues(cues);
      setSplitFilename(file.name);
    }
  };

  const splitResult = React.useMemo(() => {
    if (splitCues.length === 0) return { part1: [], part2: [] };
    const splitSec = parseTimeSrt(splitTimeInput);
    return splitSubtitles(splitCues, splitSec, resetTimestamp);
  }, [splitCues, splitTimeInput, resetTimestamp]);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Ulash & Bo'lish
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle Joiner & Splitter
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          CD1 va CD2 qismlarga bo'lingan subtitrlarni bitta faylga birlashtiring yoki bitta katta subtitrni ma'lum daqiqadan ikkiga bo'ling.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex space-x-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('join')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'join' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Birlashtirish (Join CD1 + CD2)
        </button>
        <button
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          2. Bo'lish (Split by Timestamp)
        </button>
      </div>

      {activeTab === 'join' ? (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Birlashtiriladigan Qismlar</h3>
              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center space-x-1.5 transition">
                <Plus className="w-4 h-4" />
                <span>Qism qo'shish (Fayl tanlash)</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
                  onChange={handleAddJoinFile}
                  className="hidden"
                />
              </label>
            </div>

            {joinParts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Hozircha hech qanday fayl qo'shilmadi. "Qism qo'shish" tugmasi orqali CD1, CD2 fayllarini yuklang.
              </p>
            ) : (
              <div className="space-y-3">
                {joinParts.map((part, idx) => (
                  <div
                    key={part.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-white block">{part.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {part.cues.length} replika ({formatTimeSrt(part.cues[0]?.startTime || 0)} &rarr; {formatTimeSrt(part.cues.slice(-1)[0]?.endTime || 0)})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400">Vaqt Surilishi (Sekund):</span>
                        <input
                          type="number"
                          value={part.offsetSec}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setJoinParts(prev => prev.map(p => p.id === part.id ? { ...p, offsetSec: val } : p));
                          }}
                          className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                      <button
                        onClick={() => removeJoinPart(part.id)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {joinParts.length > 0 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-300">
                  Jami birlashtirilgan: <strong className="text-white">{joinedResult.length}</strong> replika
                </div>
                <DownloadButton
                  cues={joinedResult}
                  filename="joined_subtitles"
                  defaultFormat="srt"
                />
              </div>
            )}
          </div>

          {joinedResult.length > 0 && <SubtitlePreviewTable cues={joinedResult} />}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white">Bo'linadigan Subtitr Fayli</h3>
            <input
              type="file"
              accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
              onChange={handleSplitFile}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />

            {splitCues.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Bo'linish Vaqti (Format: 00:45:00,000):
                    </label>
                    <input
                      type="text"
                      value={splitTimeInput}
                      onChange={(e) => setSplitTimeInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resetTimestamp}
                        onChange={(e) => setResetTimestamp(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950 border-slate-700"
                      />
                      <span>2-Qism vaqtini 00:00:00 dan boshlash</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-xs font-bold text-indigo-400 block mb-1">1-Qism ({splitResult.part1.length} replika)</span>
                    <DownloadButton
                      cues={splitResult.part1}
                      filename={`${splitFilename}_part1`}
                      defaultFormat="srt"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-xs font-bold text-purple-400 block mb-1">2-Qism ({splitResult.part2.length} replika)</span>
                    <DownloadButton
                      cues={splitResult.part2}
                      filename={`${splitFilename}_part2`}
                      defaultFormat="srt"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
