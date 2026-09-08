import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcastEvent } from '../events.js';

export const shoutboxRouter = express.Router();

// GET recent memories
shoutboxRouter.get('/', async (req, res) => {
  const messages = await db.prepare(`
    SELECT id, user_id, username, name, batch, avatar, message, created_at
    FROM shoutbox
    ORDER BY created_at DESC
    LIMIT 60
  `).all();

  res.json({ messages });
});

// POST new memory note
shoutboxRouter.post('/', requireAuth, async (req, res) => {
  const user = req.user;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const cleanMessage = message.trim().substring(0, 500);
  const now = Date.now();

  const insert = db.prepare(`
    INSERT INTO shoutbox (user_id, username, name, batch, avatar, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await insert.run(
    user.id,
    user.username,
    user.name,
    user.batch,
    user.avatar,
    cleanMessage,
    now
  );

  const newPost = {
    id: result.lastInsertRowid,
    user_id: user.id,
    username: user.username,
    name: user.name,
    batch: user.batch,
    avatar: user.avatar,
    message: cleanMessage,
    created_at: now
  };

  // Broadcast to all active alumni
  broadcastEvent('NEW_SHOUTBOX_MESSAGE', newPost);

  res.json({ success: true, post: newPost });
});
