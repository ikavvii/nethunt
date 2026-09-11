import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Sun, 
  Moon, 
  LogOut, 
  LogIn, 
  Compass, 
  BarChart2, 
  Sliders
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAuth }) {
  const { user, logout, eventStatus, leaderboardVisible } = useAuth();
  const { theme, setTheme, themes } = useTheme();

  const currentThemeObj = themes.find(t => t.id === theme) || themes[0];

  return (
    <header className="sticky top-0 z-40 theme-bg-card border-b theme-border shadow-sm transition-colors">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
            {/* Logo / Crest */}
            <div 
              onClick={() => setActiveTab(user?.role === 'admin' ? 'admin' : 'hunt')}
              className="flex items-center space-x-3 cursor-pointer select-none group"
            >
              <div className="bg-white/95 p-1 rounded-lg border border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.25)] flex items-center justify-center flex-shrink-0">
                <img 
                  src="/psg_logo.png" 
                  alt="PSG College of Technology" 
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-base sm:text-lg tracking-wider theme-text-primary">
                    LOGIN<span className="text-cyan-400 font-extrabold">//2026</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                    MCA_ALUMNI
                  </span>
                </div>
                <p className="text-[10px] theme-text-muted font-mono tracking-widest uppercase">
                  PSG COLLEGE OF TECHNOLOGY • 12–18 AUG 2026
                </p>
              </div>
            </div>

            {/* Navigation Controls */}
            <nav className="flex items-center space-x-1 sm:space-x-2.5">
              {user?.role !== 'admin' && (
                <button
                  onClick={() => setActiveTab('hunt')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-mono font-bold transition-all ${
                    activeTab === 'hunt'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                      : 'theme-text-secondary hover:text-cyan-400 hover:theme-bg-surface'
                  }`}
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>[ HUNT_ARENA ]</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('standings')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-mono font-bold transition-all ${
                  activeTab === 'standings'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                    : 'theme-text-secondary hover:text-cyan-400 hover:theme-bg-surface'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span>[ STANDINGS ]</span>
                {!leaderboardVisible && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hidden md:inline">
                    FROZEN
                  </span>
                )}
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-mono font-bold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(255,176,0,0.2)]'
                      : 'theme-text-secondary hover:text-amber-400 hover:theme-bg-surface'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>[ ADMIN_SYS ]</span>
                </button>
              )}

              {eventStatus === 'paused' && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center space-x-1.5 shadow-sm ml-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>PAUSED</span>
                </span>
              )}
              {(eventStatus === 'ended' || eventStatus === 'stopped') && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center space-x-1.5 shadow-sm ml-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>ENDED</span>
                </span>
              )}
            </nav>

            {/* Right Action Tools */}
            <div className="flex items-center space-x-2.5">

            {/* Serial Radios Theme Switcher (Just Radios Only) */}
            <div 
              className="flex items-center space-x-1.5 p-1 rounded-xl theme-bg-surface border theme-border"
              role="radiogroup" 
              aria-label="Theme Selection"
            >
              {themes.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <label
                    key={t.id}
                    title={`${t.name} (${t.mode === 'light' ? 'Light Mode' : 'Dark Mode'})`}
                    className={`relative flex items-center justify-center p-1.5 rounded-lg cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-slate-900 shadow-sm ring-1 ring-cyan-400/60'
                        : 'hover:bg-slate-800/40 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme-serial-radio"
                      value={t.id}
                      checked={isSelected}
                      onChange={() => setTheme(t.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex-shrink-0 transition-all border ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 scale-110 border-white'
                          : 'border-slate-600/70 hover:scale-105'
                      }`}
                      style={{ backgroundColor: t.color }}
                    />
                  </label>
                );
              })}
            </div>

            {/* User Profile / Auth Action */}
            {user ? (
              <div className="flex items-center space-x-2">
                <div className="hidden lg:flex items-center space-x-3 border theme-border px-3.5 py-1.5 rounded-xl theme-bg-surface shadow-sm">
                  <div 
                    className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-sm font-bold theme-label-cyan flex-shrink-0 font-mono"
                    title={user.name}
                  >
                    {user.name ? user.name[0] : 'A'}
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-sm font-bold theme-text-primary leading-none">
                      {user.name}
                    </p>
                    <p className="text-xs font-mono font-bold mt-1">
                      <span className="theme-label-cyan">{user.batch}</span> // <span className="theme-metric-value">{user.score || 0} PTS</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2.5 rounded-xl border theme-border theme-text-secondary hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-sm shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all uppercase tracking-wider cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>ACCESS_GATEWAY</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
