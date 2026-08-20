import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Wrench, Download } from 'lucide-react';
import { parseSubtitles, detectFormat } from '../../lib/parsers/universalParser';
import { validateSubtitles, autoFixValidationIssues } from '../../lib/processors/subtitleValidator';
import { SubtitleCue, ValidationIssue } from '../../types/subtitle';
import { SubtitlePreviewTable } from '../shared/SubtitlePreviewTable';
import { DownloadButton } from '../shared/DownloadButton';
import { FileOrUrlInput } from '../shared/FileOrUrlInput';
import { HttpRangeReader } from '../../lib/rangeReader';

export const ValidatorTool: React.FC = () => {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState('subtitles');
  const [isLoading, setIsLoading] = useState(false);
  const [fixedMessage, setFixedMessage] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    try {
      const text = await file.text();
      const detected = detectFormat(text, file.name);
      const parsed = parseSubtitles(text, detected, file.name);
      setCues(parsed);
      setFilename(file.name);
      setFixedMessage(false);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async (url: string, proxyId: string, customProxy?: string) => {
    setIsLoading(true);
    try {
      const reader = new HttpRangeReader(url, proxyId, customProxy);
      const size = await reader.getSize();
      const readSize = Math.min(size || 2 * 1024 * 1024, 5 * 1024 * 1024);
      const bytes = await reader.read(0, readSize);
      const text = new TextDecoder('utf-8').decode(bytes);

      const name = reader.getSourceName();
      const detected = detectFormat(text, name);
      const parsed = parseSubtitles(text, detected, name);
      setCues(parsed);
      setFilename(name);
      setFixedMessage(false);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  const issues: ValidationIssue[] = useMemo(() => {
    if (cues.length === 0) return [];
    return validateSubtitles(cues);
  }, [cues]);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  const handleAutoFix = () => {
    const fixed = autoFixValidationIssues(cues);
    setCues(fixed);
    setFixedMessage(true);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            Sifat & Xatoliklarni Tekshirish
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5">
          Subtitle Quality & Overlap Validator
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Subtitrlardagi vaqt kesishmalarini (overlap), o'qish tezligi (CPS) me'yordan oshib ketgan replikalarni va juda qisqa/uzun vaqtlarni avtomatik tekshiring va 1-bosishda to'g'rilang.
        </p>
      </div>

      <FileOrUrlInput
        mode="subtitle"
        onFileSelect={handleFileSelect}
        onUrlSubmit={handleUrlSubmit}
        isLoading={isLoading}
      />

      {cues.length > 0 && (
        <div className="space-y-6 animate-slide-up">
          {/* Summary & Auto-Fix Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${errorCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-bold text-white">
                    {issues.length === 0 ? 'Hech qanday xatolik topilmadi!' : `${issues.length} ta ehtimoliy muammo aniqlandi`}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  {errorCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                      {errorCount} to'qnashuv (Overlap)
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      {warningCount} tezlik ogohlantirishi (CPS)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {issues.length > 0 && (
                  <button
                    onClick={handleAutoFix}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Avtomatik To'g'rilash (Auto-Fix)</span>
                  </button>
                )}
                <DownloadButton cues={cues} filename={`${filename}_validated`} defaultFormat="srt" />
              </div>
            </div>

            {fixedMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>To'qnashuvlar va bo'sh replikalar muvaffaqiyatli to'g'rilandi!</span>
              </div>
            )}

            {/* Issue items list */}
            {issues.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      issue.severity === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {issue.severity === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold block">{issue.message}</span>
                        <span className="text-[10px] opacity-75 font-mono">{issue.timeRange}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SubtitlePreviewTable cues={cues} onCueChange={setCues} />
        </div>
      )}
    </div>
  );
};
