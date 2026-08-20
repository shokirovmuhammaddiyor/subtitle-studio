import React, { useState } from 'react';
import { Languages, Copy, Check, Sparkles, ArrowRight, Download, Upload } from 'lucide-react';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { SubtitleCue } from '../../types/subtitle';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';

export const TranslatorHelperTool: React.FC = () => {
  const [originalCues, setOriginalCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState('subtitles');
  const [translatedText, setTranslatedText] = useState('');
  const [translatedCues, setTranslatedCues] = useState<SubtitleCue[]>([]);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const parsed = parseSubtitles(text, detected, file.name);
      setOriginalCues(parsed);
      setFilename(file.name);
    }
  };

  const getCleanTranscript = () => {
    return originalCues.map(c => c.text.replace(/\n/g, ' ')).join('\n');
  };

  const copyTranscript = () => {
    const transcript = getCleanTranscript();
    navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const applyTranslation = () => {
    if (!translatedText.trim() || originalCues.length === 0) return;
    const lines = translatedText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const reassembled: SubtitleCue[] = originalCues.map((orig, idx) => ({
      ...orig,
      text: idx < lines.length ? lines[idx] : orig.text
    }));

    setTranslatedCues(reassembled);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            AI & Tarjimon Studiyasi
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle AI & Translator Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Subtitrdan faqatgina toza matn transkriptini ajratib oling (ChatGPT, Gemini yoki DeepL ga berish uchun), va tarjima qilingan matnni qaytadan asl vaqt kodlariga bir zumda birlashtiring.
        </p>
      </div>

      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white">1-Qadam: Asl Subtitr Faylini Yuklang</h3>
        <input
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
          onChange={handleFileUpload}
          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />
      </div>

      {originalCues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
          {/* Left: Original Transcript */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400">
                2-Qadam: Toza Transkript ({originalCues.length} qator)
              </span>
              <button
                onClick={copyTranscript}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
              >
                {copiedTranscript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTranscript ? 'Nusxalandi!' : 'AI uchun Nusxalash'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={getCleanTranscript()}
              rows={12}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none select-all"
            />
          </div>

          {/* Right: Translated text paste */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">
                3-Qadam: Tarjima Qilingan Matnni Tashlang
              </span>
              <button
                onClick={applyTranslation}
                disabled={!translatedText.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Vaqt Kodlariga Birlashtirish</span>
              </button>
            </div>
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              placeholder="Tarjima qilingan qatorlarni bu yerga tashlang (qatorlar soni mos kelishi kerak)..."
              rows={12}
              className="w-full p-3 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-white focus:outline-none"
            />
          </div>
        </div>
      )}

      {translatedCues.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Tayyor Tarjima Subtitri ({translatedCues.length} ta replika)</span>
            </h3>
            <DownloadButton
              cues={translatedCues}
              filename={`${filename}_translated`}
              defaultFormat="srt"
            />
          </div>
          <SubtitlePreviewTable cues={translatedCues} onCueChange={setTranslatedCues} />
        </div>
      )}
    </div>
  );
};
