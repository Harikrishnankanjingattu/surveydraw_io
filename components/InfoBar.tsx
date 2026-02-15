import React from 'react';
import { Tool } from '../types';

interface InfoBarProps {
  totalArea: number;
  activeTool: Tool;
  zoom: number;
  selectedItem: { type: string | null; id: string | null };
}

export const InfoBar: React.FC<InfoBarProps> = ({ totalArea, activeTool, zoom, selectedItem }) => {
  return (
    <div className="flex items-center justify-between px-4 sm:px-10 py-3 sm:py-4 bg-slate-900/60 backdrop-blur-2xl text-[10px] text-slate-500 border-b border-white/5 font-black uppercase tracking-[0.2em] z-[60]">

      {/* Left: System Diagnostics */}
      <div className="hidden lg:flex items-center space-x-12 w-1/3">
        <div className="flex flex-col">
          <span className="text-slate-600 mb-0.5 text-[8px]">Operation Mode</span>
          <span className="text-blue-400 font-black tracking-widest">{activeTool} ENGINE</span>
        </div>
        <div className="flex flex-col border-l border-white/5 pl-8">
          <span className="text-slate-600 mb-0.5 text-[8px]">Focal Scale</span>
          <span className="mono font-bold tracking-[0.3em] text-slate-300">Z:{(zoom * 2.5).toFixed(0)}</span>
        </div>
      </div>

      {/* Center: THE HUD (Aggregate Area) */}
      <div className="flex flex-col items-center flex-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
        <div className="relative group flex flex-col items-center">
          <div className="absolute -inset-4 bg-blue-600/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 tracking-[0.5em] mb-1 opacity-70">Estate Domain</span>
          <div className="flex items-baseline space-x-2 sm:space-x-3 bg-slate-950/40 px-4 sm:px-8 py-1 rounded-full border border-white/5 shadow-inner">
            <span className="text-xl sm:text-3xl font-black text-white tracking-tighter subpixel-antialiased drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              {totalArea.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
            </span>
            <span className="text-blue-500 font-black text-[10px] sm:text-xs tracking-[0.2em]">M²</span>
          </div>
        </div>
      </div>

      {/* Right: Selection Data */}
      <div className="hidden sm:flex items-center justify-end w-1/3 overflow-hidden">
        <div className="flex flex-col items-end">
          <span className="text-slate-600 mb-0.5 text-[8px]">Target Pipeline</span>
          <span className={`${selectedItem.id ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-slate-600'} font-bold tracking-widest truncate max-w-[150px]`}>
            {selectedItem.type ? `${selectedItem.type}_STRS[${selectedItem.id}]` : 'NULL_REF'}
          </span>
        </div>
      </div>
    </div>
  );
};
