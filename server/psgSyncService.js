import { db, assignPathToUser } from './db.js';
import { leaderboardCache } from './leaderboardCache.js';
import { broadcastEvent } from './events.js';

// In-memory token cache and sync telemetry
let cachedToken = null;
let tokenExpiresAt = 0;
let syncInProgress = false;
let syncIntervalTimer = null;

let lastSyncTelemetry = {
  lastSyncAt: null,
  status: 'idle', // 'idle' | 'running' | 'success' | 'error'
  totalFetched: 0,
  enrolledCount: 0,
  skippedCount: 0,
  error: null,
  lastEnrolledUsers: []
};

// Helper: Generate clean unique username
export async function generateUniqueUsername(name, email, batch, phone) {
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

// Authenticate against login.psgtech.ac.in API
async function authenticatePsgPortal(loginId, password) {
  const loginUrl = 'https://login.psgtech.ac.in/api/auth/login';
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      loginId: loginId.trim(),
      password: password
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMsg = `Authentication failed with status ${response.status}`;
    try {
      const j = JSON.parse(errorBody);
      parsedMsg = j.message || j.error || parsedMsg;
    } catch (e) {}
    throw new Error(`PSG Portal Login Error: ${parsedMsg}`);
  }

  const data = await response.json();
  const token = data?.data?.token || data?.token;
  if (!token) {
    throw new Error('PSG Portal Login did not return an authentication token.');
  }

  cachedToken = token;
  tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000; // Cache for 12 hours
  return token;
}

// Fetch users from login.psgtech.ac.in/api/users
async function fetchPsgUsers(token) {
  const usersUrl = 'https://login.psgtech.ac.in/api/users';
  const response = await fetch(usersUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedToken = null; // Token expired
      throw new Error('PSG Portal API returned 401 Unauthorized. Token may have expired.');
    }
    const errText = await response.text();
    throw new Error(`Failed to fetch users from PSG Portal (${response.status}): ${errText.slice(0, 100)}`);
  }

  const json = await response.json();
  const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
  return list;
}

/**
 * Perform sync between login.psgtech.ac.in and NetHunt
 * @param {Object} options - { loginId, password, token, force }
 */
export async function syncPsgPortalAlumni(options = {}) {
  if (syncInProgress) {
    return {
      success: false,
      message: 'A synchronization operation is already currently in progress.',
      telemetry: lastSyncTelemetry
    };
  }

  syncInProgress = true;
  lastSyncTelemetry.status = 'running';

  try {
    let token = options.token || cachedToken;
    const loginId = options.loginId || process.env.PSG_PORTAL_LOGIN_ID;
    const password = options.password || process.env.PSG_PORTAL_PASSWORD;

    // Direct token or authenticate with credentials
    if (!token) {
      if (process.env.PSG_PORTAL_TOKEN) {
        token = process.env.PSG_PORTAL_TOKEN.trim();
      } else if (loginId && password) {
        token = await authenticatePsgPortal(loginId, password);
      } else {
        throw new Error('No PSG Portal credentials or token configured. Set PSG_PORTAL_LOGIN_ID and PSG_PORTAL_PASSWORD in Render or enter them in the Sync modal.');
      }
    }

    // Attempt to fetch users (with retry on token expiry if credentials available)
    let rawUsers;
    try {
      rawUsers = await fetchPsgUsers(token);
    } catch (fetchErr) {
      if (fetchErr.message.includes('401') && loginId && password) {
        token = await authenticatePsgPortal(loginId, password);
        rawUsers = await fetchPsgUsers(token);
      } else {
        throw fetchErr;
      }
    }

    // Filter only alumni records
    const alumniRecords = rawUsers.filter(u => {
      const type = String(u.user_type || u.role || u.record_type || '').toUpperCase();
      return type === 'ALUMNI' || type === 'ALUMNUS';
    });

    let enrolled = 0;
    let skipped = 0;
    const enrolledUsers = [];
    const duplicatesSkipped = [];
    const seenPhones = new Set();
    const seenEmails = new Set();

    const now = Date.now();

    for (const item of alumniRecords) {
      const alumniName = (item.name || '').trim();
      if (!alumniName) {
        skipped++;
        continue;
      }

      const alumniBatch = (item.batch_year || item.batch || '19MX').trim();
      const alumniEmail = (item.email || '').trim() || null;
      const alumniPhone = (item.phone || item.mobile || '').trim() || null;
      const alumniOrg = (item.current_organization || item.organization || item.place || '').trim() || null;

      const cleanPhoneDigits = alumniPhone ? alumniPhone.replace(/[^0-9]/g, '') : null;
      const cleanLowerEmail = alumniEmail ? alumniEmail.toLowerCase() : null;

      // Check within-batch duplicates
      if ((cleanPhoneDigits && seenPhones.has(cleanPhoneDigits)) || (cleanLowerEmail && seenEmails.has(cleanLowerEmail))) {
        skipped++;
        duplicatesSkipped.push({ name: alumniName, phone: alumniPhone, email: alumniEmail, reason: 'Duplicate in portal payload' });
        continue;
      }

      // Check against existing database users (strict duplicate guard - NEVER modify existing player!)
      const duplicate = await db.prepare(`
        SELECT id, username, name FROM users 
        WHERE role != 'admin' AND (
          (? IS NOT NULL AND (phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ?))
          OR (? IS NOT NULL AND LOWER(email) = ?)
        )
      `).get(alumniPhone, alumniPhone, cleanPhoneDigits, cleanLowerEmail, cleanLowerEmail);

      if (duplicate) {
        skipped++;
        duplicatesSkipped.push({
          name: alumniName,
          phone: alumniPhone,
          email: alumniEmail,
          reason: `Already enrolled as @${duplicate.username} (${duplicate.name})`
        });
        continue;
      }

      if (cleanPhoneDigits) seenPhones.add(cleanPhoneDigits);
      if (cleanLowerEmail) seenEmails.add(cleanLowerEmail);

      // Auto-generate username and passkey
      const username = await generateUniqueUsername(alumniName, alumniEmail, alumniBatch, alumniPhone);
      const passkey = alumniPhone || 'psg2026';

      try {
        const insertRes = await db.prepare(`
          INSERT INTO users (username, passkey, name, batch, email, phone, organization, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'alumni', ?)
        `).run(
          username,
          passkey,
          alumniName,
          alumniBatch,
          alumniEmail,
          alumniPhone,
          alumniOrg,
          now
        );

        const newUserId = insertRes.lastInsertRowid;
        const path = await assignPathToUser(newUserId);

        enrolled++;
        enrolledUsers.push({
          id: newUserId,
          username,
          name: alumniName,
          batch: alumniBatch,
          email: alumniEmail,
          phone: alumniPhone,
          organization: alumniOrg,
          nodeCount: path.length
        });
      } catch (insertErr) {
        skipped++;
        duplicatesSkipped.push({ name: alumniName, phone: alumniPhone, email: alumniEmail, reason: 'Insert error: ' + insertErr.message });
      }
    }

    if (enrolled > 0) {
      await leaderboardCache.refreshNow();
      try {
        broadcastEvent('alumni_updated', {
          count: enrolled,
          message: `${enrolled} new alumni enrolled from PSG portal.`
        });
      } catch (e) {}
    }

    lastSyncTelemetry = {
      lastSyncAt: new Date().toISOString(),
      status: 'success',
      totalFetched: alumniRecords.length,
      enrolledCount: enrolled,
      skippedCount: skipped,
      error: null,
      lastEnrolledUsers: enrolledUsers.slice(0, 20)
    };

    return {
      success: true,
      message: `Sync complete: ${enrolled} new alumni enrolled, ${skipped} already enrolled (skipped).`,
      totalAlumniFound: alumniRecords.length,
      enrolledCount: enrolled,
      skippedCount: skipped,
      enrolledUsers,
      duplicatesSkipped: duplicatesSkipped.slice(0, 50)
    };
  } catch (err) {
    lastSyncTelemetry = {
      ...lastSyncTelemetry,
      lastSyncAt: new Date().toISOString(),
      status: 'error',
      error: err.message
    };
    return {
      success: false,
      error: err.message,
      telemetry: lastSyncTelemetry
    };
  } finally {
    syncInProgress = false;
  }
}

// Get current sync status and config
export function getPsgSyncStatus() {
  const isConfigured = Boolean(
    (process.env.PSG_PORTAL_LOGIN_ID && process.env.PSG_PORTAL_PASSWORD) ||
    process.env.PSG_PORTAL_TOKEN
  );
  const intervalMinutes = parseInt(process.env.PSG_SYNC_INTERVAL_MINUTES || '15', 10);

  return {
    isConfigured,
    configuredLoginId: process.env.PSG_PORTAL_LOGIN_ID ? process.env.PSG_PORTAL_LOGIN_ID.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
    intervalMinutes,
    syncInProgress,
    ...lastSyncTelemetry
  };
}

// Initialize recurring background polling
export function initPsgSyncBackgroundJob() {
  const isConfigured = Boolean(
    (process.env.PSG_PORTAL_LOGIN_ID && process.env.PSG_PORTAL_PASSWORD) ||
    process.env.PSG_PORTAL_TOKEN
  );

  const intervalMinutes = Math.max(2, parseInt(process.env.PSG_SYNC_INTERVAL_MINUTES || '15', 10));
  const intervalMs = intervalMinutes * 60 * 1000;

  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
    syncIntervalTimer = null;
  }

  if (isConfigured) {
    console.log(`[PSG-SYNC] Background sync configured. Polling every ${intervalMinutes} minutes.`);

    // Run first sync 15 seconds after boot so database setup completes first
    setTimeout(async () => {
      try {
        console.log('[PSG-SYNC] Running initial background alumni synchronization...');
        const res = await syncPsgPortalAlumni();
        if (res.success) {
          console.log(`[PSG-SYNC] Initial sync completed: ${res.enrolledCount} new alumni enrolled, ${res.skippedCount} skipped.`);
        } else {
          console.warn(`[PSG-SYNC] Initial sync notice: ${res.error || res.message}`);
        }
      } catch (err) {
        console.warn(`[PSG-SYNC] Initial background sync error: ${err.message}`);
      }
    }, 15000);

    // Schedule recurring intervals
    syncIntervalTimer = setInterval(async () => {
      try {
        console.log('[PSG-SYNC] Running scheduled background alumni synchronization...');
        const res = await syncPsgPortalAlumni();
        if (res.success) {
          console.log(`[PSG-SYNC] Scheduled sync completed: ${res.enrolledCount} new alumni enrolled, ${res.skippedCount} skipped.`);
        } else {
          console.warn(`[PSG-SYNC] Scheduled sync notice: ${res.error || res.message}`);
        }
      } catch (err) {
        console.warn(`[PSG-SYNC] Scheduled background sync error: ${err.message}`);
      }
    }, intervalMs);
  } else {
    console.log('[PSG-SYNC] Automated background sync is idle (PSG_PORTAL_LOGIN_ID and PSG_PORTAL_PASSWORD not set in env). On-demand Admin UI sync is ready.');
  }
}
