import React, { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Palette, Check, X, Sparkles, Monitor, Terminal } from 'lucide-react';

export default function ThemeSelectorModal({ isOpen, onClose }) {
  const { theme, setTheme, themes } = useTheme();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto theme-bg-card border-2 theme-border rounded-2xl shadow-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b theme-border">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl theme-bg-surface border theme-border">
              <Palette className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold font-mono theme-text-primary tracking-wide">
                  [ TERMINAL_MATRIX // THEME_GRID ]
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  6 PROTOCOLS
                </span>
              </div>
              <p className="text-xs font-mono theme-text-secondary mt-0.5">
                Select visual terminal display protocol &bull; Real-time palette preview &amp; CRT render engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-surface transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {themes.map((t) => {
            const isSelected = theme === t.id;

            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`group relative rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-400 theme-bg-surface shadow-[0_0_20px_rgba(0,240,255,0.25)] ring-1 ring-cyan-400/50'
                    : 'theme-border hover:border-slate-500 hover:theme-bg-surface/60'
                }`}
              >
                {/* Top bar: Icon, Name, Active Badge */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl" role="img" aria-label={t.name}>{t.icon}</span>
                      <div>
                        <h3 className="text-sm font-bold font-mono theme-text-primary group-hover:text-cyan-400 transition-colors">
                          {t.name}
                        </h3>
                        <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-400">
                          {t.tag}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>ACTIVE</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border border-slate-700 text-slate-400 group-hover:border-cyan-500/50 group-hover:text-cyan-300 transition-colors">
                        {t.mode === 'dark' ? 'DARK CRT' : 'DAY OPS'}
                      </span>
                    )}
                  </div>

                  {/* Live Mini Terminal Preview Box */}
                  <div 
                    className="mt-3 rounded-lg border p-2.5 font-mono text-[11px] select-none transition-all shadow-inner"
                    style={{
                      backgroundColor: t.id === 'tactical' ? '#0a0f1d' : t.bg,
                      borderColor: t.color + '55',
                      boxShadow: `inset 0 0 15px rgba(0,0,0,0.8), 0 0 10px ${t.color}22`
                    }}
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px]">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500/80 inline-block"></span>
                        <span className="w-2 h-2 rounded-full bg-amber-500/80 inline-block"></span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block"></span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                        {t.id}.sh
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-slate-400">
                        <span style={{ color: t.color }}>&gt;_</span>
                        <span>LOGIN_2026 --node=01</span>
                      </div>
                      <div className="truncate font-semibold" style={{ color: t.color }}>
                        PAYLOAD: DECRYPT_VERIFIED
                      </div>
                      <div className="text-[10px] text-slate-500">
                        STATUS: 20 NODES ONLINE
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] font-mono theme-text-secondary mt-2.5 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                {/* Bottom Color Swatches */}
                <div className="mt-3 pt-2.5 border-t theme-border flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: t.color }}
                      title={`Primary Accent: ${t.color}`}
                    />
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: t.bg }}
                      title={`Page Canvas: ${t.bg}`}
                    />
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: t.cardBg }}
                      title={`Card Surface: ${t.cardBg}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTheme(t.id);
                    }}
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded transition-all ${
                      isSelected
                        ? 'text-cyan-400 font-extrabold'
                        : 'theme-text-muted group-hover:text-cyan-300'
                    }`}
                  >
                    {isSelected ? '[ SELECTED ]' : '[ APPLY ]'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info & confirm action */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t theme-border gap-3 font-mono text-xs">
          <div className="flex items-center space-x-2 theme-text-secondary">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>Theme applies instantly across Hunt Arena, Code CRT, Standings, and Admin Console.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-xs shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all uppercase tracking-wider cursor-pointer"
          >
            CONFIRM_SELECTION
          </button>
        </div>
      </div>
    </div>
  );
}
