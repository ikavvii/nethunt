import React, { useState } from 'react';
import { 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Laptop, 
  HelpCircle,
  Trophy,
  Zap,
  Lock
} from 'lucide-react';

export default function TestStartBriefing({ 
  user, 
  durationMinutes = 60, 
  onStartTest, 
  loading = false 
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const hours = Math.floor(durationMinutes / 60);
  const remainingMins = durationMinutes % 60;
  const durationText = hours > 0 
    ? `${hours} Hour${hours > 1 ? 's' : ''}${remainingMins > 0 ? ` ${remainingMins} Mins` : ''}` 
    : `${durationMinutes} Minutes`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Top Header Card */}
      <div className="relative p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/40 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-[0_0_50px_rgba(0,240,255,0.15)] mb-8 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold mb-1">
                <span>// PRE-TEST INTEGRITY BRIEFING //</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
                LOGIN'26 <span className="text-cyan-400">NETHUNT SESSION</span>
              </h1>
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs sm:text-sm font-bold flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>SESSION LIMIT: {durationText.toUpperCase()}</span>
          </div>
        </div>

        {/* Welcome message */}
        <p className="text-slate-300 font-mono text-sm sm:text-base leading-relaxed mb-6">
          Welcome, <strong className="text-cyan-300 font-bold">{user?.name || 'Alumnus'}</strong> (<span className="text-slate-400">@{user?.username || 'handle'}</span> • {user?.batch || 'PSG Tech'}). 
          You are about to initiate your official timed NetHunt session. Please carefully review the session constraints before starting.
        </p>

        {/* Grid of 4 Key Protocol Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Rule 1: Continuous Timer */}
          <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-slate-200">
            <div className="flex items-center space-x-3 mb-2 text-rose-400 font-mono font-bold text-sm">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span>1. CONTINUOUS SERVER TIMER</span>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Once started, the <strong className="text-white">{durationText}</strong> countdown runs continuously on the server. 
              Closing the browser, refreshing, or disconnecting does <strong className="text-rose-300">NOT</strong> pause or reset your timer.
            </p>
          </div>

          {/* Rule 2: 7-Day Window Availability */}
          <div className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 text-slate-200">
            <div className="flex items-center space-x-3 mb-2 text-cyan-400 font-mono font-bold text-sm">
              <Zap className="w-5 h-5 flex-shrink-0" />
              <span>2. 7-DAY EVENT WINDOW</span>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              The event is open from <strong className="text-white">11th Aug to 17th Aug 2026</strong>. You may choose any convenient time to start your {durationText} attempt within this window.
            </p>
          </div>

          {/* Rule 3: Fullscreen & Integrity */}
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 text-slate-200">
            <div className="flex items-center space-x-3 mb-2 text-amber-400 font-mono font-bold text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>3. FULLSCREEN &amp; INTEGRITY</span>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Fullscreen mode is enforced on Laptop/Desktop. Tab switches, window minimization, and direct pasting are proctor-logged for batch audit.
            </p>
          </div>

          {/* Rule 4: Progressive Hints & Scoring */}
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-slate-200">
            <div className="flex items-center space-x-3 mb-2 text-emerald-400 font-mono font-bold text-sm">
              <Trophy className="w-5 h-5 flex-shrink-0" />
              <span>4. PROGRESSIVE SCORING</span>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Each cryptic challenge starts at 1,000 base points. Progressive hint reveals deduct potential reward. Ties are resolved by fastest sub-millisecond solve time.
            </p>
          </div>
        </div>

        {/* Notice Alert */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-mono text-amber-200 leading-relaxed">
            <strong>Anti-Collusion Active:</strong> When your {durationText} expires, all puzzle submissions will be automatically and strictly locked by the server. Ensure you have a reliable internet connection before commencing.
          </div>
        </div>

        {/* Checkbox Acknowledgment */}
        <label className="flex items-start space-x-3 p-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800/90 cursor-pointer transition-all mb-8">
          <input 
            type="checkbox" 
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
          />
          <span className="text-xs sm:text-sm font-mono text-slate-200 leading-relaxed select-none">
            I confirm that I am in a focused environment on a laptop or desktop computer. I understand that once initialized, my <strong>{durationText} timer will start immediately</strong> and cannot be paused or restarted.
          </span>
        </label>

        {/* Start Button */}
        <button
          onClick={onStartTest}
          disabled={!acknowledged || loading}
          className={`w-full py-5 rounded-2xl font-mono font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center space-x-3 transition-all ${
            acknowledged && !loading
              ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] cursor-pointer hover:scale-[1.01]'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
          }`}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>INITIALIZING SECURE SESSION...</span>
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 stroke-[2.5]" />
              <span>[ INITIALIZE SESSION // START {durationText.toUpperCase()} TEST ]</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
