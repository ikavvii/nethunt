import express from 'express';
import { db, assignPathToUser } from '../db.js';
import { generateToken, requireAuth } from '../auth.js';

export const authRouter = express.Router();

// Alumni Login (Only pre-enrolled alumni by admin)
authRouter.post('/login', async (req, res) => {
  const { username, passkey } = req.body;
  if (!username || !passkey) {
    return res.status(400).json({ error: 'Registered Email, Phone number, or Username and Passkey are required.' });
  }

  const cleanIdentifier = username.trim().toLowerCase();
  const digitsOnly = username.trim().replace(/[^0-9]/g, '');

  // Look up user by username, email, or phone number
  const user = await db.prepare(`
    SELECT * FROM users 
    WHERE role != 'admin' AND (
      LOWER(username) = ? 
      OR LOWER(email) = ? 
      OR (phone IS NOT NULL AND (phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ?))
    )
  `).get(cleanIdentifier, cleanIdentifier, username.trim(), digitsOnly);

  if (!user) {
    return res.status(401).json({ error: 'Alumni record not found. Please verify your registered email or mobile number.' });
  }

  // If user has already changed password, only their new personal password is valid.
  // Otherwise, default password is their registered phone number or initial passkey.
  const cleanInputPass = passkey.trim();
  const userStoredPhone = (user.phone || '').trim();
  const userPhoneDigits = userStoredPhone.replace(/[^0-9]/g, '');
  const inputPassDigits = cleanInputPass.replace(/[^0-9]/g, '');

  let isPassValid = false;
  if (user.password_changed === 1) {
    isPassValid = (user.passkey === cleanInputPass);
  } else {
    isPassValid = 
      user.passkey === cleanInputPass ||
      (userStoredPhone && userStoredPhone === cleanInputPass) ||
      (userPhoneDigits && userPhoneDigits.length >= 7 && userPhoneDigits === inputPassDigits);
  }

  if (!isPassValid) {
    const hintMsg = user.password_changed === 1 
      ? 'Incorrect password. Use your personalized password or reset if forgotten.' 
      : 'Incorrect password (default is your registered mobile number).';
    return res.status(401).json({ error: hintMsg });
  }

  // Ensure path is assigned
  let path = [];
  try { path = JSON.parse(user.assigned_path_json || '[]'); } catch (e) {}
  if (!path || path.length === 0) {
    path = await assignPathToUser(user.id);
  }

  const mustChangePassword = (user.password_changed !== 1 && user.role !== 'admin');
  const token = generateToken(user);
  return res.json({
    token,
    mustChangePassword,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      batch: user.batch,
      email: user.email,
      phone: user.phone,
      organization: user.organization || '',
      role: user.role,
      current_step: user.current_step || 0,
      total_nodes: path.length,
      score: user.score || 0,
      tab_violations: user.tab_violations || 0,
      password_changed: user.password_changed || 0,
      mustChangePassword
    }
  });
});

// Admin Login
authRouter.post('/admin-login', async (req, res) => {
  const { adminKey } = req.body;
  const envKey = process.env.ADMIN_KEY || process.env.ADMIN_PASSKEY;
  const configKey = (await db.prepare("SELECT value FROM config WHERE key = 'admin_key'").get())?.value;

  // Strict Single Key Enforcement:
  // 1. Environment variable ADMIN_KEY / ADMIN_PASSKEY has absolute priority.
  // 2. If no environment variable is provided, the database config 'admin_key' is used.
  // 3. Fallback 'login2026admin' is ONLY used if neither environment variable nor database config exists.
  const activeKey = envKey || configKey || 'login2026admin';

  if (!adminKey || adminKey !== activeKey) {
    return res.status(401).json({ error: 'Invalid Game Master Key' });
  }

  let adminUser = await db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  if (!adminUser) {
    const resId = await db.prepare(`
      INSERT INTO users (username, passkey, name, batch, email, role, created_at)
      VALUES ('admin', ?, 'LOGIN 2026 Game Master', 'Staff', 'admin@psgtech.ac.in', 'admin', ?)
    `).run(activeKey, Date.now());
    adminUser = await db.prepare("SELECT * FROM users WHERE id = ?").get(resId.lastInsertRowid);
  } else if (adminUser.passkey !== activeKey) {
    await db.prepare("UPDATE users SET passkey = ? WHERE username = 'admin'").run(activeKey);
  }

  const token = generateToken(adminUser);
  return res.json({
    token,
    user: adminUser,
    message: 'Game Master session authenticated.'
  });
});

// Current Authenticated Profile
authRouter.get('/me', requireAuth, (req, res) => {
  let path = [];
  try { path = JSON.parse(req.user.assigned_path_json || '[]'); } catch (e) {}

  const mustChangePassword = (req.user.password_changed !== 1 && req.user.role !== 'admin');

  res.json({
    user: {
      ...req.user,
      total_nodes: path.length,
      password_changed: req.user.password_changed || 0,
      mustChangePassword
    }
  });
});

// Change Password (First Login Prompt or User Settings)
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  const cleanPass = newPassword.trim();
  await db.prepare('UPDATE users SET passkey = ?, password_changed = 1 WHERE id = ?').run(cleanPass, req.user.id);
  const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    success: true,
    message: 'Password successfully updated. Your account is secured for LOGIN 2026.',
    user: {
      ...updatedUser,
      password_changed: 1,
      mustChangePassword: false
    }
  });
});

// Alias for PIN / passkey update
authRouter.post('/set-pin', requireAuth, async (req, res) => {
  const { newPasskey, newPassword } = req.body;
  const pass = (newPassword || newPasskey || '').trim();
  if (!pass || pass.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  await db.prepare('UPDATE users SET passkey = ?, password_changed = 1 WHERE id = ?').run(pass, req.user.id);
  const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    success: true,
    message: 'Password updated successfully.',
    user: {
      ...updatedUser,
      password_changed: 1,
      mustChangePassword: false
    }
  });
});

// Self-Service Passkey Recovery (Verifies matching registered Email + Mobile Number)
authRouter.post('/recover-passkey', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) {
    return res.status(400).json({ error: 'Both registered Email and Mobile Number are required for passkey recovery.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const phoneDigits = phone.trim().replace(/[^0-9]/g, '');

  if (phoneDigits.length < 7) {
    return res.status(400).json({ error: 'Please enter a valid mobile number.' });
  }

  // Find user matching email AND phone digits
  const user = await db.prepare(`
    SELECT * FROM users
    WHERE role != 'admin'
      AND LOWER(email) = ?
      AND (
        phone = ? 
        OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ?
        OR phone LIKE ?
      )
  `).get(cleanEmail, phone.trim(), phoneDigits, `%${phoneDigits}%`);

  if (!user) {
    return res.status(404).json({ 
      error: 'No alumni record found matching both that Email and Mobile number. Please double-check the registration details provided to the organizing team.' 
    });
  }

  // Reset passkey back to their clean phone number, and prompt for password change on next login
  const resetPasskey = (user.phone || phoneDigits).trim();
  await db.prepare('UPDATE users SET passkey = ?, password_changed = 0 WHERE id = ?').run(resetPasskey, user.id);

  return res.json({
    success: true,
    message: `Password reset to your registered mobile number: ${resetPasskey}. You will be prompted to set a new password upon logging in.`,
    username: user.username,
    passkey: resetPasskey
  });
});
