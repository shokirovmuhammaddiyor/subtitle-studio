import React, { useState, useMemo } from 'react';
import {
  Languages,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Download,
  Upload,
  AlertTriangle,
  FileCheck2,
  ListOrdered,
  Layers,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { SubtitleCue } from '../../types/subtitle';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';

export const TranslatorHelperTool: React.FC = () => {
  const [originalCues, setOriginalCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState('subtitles');
  const [translatedText, setTranslatedText] = useState('');
  const [translatedCues, setTranslatedCues] = useState<SubtitleCue[]>([]);
  const [copiedMode, setCopiedMode] = useState<string | null>(null);

  // Chunk pagination for AI (100 lines per chunk)
  const [chunkSize] = useState(100);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [includeLineNumbers, setIncludeLineNumbers] = useState(true);
  const [stripAssTagsForAi, setStripAssTagsForAi] = useState(true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const parsed = parseSubtitles(text, detected, file.name);
      setOriginalCues(parsed);
      setFilename(file.name);
      setTranslatedCues([]);
      setTranslatedText('');
      setActiveChunkIndex(0);
    }
  };

  const totalChunks = Math.ceil(originalCues.length / chunkSize);

  const currentChunkCues = useMemo(() => {
    if (activeChunkIndex === -1) return originalCues;
    const start = activeChunkIndex * chunkSize;
    return originalCues.slice(start, start + chunkSize);
  }, [originalCues, activeChunkIndex, chunkSize]);

  const cleanCueTextForAi = (cue: SubtitleCue): string => {
    let t = cue.text;
    if (stripAssTagsForAi) {
      // Strip ASS tags like {\an8}, {\pos(1,2)}, {\c&H...&}
      t = t.replace(/\{[^{}]*\}/g, '');
    }
    // Replace newlines with spaces for single-line AI processing
    return t.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const getTranscriptText = (cuesToExport: SubtitleCue[]) => {
    if (includeLineNumbers) {
      return cuesToExport.map((c) => `[${c.id}] ${cleanCueTextForAi(c)}`).join('\n');
    }
    return cuesToExport.map((c) => cleanCueTextForAi(c)).join('\n');
  };

  const copyPromptForAi = (cuesToExport: SubtitleCue[], modeLabel: string) => {
    const textContent = getTranscriptText(cuesToExport);
    let prompt = textContent;

    if (includeLineNumbers) {
      prompt = `Quyidagi subtitr replikalarini o'zbek tiliga tabiiy va ravon tarjima qilib ber.\nMUHIM QOIDA: Har bir replika boshidagi [1], [2] raqamlarini o'zgartirmasdan, hech bir qatorni tashlab ketmasdan aynan shu tartibda qaytar:\n\n${textContent}`;
    }

    navigator.clipboard.writeText(prompt);
    setCopiedMode(modeLabel);
    setTimeout(() => setCopiedMode(null), 2500);
  };

  // Smart Parser for Translated Text
  const parseTranslatedInput = (input: string): Map<number, string> => {
    const map = new Map<number, string>();
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);

    // Check if lines have [ID] or ID: pattern
    let hasNumberedLines = false;
    for (const l of lines) {
      if (/^\[?\d+\]?[:.]?\s+/.test(l)) {
        hasNumberedLines = true;
        break;
      }
    }

    if (hasNumberedLines) {
      for (const line of lines) {
        const match = line.match(/^\[?(\d+)\]?[:.]?\s*(.*)$/);
        if (match) {
          const id = parseInt(match[1], 10);
          const text = match[2].trim();
          map.set(id, text);
        }
      }
    } else {
      // Sequential fallback
      lines.forEach((line, idx) => {
        if (idx < originalCues.length) {
          map.set(originalCues[idx].id, line);
        }
      });
    }

    return map;
  };

  const applyTranslation = () => {
    if (!translatedText.trim() || originalCues.length === 0) return;

    const translationMap = parseTranslatedInput(translatedText);

    // Merge into existing translated cues (if any) or original cues
    const baseCues = translatedCues.length === originalCues.length ? translatedCues : originalCues;

    const reassembled: SubtitleCue[] = baseCues.map((orig) => {
      const translated = translationMap.get(orig.id);
      if (translated) {
        // If original had ASS tags, restore them if requested
        let finalRaw = orig.rawText;
        if (orig.rawText && orig.rawText.includes('{\\')) {
          const tagMatch = orig.rawText.match(/^(\{[^{}]*\})+/);
          if (tagMatch) {
            finalRaw = tagMatch[0] + translated;
          }
        }
        return {
          ...orig,
          text: translated,
          rawText: finalRaw
        };
      }
      return orig;
    });

    setTranslatedCues(reassembled);
  };

  // Translation stats
  const translatedCount = useMemo(() => {
    if (translatedCues.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < originalCues.length; i++) {
      if (translatedCues[i] && translatedCues[i].text !== originalCues[i].text) {
        count++;
      }
    }
    return count;
  }, [translatedCues, originalCues]);

  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            AI & Tarjimon Studiyasi
          </span>
          <span className="text-slate-400 text-xs">&bull; ASS / SRT Smart Chunking</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle AI & Translator Studio (Mukammal Tarjima)
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
          Subtitrdan toza replika matnlarini ChatGPT, Gemini yoki DeepL ga uzating. Raqamlangan qismlar (Batching) orqali barcha qatorlar 100% to'liq, birorta replika tashlab ketilmasdan tarjima qilinadi.
        </p>
      </div>

      {/* Step 1: Upload */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>1-Qadam: Asl Subtitr Faylini Yuklang (ASS, SRT, VTT)</span>
          </h3>
          {originalCues.length > 0 && (
            <span className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
              {originalCues.length} ta replika yuklandi
            </span>
          )}
        </div>
        <input
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.lrc,.txt"
          onChange={handleFileUpload}
          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
        />
      </div>

      {originalCues.length > 0 && (
        <div className="space-y-6 animate-slide-up">
          {/* Options toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-4 rounded-xl border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLineNumbers}
                  onChange={(e) => setIncludeLineNumbers(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Raqamlangan format ([1], [2]... - Qatorlar tushib qolmasligi uchun)</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stripAssTagsForAi}
                  onChange={(e) => setStripAssTagsForAi(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>ASS teglari va stillarini tozalash (AI chalg'imasligi uchun)</span>
              </label>
            </div>

            {totalChunks > 1 && (
              <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 px-2 text-[11px]">Qism:</span>
                <button
                  type="button"
                  onClick={() => setActiveChunkIndex(-1)}
                  className={`px-2.5 py-1 rounded text-xs transition ${
                    activeChunkIndex === -1 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hammasi ({originalCues.length})
                </button>
                {Array.from({ length: totalChunks }).map((_, idx) => {
                  const start = idx * chunkSize + 1;
                  const end = Math.min((idx + 1) * chunkSize, originalCues.length);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveChunkIndex(idx)}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        activeChunkIndex === idx ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {start}-{end}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two Columns: Source Transcript and Translation Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Original Transcript */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1.5">
                  <ListOrdered className="w-4 h-4" />
                  <span>
                    2-Qadam: AI uchun Matn ({currentChunkCues.length} ta replika)
                  </span>
                </span>
                <button
                  onClick={() => copyPromptForAi(currentChunkCues, `chunk-${activeChunkIndex}`)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow-md shadow-indigo-600/30"
                >
                  {copiedMode === `chunk-${activeChunkIndex}` ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedMode === `chunk-${activeChunkIndex}`
                      ? 'Nusxalandi!'
                      : 'AI uchun Prompt Nusxalash'}
                  </span>
                </button>
              </div>

              <textarea
                readOnly
                value={getTranscriptText(currentChunkCues)}
                rows={14}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none select-all"
              />
              <p className="text-[11px] text-slate-500">
                💡 <strong>Maslahat:</strong> ChatGPT yoki Gemini'ga berish uchun "AI uchun Prompt Nusxalash" tugmasini bosing. U avtomatik tarzda to'g'ri ko'rsatma bilan birga nusxalanadi.
              </p>
            </div>

            {/* Right: Translated text paste */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>3-Qadam: AI Tarjimasini Tashlang</span>
                </span>
                <button
                  onClick={applyTranslation}
                  disabled={!translatedText.trim()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow-md shadow-emerald-600/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Vaqt Kodlariga Birlashtirish</span>
                </button>
              </div>

              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder="AI tarjima qilgan replikalarni bu yerga tashlang (masalan: [1] Salom dunyo... yoki oddiy qatorlar)..."
                rows={14}
                className="w-full p-3.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-white focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                ⚡️ <strong>Smart Birlashtirish:</strong> Raqamlar bilan kelsa ham, raqamsiz kelsa ham avtomatik aniqlanadi. Agar bo'lib-bo'lib tashlasangiz, oldingi tarjimalar ustiga qo'shilib boradi.
              </p>
            </div>
          </div>

          {/* Progress / Status indicator */}
          {translatedCount > 0 && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">
                  Tarjima holati: {translatedCount} / {originalCues.length} ta replika muvaffaqiyatli tarjima qilindi ({Math.round((translatedCount / originalCues.length) * 100)}%)
                </span>
              </div>
              {translatedCount < originalCues.length && (
                <span className="text-amber-400 text-[11px] flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{originalCues.length - translatedCount} ta replika qoldi (keyingi qismni tashlang)</span>
                </span>
              )}
            </div>
          )}

          {/* Final Result & Download Table */}
          {translatedCues.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-4 animate-slide-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Tayyor Tarjima Subtitri ({translatedCues.length} ta replika)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Format: <span className="uppercase font-bold text-indigo-300">SRT / ASS</span> &bull; {translatedCount} ta replika tarjima qilingan
                  </p>
                </div>

                <DownloadButton
                  cues={translatedCues}
                  filename={`${filename.replace(/\.[^/.]+$/, '')}_translated`}
                  defaultFormat="srt"
                />
              </div>

              <SubtitlePreviewTable cues={translatedCues} onCueChange={setTranslatedCues} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
