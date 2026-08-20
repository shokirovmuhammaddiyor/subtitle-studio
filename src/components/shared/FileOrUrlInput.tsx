import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, FileVideo, Globe, AlertCircle } from 'lucide-react';
import { CORS_PROXIES } from '../../lib/corsProxy';

interface FileOrUrlInputProps {
  mode: 'video' | 'subtitle' | 'both';
  onFileSelect: (file: File) => void;
  onUrlSubmit: (url: string, proxyId: string, customProxy?: string) => void;
  isLoading?: boolean;
  acceptedExtensions?: string;
  placeholderUrl?: string;
}

export const FileOrUrlInput: React.FC<FileOrUrlInputProps> = ({
  mode,
  onFileSelect,
  onUrlSubmit,
  isLoading = false,
  acceptedExtensions = mode === 'video' ? '.mkv,.mp4,.webm,.mov,.avi' : '.srt,.vtt,.ass,.ssa,.lrc,.smi,.json,.txt',
  placeholderUrl = mode === 'video'
    ? 'https://example.com/video.mkv yoki Seedr / Direct video havolasi'
    : 'https://example.com/subtitles.srt yoki havola'
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [proxyId, setProxyId] = useState('direct');
  const [customProxy, setCustomProxy] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onUrlSubmit(inputUrl.trim(), proxyId, customProxy.trim());
    }
  };

  const setSampleUrl = (sample: string, proxy: string = 'corsproxy_io') => {
    setInputUrl(sample);
    setProxyId(proxy);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'url'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Havola orqali (URL / Seedr)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Lokal fayl (Drag & Drop)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
          <FileVideo className="w-4 h-4 text-indigo-400" />
          <span>Faqat bir necha KB yuklanadi</span>
        </div>
      </div>

      {activeTab === 'url' ? (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              To'g'ridan-to'g'ri Media Havolasi (MKV, MP4, Seedr, Google Drive, WebM):
            </label>
            <div className="relative">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={placeholderUrl}
                required
                className="w-full pl-10 pr-28 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <button
                type="submit"
                disabled={isLoading || !inputUrl.trim()}
                className="absolute right-2 top-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30"
              >
                {isLoading ? 'Yuklanmoqda...' : 'Ajratib olish'}
              </button>
            </div>
          </div>

          {/* CORS Proxy & Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                CORS Bypass Rejimi:
              </label>
              <select
                value={proxyId}
                onChange={(e) => setProxyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {CORS_PROXIES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Maxsus CORS Proxy URL...</option>
              </select>
            </div>

            {proxyId === 'custom' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Maxsus Proxy URL ({'{url}'} bilan):
                </label>
                <input
                  type="text"
                  value={customProxy}
                  onChange={(e) => setCustomProxy(e.target.value)}
                  placeholder="https://my-proxy.com/{url}"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <span className="text-[11px] text-slate-400 mr-2">Namuna havolalar:</span>
              <button
                type="button"
                onClick={() => setSampleUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'direct')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline mr-3"
              >
                MP4 Namuna (Big Buck Bunny)
              </button>
              <button
                type="button"
                onClick={() => setSampleUrl('https://raw.githubusercontent.com/ietf-wg-cellar/matroska-test-files/master/test_files/test1.mkv', 'corsproxy_io')}
                className="text-[11px] text-purple-400 hover:text-purple-300 underline"
              >
                MKV Namuna (Matroska Test)
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>Eslatma:</strong> Seedr yoki boshqa CDN havolalarida agar to'g'ridan-to'g'ri o'qishda xatolik bersa, CORS Proxy rejimini <strong>CORSProxy.io</strong> yoki <strong>AllOrigins</strong> ga o'tkazing.
            </span>
          </div>
        </form>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-900/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={acceptedExtensions}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-200">
            Faylni bu yerga sudrab tashlang yoki tanlang
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Qo'llab-quvvatlanadi: <span className="font-mono text-indigo-300">{acceptedExtensions}</span>
          </p>
          <p className="text-[11px] text-emerald-400 mt-2">
            ⚡ 100 GB gacha bo'lgan fayllarni ham xotirani band qilmasdan bir zumda o'qiydi (File.slice)
          </p>
        </div>
      )}
    </div>
  );
};
