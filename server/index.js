import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, db } from './db.js';
import { registerSSEClient } from './events.js';
import { authRouter } from './routes/authRoutes.js';
import { huntRouter } from './routes/huntRoutes.js';
import { leaderboardRouter } from './routes/leaderboardRoutes.js';
import { shoutboxRouter } from './routes/shoutboxRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

import { leaderboardCache } from './leaderboardCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed levels
await initDatabase();
await leaderboardCache.refreshNow();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Real-time Event Stream (Server-Sent Events)
app.get('/api/events/stream', registerSSEClient);

// Event Status Endpoint (Public)
app.get('/api/events/status', async (req, res) => {
  try {
    const evStatus = (await db.prepare("SELECT value FROM config WHERE key = 'event_status'").get())?.value || 'active';
    res.json({ status: evStatus });
  } catch (e) {
    res.json({ status: 'active' });
  }
});

// API Routers
app.use('/api/auth', authRouter);
app.use('/api/hunt', huntRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/shoutbox', shoutboxRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    event: 'LOGIN 2026 - PSG Tech MCA Alumni Nethunt',
    timestamp: Date.now()
  });
});

// Serve frontend in production build if dist exists
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 LOGIN 2026 NETHUNT BACKEND ACTIVE ON PORT ${PORT}`);
    console.log(`🎓 Host: PSG College of Technology, MCA Dept`);
    console.log(`⚡ API URL: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
