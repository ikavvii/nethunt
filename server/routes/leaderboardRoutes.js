import express from 'express';
import { leaderboardCache } from '../leaderboardCache.js';

export const leaderboardRouter = express.Router();

// GET Global Standings (Fast in-memory cache for 500+ concurrent players)
leaderboardRouter.get('/', async (req, res) => {
  const standings = await leaderboardCache.getLeaderboard();
  res.json({ leaderboard: standings });
});

// GET Batch Standings (Aggregated in-memory)
leaderboardRouter.get('/batches', async (req, res) => {
  const batches = await leaderboardCache.getBatches();
  res.json({ batches });
});
