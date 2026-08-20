import React, { useState } from 'react';
import { Navbar, ActiveTool } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { VideoDemuxerTool } from './components/tools/VideoDemuxerTool';
import { ConverterTool } from './components/tools/ConverterTool';
import { CleanerTool } from './components/tools/CleanerTool';
import { ResyncTool } from './components/tools/ResyncTool';
import { DualSubtitleTool } from './components/tools/DualSubtitleTool';
import { JoinSplitTool } from './components/tools/JoinSplitTool';
import { EditorPlayerTool } from './components/tools/EditorPlayerTool';
import { TranslatorHelperTool } from './components/tools/TranslatorHelperTool';
import { ValidatorTool } from './components/tools/ValidatorTool';

export const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ActiveTool>('demuxer');

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar activeTool={activeTool} setActiveTool={setActiveTool} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTool === 'demuxer' && <VideoDemuxerTool />}
        {activeTool === 'converter' && <ConverterTool />}
        {activeTool === 'cleaner' && <CleanerTool />}
        {activeTool === 'resync' && <ResyncTool />}
        {activeTool === 'dual' && <DualSubtitleTool />}
        {activeTool === 'joinsplit' && <JoinSplitTool />}
        {activeTool === 'editor' && <EditorPlayerTool />}
        {activeTool === 'translator' && <TranslatorHelperTool />}
        {activeTool === 'validator' && <ValidatorTool />}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
