import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Search, Filter, RefreshCw, Award, Shield } from 'lucide-react';

export default function Leaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const fetchStandings = async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      const [lbRes, bRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/leaderboard/batches')
      ]);
      const lbData = await lbRes.json();
      const bData = await bRes.json();
      setLeaderboard(lbData.leaderboard || []);
      setBatches(bData.batches || []);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    // Live dynamic updates every 3 seconds for continuous auditorium / display board streaming
    const interval = setInterval(() => fetchStandings(false), 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = leaderboard.filter(al => {
    const matchesSearch = al.name.toLowerCase().includes(search.toLowerCase()) ||
                          al.username.toLowerCase().includes(search.toLowerCase());
    const matchesBatch = batchFilter === 'ALL' || al.batch === batchFilter;
    return matchesSearch && matchesBatch;
  });

  const uniqueBatches = Array.from(new Set(leaderboard.map(u => u.batch).filter(Boolean))).sort().reverse();

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b theme-border pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <Trophy className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-mono font-black theme-text-primary tracking-wider uppercase">
              ALUMNI TELEMETRY // STANDINGS
            </h1>
          </div>
          <p className="text-sm theme-text-muted mt-1 font-mono">
            &gt; Live continuous rankings broken by aggregate score, node step, and sub-millisecond solve timestamp.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Dynamic Feed Indicator */}
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-wide">LIVE DYNAMIC SYNC (3S)</span>
            {lastSyncTime && <span className="opacity-75 hidden md:inline">[{lastSyncTime}]</span>}
          </div>

          <button
            onClick={() => fetchStandings(true)}
            className="px-4 py-2 rounded-xl border theme-border theme-text-primary hover:theme-bg-surface transition-all font-mono text-xs font-bold flex items-center space-x-2 cursor-pointer shadow-sm"
            title="Force refresh standings immediately"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin theme-label-cyan' : ''}`} />
            <span className="hidden sm:inline">[ REFRESH ]</span>
          </button>
        </div>
      </div>

      {/* Batch Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {batches.slice(0, 4).map((b) => (
          <div key={b.batch} className="theme-bg-card border theme-border p-5 rounded-xl shadow-sm space-y-1.5">
            <span className="text-xs font-mono font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider">
              [ {b.batch} ]
            </span>
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-black theme-metric-value font-mono">{b.totalScore} PTS</span>
              <span className="text-xs theme-text-muted font-mono font-bold">{b.totalParticipants} ALUMS</span>
            </div>
            <p className="text-xs theme-text-muted font-mono">
              AVG_STEP: <strong className="theme-text-primary">{b.avgStep}</strong>
            </p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="theme-bg-card border theme-border p-4 rounded-xl flex flex-col sm:flex-row gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-cyan-600 dark:text-cyan-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alumni by name or handle..."
            className="w-full pl-11 pr-4 py-3 rounded-xl theme-bg-surface border theme-border theme-text-primary text-sm font-mono focus:outline-none focus:border-cyan-400 placeholder:theme-text-muted shadow-inner"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-4 py-3 rounded-xl theme-bg-surface border theme-border theme-text-primary text-sm focus:outline-none focus:border-cyan-400 font-mono shadow-inner cursor-pointer font-bold"
          >
            <option value="ALL">ALL BATCHES</option>
            {uniqueBatches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono">
            <thead className="theme-bg-surface theme-text-muted border-b theme-border text-xs uppercase tracking-wider font-bold">
              <tr>
                <th className="py-4 px-4 w-16 text-center">RANK</th>
                <th className="py-4 px-4">ALUMNI_OPERATOR</th>
                <th className="py-4 px-4">BATCH</th>
                <th className="py-4 px-4 text-center">STEP</th>
                <th className="py-4 px-4 text-center">SCORE</th>
                <th className="py-4 px-4 text-right">LATEST_SOLVE</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {filtered.map((al) => {
                const isMe = user?.id === al.id;
                return (
                  <tr 
                    key={al.id} 
                    className={`transition-colors ${
                      isMe ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : 'hover:theme-bg-surface'
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center font-bold">
                      {al.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/50 text-sm font-black shadow-sm">1</span>
                      ) : al.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-600 dark:text-slate-300 border border-slate-400/50 text-sm font-black">2</span>
                      ) : al.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 dark:text-amber-500 border border-amber-700/50 text-sm font-black">3</span>
                      ) : (
                        <span className="theme-text-muted text-sm font-mono font-bold">#{al.rank}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-full bg-slate-800 border theme-border flex items-center justify-center text-xs font-bold theme-text-muted flex-shrink-0 font-mono"
                        >
                          {al.name ? al.name[0] : 'A'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm sm:text-base font-bold ${isMe ? 'theme-label-cyan' : 'theme-text-primary'}`}>
                              {al.name}
                            </span>
                            {isMe && (
                              <span className="text-[11px] bg-cyan-500 text-slate-950 font-bold px-2 py-0.5 rounded font-mono shadow-sm">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs font-mono mt-0.5">
                            <span className="theme-label-cyan">@{al.username}</span>
                            {al.organization && (
                              <span className="text-xs px-2 py-0.5 rounded border theme-border theme-text-secondary bg-slate-800/20 font-sans">
                                {al.organization}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-sm sm:text-base theme-label-cyan font-mono">
                      {al.batch}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-xs sm:text-sm theme-metric-value">
                      STEP {al.current_step}
                    </td>
                    <td className="py-3.5 px-4 text-center font-black text-base sm:text-lg theme-metric-value">
                      {al.score}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs font-mono theme-text-muted">
                      {al.last_solved_subms > 0 ? (
                        new Date(al.last_solved_subms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
