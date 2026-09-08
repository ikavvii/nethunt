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
  refreshNow() {
    const users = db.prepare(`
      SELECT id, username, name, batch, organization, role, current_step, score, tab_violations, last_solved_subms
      FROM users
      WHERE role != 'admin'
      ORDER BY score DESC, current_step DESC, last_solved_subms ASC, id ASC
    `).all();

    this.cachedLeaderboard = users.map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      username: u.username,
      name: u.name,
      batch: u.batch,
      organization: u.organization || '',
      current_step: u.current_step,
      score: u.score,
      tab_violations: u.tab_violations,
      last_solved_subms: u.last_solved_subms || 0
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
  }

  getLeaderboard() {
    if (Date.now() - this.lastRefreshed > this.refreshIntervalMs || this.cachedLeaderboard.length === 0) {
      this.refreshNow();
    }
    return this.cachedLeaderboard;
  }

  getBatches() {
    if (Date.now() - this.lastRefreshed > this.refreshIntervalMs || this.cachedBatches.length === 0) {
      this.refreshNow();
    }
    return this.cachedBatches;
  }
}

export const leaderboardCache = new LeaderboardCache();
