import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'psg-tech-mca-login-2026-secret-key-super-secure';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      batch: user.batch,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fetch latest user state from DB
    const user = await db.prepare(`
      SELECT id, username, name, batch, email, phone, organization, role, 
             assigned_path_json, current_step, score, tab_violations, is_disqualified, 
             passkey, password_changed, test_started_at, test_duration_minutes, 
             extra_time_minutes, test_submitted_at, created_at
      FROM users WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found or deleted' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
  });
}
