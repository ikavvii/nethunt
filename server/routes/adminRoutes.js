import express from 'express';
import { db, assignPathToUser, createNode, updateNode, deleteNode } from '../db.js';
import { requireAdmin } from '../auth.js';
import { broadcastEvent } from '../events.js';
import { leaderboardCache } from '../leaderboardCache.js';

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

// Helper: Generate unique clean username
async function generateUniqueUsername(name, email, batch, phone) {
  let base = '';
  if (email && email.includes('@')) {
    base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  }
  if (!base && name) {
    base = name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }
  if (!base && phone) {
    base = 'alumni_' + phone.replace(/[^0-9]/g, '').slice(-6);
  }
  if (!base) {
    base = 'alumni_' + Math.floor(1000 + Math.random() * 9000);
  }

  let candidate = base;
  let counter = 1;
  while (await db.prepare('SELECT id FROM users WHERE username = ?').get(candidate)) {
    candidate = `${base}_${counter}`;
    counter++;
  }
  return candidate;
}

// Helper: Parse Tab/Comma-Separated Text (e.g. from Google Sheets / Excel)
function parseRawAlumniText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const isTsv = firstLine.includes('\t');
  const delimiter = isTsv ? '\t' : (firstLine.includes(',') ? ',' : /\s{2,}/);

  const headerTokens = firstLine.split(delimiter).map(t => t.trim().toUpperCase());
  const hasHeader = headerTokens.some(h => ['NAME', 'EMAIL', 'PHONE', 'BATCH', 'ORGANIZATION'].includes(h));

  let nameIdx = -1, emailIdx = -1, phoneIdx = -1, batchIdx = -1, orgIdx = -1;

  if (hasHeader) {
    headerTokens.forEach((h, i) => {
      if (h.includes('NAME')) nameIdx = i;
      else if (h.includes('MAIL')) emailIdx = i;
      else if (h.includes('PHON') || h.includes('MOBI') || h.includes('CELL') || h.includes('CONTACT')) phoneIdx = i;
      else if (h.includes('BATCH') || h.includes('CLASS') || h.includes('YEAR')) batchIdx = i;
      else if (h.includes('ORG') || h.includes('COMP') || h.includes('WORK') || h.includes('EMPLOYER')) orgIdx = i;
    });
  } else {
    // Default standard order: NAME, EMAIL, PHONE, BATCH, ORGANIZATION
    nameIdx = 0; emailIdx = 1; phoneIdx = 2; batchIdx = 3; orgIdx = 4;
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const result = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const tokens = line.split(delimiter).map(t => t.trim());
    if (tokens.length === 0) continue;

    const name = nameIdx !== -1 && tokens[nameIdx] ? tokens[nameIdx] : (tokens[0] || '');
    if (!name) continue;

    const email = emailIdx !== -1 && tokens[emailIdx] ? tokens[emailIdx] : '';
    const phone = phoneIdx !== -1 && tokens[phoneIdx] ? tokens[phoneIdx] : '';
    const batch = batchIdx !== -1 && tokens[batchIdx] ? tokens[batchIdx] : '19MX';
    const organization = orgIdx !== -1 && tokens[orgIdx] ? tokens[orgIdx] : '';

    result.push({
      name,
      email,
      phone,
      batch: batch || '19MX',
      organization
    });
  }

  return result;
}

// CREATE Single Alumni
adminRouter.post('/alumni', async (req, res) => {
  const { name, batch, email, phone, organization, username: customUsername, passkey: customPasskey } = req.body;
  let username = customUsername;
  let passkey = customPasskey;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Alumni Name is required' });
  }

  const alumniName = name.trim();
  const alumniBatch = (batch || '19MX').trim();
  const alumniEmail = email ? email.trim() : null;
  const alumniPhone = phone ? phone.trim() : null;
  const alumniOrg = organization ? organization.trim() : null;

  // Check duplicate phone or email
  const cleanPhoneDigits = alumniPhone ? alumniPhone.replace(/[^0-9]/g, '') : null;
  const cleanLowerEmail = alumniEmail ? alumniEmail.toLowerCase() : null;

  if (cleanPhoneDigits || cleanLowerEmail) {
    const duplicate = await db.prepare(`
      SELECT id, username, name, email, phone FROM users 
      WHERE role != 'admin' AND (
        (? IS NOT NULL AND (phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ?))
        OR (? IS NOT NULL AND LOWER(email) = ?)
      )
    `).get(alumniPhone, alumniPhone, cleanPhoneDigits, cleanLowerEmail, cleanLowerEmail);

    if (duplicate) {
      return res.status(409).json({
        error: `Duplicate Alumnus: An alumnus with mobile '${alumniPhone || ''}' or email '${alumniEmail || ''}' is already enrolled as @${duplicate.username} (${duplicate.name}).`
      });
    }
  }

  // Auto-generate username if not provided
  if (!username || !username.trim()) {
    username = await generateUniqueUsername(alumniName, alumniEmail, alumniBatch, alumniPhone);
  } else {
    username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: `Username @${username} is already registered.` });
  }

  // Auto-default passkey to registered phone number if not explicitly specified
  if (!passkey || !passkey.trim()) {
    passkey = alumniPhone || 'psg2026';
  } else {
    passkey = passkey.trim();
  }

  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO users (username, passkey, name, batch, email, phone, organization, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'alumni', ?)
  `);

  try {
    const result = await insert.run(
      username,
      passkey,
      alumniName,
      alumniBatch,
      alumniEmail,
      alumniPhone,
      alumniOrg,
      now
    );

    const newUserId = result.lastInsertRowid;
    const path = await assignPathToUser(newUserId);
    await leaderboardCache.refreshNow();

    res.json({
      success: true,
      message: `Enrolled @${username} (${alumniName}) successfully with trajectory of ${path.length} nodes.`,
      user: {
        id: newUserId,
        username,
        passkey,
        name: alumniName,
        batch: alumniBatch,
        email: alumniEmail,
        phone: alumniPhone,
        organization: alumniOrg,
        nodesCount: path.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to enroll alumni: ' + err.message });
  }
});

// BULK CREATE Alumni (Supports TSV/Google Sheets, CSV, or JSON Array with strict duplicate prevention)
adminRouter.post('/bulk-enroll', async (req, res) => {
  let list = [];

  if (typeof req.body.rawText === 'string' && req.body.rawText.trim()) {
    list = parseRawAlumniText(req.body.rawText);
  } else if (Array.isArray(req.body.alumniList)) {
    list = req.body.alumniList;
  } else if (typeof req.body === 'string' && req.body.trim()) {
    list = parseRawAlumniText(req.body);
  }

  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ 
      error: 'Provide valid alumni data. Supports copy-pasting from Google Sheets / Excel (NAME, EMAIL, PHONE, BATCH, ORGANIZATION) or JSON array.' 
    });
  }

  let enrolled = 0;
  let skipped = 0;
  const enrolledUsers = [];
  const duplicatesSkipped = [];
  const seenPhones = new Set();
  const seenEmails = new Set();

  for (const item of list) {
    const alumniName = (item.name || item.NAME || '').trim();
    const alumniBatch = (item.batch || item.BATCH || '19MX').trim();
    const alumniEmail = (item.email || item.EMAIL || '').trim() || null;
    const alumniPhone = (item.phone || item.PHONE || '').trim() || null;
    const alumniOrg = (item.organization || item.ORGANIZATION || item.company || '').trim() || null;

    if (!alumniName) {
      skipped++;
      continue;
    }

    const cleanPhoneDigits = alumniPhone ? alumniPhone.replace(/[^0-9]/g, '') : null;
    const cleanLowerEmail = alumniEmail ? alumniEmail.toLowerCase() : null;

    // In-batch duplicate check
    if ((cleanPhoneDigits && seenPhones.has(cleanPhoneDigits)) || (cleanLowerEmail && seenEmails.has(cleanLowerEmail))) {
      skipped++;
      duplicatesSkipped.push({ name: alumniName, phone: alumniPhone, email: alumniEmail, reason: 'Duplicate in submitted batch' });
      continue;
    }

    let cleanUsername = (item.username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      cleanUsername = await generateUniqueUsername(alumniName, alumniEmail, alumniBatch, alumniPhone);
    }

    // Database duplicate check across username, phone, or email
    const duplicate = await db.prepare(`
      SELECT id, username FROM users WHERE role != 'admin' AND (
        username = ?
        OR (? IS NOT NULL AND (phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ?))
        OR (? IS NOT NULL AND LOWER(email) = ?)
      )
    `).get(cleanUsername, alumniPhone, alumniPhone, cleanPhoneDigits, cleanLowerEmail, cleanLowerEmail);

    if (duplicate) {
      skipped++;
      duplicatesSkipped.push({ name: alumniName, phone: alumniPhone, email: alumniEmail, reason: `Already registered as @${duplicate.username}` });
      continue;
    }

    if (cleanPhoneDigits) seenPhones.add(cleanPhoneDigits);
    if (cleanLowerEmail) seenEmails.add(cleanLowerEmail);

    const passkey = (item.passkey || alumniPhone || 'psg2026').trim();

    try {
      const resId = await db.prepare(`
        INSERT INTO users (username, passkey, name, batch, email, phone, organization, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'alumni', ?)
      `).run(
        cleanUsername,
        passkey,
        alumniName,
        alumniBatch,
        alumniEmail,
        alumniPhone,
        alumniOrg,
        Date.now()
      );

      await assignPathToUser(resId.lastInsertRowid);
      enrolled++;
      enrolledUsers.push({
        name: alumniName,
        username: cleanUsername,
        passkey,
        batch: alumniBatch,
        organization: alumniOrg,
        phone: alumniPhone,
        email: alumniEmail
      });
    } catch (e) {
      skipped++;
    }
  }

  await leaderboardCache.refreshNow();
  res.json({
    success: true,
    enrolled,
    skipped,
    duplicatesSkipped,
    totalParsed: list.length,
    users: enrolledUsers,
    message: `Bulk enrollment complete: ${enrolled} enrolled successfully, ${skipped} skipped (${duplicatesSkipped.length} duplicates blocked).`
  });
});

// READ All Alumni (with optional search across name, handle, batch, phone, organization, email)
adminRouter.get('/alumni', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  let sql = `
    SELECT id, username, passkey, name, batch, email, phone, organization, role, current_step, score, 
           tab_violations, is_disqualified, password_changed, test_started_at, test_duration_minutes,
           extra_time_minutes, test_submitted_at, created_at
    FROM users
    WHERE role != 'admin'
  `;

  if (query) {
    sql += ` AND (
      LOWER(name) LIKE '%${query}%' 
      OR LOWER(username) LIKE '%${query}%' 
      OR LOWER(batch) LIKE '%${query}%'
      OR (organization IS NOT NULL AND LOWER(organization) LIKE '%${query}%')
      OR (email IS NOT NULL AND LOWER(email) LIKE '%${query}%')
      OR (phone IS NOT NULL AND phone LIKE '%${query}%')
    )`;
  }

  sql += ' ORDER BY score DESC, current_step DESC, created_at DESC';
  const alumni = await db.prepare(sql).all();

  const globalDurationConfig = (await db.prepare("SELECT value FROM config WHERE key = 'test_duration_minutes'").get())?.value;
  const globalDuration = parseInt(globalDurationConfig || '60', 10);
  const now = Date.now();

  const enrichedAlumni = alumni.map(a => {
    const totalDurationMinutes = (a.test_duration_minutes || globalDuration) + (a.extra_time_minutes || 0);
    let timerStatus = 'not_started';
    let timeRemainingSeconds = totalDurationMinutes * 60;

    if (a.test_started_at) {
      const startedMs = !isNaN(Number(a.test_started_at))
        ? Number(a.test_started_at)
        : new Date(a.test_started_at).getTime();
      const elapsedMs = now - startedMs;
      const remainingMs = totalDurationMinutes * 60 * 1000 - elapsedMs;
      timeRemainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      if (a.test_submitted_at) {
        timerStatus = 'completed';
      } else if (timeRemainingSeconds <= 0) {
        timerStatus = 'expired';
      } else {
        timerStatus = 'active';
      }
    }

    return {
      ...a,
      total_duration_minutes: totalDurationMinutes,
      time_remaining_seconds: timeRemainingSeconds,
      timer_status: timerStatus
    };
  });

  res.json({ alumni: enrichedAlumni });
});

// EXPORT All Alumni
adminRouter.get('/alumni-export', async (req, res) => {
  const alumni = await db.prepare(`
    SELECT name, email, phone, batch, organization, username, passkey, score, current_step
    FROM users
    WHERE role != 'admin'
    ORDER BY batch ASC, name ASC
  `).all();

  res.json({ alumni });
});

// READ Single Alumni
adminRouter.get('/alumni/:id', async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni not found' });

  const progress = await db.prepare(`
    SELECT p.*, n.title, n.node_code, n.tier
    FROM user_node_progress p
    JOIN nodes n ON p.node_id = n.id
    WHERE p.user_id = ?
    ORDER BY p.step_index ASC
  `).all(req.params.id);

  res.json({ user, progress });
});

// UPDATE Alumni
adminRouter.put('/alumni/:id', async (req, res) => {
  const { name, batch, passkey, email, phone, organization, score, current_step } = req.body;
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  await db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        batch = COALESCE(?, batch),
        passkey = COALESCE(?, passkey),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        organization = COALESCE(?, organization),
        score = COALESCE(?, score),
        current_step = COALESCE(?, current_step)
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    batch ? batch.trim() : null,
    passkey ? passkey.trim() : null,
    email !== undefined ? email : null,
    phone !== undefined ? phone : null,
    organization !== undefined ? organization : null,
    score !== undefined ? parseInt(score) : null,
    current_step !== undefined ? parseInt(current_step) : null,
    req.params.id
  );

  await leaderboardCache.refreshNow();
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Alumni profile updated successfully', user: updated });
});

// RESET Alumni Progress
adminRouter.post('/alumni/:id/reset', async (req, res) => {
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  await db.prepare('UPDATE users SET current_step = 0, score = 0, tab_violations = 0, last_solved_subms = 0, test_started_at = NULL, extra_time_minutes = 0, test_submitted_at = NULL WHERE id = ?').run(req.params.id);
  await db.prepare('DELETE FROM user_node_progress WHERE user_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);

  await assignPathToUser(user.id);
  await leaderboardCache.refreshNow();

  res.json({ success: true, message: 'Alumni progress reset to Step 0 with new randomized trajectory and timer cleared.' });
});

// MANAGE Alumni Session Timer (Grant extra time or Reset timer)
adminRouter.post('/alumni/:id/timer', async (req, res) => {
  const { action, extraMinutes } = req.body;
  const user = await db.prepare('SELECT id, name, test_started_at, extra_time_minutes FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  if (action === 'grant_extra_time') {
    const mins = parseInt(extraMinutes || 15, 10);
    const newExtra = (user.extra_time_minutes || 0) + mins;
    await db.prepare('UPDATE users SET extra_time_minutes = ? WHERE id = ?').run(newExtra, user.id);
    return res.json({
      success: true,
      message: `Granted +${mins} minutes extra test time to ${user.name}.`,
      extra_time_minutes: newExtra
    });
  } else if (action === 'reset_timer') {
    await db.prepare('UPDATE users SET test_started_at = NULL, extra_time_minutes = 0, test_submitted_at = NULL WHERE id = ?').run(user.id);
    return res.json({
      success: true,
      message: `Test session timer reset for ${user.name}. Participant can now re-initialize their test.`
    });
  } else {
    return res.status(400).json({ error: 'Invalid action. Supported: grant_extra_time, reset_timer' });
  }
});

// RESET Alumni Passkey to Registered Phone
adminRouter.post('/alumni/:id/reset-passkey', async (req, res) => {
  const user = await db.prepare('SELECT id, username, phone, name FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  const resetPass = (user.phone || 'psg2026').trim();
  await db.prepare('UPDATE users SET passkey = ?, password_changed = 0 WHERE id = ?').run(resetPass, user.id);

  res.json({ 
    success: true, 
    message: `Passkey for ${user.name} reset to: ${resetPass}`, 
    passkey: resetPass 
  });
});

// DELETE Alumni
adminRouter.delete('/alumni/:id', async (req, res) => {
  const user = await db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  await leaderboardCache.refreshNow();

  res.json({ success: true, message: `Alumni @${user.username} successfully removed.` });
});

// RESET Alumni Proctor Violations
adminRouter.post('/alumni/:id/reset-violations', async (req, res) => {
  const { id } = req.params;
  await db.prepare('UPDATE users SET tab_violations = 0 WHERE id = ?').run(id);
  res.json({ success: true, message: 'Alumnus proctor infractions reset to zero.' });
});

// READ Proctor Logs (with optional filtering by event type and search)
adminRouter.get('/proctor-logs', async (req, res) => {
  const limit = parseInt(req.query.limit) || 250;
  const { type, q } = req.query;

  let sql = `
    SELECT p.*, u.username, u.name, u.batch
    FROM proctor_logs p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (type && type !== 'ALL') {
    sql += ` AND p.event_type = ?`;
    params.push(type);
  }

  if (q && q.trim()) {
    sql += ` AND (u.name LIKE ? OR u.username LIKE ? OR u.batch LIKE ?)`;
    const searchParam = `%${q.trim()}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY p.timestamp DESC LIMIT ?`;
  params.push(limit);

  const logs = await db.prepare(sql).all(...params);
  res.json({ logs });
});

// DELETE / PURGE Proctor Logs
adminRouter.delete('/proctor-logs', async (req, res) => {
  await db.prepare('DELETE FROM proctor_logs').run();
  res.json({ success: true, message: 'All proctor logs have been cleared.' });
});

// READ Master Node Pool
adminRouter.get('/nodes', async (req, res) => {
  const nodes = await db.prepare('SELECT * FROM nodes ORDER BY tier ASC, id ASC').all();
  const enriched = nodes.map(n => {
    let hints = [];
    let aliases = [];
    let nearMisses = {};
    try { hints = JSON.parse(n.hints_json || '[]'); } catch (e) {}
    try { aliases = JSON.parse(n.aliases_json || '[]'); } catch (e) {}
    try { nearMisses = JSON.parse(n.near_misses_json || '{}'); } catch (e) {}
    return { ...n, hints, aliases, near_misses: nearMisses };
  });

  res.json({ nodes: enriched });
});

// CREATE Node
adminRouter.post('/nodes', async (req, res) => {
  const { node_code, code, title, clue_text, answer } = req.body;
  const targetCode = (node_code || code || '').trim().toUpperCase();

  if (!targetCode || !title || !clue_text || !answer) {
    return res.status(400).json({ error: 'Node Code, Title, Clue Text, and Answer are required.' });
  }

  const existing = await db.prepare('SELECT id FROM nodes WHERE node_code = ?').get(targetCode);
  if (existing) {
    return res.status(409).json({ error: `Node code ${targetCode} already exists.` });
  }

  try {
    const id = await createNode({ ...req.body, code: targetCode });
    res.json({ success: true, message: `Node ${targetCode} created successfully.`, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create node: ' + err.message });
  }
});

// UPDATE Node
adminRouter.put('/nodes/:id', async (req, res) => {
  const id = req.params.id;
  const existing = await db.prepare('SELECT id, node_code FROM nodes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Node not found' });

  try {
    await updateNode(id, req.body);
    res.json({ success: true, message: `Node ${existing.node_code} updated successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update node: ' + err.message });
  }
});

// DELETE Node
adminRouter.delete('/nodes/:id', async (req, res) => {
  const id = req.params.id;
  const existing = await db.prepare('SELECT id, node_code FROM nodes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Node not found' });

  try {
    await deleteNode(id);
    res.json({ success: true, message: `Node ${existing.node_code} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete node: ' + err.message });
  }
});

// TEST SOLVE Node Verification
adminRouter.post('/nodes/:id/test-solve', async (req, res) => {
  const id = req.params.id;
  const { answer } = req.body;
  const node = await db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  if (!node) return res.status(404).json({ error: 'Node not found' });

  const clean = (answer || '').toLowerCase().trim();
  let aliases = [];
  let nearMisses = {};
  try { aliases = JSON.parse(node.aliases_json || '[]'); } catch (e) {}
  try { nearMisses = JSON.parse(node.near_misses_json || '{}'); } catch (e) {}

  const isCorrect = clean === node.answer.toLowerCase().trim() || aliases.includes(clean);
  const nearMissMsg = nearMisses[clean] || null;

  res.json({
    correct: isCorrect,
    input: clean,
    canonicalAnswer: node.answer,
    nearMiss: nearMissMsg,
    message: isCorrect ? 'VERIFIED: Correct solution!' : (nearMissMsg || 'INCORRECT: Solution does not match.')
  });
});

// CONFIG
adminRouter.get('/config', async (req, res) => {
  const rows = await db.prepare('SELECT key, value FROM config').all();
  const config = {};
  for (const r of rows) {
    if (r.key === 'admin_key') {
      config.hasCustomAdminKey = r.value !== 'login2026admin';
    } else {
      config[r.key] = r.value;
    }
  }
  config.isEnvAdminKeySet = Boolean(process.env.ADMIN_KEY || process.env.ADMIN_PASSKEY);
  res.json({ config });
});

adminRouter.post('/config', async (req, res) => {
  const { event_status, path_length, event_end_time, new_admin_key, leaderboard_visible, test_duration_minutes } = req.body;
  const setConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

  if (event_status) {
    const normStatus = (event_status === 'stopped') ? 'ended' : event_status;
    await setConfig.run('event_status', normStatus);
    broadcastEvent('EVENT_STATUS_CHANGED', { status: normStatus });
  }
  if (leaderboard_visible !== undefined) {
    const isVisible = String(leaderboard_visible) === 'true' || leaderboard_visible === true;
    const valStr = isVisible ? 'true' : 'false';
    await setConfig.run('leaderboard_visible', valStr);
    broadcastEvent('LEADERBOARD_VISIBILITY_CHANGED', { visible: isVisible });
  }
  if (path_length) await setConfig.run('path_length', String(path_length));
  if (test_duration_minutes) await setConfig.run('test_duration_minutes', String(test_duration_minutes));
  if (event_end_time) await setConfig.run('event_end_time', String(event_end_time));
  if (new_admin_key && typeof new_admin_key === 'string' && new_admin_key.trim().length >= 6) {
    const cleanKey = new_admin_key.trim();
    await setConfig.run('admin_key', cleanKey);
    await db.prepare("UPDATE users SET passkey = ? WHERE username = 'admin'").run(cleanKey);
  }

  res.json({ success: true, message: 'Configuration saved' });
});

// Dedicated Change Game Master Key
adminRouter.post('/change-admin-key', async (req, res) => {
  const { newAdminKey } = req.body;
  if (!newAdminKey || typeof newAdminKey !== 'string' || newAdminKey.trim().length < 6) {
    return res.status(400).json({ error: 'New Game Master Key must be at least 6 characters long.' });
  }

  const cleanKey = newAdminKey.trim();
  await db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('admin_key', ?)").run(cleanKey);
  await db.prepare("UPDATE users SET passkey = ? WHERE username = 'admin'").run(cleanKey);

  res.json({
    success: true,
    message: 'Game Master Secret Key updated successfully. The default login2026admin key is revoked and only your new key is valid.'
  });
});
