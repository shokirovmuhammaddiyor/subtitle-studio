import React from 'react';
import { ShieldCheck, Cpu, HardDriveDownload, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-[#0B0F19]/50 py-8 px-4 sm:px-6 lg:px-8 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Maxfiylik (Fayllar serverga yuborilmaydi)</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1.5 text-slate-300">
            <HardDriveDownload className="w-4 h-4 text-indigo-400" />
            <span>HTTP Range Slicing</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5 text-slate-300">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Client-side Web Demuxer</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>Subtitle Studio Pro &bull; Vite & GitHub Pages</span>
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 inline" />
        </div>
      </div>
    </footer>
  );
};
