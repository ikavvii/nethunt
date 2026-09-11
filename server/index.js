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
    const lbRow = await db.prepare("SELECT value FROM config WHERE key = 'leaderboard_visible'").get();
    const lbVisible = (!lbRow || lbRow.value === undefined || lbRow.value === null) ? true : (lbRow.value === 'true' || lbRow.value === '1');
    const startDate = (await db.prepare("SELECT value FROM config WHERE key = 'event_start_date'").get())?.value || '2026-08-12T09:00:00+05:30';
    const endDate = (await db.prepare("SELECT value FROM config WHERE key = 'event_end_date'").get())?.value || '2026-08-18T09:00:00+05:30';
    
    const now = Date.now();
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const isBeforeStart = !isNaN(startMs) && now < startMs;
    const isAfterEnd = !isNaN(endMs) && now > endMs;

    res.json({ 
      status: evStatus, 
      leaderboardVisible: lbVisible,
      eventStartDate: startDate,
      eventEndDate: endDate,
      eventStartTimeMs: startMs,
      eventEndTimeMs: endMs,
      isBeforeStart,
      isAfterEnd,
      timeUntilStartSeconds: isBeforeStart ? Math.max(0, Math.floor((startMs - now) / 1000)) : 0,
      timeUntilEndSeconds: !isAfterEnd ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0,
      eventWindow: '12th Aug 2026 (09:00 AM) – 18th Aug 2026 (09:00 AM)'
    });
  } catch (e) {
    res.json({ 
      status: 'active', 
      leaderboardVisible: true,
      eventStartDate: '2026-08-12T09:00:00+05:30',
      eventEndDate: '2026-08-18T09:00:00+05:30',
      eventWindow: '12th Aug 2026 (09:00 AM) – 18th Aug 2026 (09:00 AM)'
    });
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
