import React from 'react';
import {
  Film,
  RefreshCw,
  Sparkles,
  Clock,
  Layers,
  Scissors,
  PlaySquare,
  Languages,
  CheckCircle2,
  Github,
  Zap
} from 'lucide-react';

export type ActiveTool =
  | 'demuxer'
  | 'converter'
  | 'cleaner'
  | 'resync'
  | 'dual'
  | 'joinsplit'
  | 'editor'
  | 'translator'
  | 'validator';

interface NavbarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTool, setActiveTool }) => {
  const tools: { id: ActiveTool; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'demuxer', label: 'Video to Subtitle', icon: <Film className="w-4 h-4" />, badge: 'Range 99.9%' },
    { id: 'converter', label: 'Converter', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'cleaner', label: 'Cleaner & Tags', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'resync', label: 'Time & FPS Sync', icon: <Clock className="w-4 h-4" /> },
    { id: 'dual', label: 'Dual Subtitles', icon: <Layers className="w-4 h-4" /> },
    { id: 'joinsplit', label: 'Join & Split', icon: <Scissors className="w-4 h-4" /> },
    { id: 'editor', label: 'Player & Editor', icon: <PlaySquare className="w-4 h-4" /> },
    { id: 'translator', label: 'AI Translator', icon: <Languages className="w-4 h-4" /> },
    { id: 'validator', label: 'Validator', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTool('demuxer')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                  Subtitle Studio
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">100% Client-Side Subtitle Suite</p>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GitHub Pages Ready</span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="GitHub Repository"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60 -mx-4 px-4 sm:mx-0 sm:px-0">
          {tools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                {tool.icon}
                <span>{tool.label}</span>
                {tool.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-900/50 text-indigo-300'
                  }`}>
                    {tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
