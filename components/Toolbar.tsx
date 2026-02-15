import React from 'react';
import {
  MousePointer2,
  Dot,
  Slash,
  Triangle as TriangleIcon,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Grid3x3,
  Sun,
  Moon,
  Hand,
  Download,
  Eraser,
  Magnet,
  RotateCcw,
  Type
} from 'lucide-react';
import { Tool } from '../types';

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onExport: () => void;
  onGlobalRotate: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool, setActiveTool, onUndo, onRedo, canUndo, canRedo,
  onClear, onZoomIn, onZoomOut, gridVisible, onToggleGrid,
  snapToGrid, onToggleSnap, theme, onToggleTheme, onExport,
  onGlobalRotate
}) => {
  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'SELECT', icon: MousePointer2, label: 'Select Tool' },
    { id: 'PAN', icon: Hand, label: 'Pan Tool' },
    { id: 'POINT', icon: Dot, label: 'Create Point' },
    { id: 'LINE', icon: Slash, label: 'Draw Line' },
    { id: 'TRIANGLE', icon: TriangleIcon, label: 'Create Triangle' },
    { id: 'HARITRIANGLE', icon: TriangleIcon, label: 'HariTriangle (SSS)' },
    { id: 'TEXT', icon: Type, label: 'Title / Text Label' },
    { id: 'ERASER', icon: Eraser, label: 'Eraser Tool' },
  ];

  const btnClass = "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center relative group";
  const activeBtnClass = theme === 'dark'
    ? "bg-blue-600/20 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.2)] border border-blue-500/30 scale-105"
    : "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105";
  const inactiveBtnClass = theme === 'dark'
    ? "hover:bg-slate-800/50 text-slate-400 hover:text-slate-100"
    : "hover:bg-slate-100 text-slate-500 hover:text-slate-900";

  return (
    <div className={`
      fixed lg:sticky top-auto lg:top-0 bottom-0 lg:bottom-auto w-full
      px-4 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row items-center justify-between border-t lg:border-t-0 lg:border-b
      backdrop-blur-md z-[110] transition-all duration-500
      ${theme === 'dark' ? 'bg-slate-900/80 border-white/5' : 'bg-white/80 border-slate-200'}
    `}>
      <div className="flex items-center justify-between w-full lg:w-auto mb-2 lg:mb-0">
        <div className="flex flex-col mr-4 sm:mr-8 group cursor-default">
          <span className="font-black text-2xl leading-none tracking-tighter bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent group-hover:filter group-hover:brightness-110 transition-all duration-500">
            SurveyDraw
          </span>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="text-[8px] uppercase tracking-[0.3em] text-slate-500 font-bold">Scientific Edition</span>
          </div>
        </div>

        <div className="flex lg:hidden items-center space-x-1">
          <button onClick={onToggleTheme} className={`${btnClass} ${inactiveBtnClass}`}>
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
          </button>
          <button onClick={onExport} className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all">
            <Download size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-1 w-full lg:w-auto overflow-x-auto no-scrollbar py-1">
        <div className="h-10 w-px bg-slate-700/30 mx-2 hidden lg:block" />

        <div className="flex items-center space-x-1 p-1 bg-slate-950/10 dark:bg-black/20 rounded-2xl border border-white/5 shrink-0">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`${btnClass} ${activeTool === tool.id ? activeBtnClass : inactiveBtnClass}`}
            >
              <tool.icon size={20} strokeWidth={activeTool === tool.id ? 2.5 : 2} />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none z-[100] shadow-2xl border border-white/10 translate-y-2 group-hover:translate-y-0 hidden lg:block">
                {tool.label}
              </div>
            </button>
          ))}
        </div>

        <div className="h-10 w-px bg-slate-700/30 mx-2 shrink-0" />

        <div className="flex items-center space-x-1 shrink-0 mr-4">
          <button onClick={onUndo} disabled={!canUndo} className={`${btnClass} ${inactiveBtnClass} disabled:opacity-10 disabled:grayscale`}>
            <Undo2 size={18} />
          </button>
          <button onClick={onClear} className={`${btnClass} hover:bg-red-500/10 text-slate-400 hover:text-red-500`}>
            <Trash2 size={18} />
          </button>
        </div>

        <div className="lg:flex items-center space-x-1 shrink-0 hidden">
          <button onClick={onToggleSnap} className={`${btnClass} ${snapToGrid ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : inactiveBtnClass}`}>
            <Magnet size={18} />
          </button>
          <button onClick={onGlobalRotate} className={`${btnClass} hover:text-amber-400 transition-colors`}>
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div className="hidden lg:flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <button onClick={onZoomOut} className={`${btnClass} ${inactiveBtnClass}`} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button onClick={onZoomIn} className={`${btnClass} ${inactiveBtnClass}`} title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-700/30 to-transparent mx-2" />

        <button onClick={onExport} className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl font-bold text-xs transition-all duration-300 shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 active:scale-95 border border-white/10">
          <Download size={16} />
          <span>EXPORT</span>
        </button>

        <button onClick={onToggleTheme} className={`${btnClass} ${inactiveBtnClass} ml-2 border border-white/5`}>
          {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-700" />}
        </button>
      </div>
    </div>
  );
};
