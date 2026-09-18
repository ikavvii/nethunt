process.env.TZ = 'Asia/Kolkata';

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
import { initPsgSyncBackgroundJob } from './psgSyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed levels
await initDatabase();
await leaderboardCache.refreshNow();
initPsgSyncBackgroundJob();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Real-time Event Stream (Server-Sent Events)
app.get('/api/events/stream', registerSSEClient);

function formatEventWindow(startInput, endInput) {
  try {
    const fmt = (input) => {
      const d = new Date(input);
      if (isNaN(d.getTime())) return input;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).formatToParts(d);
      const map = {};
      for (const p of parts) map[p.type] = p.value;
      const hourPad = String(map.hour).padStart(2, '0');
      const dayPeriod = (map.dayPeriod || 'AM').toUpperCase();
      return `${map.day} ${map.month} ${map.year} (${hourPad}:${map.minute} ${dayPeriod})`;
    };
    return `${fmt(startInput)} – ${fmt(endInput)}`;
  } catch (err) {
    return `${startInput} – ${endInput}`;
  }
}

// Event Status Endpoint (Public)
app.get('/api/events/status', async (req, res) => {
  try {
    const evStatus = (await db.prepare("SELECT value FROM config WHERE key = 'event_status'").get())?.value || 'active';
    const lbRow = await db.prepare("SELECT value FROM config WHERE key = 'leaderboard_visible'").get();
    const lbVisible = (!lbRow || lbRow.value === undefined || lbRow.value === null) ? true : (lbRow.value === 'true' || lbRow.value === '1');
    const startDate = (await db.prepare("SELECT value FROM config WHERE key = 'event_start_date'").get())?.value || '2026-09-12T09:00:00+05:30';
    const endDate = (await db.prepare("SELECT value FROM config WHERE key = 'event_end_date'").get())?.value || '2026-09-19T10:00:00+05:30';
    
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
      eventWindow: formatEventWindow(startDate, endDate)
    });
  } catch (e) {
    console.error('EVENT STATUS ERROR:', e);
    res.json({ 
      status: 'active', 
      leaderboardVisible: true,
      eventStartDate: '2026-09-12T09:00:00+05:30',
      eventEndDate: '2026-09-18T09:00:00+05:30',
      eventWindow: '12 Sep 2026 (09:00 AM) – 18 Sep 2026 (09:00 AM)',
      _debug_error: e.message,
      _debug_stack: e.stack
    });
  }
});

// Diagnostic endpoint for troubleshooting cloud deployments
app.get('/api/diagnostic', async (req, res) => {
  try {
    const isTurso = Boolean(process.env.TURSO_DATABASE_URL);
    const tursoUrl = process.env.TURSO_DATABASE_URL ? (process.env.TURSO_DATABASE_URL.substring(0, 16) + '...') : null;
    const hasToken = Boolean(process.env.TURSO_AUTH_TOKEN);
    let dbTest = 'untested';
    let dbTestError = null;
    try {
      const row = await db.prepare("SELECT value FROM config WHERE key = 'event_status'").get();
      dbTest = 'success: ' + JSON.stringify(row);
    } catch (dbe) {
      dbTest = 'failed: ' + dbe.message;
      dbTestError = { message: dbe.message, stack: dbe.stack, code: dbe.code };
    }

    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      isTurso,
      tursoUrl,
      hasToken,
      dbTest,
      dbTestError
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
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

// Global API error handler returning JSON instead of HTML
app.use((err, req, res, next) => {
  console.error('SERVER_ERROR:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code,
    stack: err.stack
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
