import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { leaderboardCache } from '../leaderboardCache.js';

export const leaderboardRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'psg-tech-mca-login-2026-secret-key-super-secure';

function isRequestAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.role === 'admin';
  } catch (e) {
    return false;
  }
}

async function isLeaderboardVisible() {
  const row = await db.prepare("SELECT value FROM config WHERE key = 'leaderboard_visible'").get();
  if (!row || row.value === undefined || row.value === null) return true;
  return row.value === 'true' || row.value === '1';
}

// GET Global Standings (Fast in-memory cache for 500+ concurrent players)
leaderboardRouter.get('/', async (req, res) => {
  const visible = await isLeaderboardVisible();
  const isAdmin = isRequestAdmin(req);

  if (!visible && !isAdmin) {
    return res.json({
      visible: false,
      message: 'Standings telemetry is temporarily frozen/hidden by the Game Master.',
      leaderboard: []
    });
  }

  const standings = await leaderboardCache.getLeaderboard();
  res.json({
    visible,
    isAdminPreview: !visible && isAdmin,
    leaderboard: standings
  });
});

// GET Batch Standings (Aggregated in-memory)
leaderboardRouter.get('/batches', async (req, res) => {
  const visible = await isLeaderboardVisible();
  const isAdmin = isRequestAdmin(req);

  if (!visible && !isAdmin) {
    return res.json({
      visible: false,
      message: 'Batch standings are temporarily frozen/hidden by the Game Master.',
      batches: []
    });
  }

  const batches = await leaderboardCache.getBatches();
  res.json({
    visible,
    isAdminPreview: !visible && isAdmin,
    batches
  });
});
