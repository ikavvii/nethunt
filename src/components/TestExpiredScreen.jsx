import React from 'react';
import { 
  Hourglass, 
  Lock, 
  Trophy, 
  Layers, 
  ShieldAlert, 
  ArrowRight,
  Award,
  Clock
} from 'lucide-react';

export default function TestExpiredScreen({ 
  user, 
  currentNodeData, 
  onNavigateToLeaderboard 
}) {
  const currentStep = currentNodeData?.currentStep ?? user?.current_step ?? 0;
  const totalSteps = currentNodeData?.totalSteps ?? 20;
  const score = currentNodeData?.score ?? user?.score ?? 0;
  const violations = currentNodeData?.tabViolations ?? user?.tab_violations ?? 0;
  const totalDurationMinutes = currentNodeData?.totalDurationMinutes ?? 120;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-20 text-center">
      {/* Icon */}
      <div className="w-24 h-24 mx-auto rounded-3xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-400 flex items-center justify-center text-4xl mb-6 shadow-[0_0_40px_rgba(244,63,94,0.3)] animate-pulse">
        <Hourglass className="w-12 h-12" />
      </div>

      {/* Badge */}
      <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/40 text-rose-300 font-mono text-xs sm:text-sm font-bold mb-4 shadow-sm">
        <Lock className="w-4 h-4" />
        <span>[ SESSION TIME EXPIRED // SUBMISSIONS LOCKED ]</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono font-black text-white mb-4 tracking-tight">
        NETHUNT TEST <span className="text-rose-400">CONCLUDED</span>
      </h1>

      {/* Description */}
      <p className="text-slate-300 font-mono text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
        Your allocated <strong className="text-white">{totalDurationMinutes}-minute</strong> session window has expired. 
        In accordance with competition rules, submissions are strictly locked. Your final verified score has been permanently recorded.
      </p>

      {/* Score Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto mb-10">
        <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900/80">
          <div className="flex items-center justify-center space-x-1.5 text-cyan-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="font-mono text-xs text-slate-400">FINAL SCORE</span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-300">
            {score.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-slate-500">POINTS</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900/80">
          <div className="flex items-center justify-center space-x-1.5 text-emerald-400 mb-1">
            <Layers className="w-4 h-4" />
            <span className="font-mono text-xs text-slate-400">PROGRESS</span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-300">
            {currentStep}<span className="text-sm font-normal text-slate-500">/{totalSteps}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500">NODES CLEARED</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900/80">
          <div className="flex items-center justify-center space-x-1.5 text-amber-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-xs text-slate-400">DURATION</span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300">
            {totalDurationMinutes}m
          </div>
          <div className="text-[10px] font-mono text-slate-500">TIMED WINDOW</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-700 bg-slate-900/80">
          <div className="flex items-center justify-center space-x-1.5 text-rose-400 mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span className="font-mono text-xs text-slate-400">PROCTOR</span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-rose-300">
            {violations}
          </div>
          <div className="text-[10px] font-mono text-slate-500">INFRACTIONS</div>
        </div>
      </div>

      {/* Participant Card */}
      <div className="inline-block p-4 px-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 text-slate-300 font-mono text-xs sm:text-sm mb-10">
        <span className="text-cyan-400 font-bold">{user?.name}</span> • 
        <span className="text-slate-400"> @{user?.username}</span> • 
        <span className="text-amber-300 font-bold"> Batch {user?.batch}</span>
      </div>

      {/* CTA Button */}
      <div>
        <button
          onClick={onNavigateToLeaderboard}
          className="px-8 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black text-sm sm:text-base uppercase tracking-wider shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] transition-all inline-flex items-center space-x-3 cursor-pointer"
        >
          <Award className="w-5 h-5 stroke-[2.5]" />
          <span>[ VIEW LIVE STANDINGS // LEADERBOARD ]</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
