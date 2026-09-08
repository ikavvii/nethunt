import { db } from './db.js';

// Real-time Event Hub using Server-Sent Events (SSE)
const clients = new Set();

export function registerSSEClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  clients.add(res);

  // Send initial welcome message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  // Immediately push current event status and leaderboard visibility on connection
  Promise.resolve().then(async () => {
    try {
      const row = await db.prepare("SELECT value FROM config WHERE key = 'event_status'").get();
      const status = row?.value || 'active';
      res.write(`data: ${JSON.stringify({ type: 'EVENT_STATUS_CHANGED', payload: { status }, timestamp: Date.now() })}\n\n`);

      const lbRow = await db.prepare("SELECT value FROM config WHERE key = 'leaderboard_visible'").get();
      const lbVisible = (!lbRow || lbRow.value === undefined || lbRow.value === null) ? true : (lbRow.value === 'true' || lbRow.value === '1');
      res.write(`data: ${JSON.stringify({ type: 'LEADERBOARD_VISIBILITY_CHANGED', payload: { visible: lbVisible }, timestamp: Date.now() })}\n\n`);
    } catch (e) {}
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcastEvent(eventType, payload) {
  const message = `data: ${JSON.stringify({ type: eventType, payload, timestamp: Date.now() })}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch (e) {
      clients.delete(client);
    }
  }
}
