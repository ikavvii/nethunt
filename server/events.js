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
