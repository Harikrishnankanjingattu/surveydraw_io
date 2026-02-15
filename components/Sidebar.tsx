
import React from 'react';
import { Triangle, AppState, Point } from '../types';
import { Trash2, Layers, Box, MapPin, Download, Edit3 } from 'lucide-react';

interface SidebarProps {
  state: AppState;
  updateState: (updater: (s: AppState) => AppState) => void;
  onRotate: (id: string) => void;
  isVisible: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, updateState, onRotate, isVisible, onToggle }) => {
  const { triangles, points, theme } = state;

  const handleDeleteTriangle = (id: string) => {
    updateState(s => ({
      ...s,
      triangles: s.triangles.filter(t => t.id !== id),
      selection: s.selection.id === id ? { type: null, id: null } : s.selection
    }));
  };

  const handleDeletePoint = (id: string) => {
    updateState(s => ({
      ...s,
      points: s.points.filter(p => p.id !== id),
      lines: s.lines.filter(l => l.p1 !== id && l.p2 !== id),
      triangles: s.triangles.filter(t => !t.points.includes(id)),
      selection: s.selection.id === id ? { type: null, id: null } : s.selection
    }));
  };

  const handleUpdateTriangle = (id: string, updates: Partial<Triangle>) => {
    updateState(s => ({
      ...s,
      triangles: s.triangles.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const handleUpdatePoint = (id: string, updates: Partial<Point>) => {
    updateState(s => ({
      ...s,
      points: s.points.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  return (
    <div className={`
      fixed lg:relative
      ${isVisible ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      top-0 left-0 w-80 h-full lg:h-[calc(100vh-100px)] lg:m-4
      flex flex-col z-[100] lg:z-40 transition-all duration-500
      rounded-none lg:rounded-3xl border-r lg:border
      backdrop-blur-2xl shadow-[20px_0_50px_rgba(0,0,0,0.3)] lg:shadow-[0_20px_50px_rgba(0,0,0,0.3)]
      overflow-hidden
      ${theme === 'dark' ? 'bg-slate-900/90 border-white/10' : 'bg-white/80 border-slate-200'}
    `}>
      {/* Mobile Close Button */}
      <div className="lg:hidden flex justify-end p-4">
        <button onClick={onToggle} className="p-2 text-slate-500 hover:text-white transition-colors">
          <Trash2 size={24} className="rotate-45" /> {/* Using Trash as an 'X' via rotation for speed */}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">

        {/* Survey Plots Header */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Layers size={14} strokeWidth={2.5} />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Survey Plots</h2>
            </div>
            <span className="text-[10px] font-bold mono bg-slate-950/20 px-2.5 py-1 rounded-full">{triangles.length}</span>
          </div>

          <div className="space-y-4">
            {triangles.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-40 bg-slate-950/5">
                <Box size={20} className="mx-auto mb-2.5 opacity-20" />
                <p className="text-[10px] font-bold tracking-tight px-4 leading-relaxed uppercase opacity-60">No plots defined</p>
              </div>
            ) : (
              triangles.map(t => (
                <div
                  key={t.id}
                  className={`group p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${state.selection.id === t.id
                    ? 'bg-blue-600/10 border-blue-500/40 shadow-xl'
                    : 'bg-slate-950/10 border-white/5 hover:border-white/10 hover:bg-slate-950/20'}`}
                  onClick={() => updateState(s => ({ ...s, selection: { type: 'TRIANGLE', id: t.id } }), false)}
                >
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <div className="flex items-center space-x-2 flex-1">
                      <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]" style={{ backgroundColor: t.fillColor }} />
                      <input
                        className="bg-transparent border-none outline-none font-black text-xs w-full focus:text-blue-400 transition-colors uppercase tracking-tight"
                        value={t.name}
                        onChange={(e) => handleUpdateTriangle(t.id, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRotate(t.id); }}
                        className="text-slate-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Rotate Plot"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTriangle(t.id); }} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between relative z-10">
                    <div>
                      <span className="text-lg font-black mono text-blue-500 tracking-tighter">{t.area.toFixed(2)}</span>
                      <span className="text-[9px] font-bold text-slate-500 ml-1">m²</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                      <input
                        type="color"
                        value={t.fillColor}
                        onChange={(e) => handleUpdateTriangle(t.id, { fillColor: e.target.value })}
                        className="w-5 h-5 rounded-lg border-none cursor-pointer p-0 bg-transparent"
                      />
                      <div className="w-px h-3 bg-white/10" />
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={t.opacity}
                        onChange={(e) => handleUpdateTriangle(t.id, { opacity: parseFloat(e.target.value) })}
                        className="w-12 h-1 bg-blue-500/20 rounded-full appearance-none cursor-pointer accent-blue-500 scale-90"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Reference Points Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <MapPin size={14} strokeWidth={2.5} />
              </div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Reference Grid</h2>
            </div>
            <span className="text-[10px] font-bold mono bg-slate-950/20 px-2.5 py-1 rounded-full">{points.length}</span>
          </div>

          <div className="space-y-2">
            {points.length === 0 ? (
              <div className="py-6 text-center opacity-40 border-2 border-dashed border-white/5 rounded-2xl bg-slate-950/5">
                <p className="text-[9px] font-bold tracking-widest uppercase opacity-40 leading-relaxed px-4">No reference data found</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {points.map(p => (
                  <div
                    key={p.id}
                    className={`group p-2.5 rounded-xl border flex items-center justify-between transition-all duration-200 cursor-pointer ${state.selection.id === p.id
                      ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                      : 'bg-slate-950/5 border-white/5 hover:bg-slate-950/10 hover:border-white/10'}`}
                    onClick={() => updateState(s => ({ ...s, selection: { type: 'POINT', id: p.id } }), false)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <input
                        type="color"
                        value={p.color}
                        onChange={(e) => handleUpdatePoint(p.id, { color: e.target.value })}
                        className="w-4 h-4 rounded-full border-none cursor-pointer bg-transparent"
                      />
                      <input
                        className="bg-transparent border-none outline-none font-bold text-[10px] uppercase w-full focus:text-emerald-400 transition-colors tracking-wide"
                        value={p.label}
                        onChange={(e) => handleUpdatePoint(p.id, { label: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center space-x-3 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-black mono text-emerald-500/80 tracking-tighter bg-black/20 px-1.5 py-0.5 rounded-md">
                        {p.x.toFixed(1)},{p.y.toFixed(1)}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeletePoint(p.id); }} className="text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Persistence Controls */}
      <div className={`p-6 border-t shadow-[0_-10px_20px_rgba(0,0,0,0.1)] ${theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => {
              const data = JSON.stringify(state);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `survey-${Date.now()}.json`;
              a.click();
            }}
            className="flex flex-col items-center justify-center p-3 space-y-2 bg-slate-950 text-white rounded-2xl hover:bg-blue-600 transition-all active:scale-95 group border border-white/5"
          >
            <Download size={16} className="text-blue-500 group-hover:text-white transition-colors" />
            <span className="text-[9px] font-black tracking-widest uppercase opacity-80 group-hover:opacity-100">Store DB</span>
          </button>

          <label className="flex flex-col items-center justify-center p-3 space-y-2 bg-slate-800 text-white rounded-2xl hover:bg-slate-700 transition-all active:scale-95 group border border-white/5 cursor-pointer">
            <Edit3 size={16} className="text-slate-400 group-hover:text-white transition-colors" />
            <span className="text-[9px] font-black tracking-widest uppercase opacity-80 group-hover:opacity-100">Import Data</span>
            <input
              type="file"
              className="hidden"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (re) => {
                    try {
                      const loaded = JSON.parse(re.target?.result as string);
                      updateState(() => ({ ...loaded, selection: { type: null, id: null } }));
                    } catch (err) { alert('Invalid dataset format'); }
                  };
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          <div className="flex flex-col">
            <span className="text-[8px] opacity-40 leading-none mb-1.5">Project Aggregate</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-black text-blue-500 mono leading-none">
                {triangles.reduce((acc, t) => acc + t.area, 0).toFixed(2)}
              </span>
              <span className="text-[9px] lowercase opacity-60">m²</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mb-1 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[8px] opacity-40">System Core v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
