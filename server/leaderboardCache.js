import { db } from './db.js';

// High-performance in-memory cache for 500+ concurrent players
// Eliminates repetitive expensive database table scans and ORDER BY sorts
class LeaderboardCache {
  constructor() {
    this.cachedLeaderboard = [];
    this.cachedBatches = [];
    this.lastRefreshed = 0;
    this.refreshIntervalMs = 500; // Refreshes at most once every 500ms or on direct solve event
  }

  // Get current high-resolution timestamp with sub-millisecond precision
  static getSubMillisecondTimestamp() {
    const hr = process.hrtime();
    // Sub-millisecond fraction: hr[1] nanoseconds divided by 1,000,000 gives milliseconds fraction
    return Date.now() + (hr[1] / 1000000000);
  }

  // Atomically rebuild in-memory rankings from DB
  async refreshNow() {
    if (this.refreshingPromise) return this.refreshingPromise;

    this.refreshingPromise = (async () => {
      try {
        const users = await db.prepare(`
          SELECT id, username, name, batch, organization, role, current_step, score, tab_violations, last_solved_subms, test_started_at
          FROM users
          WHERE role != 'admin'
        `).all();

        const activeUsers = (users || []).filter(u => {
          const started = u.test_started_at && u.test_started_at !== '0' && u.test_started_at !== 0;
          return started || (u.score && u.score > 0) || (u.current_step && u.current_step > 0);
        });

        const mapped = activeUsers.map(u => {
          const startedMs = !isNaN(Number(u.test_started_at))
            ? Number(u.test_started_at)
            : (u.test_started_at ? new Date(u.test_started_at).getTime() : 0);

          const elapsedMs = (u.last_solved_subms > 0 && startedMs > 0)
            ? Math.max(0, Math.round(u.last_solved_subms - startedMs))
            : 0;

          return {
            id: u.id,
            username: u.username,
            name: u.name,
            batch: u.batch,
            organization: u.organization || '',
            current_step: u.current_step || 0,
            score: u.score || 0,
            tab_violations: u.tab_violations || 0,
            last_solved_subms: u.last_solved_subms || 0,
            test_started_at: u.test_started_at || null,
            elapsed_time_ms: elapsedMs
          };
        });

        mapped.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.current_step !== a.current_step) return b.current_step - a.current_step;
          const aElapsed = a.elapsed_time_ms > 0 ? a.elapsed_time_ms : 999999999999;
          const bElapsed = b.elapsed_time_ms > 0 ? b.elapsed_time_ms : 999999999999;
          if (aElapsed !== bElapsed) return aElapsed - bElapsed;
          if (a.last_solved_subms !== b.last_solved_subms) return a.last_solved_subms - b.last_solved_subms;
          return a.id - b.id;
        });

        this.cachedLeaderboard = mapped.map((u, idx) => ({
          rank: idx + 1,
          ...u
        }));

        // Aggregate batches in memory without hitting disk
        const batchMap = new Map();
        for (const u of this.cachedLeaderboard) {
          if (!u.batch) continue;
          const existing = batchMap.get(u.batch) || {
            batch: u.batch,
            totalParticipants: 0,
            totalScore: 0,
            totalSteps: 0,
            maxStep: 0
          };
          existing.totalParticipants += 1;
          existing.totalScore += u.score;
          existing.totalSteps += u.current_step;
          existing.maxStep = Math.max(existing.maxStep, u.current_step);
          batchMap.set(u.batch, existing);
        }

        const batchArr = Array.from(batchMap.values()).map(b => ({
          ...b,
          avgStep: Math.round((b.totalSteps / Math.max(1, b.totalParticipants)) * 10) / 10
        }));

        batchArr.sort((a, b) => b.totalScore - a.totalScore || b.totalParticipants - a.totalParticipants);
        this.cachedBatches = batchArr.map((b, idx) => ({ rank: idx + 1, ...b }));
        this.lastRefreshed = Date.now();
      } catch (err) {
        console.error('Leaderboard refresh error:', err);
      } finally {
        this.refreshingPromise = null;
      }
    })();

    return this.refreshingPromise;
  }

  async getLeaderboard() {
    if (Date.now() - this.lastRefreshed > this.refreshIntervalMs || this.cachedLeaderboard.length === 0) {
      await this.refreshNow();
    }
    return this.cachedLeaderboard;
  }

  async getBatches() {
    if (Date.now() - this.lastRefreshed > this.refreshIntervalMs || this.cachedBatches.length === 0) {
      await this.refreshNow();
    }
    return this.cachedBatches;
  }
}

export const leaderboardCache = new LeaderboardCache();
