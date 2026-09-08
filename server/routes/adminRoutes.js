import express from 'express';
import { db, assignPathToUser, createNode, updateNode, deleteNode } from '../db.js';
import { requireAdmin } from '../auth.js';
import { broadcastEvent } from '../events.js';
import { leaderboardCache } from '../leaderboardCache.js';

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

// Helper: Generate unique clean username
function generateUniqueUsername(name, email, batch, phone) {
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
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(candidate)) {
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
    nameIdx = headerTokens.findIndex(h => h.includes('NAME'));
    emailIdx = headerTokens.findIndex(h => h.includes('EMAIL') || h.includes('MAIL'));
    phoneIdx = headerTokens.findIndex(h => h.includes('PHONE') || h.includes('MOBILE') || h.includes('CONTACT'));
    batchIdx = headerTokens.findIndex(h => h.includes('BATCH') || h.includes('YEAR'));
    orgIdx = headerTokens.findIndex(h => h.includes('ORGANIZATION') || h.includes('COMPANY') || h.includes('ORG'));
  }

  const startIdx = hasHeader ? 1 : 0;
  const records = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim());
    if (parts.length === 0 || !parts.some(Boolean)) continue;

    let name = '', email = '', phone = '', batch = '', organization = '';

    if (hasHeader) {
      if (nameIdx >= 0 && parts[nameIdx]) name = parts[nameIdx];
      if (emailIdx >= 0 && parts[emailIdx]) email = parts[emailIdx];
      if (phoneIdx >= 0 && parts[phoneIdx]) phone = parts[phoneIdx];
      if (batchIdx >= 0 && parts[batchIdx]) batch = parts[batchIdx];
      if (orgIdx >= 0 && parts[orgIdx]) organization = parts[orgIdx];
    } else {
      name = parts[0] || '';
      email = parts[1] || '';
      phone = parts[2] || '';
      batch = parts[3] || '19MX';
      organization = parts[4] || '';
    }

    if (name || email || phone) {
      records.push({ name, email, phone, batch, organization });
    }
  }

  return records;
}

// CREATE Alumni
adminRouter.post('/alumni', (req, res) => {
  const { name, batch, email, phone, organization } = req.body;
  let { username, passkey } = req.body;

  if (!name || (!batch && !req.body.batch)) {
    return res.status(400).json({ error: 'Name and Batch are required.' });
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
    const duplicate = db.prepare(`
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
    username = generateUniqueUsername(alumniName, alumniEmail, alumniBatch, alumniPhone);
  } else {
    username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
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
    const result = insert.run(
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
    const path = assignPathToUser(newUserId);
    leaderboardCache.refreshNow();

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
adminRouter.post('/bulk-enroll', (req, res) => {
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
      cleanUsername = generateUniqueUsername(alumniName, alumniEmail, alumniBatch, alumniPhone);
    }

    // Database duplicate check across username, phone, or email
    const duplicate = db.prepare(`
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
      const resId = db.prepare(`
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

      assignPathToUser(resId.lastInsertRowid);
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

  leaderboardCache.refreshNow();
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
adminRouter.get('/alumni', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  let sql = `
    SELECT id, username, passkey, name, batch, email, phone, organization, role, current_step, score, 
           tab_violations, is_disqualified, password_changed, created_at
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
  const alumni = db.prepare(sql).all();
  res.json({ alumni });
});

// EXPORT All Alumni
adminRouter.get('/alumni-export', (req, res) => {
  const alumni = db.prepare(`
    SELECT name, email, phone, batch, organization, username, passkey, score, current_step
    FROM users
    WHERE role != 'admin'
    ORDER BY batch ASC, name ASC
  `).all();

  res.json({ alumni });
});

// READ Single Alumni
adminRouter.get('/alumni/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni not found' });

  const progress = db.prepare(`
    SELECT p.*, n.title, n.node_code, n.tier
    FROM user_node_progress p
    JOIN nodes n ON p.node_id = n.id
    WHERE p.user_id = ?
    ORDER BY p.step_index ASC
  `).all(req.params.id);

  res.json({ user, progress });
});

// UPDATE Alumni
adminRouter.put('/alumni/:id', (req, res) => {
  const { name, batch, passkey, email, phone, organization, score, current_step } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  db.prepare(`
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

  leaderboardCache.refreshNow();
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Alumni profile updated successfully', user: updated });
});

// RESET Alumni Progress
adminRouter.post('/alumni/:id/reset', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  db.prepare('UPDATE users SET current_step = 0, score = 0, tab_violations = 0, last_solved_subms = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM user_node_progress WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);

  assignPathToUser(user.id);
  leaderboardCache.refreshNow();

  res.json({ success: true, message: 'Alumni progress reset to Step 0 with new randomized trajectory.' });
});

// RESET Alumni Passkey to Registered Phone
adminRouter.post('/alumni/:id/reset-passkey', (req, res) => {
  const user = db.prepare('SELECT id, username, phone, name FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  const resetPass = (user.phone || 'psg2026').trim();
  db.prepare('UPDATE users SET passkey = ?, password_changed = 0 WHERE id = ?').run(resetPass, user.id);

  res.json({ 
    success: true, 
    message: `Passkey for ${user.name} reset to: ${resetPass}`, 
    passkey: resetPass 
  });
});

// DELETE Alumni
adminRouter.delete('/alumni/:id', (req, res) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Alumni record not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  leaderboardCache.refreshNow();

  res.json({ success: true, message: `Alumni @${user.username} successfully removed.` });
});

// READ Proctor Logs
adminRouter.get('/proctor-logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.prepare(`
    SELECT p.*, u.username, u.name, u.batch
    FROM proctor_logs p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.timestamp DESC
    LIMIT ?
  `).all(limit);

  res.json({ logs });
});

// READ Master Node Pool
adminRouter.get('/nodes', (req, res) => {
  const nodes = db.prepare('SELECT * FROM nodes ORDER BY tier ASC, id ASC').all();
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
adminRouter.post('/nodes', (req, res) => {
  const { node_code, code, title, clue_text, answer } = req.body;
  const targetCode = (node_code || code || '').trim().toUpperCase();

  if (!targetCode || !title || !clue_text || !answer) {
    return res.status(400).json({ error: 'Node Code, Title, Clue Text, and Answer are required.' });
  }

  const existing = db.prepare('SELECT id FROM nodes WHERE node_code = ?').get(targetCode);
  if (existing) {
    return res.status(409).json({ error: `Node code ${targetCode} already exists.` });
  }

  try {
    const id = createNode({ ...req.body, code: targetCode });
    res.json({ success: true, message: `Node ${targetCode} created successfully.`, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create node: ' + err.message });
  }
});

// UPDATE Node
adminRouter.put('/nodes/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id, node_code FROM nodes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Node not found' });

  try {
    updateNode(id, req.body);
    res.json({ success: true, message: `Node ${existing.node_code} updated successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update node: ' + err.message });
  }
});

// DELETE Node
adminRouter.delete('/nodes/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id, node_code FROM nodes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Node not found' });

  try {
    deleteNode(id);
    res.json({ success: true, message: `Node ${existing.node_code} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete node: ' + err.message });
  }
});

// TEST SOLVE Node Verification
adminRouter.post('/nodes/:id/test-solve', (req, res) => {
  const id = req.params.id;
  const { answer } = req.body;
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
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
adminRouter.get('/config', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {};
  for (const r of rows) config[r.key] = r.value;
  res.json({ config });
});

adminRouter.post('/config', (req, res) => {
  const { event_status, path_length, event_end_time } = req.body;
  const setConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

  if (event_status) {
    setConfig.run('event_status', event_status);
    broadcastEvent('EVENT_STATUS_CHANGED', { status: event_status });
  }
  if (path_length) setConfig.run('path_length', String(path_length));
  if (event_end_time) setConfig.run('event_end_time', String(event_end_time));

  res.json({ success: true, message: 'Configuration saved' });
});
