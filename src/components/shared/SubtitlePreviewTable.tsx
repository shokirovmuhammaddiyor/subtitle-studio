import React, { useState, useMemo } from 'react';
import { Search, Edit2, Check, X, Clock } from 'lucide-react';
import { SubtitleCue } from '../../types/subtitle';
import { formatTimeSrt } from '../../lib/parsers/srtParser';

interface SubtitlePreviewTableProps {
  cues: SubtitleCue[];
  onCueChange?: (updatedCues: SubtitleCue[]) => void;
  onJumpToTime?: (timeSec: number) => void;
  maxDisplay?: number;
}

export const SubtitlePreviewTable: React.FC<SubtitlePreviewTableProps> = ({
  cues,
  onCueChange,
  onJumpToTime,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filteredCues = useMemo(() => {
    if (!searchQuery.trim()) return cues;
    const q = searchQuery.toLowerCase();
    return cues.filter(
      c =>
        c.text.toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        formatTimeSrt(c.startTime).includes(q)
    );
  }, [cues, searchQuery]);

  const totalPages = Math.ceil(filteredCues.length / pageSize) || 1;
  const paginatedCues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCues.slice(start, start + pageSize);
  }, [filteredCues, currentPage, pageSize]);

  const handleStartEdit = (cue: SubtitleCue) => {
    setEditingId(cue.id);
    setEditText(cue.text);
  };

  const handleSaveEdit = (cueId: number) => {
    if (!onCueChange) return;
    const updated = cues.map(c => (c.id === cueId ? { ...c, text: editText } : c));
    onCueChange(updated);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Jami replikalar soni: <strong className="text-white">{cues.length}</strong> ta</span>
          {searchQuery && (
            <span className="text-slate-400 font-normal">
              (Qidiruv natijasi: {filteredCues.length})
            </span>
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Matn yoki vaqt bo'yicha qidirish..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto max-h-[450px] overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center">#</th>
              <th className="py-2.5 px-3 w-32">Boshlanish</th>
              <th className="py-2.5 px-3 w-32">Tugash</th>
              <th className="py-2.5 px-3 w-20">Davomiylik</th>
              <th className="py-2.5 px-4">Subtitr Matni</th>
              <th className="py-2.5 px-3 w-16 text-center">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {paginatedCues.map((cue) => {
              const isEditing = editingId === cue.id;
              const duration = (cue.endTime - cue.startTime).toFixed(2);

              return (
                <tr
                  key={cue.id}
                  className="hover:bg-slate-900/60 transition group cursor-pointer"
                  onClick={() => onJumpToTime && onJumpToTime(cue.startTime)}
                >
                  <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                    {cue.id}
                  </td>
                  <td className="py-2.5 px-3 text-indigo-300 font-mono whitespace-nowrap">
                    {formatTimeSrt(cue.startTime)}
                  </td>
                  <td className="py-2.5 px-3 text-indigo-300 font-mono whitespace-nowrap">
                    {formatTimeSrt(cue.endTime)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap text-[11px]">
                    {duration}s
                  </td>
                  <td className="py-2.5 px-4 text-slate-200" onClick={(e) => isEditing && e.stopPropagation()}>
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-indigo-500 rounded text-xs text-white focus:outline-none"
                        rows={2}
                        autoFocus
                      />
                    ) : (
                      <div className="whitespace-pre-line leading-relaxed">
                        {cue.text}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleSaveEdit(cue.id)}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                          title="Saqlash"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-rose-400 hover:bg-rose-500/20 rounded"
                          title="Bekor qilish"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(cue)}
                        className="p-1 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition rounded hover:bg-slate-800"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {paginatedCues.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                  Hech qanday replika topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
          <div>
            Sahifa <strong className="text-white">{currentPage}</strong> / {totalPages}
          </div>
          <div className="flex space-x-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-300 disabled:opacity-40"
            >
              Oldingi
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-300 disabled:opacity-40"
            >
              Keyingi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
