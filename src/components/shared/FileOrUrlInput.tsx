import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, FileVideo, Globe, AlertCircle, HelpCircle, Copy, Check, ExternalLink } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  const [inputUrl, setInputUrl] = useState('');
  const [proxyId, setProxyId] = useState('direct');
  const [customProxy, setCustomProxy] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [copiedWorker, setCopiedWorker] = useState(false);

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

  const workerCode = `export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Expose-Headers": "*",
        },
      });
    }
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url") || url.pathname.slice(1);
    if (!targetUrl) return new Response("Missing url param", { status: 400 });

    const newHeaders = new Headers(request.headers);
    newHeaders.delete("host");
    newHeaders.delete("origin");
    newHeaders.delete("referer");

    const response = await fetch(targetUrl, { method: request.method, headers: newHeaders });
    const respHeaders = new Headers(response.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");
    respHeaders.set("Access-Control-Expose-Headers", "*");

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: respHeaders });
  },
};`;

  const copyWorkerCode = () => {
    navigator.clipboard.writeText(workerCode);
    setCopiedWorker(true);
    setTimeout(() => setCopiedWorker(false), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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

        <button
          type="button"
          onClick={() => setShowCorsHelp(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">CORS & Proxy Yechimlari</span>
        </button>
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

          {/* CORS Proxy & Custom Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ulanish Usuli (CORS Rejimi):
              </label>
              <select
                value={proxyId}
                onChange={(e) => setProxyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {CORS_PROXIES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="custom">Maxsus Cloudflare Worker / Proxy URL...</option>
              </select>
            </div>

            {proxyId === 'custom' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Maxsus Worker URL ({'{url}'} yoki ?url=):
                </label>
                <input
                  type="text"
                  value={customProxy}
                  onChange={(e) => setCustomProxy(e.target.value)}
                  placeholder="https://my-worker.workers.dev/?url={url}"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
            )}
          </div>

          <div className="flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>
                <strong>Seedr va Direct havolalar uchun maslahat:</strong> Agar havolangiz CORS sababli bloklansa, brauzeringizga <strong>"Allow CORS"</strong> kengaytmasini o'rnating yoki <strong>"CORS & Proxy Yechimlari"</strong> tugmasidan 100% bepul shaxsiy Cloudflare Worker ulab oling.
              </span>
            </div>
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

      {/* CORS Help Modal */}
      {showCorsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>CORS Xatoligini Yechish Bo'yicha Qo'llanma</span>
              </h3>
              <button
                onClick={() => setShowCorsHelp(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-lg"
              >
                Yopish
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-1">
                <p className="font-bold text-indigo-300">1-Usul: Bepul Cloudflare Worker (100% Barqaror va Cheksiz Tezlik)</p>
                <p className="text-slate-400">
                  Cloudflare'da bepul 100,000 so'rov/kunlik Worker ochib, quyidagi kodni qo'yishingiz mumkin:
                </p>
                <div className="relative mt-2">
                  <pre className="p-3 bg-black/80 rounded-lg text-[10px] font-mono text-emerald-400 overflow-x-auto">
                    {workerCode}
                  </pre>
                  <button
                    onClick={copyWorkerCode}
                    className="absolute right-2 top-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] flex items-center space-x-1"
                  >
                    {copiedWorker ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWorker ? 'Nusxalandi!' : 'Kodni nusxalash'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1">
                <p className="font-bold text-slate-200">2-Usul: "Allow CORS" Brauzer Kengaytmasi</p>
                <p className="text-slate-400">
                  Chrome, Brave yoki Firefox do'konidan <strong>"Allow CORS: Access-Control-Allow-Origin"</strong> kengaytmasini yoqsangiz, hech qanday proksisiz to'g'ridan-to'g'ri Seedr serveridan maksimal tezlikda o'qiydi.
                </p>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1">
                <p className="font-bold text-slate-200">3-Usul: Lokal Fayl (Drag & Drop)</p>
                <p className="text-slate-400">
                  Faylni kompyuteringizdan Drag & Drop qilsangiz, internet va CORS ga umuman bog'liq bo'lmagan holda 0.1 soniyada barcha subtitrlarni ajratib beradi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
