import React, { useState, useRef, useEffect } from 'react';
import { PlaySquare, Plus, Trash2, Edit3, Download, Volume2, Upload, Link as LinkIcon } from 'lucide-react';
import { SubtitleCue } from '../../types/subtitle';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { formatTimeSrt, parseTimeSrt } from '../../lib/parsers/srtParser';
import { DownloadButton } from '../shared/DownloadButton';

export const EditorPlayerTool: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [cues, setCues] = useState<SubtitleCue[]>([
    { id: 1, startTime: 0.5, endTime: 3.5, text: 'Subtitle Studio Pro pleyeriga xush kelibsiz!' },
    { id: 2, startTime: 4.0, endTime: 7.0, text: 'Videoni yuklang va subtitrlarni jonli tahrirlang.' }
  ]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Time update listener
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      // Find active cue
      const active = cues.find(c => cur >= c.startTime && cur <= c.endTime);
      setActiveCueText(active ? active.text : null);
    }
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleSubtitleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      setCues(parseSubtitles(text, detected, file.name));
    }
  };

  const jumpToTime = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      videoRef.current.play();
    }
  };

  const addNewCue = () => {
    const start = currentTime;
    const end = start + 3.0;
    const newCue: SubtitleCue = {
      id: cues.length + 1,
      startTime: Number(start.toFixed(3)),
      endTime: Number(end.toFixed(3)),
      text: 'Yangi subtitr matni...'
    };
    setCues(prev => [...prev, newCue].sort((a, b) => a.startTime - b.startTime).map((c, i) => ({ ...c, id: i + 1 })));
  };

  const deleteCue = (id: number) => {
    setCues(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, id: i + 1 })));
  };

  const updateCueText = (id: number, text: string) => {
    setCues(prev => prev.map(c => c.id === id ? { ...c, text } : c));
  };

  const updateCueTime = (id: number, field: 'start' | 'end', valStr: string) => {
    const sec = parseTimeSrt(valStr);
    setCues(prev => prev.map(c => {
      if (c.id === id) {
        return field === 'start' ? { ...c, startTime: sec } : { ...c, endTime: sec };
      }
      return c;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Jonli Pleyer & Tahrirlovchi
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Visual Subtitle Editor & Live Video Player
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Videoni brauzerda oching, subtitrlarni real vaqt rejimida video ustida ko'ring va vaqt kodlarini bevosita tahrirlang.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Player & Subtitle Overlay */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            {/* Video container */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-2xl">
              {videoSrc ? (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <PlaySquare className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Video tanlanmagan</p>
                </div>
              )}

              {/* Subtitle Overlay */}
              {activeCueText && (
                <div className="absolute bottom-12 inset-x-4 text-center pointer-events-none transition-all">
                  <span className="inline-block bg-black/80 text-white font-semibold text-sm sm:text-base px-4 py-1.5 rounded-lg shadow-lg border border-white/10 backdrop-blur-sm whitespace-pre-line leading-snug">
                    {activeCueText}
                  </span>
                </div>
              )}
            </div>

            {/* Video Loader input */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <label className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-center space-x-2 transition">
                <Upload className="w-4 h-4" />
                <span>Video Fayl Tanlash</span>
                <input type="file" accept="video/*,audio/*" onChange={handleVideoFile} className="hidden" />
              </label>

              <div className="flex-1 w-full flex items-center space-x-1.5">
                <input
                  type="url"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="Yoki to'g'ridan-to'g'ri video URL..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <button
                  onClick={() => videoUrlInput && setVideoSrc(videoUrlInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Ochish
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Subtitle Cue Editor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition">
                  Subtitr Yuklash
                  <input type="file" accept=".srt,.vtt,.ass,.txt" onChange={handleSubtitleFile} className="hidden" />
                </label>
                <button
                  onClick={addNewCue}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Qo'shish</span>
                </button>
              </div>

              <DownloadButton cues={cues} filename="edited_subtitles" defaultFormat="srt" />
            </div>

            {/* Cue list */}
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {cues.map((cue) => {
                const isActive = currentTime >= cue.startTime && currentTime <= cue.endTime;
                return (
                  <div
                    key={cue.id}
                    onClick={() => jumpToTime(cue.startTime)}
                    className={`p-3 rounded-xl border text-xs space-y-2 cursor-pointer transition ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center space-x-2 font-mono text-[11px]">
                        <span className="text-slate-500 font-bold">#{cue.id}</span>
                        <input
                          type="text"
                          defaultValue={formatTimeSrt(cue.startTime)}
                          onBlur={(e) => updateCueTime(cue.id, 'start', e.target.value)}
                          className="w-24 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-indigo-300"
                        />
                        <span className="text-slate-500">&rarr;</span>
                        <input
                          type="text"
                          defaultValue={formatTimeSrt(cue.endTime)}
                          onBlur={(e) => updateCueTime(cue.id, 'end', e.target.value)}
                          className="w-24 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-indigo-300"
                        />
                      </div>
                      <button
                        onClick={() => deleteCue(cue.id)}
                        className="p-1 text-rose-400 hover:bg-rose-500/20 rounded"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      value={cue.text}
                      onChange={(e) => updateCueText(cue.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      rows={2}
                      className="w-full p-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded text-xs text-white focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
