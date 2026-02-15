
import React from 'react';
import { AppState } from '../types';
import { Layout, Maximize, FileText, Globe, Check } from 'lucide-react';

interface SetupModalProps {
    onComplete: (mode: AppState['sheetMode']) => void;
    theme: 'dark' | 'light';
}

export const SetupModal: React.FC<SetupModalProps> = ({ onComplete, theme }) => {
    const options: { id: AppState['sheetMode']; label: string; sub: string; icon: any }[] = [
        { id: 'infinite', label: 'Infinite Canvas', sub: 'Boundary-less drafting area', icon: Globe },
        { id: 'A4_PORTRAIT', label: 'A4 Portrait', sub: '210 x 297 mm', icon: FileText },
        { id: 'A4_LANDSCAPE', label: 'A4 Landscape', sub: '297 x 210 mm', icon: Layout },
        { id: 'A6_PORTRAIT', label: 'A6 Portrait', sub: '105 x 148 mm', icon: FileText },
        { id: 'A6_LANDSCAPE', label: 'A6 Landscape', sub: '148 x 105 mm', icon: Layout },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-500">
            <div className={`w-full max-w-2xl p-8 rounded-[2rem] border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-700 ${theme === 'dark' ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>

                <div className="text-center mb-10">
                    <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-4">
                        <Maximize size={24} strokeWidth={2.5} />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-2 bg-gradient-to-br from-slate-100 to-slate-400 bg-clip-text text-transparent">Project Initialization</h1>
                    <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">Select your drafting standard to begin</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => onComplete(opt.id)}
                            className={`group flex items-start space-x-4 p-5 rounded-2xl border transition-all duration-300 ${theme === 'dark'
                                ? 'bg-slate-950/20 border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5'
                                : 'bg-white border-slate-100 hover:border-blue-500/50 hover:bg-blue-50/50'}`}
                        >
                            <div className={`p-3 rounded-xl transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-400' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-500 group-hover:text-white'}`}>
                                <opt.icon size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-sm mb-0.5 tracking-tight group-hover:text-blue-400 transition-colors">{opt.label}</h3>
                                <p className="text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-widest opacity-60">{opt.sub}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-center space-x-4 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                    <span className="w-8 h-px bg-current" />
                    <span>SurveyDraw Core v2.0</span>
                    <span className="w-8 h-px bg-current" />
                </div>
            </div>
        </div>
    );
};
