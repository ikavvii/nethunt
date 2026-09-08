import express from 'express';
import { leaderboardCache } from '../leaderboardCache.js';

export const leaderboardRouter = express.Router();

// GET Global Standings (Fast in-memory cache for 500+ concurrent players)
leaderboardRouter.get('/', (req, res) => {
  const standings = leaderboardCache.getLeaderboard();
  res.json({ leaderboard: standings });
});

// GET Batch Standings (Aggregated in-memory)
leaderboardRouter.get('/batches', (req, res) => {
  const batches = leaderboardCache.getBatches();
  res.json({ batches });
});
