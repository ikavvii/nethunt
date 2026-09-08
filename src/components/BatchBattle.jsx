import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, Trophy, Users, Zap, Crown, Award, ChevronRight } from 'lucide-react';

export default function BatchBattle() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leaderboard/batches');
      const json = await res.json();
      setBatches(json.batches || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 20000);
    return () => clearInterval(interval);
  }, []);

  const highestScore = batches[0]?.totalScore || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Hero Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-rose-950/60 to-amber-950/60 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-mono font-bold text-rose-300">
          <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>ALUMNI PRIDE RIVALRY</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Battle of the Batches
        </h1>
        <p className="text-slate-300 text-sm leading-relaxed">
          Which MCA batch has the sharpest cryptic hunters? Points are pooled across all registered alumni of each graduating year. Represent your batch with pride!
        </p>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {batches.slice(0, 3).map((b, idx) => {
          const isWinner = idx === 0;
          const isSecond = idx === 1;
          const isThird = idx === 2;
          const medals = ['1ST PLACE', '2ND PLACE', '3RD PLACE'];
          const colors = [
            'from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/50 shadow-amber-500/10',
            'from-slate-400/20 via-slate-500/10 to-transparent border-slate-400/50 shadow-slate-500/10',
            'from-amber-700/20 via-amber-800/10 to-transparent border-amber-700/50 shadow-amber-700/10',
          ];

          return (
            <div 
              key={b.batch} 
              className={`glass-panel p-6 rounded-2xl border bg-gradient-to-b ${colors[idx]} shadow-xl relative overflow-hidden flex flex-col justify-between`}
            >
              {isWinner && (
                <div className="absolute top-3 right-3 text-amber-400 animate-bounce">
                  <Crown className="w-6 h-6" />
                </div>
              )}

              <div>
                <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  {medals[idx]}
                </span>
                <h3 className="text-2xl font-black text-white mt-1">
                  {b.batch}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  PSG Tech MCA • {b.batch}
                </p>

                <div className="my-6 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Total Pooled Points</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      {b.totalScore.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Active Solvers</span>
                    <span className="font-bold text-white font-mono">{b.totalParticipants} Alumni</span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Average Level Cleared</span>
                    <span className="font-bold text-cyan-400 font-mono">Level {b.avgLevel}</span>
                  </div>
                </div>
              </div>

              {/* Batch MVP Box */}
              {b.mvp && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-[10px] font-bold font-mono">
                      {b.mvp.name ? b.mvp.name[0] : 'A'}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">Batch MVP</p>
                      <p className="font-bold text-white leading-none">{b.mvp.name}</p>
                    </div>
                  </div>
                  <span className="text-amber-400 font-mono font-bold">{b.mvp.score} pts</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full Batches Table & Progress Bars */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 font-mono uppercase tracking-wider">
          All Participating Batches Standing
        </h3>

        <div className="space-y-4">
          {batches.map((b) => {
            const isMyBatch = user?.batch === b.batch;
            const percentage = Math.round((b.totalScore / highestScore) * 100);

            return (
              <div 
                key={b.batch} 
                className={`p-4 rounded-xl border transition-all ${
                  isMyBatch 
                    ? 'bg-amber-400/10 border-amber-400/40 shadow-md' 
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-mono font-bold text-xs flex items-center justify-center border border-slate-700">
                      #{b.rank}
                    </span>
                    <span className="text-base font-bold text-white">
                      {b.batch}
                    </span>
                    {isMyBatch && (
                      <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded font-mono">
                        YOUR BATCH
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="text-slate-400">
                      <strong className="text-white">{b.totalParticipants}</strong> solvers
                    </span>
                    <span className="text-cyan-400">
                      Avg Lvl <strong className="text-cyan-300">{b.avgLevel}</strong>
                    </span>
                    <span className="text-amber-400 font-black text-sm">
                      {b.totalScore} pts
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-300 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(5, percentage)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
