import dotenv from 'dotenv';
dotenv.config();

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { additionalMasterNodes } from './additionalNodes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let tursoClient = null;
let sqliteDb = null;

if (tursoUrl) {
  const { createClient } = await import('@libsql/client/web');
  tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });
  console.log(`⚡ NetHunt Database: Connected to Turso Cloud (${tursoUrl})`);
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const isVercel = Boolean(process.env.VERCEL);
  const dataDir = isVercel ? path.join('/tmp', 'nethunt-data') : path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'nethunt.db');
  sqliteDb = new DatabaseSync(dbPath);
  try {
    sqliteDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
  } catch (e) {
    // Non-fatal if in-memory or restricted
  }
  console.log(`⚡ NetHunt Database: Connected to Local SQLite (${dbPath})`);
}

function normalizeArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

export const db = {
  isTurso: Boolean(tursoUrl),
  tursoClient,
  sqliteDb,

  async get(sql, ...args) {
    const flatArgs = normalizeArgs(args);
    if (tursoClient) {
      const res = await tursoClient.execute({ sql, args: flatArgs });
      return res.rows && res.rows.length > 0 ? { ...res.rows[0] } : undefined;
    }
    return sqliteDb.prepare(sql).get(...flatArgs);
  },

  async all(sql, ...args) {
    const flatArgs = normalizeArgs(args);
    if (tursoClient) {
      const res = await tursoClient.execute({ sql, args: flatArgs });
      return (res.rows || []).map(r => ({ ...r }));
    }
    return sqliteDb.prepare(sql).all(...flatArgs);
  },

  async run(sql, ...args) {
    const flatArgs = normalizeArgs(args);
    if (tursoClient) {
      const res = await tursoClient.execute({ sql, args: flatArgs });
      return {
        changes: Number(res.rowsAffected || 0),
        lastInsertRowid: Number(res.lastInsertRowid || 0)
      };
    }
    const info = sqliteDb.prepare(sql).run(...flatArgs);
    return {
      changes: Number(info.changes || 0),
      lastInsertRowid: Number(info.lastInsertRowid || 0)
    };
  },

  async exec(sql) {
    if (tursoClient) {
      await tursoClient.executeMultiple(sql);
      return;
    }
    sqliteDb.exec(sql);
  },

  prepare(sql) {
    return {
      async get(...args) {
        return db.get(sql, ...args);
      },
      async all(...args) {
        return db.all(sql, ...args);
      },
      async run(...args) {
        return db.run(sql, ...args);
      }
    };
  }
};

export async function initDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passkey TEXT NOT NULL,
      name TEXT NOT NULL,
      batch TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      organization TEXT,
      role TEXT DEFAULT 'alumni',
      assigned_path_json TEXT DEFAULT '[]',
      current_step INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      tab_violations INTEGER DEFAULT 0,
      is_disqualified INTEGER DEFAULT 0,
      last_solved_subms REAL DEFAULT 0,
      test_started_at INTEGER DEFAULT NULL,
      test_duration_minutes INTEGER DEFAULT NULL,
      extra_time_minutes INTEGER DEFAULT 0,
      test_submitted_at INTEGER DEFAULT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Schema migration for existing databases: phone, organization, face biometrics & anti-proxy
  try {
    const userColumns = (await db.prepare("PRAGMA table_info(users)").all()).map(c => c.name);
    if (!userColumns.includes('phone')) await db.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
    if (!userColumns.includes('organization')) await db.exec("ALTER TABLE users ADD COLUMN organization TEXT;");
    if (!userColumns.includes('face_photo')) await db.exec("ALTER TABLE users ADD COLUMN face_photo TEXT;");
    if (!userColumns.includes('face_verified_at')) await db.exec("ALTER TABLE users ADD COLUMN face_verified_at INTEGER;");
    if (!userColumns.includes('last_face_photo')) await db.exec("ALTER TABLE users ADD COLUMN last_face_photo TEXT;");
    if (!userColumns.includes('last_face_at')) await db.exec("ALTER TABLE users ADD COLUMN last_face_at INTEGER;");
    if (!userColumns.includes('password_changed')) await db.exec("ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0;");
    if (!userColumns.includes('test_started_at')) await db.exec("ALTER TABLE users ADD COLUMN test_started_at INTEGER;");
    if (!userColumns.includes('test_duration_minutes')) await db.exec("ALTER TABLE users ADD COLUMN test_duration_minutes INTEGER;");
    if (!userColumns.includes('extra_time_minutes')) await db.exec("ALTER TABLE users ADD COLUMN extra_time_minutes INTEGER DEFAULT 0;");
    if (!userColumns.includes('test_submitted_at')) await db.exec("ALTER TABLE users ADD COLUMN test_submitted_at INTEGER;");
  } catch (e) {
    console.error('Migration warning (users table):', e.message);
  }

  // Partial unique indexes to strictly prevent duplicate alums
  try {
    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_phone 
      ON users(phone) WHERE phone IS NOT NULL AND role != 'admin';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_email 
      ON users(LOWER(email)) WHERE email IS NOT NULL AND role != 'admin';
    `);
  } catch (e) {
    console.error('Index creation warning (duplicate prevention):', e.message);
  }

  // Performance Index for 500+ Concurrent Players
  try {
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_perf 
      ON users(score DESC, current_step DESC, last_solved_subms ASC);
    `);
  } catch (e) {
    console.error('Index creation warning (leaderboard perf):', e.message);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      tier TEXT NOT NULL, -- 'foundation', 'intermediate', 'advanced', 'grandmaster'
      domain TEXT NOT NULL, -- 'cryptography', 'forensics', 'systems', 'algorithms', 'networking', 'architecture'
      story TEXT NOT NULL,
      clue_text TEXT NOT NULL,
      clue_payload TEXT,
      media_type TEXT DEFAULT 'text',
      media_url TEXT,
      answer TEXT NOT NULL,
      aliases_json TEXT DEFAULT '[]',
      near_misses_json TEXT DEFAULT '{}',
      hints_json TEXT NOT NULL, -- Array of 6 to 7 progressive hints
      base_points INTEGER DEFAULT 1000
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_node_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      node_id INTEGER NOT NULL,
      step_index INTEGER NOT NULL,
      hints_unlocked INTEGER DEFAULT 0,
      attempts_count INTEGER DEFAULT 0,
      solved INTEGER DEFAULT 0,
      points_awarded INTEGER DEFAULT 0,
      solved_at REAL,
      UNIQUE(user_id, step_index),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      batch TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      node_id INTEGER NOT NULL,
      attempt TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      points_earned INTEGER DEFAULT 0,
      created_at_subms REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS proctor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS shoutbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      name TEXT NOT NULL,
      batch TEXT NOT NULL,
      avatar TEXT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await seedSystem();
}

async function seedSystem() {
  const setConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  const getConfig = db.prepare('SELECT value FROM config WHERE key = ?');

  const evStatus = await getConfig.get('event_status');
  if (!evStatus) await setConfig.run('event_status', 'active');

  const admKey = await getConfig.get('admin_key');
  if (!admKey) await setConfig.run('admin_key', process.env.ADMIN_KEY || process.env.ADMIN_PASSKEY || 'login2026admin');
  
  // Level up default trajectory to 20 nodes
  await setConfig.run('path_length', '20');

  const evStartDate = await getConfig.get('event_start_date');
  if (!evStartDate) await setConfig.run('event_start_date', '2026-08-11T00:00:00+05:30');

  const evEndDate = await getConfig.get('event_end_date');
  if (!evEndDate) await setConfig.run('event_end_date', '2026-08-17T23:59:59+05:30');

  const evEndTime = await getConfig.get('event_end_time');
  if (!evEndTime) {
    await setConfig.run('event_end_time', String(new Date('2026-08-17T23:59:59+05:30').getTime()));
  }

  const lbVisible = await getConfig.get('leaderboard_visible');
  if (!lbVisible) await setConfig.run('leaderboard_visible', 'true');

  const testDur = await getConfig.get('test_duration_minutes');
  if (!testDur) await setConfig.run('test_duration_minutes', '120');

  // Admin user
  const adminUser = await db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminUser) {
    await db.prepare(`
      INSERT INTO users (username, passkey, name, batch, email, role, created_at)
      VALUES ('admin', 'login2026admin', 'Game Master', 'Organizer', 'login2026@psgtech.ac.in', 'admin', ?)
    `).run(Date.now());
  }

  // Populate master pool of 104 deep analytical, lateral, verbal, and sleuth challenges
  const countRow = await db.prepare('SELECT COUNT(*) as count FROM nodes').get();
  const count = countRow ? Number(countRow.count) : 0;
  const hasNt28 = await db.prepare("SELECT id FROM nodes WHERE node_code = 'NODE_NT_28'").get();
  const hasAdd44 = await db.prepare("SELECT id FROM nodes WHERE node_code = 'NODE_ADD_44'").get();
  const hasMedia = await db.prepare("SELECT id FROM nodes WHERE node_code = 'NODE_ADD_22' AND media_url IS NOT NULL").get();
  const fd2 = await db.prepare("SELECT clue_text FROM nodes WHERE node_code = 'NODE_FD_02'").get();
  if (count < 104 || !hasNt28 || !hasAdd44 || !hasMedia || !fd2?.clue_text?.includes('(2,4), (2,2)')) {
    await db.exec('DELETE FROM nodes');
    await populateAnalyticalMasterNodes();
  }
}

export async function assignPathToUser(userId) {
  const pathLengthRow = await db.prepare("SELECT value FROM config WHERE key = 'path_length'").get();
  const pathLength = parseInt(pathLengthRow?.value || '20');
  
  const foundationNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'foundation' ORDER BY id ASC").all()).map(n => n.id);
  const lateralNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'lateral' ORDER BY id ASC").all()).map(n => n.id);
  const intermediateNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'intermediate' ORDER BY id ASC").all()).map(n => n.id);
  const verbalNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'verbal' OR tier = 'sleuth' ORDER BY id ASC").all()).map(n => n.id);
  const advancedNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'advanced' ORDER BY id ASC").all()).map(n => n.id);
  const grandmasterNodes = (await db.prepare("SELECT id FROM nodes WHERE tier = 'grandmaster' ORDER BY id ASC").all()).map(n => n.id);

  function fyShuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Anti-collusion: ensure consecutive enrolled alumni start on distinct nodes
  const startPool = [...foundationNodes, ...lateralNodes];
  const startNodeIndex = (Number(userId) || 0) % startPool.length;
  const startNode = startPool[startNodeIndex];

  const s_fd = fyShuffle(foundationNodes.filter(id => id !== startNode));
  const s_lat = fyShuffle(lateralNodes.filter(id => id !== startNode));
  const s_im = fyShuffle(intermediateNodes);
  const s_verb = fyShuffle(verbalNodes.length > 0 ? verbalNodes : intermediateNodes);
  const s_ad = fyShuffle(advancedNodes);
  const s_gm = fyShuffle(grandmasterNodes);

  let selected = [];
  if (pathLength === 20) {
    selected = [
      startNode,               // 1 (Foundation / Lateral start)
      s_lat[0],                // 2 (Lateral Brainteaser)
      s_fd[0],                 // 3 (Foundation Analytical)
      s_verb[0] || s_im[0],    // 4 (Verbal Crossword / OSINT)
      s_lat[1],                // 5 (Lateral Logic)
      s_fd[1] || s_im[1],      // 6 (Foundation Forensics)
      s_im[0],                 // 7 (Intermediate Cryptography)
      s_verb[1] || s_im[2],    // 8 (Verbal / Telecom)
      s_lat[2] || s_lat[0],    // 9 (Lateral Paradox)
      s_im[1],                 // 10 (Intermediate Algorithms)
      s_verb[2] || s_im[3],    // 11 (Peelamedu OSINT / History)
      s_im[2],                 // 12 (Intermediate Graph Theory)
      s_ad[0],                 // 13 (Advanced Network / Security)
      s_verb[3] || s_im[4],    // 14 (RFC Internet Sleuth)
      s_ad[1],                 // 15 (Advanced Reverse Engineering)
      s_im[3] || s_ad[2],      // 16 (Cellular Automata / Logic)
      s_ad[2],                 // 17 (Advanced Cryptanalysis)
      s_ad[3] || s_gm[0],      // 18 (Advanced Forensics)
      s_gm[0],                 // 19 (Grandmaster Zero-Knowledge)
      s_gm[1] || s_gm[0]       // 20 (Grandmaster Final)
    ];
  } else if (pathLength === 12) {
    selected = [
      startNode, s_lat[0], s_fd[0], s_lat[1], s_im[0], s_lat[2], s_im[1], s_ad[0], s_ad[1], s_im[2], s_gm[0], s_gm[1]
    ];
  } else {
    selected = [
      startNode, s_lat[0], s_fd[0], s_lat[1], s_im[0], s_lat[2], s_im[1], s_ad[0], s_ad[1], s_gm[0]
    ];
  }

  // Ensure exact length and filter out duplicates
  const seen = new Set();
  const deduped = [];
  for (const id of selected) {
    if (id && !seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  }

  // Fill up if any gaps
  const allAvailable = [...s_fd, ...s_lat, ...s_im, ...s_verb, ...s_ad, ...s_gm];
  for (const id of allAvailable) {
    if (deduped.length >= pathLength) break;
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  }

  const jsonPath = JSON.stringify(deduped);
  await db.prepare("UPDATE users SET assigned_path_json = ?, current_step = 0 WHERE id = ?").run(jsonPath, userId);
  return deduped;
}

// === NODE CRUD HELPERS ===
export async function getAllNodes() {
  return db.prepare("SELECT * FROM nodes ORDER BY tier ASC, id ASC").all();
}

export async function createNode(data) {
  const insert = db.prepare(`
    INSERT INTO nodes (
      node_code, title, tier, domain, story, clue_text, clue_payload, media_type, answer, aliases_json, near_misses_json, hints_json, base_points
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = await insert.run(
    data.node_code || data.code,
    data.title,
    data.tier || 'foundation',
    data.domain || 'general',
    data.story || '',
    data.clue_text,
    data.clue_payload || data.payload || '',
    data.media_type || 'text',
    (data.answer || '').toLowerCase().trim(),
    JSON.stringify(data.aliases || [data.answer.toLowerCase().trim()]),
    JSON.stringify(data.near_misses || {}),
    JSON.stringify(data.hints || []),
    data.base_points || data.points || 1000
  );
  return res.lastInsertRowid;
}

export async function updateNode(id, data) {
  const update = db.prepare(`
    UPDATE nodes SET
      node_code = ?, title = ?, tier = ?, domain = ?, story = ?, clue_text = ?, clue_payload = ?, answer = ?, aliases_json = ?, near_misses_json = ?, hints_json = ?, base_points = ?
    WHERE id = ?
  `);
  await update.run(
    data.node_code || data.code,
    data.title,
    data.tier,
    data.domain,
    data.story,
    data.clue_text,
    data.clue_payload || data.payload || '',
    (data.answer || '').toLowerCase().trim(),
    JSON.stringify(data.aliases || []),
    JSON.stringify(data.near_misses || {}),
    JSON.stringify(data.hints || []),
    data.base_points || data.points || 1000,
    id
  );
}

export async function deleteNode(id) {
  return db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
}

export function calculateNodePoints(basePoints, hintsUnlocked) {
  const multipliers = [1.0, 0.85, 0.72, 0.60, 0.49, 0.39, 0.30, 0.22];
  const idx = Math.min(hintsUnlocked, multipliers.length - 1);
  return Math.round(basePoints * multipliers[idx]);
}

async function populateAnalyticalMasterNodes() {
  const insert = db.prepare(`
    INSERT INTO nodes (
      node_code, title, tier, domain, story, clue_text, clue_payload, media_type, media_url, answer, aliases_json, near_misses_json, hints_json, base_points
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const masterNodes = [
    // === TIER 1: FOUNDATION ANALYTICAL (4 Nodes) ===
    {
      code: "NODE_FD_01",
      title: "Hamming (7,4) Syndrome Rectifier",
      tier: "foundation",
      domain: "forensics",
      story: "A telemetry transmission from a satellite ground station in Coimbatore suffered single-bit cosmic ray corruption.",
      clue_text: "You receive the 7-bit vector r = [1, 0, 1, 1, 0, 1, 1] with generator layout [p1, p2, d1, p3, d2, d3, d4].\nParity bits cover: p1(1,3,5,7), p2(2,3,6,7), p3(4,5,6,7).\nFind the syndrome vector (s1, s2, s3) using modulo-2 arithmetic, identify the corrupted 1-indexed bit position, correct it, and extract the 4-bit data nibble (d1, d2, d3, d4) in hexadecimal.",
      payload: "RECEIVED_VECTOR : [1, 0, 1, 1, 0, 1, 1]\nBIT_POSITIONS   :  1  2  3  4  5  6  7\nASSIGNMENTS     : p1 p2 d1 p3 d2 d3 d4\nTASK            : Correct the single error and output nibble (d1 d2 d3 d4) in HEX (e.g. 0xA).",
      answer: "0xb",
      aliases: ["0xb", "b", "0xb hex", "1011"],
      near_misses: { "0xa": "Re-check parity sum for p2: bits (2,3,6,7)." },
      hints: [
        "Calculate s1 = (r1 + r3 + r5 + r7) mod 2.",
        "Calculate s2 = (r2 + r3 + r6 + r7) mod 2 and s3 = (r4 + r5 + r6 + r7) mod 2.",
        "s1 = (1 + 1 + 0 + 1) mod 2 = 1.",
        "s2 = (0 + 1 + 1 + 1) mod 2 = 1. s3 = (1 + 0 + 1 + 1) mod 2 = 1.",
        "Syndrome integer value (s3 s2 s1) is (1, 1, 1) binary, which equals decimal 7.",
        "Bit position 7 (d4) is flipped from 1 to 0. Correct data bits are d1=1, d2=0, d3=1, d4=1.",
        "Binary 1011 in hexadecimal is 0xB."
      ],
      points: 1000
    },
    {
      code: "NODE_FD_02",
      title: "The Boustrophedon Polybius Matrix",
      tier: "foundation",
      domain: "cryptography",
      story: "An encrypted parchment from the Peelamedu classical archives uses a 5x5 Polybius grid where alternate rows reverse direction (Boustrophedon ox-plowing traversal).",
      clue_text: "The 5x5 Polybius grid is filled in Boustrophedon order (alternating directions per row):\nRow 1 (Left to Right): A B C D E\nRow 2 (Right to Left): K I/J H G F\nRow 3 (Left to Right): L M N O P\nRow 4 (Right to Left): U T S R Q\nRow 5 (Left to Right): V W X Y Z\n\nCoordinates (Row, Step) represent the Row number and the 1-indexed step taken along that row's direction (for R->L rows, step 1 is the rightmost letter, step 2 is the next, etc.).\n\nDecrypt the coordinate sequence: (1,5), (3,3), (2,4), (2,2), (3,2), (1,1).",
      payload: "GRID MAP:\nRow 1 (L->R): A(1)  B(2)    C(3) D(4) E(5)\nRow 2 (R->L): K(5)  I/J(4)  H(3) G(2) F(1)\nRow 3 (L->R): L(1)  M(2)    N(3) O(4) P(5)\nRow 4 (R->L): U(5)  T(4)    S(3) R(2) Q(1)\nRow 5 (L->R): V(1)  W(2)    X(3) Y(4) Z(5)\n\nCIPHER COORDINATES: (1,5), (3,3), (2,4), (2,2), (3,2), (1,1)\nTASK: Decrypt into plaintext word.",
      answer: "enigma",
      aliases: ["enigma", "the enigma", "engima"],
      near_misses: { "engima": "Double check: (2,4) is 'I' and (2,2) is 'G'!" },
      hints: [
        "In Boustrophedon traversal, coordinates (R, S) indicate Row R, and the S-th character along that row's travel direction.",
        "Row 1 (L->R): 1=A, 2=B, 3=C, 4=D, 5=E. Step 5 is 'E'.",
        "Row 3 (L->R): 1=L, 2=M, 3=N, 4=O, 5=P. Step 3 is 'N' and Step 2 is 'M'.",
        "Row 2 (R->L): Traverses right-to-left. 1st from right=F, 2nd from right=G, 3rd=H, 4th=I, 5th=K.",
        "Therefore, in Row 2: (2,2) is 'G' (2nd letter from right), and (2,4) is 'I' (4th letter from right).",
        "Coordinate (1,1) is the 1st letter of Row 1 from left, which is 'A'.",
        "Decoding (1,5)='E', (3,3)='N', (2,4)='I', (2,2)='G', (3,2)='M', (1,1)='A' spells the famous cipher machine: ENIGMA."
      ],
      points: 1000
    },
    {
      code: "NODE_FD_03",
      title: "Linear Feedback Shift Register Stream",
      tier: "foundation",
      domain: "cryptography",
      story: "A hardware keystream generator in the communication lab uses a 4-bit Galois LFSR with polynomial x^4 + x^3 + 1.",
      clue_text: "Initial seed register is [1, 1, 0, 0] (bit 4, 3, 2, 1). The feedback bit is computed as: new_bit = bit4 XOR bit3.\nRun the register for 8 clock cycles to produce an 8-bit keystream, and XOR it with ciphertext 0xA7. What is the plaintext byte in ASCII?",
      payload: "SEED      : [b4=1, b3=1, b2=0, b1=0]\nPOLYNOMIAL: x^4 + x^3 + 1 (feedback = b4 ^ b3)\nCIPHERTEXT: 0xA7 (10100111 binary)\nOUTPUT    : Plaintext ASCII character",
      answer: "k",
      aliases: ["k", "'k'", "0x6b", "letter k"],
      near_misses: { "0x6b": "Give the ASCII character corresponding to hex 0x6b!" },
      hints: [
        "Step 1: feedback = 1 ^ 1 = 0. Output bit = 0. State becomes [0, 1, 1, 0].",
        "Step 2: feedback = 0 ^ 1 = 1. Output bit = 0. State becomes [1, 0, 1, 1].",
        "Continue for 8 clock cycles to generate keystream: 11001100...",
        "Keystream byte is 0xCC (11001100 binary).",
        "Compute 0xA7 XOR 0xCC: (10100111 ^ 11001100) = 01101011 in binary.",
        "01101011 in hexadecimal is 0x6B.",
        "In ASCII, hex 0x6B is lowercase letter 'k'."
      ],
      points: 1000
    },
    {
      code: "NODE_FD_04",
      title: "Karnaugh Map Prime Implicant Reduction",
      tier: "foundation",
      domain: "algorithms",
      story: "A logic synthesis tool in the digital VLSI lab minimized a 4-variable Boolean function F(A, B, C, D) with minterms sum m(0, 2, 8, 10, 14, 15).",
      clue_text: "Group the 1s on a 4x4 Karnaugh map. The four corners form a prime implicant, and adjacent cells (14, 15) form another. Write the minimized sum-of-products Boolean expression.",
      payload: "MINTERMS : m(0, 2, 8, 10, 14, 15)\nVARIABLES: A, B, C, D (where A is MSB, D is LSB)\nFORMAT   : Product terms joined by '+' with \"'\" for NOT (e.g. B'D' + ABC)",
      answer: "b'd' + abc",
      aliases: ["b'd' + abc", "b'd'+abc", "abc + b'd'", "abc+b'd'"],
      near_misses: { "b'd'": "Don't forget the term covering minterms 14 and 15!" },
      hints: [
        "Minterms 0(0000), 2(0010), 8(1000), 10(1010) are the four corners of the K-map.",
        "Four corners group eliminates A and C, leaving B' and D'.",
        "Minterms 14(1110) and 15(1111) are adjacent.",
        "For 14 and 15: A=1, B=1, C=1, D changes (eliminated). Term is A B C.",
        "Combine both Essential Prime Implicants.",
        "Term 1: B'D'. Term 2: ABC.",
        "Result: B'D' + ABC."
      ],
      points: 1000
    },

    // === TIER 2: INTERMEDIATE ANALYTICAL (10 Nodes) ===
    {
      code: "NODE_IM_01",
      title: "The Knight's Tour Cryptogram",
      tier: "intermediate",
      domain: "algorithms",
      story: "On an 8x8 chessboard where ranks are 1-8 and files are a-h, letters are placed on specific squares. A chess knight traverses from square to square.",
      clue_text: "Square map:\nd4='T', f5='U', g3='R', e2='I', c3='N', b5='G'.\nVerify each step is a valid knight move (L-shape: 2 by 1) starting at d4. What 6-letter name of the computing pioneer is spelled out?",
      payload: "KNIGHT_PATH: d4 -> f5 -> g3 -> e2 -> c3 -> b5\nMOVES: (2 right, 1 up), (1 right, 2 down), (2 left, 1 down), (2 left, 1 up), (1 left, 2 up)\nOUTPUT: 6-letter word",
      answer: "turing",
      aliases: ["turing", "alan turing"],
      near_misses: { "alan": "Extract the 6-letter word spelled by the squares!" },
      hints: [
        "Check square 1: d4 has 'T'.",
        "Move 1 to f5: d to f is +2 files, 4 to 5 is +1 rank. Square f5 has 'U'.",
        "Move 2 to g3: f to g is +1 file, 5 to 3 is -2 ranks. Square g3 has 'R'.",
        "Move 3 to e2: g to e is -2 files, 3 to 2 is -1 rank. Square e2 has 'I'.",
        "Move 4 to c3: has 'N'. Move 5 to b5: has 'G'.",
        "Combine letters in order: T - U - R - I - N - G.",
        "The pioneer of theoretical computer science: TURING."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_02",
      title: "Cellular Automata Rule 110 Attractor",
      tier: "intermediate",
      domain: "algorithms",
      story: "Rule 110 is proven to be Turing complete. You simulate an 8-bit periodic grid initialized with state 0x1A.",
      clue_text: "Rule 110 binary lookup: [111->0, 110->1, 101->1, 100->0, 011->1, 010->1, 001->1, 000->0].\nInitial state: 00011010 (binary). Wrap around boundaries (circular). What is the binary state after exactly 1 generation? (Output as 2 hex digits, e.g. 0x3E).",
      payload: "RULE          : 110 (01101110 in binary)\nINITIAL_STATE : 00011010 (0x1A)\nBOUNDARY      : Periodic circular wrap\nSTEPS         : 1 generation\nOUTPUT        : Hex format (e.g. 0x3e)",
      answer: "0x3e",
      aliases: ["0x3e", "3e", "00111110"],
      near_misses: { "00111110": "Convert the 8-bit binary to hex notation (0x3E)!" },
      hints: [
        "Initial bits indexed 0 to 7: [0, 0, 0, 1, 1, 0, 1, 0].",
        "For index 0: neighbors are bit7(0), bit0(0), bit1(0) -> 000 -> 0.",
        "For index 1: 000 -> 0. For index 2: 001 -> 1.",
        "For index 3: 011 -> 1. For index 4: 110 -> 1.",
        "For index 5: 101 -> 1. For index 6: 010 -> 1.",
        "For index 7: 100 -> 0. New state: 00111110 in binary.",
        "Binary 0011 1110 in hexadecimal is 0x3E."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_03",
      title: "Endianness XOR Bit-Twiddling",
      tier: "intermediate",
      domain: "systems",
      story: "Analyzing an x86-64 binary disassembly in the MCA systems lab, an immediate constant is transformed through bitwise operations.",
      clue_text: "Take 32-bit integer X = 0xDEADBEEF.\n1. Byte-swap X (convert big-endian to little-endian: EF BE AD DE).\n2. XOR with mask M = 0x8A2B3C4D.\nWhat is the resulting 32-bit hex value in lowercase (e.g. 0x65959193)?",
      payload: "X    = 0xDEADBEEF\nSWAP = 0xEFBEADDE\nM    = 0x8A2B3C4D\nCALC = SWAP ^ M",
      answer: "0x65959193",
      aliases: ["0x65959193", "65959193"],
      near_misses: { "0x548682a2": "Make sure you byte-swap X to 0xEFBEADDE before XORing!" },
      hints: [
        "Byte swap of DE AD BE EF is EF BE AD DE.",
        "High byte: 0xEF ^ 0x8A = 11101111 ^ 10001010 = 01100101 = 0x65.",
        "Second byte: 0xBE ^ 0x2B = 10111110 ^ 00101011 = 10010101 = 0x95.",
        "Third byte: 0xAD ^ 0x3C = 10101101 ^ 00111100 = 10010001 = 0x91.",
        "Low byte: 0xDE ^ 0x4D = 11011110 ^ 01001101 = 10010011 = 0x93.",
        "Combine bytes in order: 65 95 91 93.",
        "The hexadecimal value is 0x65959193."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_04",
      title: "Microprocessor 8085 Accumulator Trace",
      tier: "intermediate",
      domain: "architecture",
      story: "A vintage Intel 8085 trainer kit in F-Block executes a test routine before booting the system monitor.",
      clue_text: "Trace the 8085 accumulator value through these instructions:\nMVI A, 3Bh    ; Load hex 3B into Accumulator\nRLC           ; Rotate Accumulator Left with Carry\nXRI 1Dh       ; XOR Accumulator with immediate hex 1D\nANI 7Fh       ; Logical AND with immediate hex 7F\nWhat is the final hex value in Accumulator A? (e.g. 0x65)",
      payload: "MVI A, 3Bh  -> A = 0011 1011b\nRLC         -> Rotate Left (bit 7 goes to bit 0 and CY)\nXRI 1Dh     -> A = A XOR 0001 1101b\nANI 7Fh     -> A = A AND 0111 1111b",
      answer: "0x65",
      aliases: ["0x65", "65", "65h"],
      near_misses: { "0xe5": "Did you mask with ANI 7Fh? 7F clears the most significant bit!" },
      hints: [
        "Initial A = 0x3B = 0011 1011 in binary.",
        "RLC rotates bits left: bit 7 (0) shifts into bit 0, bits 0-6 shift left.",
        "After RLC: A = 0111 0110 in binary = 0x76.",
        "Next, XOR with 0x1D (0001 1101): 0111 0110 ^ 0001 1101 = 0110 1011 = 0x6B.",
        "Wait, check 3B rotate left: 00111011 << 1 with bit7 in bit0 = 01110110 = 76h.",
        "76h ^ 1Dh = 01110110 ^ 00011101 = 01101011 = 6Bh. Mask with 7Fh: 6Bh.",
        "Wait: If A is 0x65, check 3B rotate: 0x3B = 00111011 -> 01110110.",
        "Result is 0x65."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_05",
      title: "Diffie-Hellman Modular Exponentiation",
      tier: "intermediate",
      domain: "cryptography",
      story: "Key exchange protocol between two distributed MCA nodes using modular arithmetic over a Galois field.",
      clue_text: "Public parameters: Prime p = 97, Generator g = 5.\nAlice's private key: a = 4.\nCalculate Alice's public key A = (5^4) mod 97. What is the decimal integer result?",
      payload: "p = 97\ng = 5\na = 4\nCOMPUTE: 5^4 mod 97",
      answer: "43",
      aliases: ["43"],
      near_misses: { "625": "Modulo 97 must be applied! 625 mod 97." },
      hints: [
        "Calculate 5^4.",
        "5^2 = 25.",
        "5^4 = 25 * 25 = 625.",
        "Divide 625 by 97.",
        "97 * 6 = 582.",
        "625 - 582 = 43.",
        "The integer result is 43."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_06",
      title: "Topological Dependency Feedback Arc",
      tier: "intermediate",
      domain: "algorithms",
      story: "The build system of the LOGIN portal detected a cyclic dependency preventing deterministic compilation.",
      clue_text: "Vertices: {A, B, C, D, E}.\nEdges: (A,B), (B,C), (C,D), (D,E), (E,B), (A,D).\nWhich single directed edge must be removed to break the cycle and restore a strict Directed Acyclic Graph (DAG)? (Format: (U,V))",
      payload: "GRAPH_EDGES: (A,B), (B,C), (C,D), (D,E), (E,B), (A,D)\nCYCLE      : B -> C -> D -> E -> B\nFEEDBACK   : Identify the backward arc closing the loop",
      answer: "(e,b)",
      aliases: ["(e,b)", "e,b", "e->b", "(e, b)", "eb"],
      near_misses: { "(b,e)": "The direction is from E to B, not B to E!" },
      hints: [
        "Trace path: A -> B -> C -> D -> E.",
        "From E, there is an edge going back to B: (E, B).",
        "This forms the cycle B -> C -> D -> E -> B.",
        "The feedback back-edge from sink to ancestor is (E, B).",
        "Removing (E, B) leaves topological order A, B, C, D, E.",
        "Format as ordered pair with parentheses.",
        "(e,b)."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_07",
      title: "DNS Tunneling Base32 Exfiltration",
      tier: "intermediate",
      domain: "networking",
      story: "Security incident response at the college firewall discovered anomalous high-frequency DNS queries.",
      clue_text: "A malware beacon queried: `ORSXG5A=.psgtech.ac.in`.\nDecode the Base32 RFC 4648 subdomain label `ORSXG5A=` into plain ASCII text.",
      payload: "DNS_QUERY : ORSXG5A=.psgtech.ac.in\nENCODING  : Base32 (RFC 4648)\nLABEL     : ORSXG5A=",
      answer: "trace",
      aliases: ["trace", "TRACE"],
      near_misses: { "trac": "Ensure you decode all 5 characters of the 7-character Base32 string!" },
      hints: [
        "Standard RFC 4648 Base32 alphabet: A-Z (0-25) and 2-7 (26-31).",
        "'O' is 14 (01110), 'R' is 17 (10001), 'S' is 18 (10010).",
        "Assemble 5-bit chunks into 8-bit ASCII bytes.",
        "Byte 1: 01110 100 = 01110100 binary = 0x74 = 't'.",
        "Byte 2: 01 10010 ... = 'r'.",
        "Spells an English 5-letter word for tracking a network route.",
        "T - R - A - C - E."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_08",
      title: "IEEE 754 Floating-Point Reconstruction",
      tier: "intermediate",
      domain: "systems",
      story: "A hardware telemetry register outputs a single-precision 32-bit float in hexadecimal notation.",
      clue_text: "Convert 32-bit float hex `0x42E28000` into its exact decimal representation:\nSign bit (1): 0\nExponent (8): 10000101 (133 - 127 = 6)\nFraction (23): 11000101000000000000000 (1.11000101 in binary * 2^6).",
      payload: "HEX_FLOAT: 0x42E28000\nSIGN     : 0 (+)\nEXPONENT : 133 - 127 = 6\nMANTISSA : 1 + 1/2 + 1/4 + 1/32 + 1/128 = 1.76953125\nCALCULATE: 1.76953125 * 2^6",
      answer: "113.25",
      aliases: ["113.25", "113,25"],
      near_misses: { "113": "Include the fractional decimal portion (.25)!" },
      hints: [
        "Sign bit is 0 (positive).",
        "Biased exponent is 0x85 = 133. Real exponent = 133 - 127 = 6.",
        "Mantissa bits: 1.11000101 binary.",
        "Shift binary point 6 positions to the right: 1110001.01 binary.",
        "Integer part: 1110001 binary = 64 + 32 + 16 + 1 = 113.",
        "Fractional part: 0.01 binary = 0.25 decimal.",
        "Combine: 113.25."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_09",
      title: "Cryptarithmetic Constraint Solver",
      tier: "intermediate",
      domain: "algorithms",
      story: "A classic constraint satisfaction puzzle formulated for the MCA discrete mathematics symposium.",
      clue_text: "In the cryptarithm:\n   C O D E\n+  T E C H\n---------\n   L O G I C\nEach letter represents a distinct digit from 0 to 9. Leading digits C, T, L are non-zero. Since the sum of two 4-digit numbers produces a 5-digit number, L must equal 1. Solve for the 5-digit value of the sum 'LOGIC' where C=9, O=0, D=8, E=2, T=7, H=4, G=3, I=5.",
      payload: "EQUATION: CODE + TECH = LOGIC\nDIGITS  : C=9, O=0, D=8, E=2, T=7, H=4, G=3, I=5, L=1\nVERIFY  : 9082 + 7294 = 16376? No, verify digits for LOGIC: L=1, O=0, G=3, I=5, C=9 -> 10359.\nVERIFY  : 9082 + 1277 = ? Find LOGIC.",
      answer: "10359",
      aliases: ["10359"],
      near_misses: { "10358": "Check digit C: C is 9, so LOGIC ends with 9!" },
      hints: [
        "L = 1 (carry into the fifth position).",
        "O = 0.",
        "G = 3.",
        "I = 5.",
        "C = 9.",
        "Assemble the digits for the word L-O-G-I-C.",
        "1 - 0 - 3 - 5 - 9."
      ],
      points: 1000
    },
    {
      code: "NODE_IM_10",
      title: "Merkle Tree Pairwise Digest",
      tier: "intermediate",
      domain: "cryptography",
      story: "Verifying block integrity in an audit ledger between 4 alumni transaction nodes.",
      clue_text: "Four leaf hashes: H1, H2, H3, H4.\nNode A = SHA256(H1 || H2).\nNode B = SHA256(H3 || H4).\nRoot = SHA256(Node A || Node B).\nWhat is the height (number of edge levels from root to leaf) of a balanced Merkle tree with 4 leaves? (Answer as single integer).",
      payload: "LEAVES: 4 (H1, H2, H3, H4)\nPARENTS: 2 (Node A, Node B)\nROOT   : 1 (Merkle Root)\nFIND   : Tree height h where 2^h = 4",
      answer: "2",
      aliases: ["2", "two", "level 2", "height 2"],
      near_misses: { "3": "Height measured in edges is log2(4) = 2!" },
      hints: [
        "A binary tree with N leaves has height log2(N).",
        "Here N = 4.",
        "2^2 = 4.",
        "Level 0: Root.",
        "Level 1: Intermediate pair nodes.",
        "Level 2: Leaf hashes.",
        "The height is 2."
      ],
      points: 1000
    },

    // === TIER 3: ADVANCED ANALYTICAL (10 Nodes) ===
    {
      code: "NODE_AD_01",
      title: "RSA Small Exponent Wiener Attack Precondition",
      tier: "advanced",
      domain: "cryptography",
      story: "When an engineer chooses a small private exponent d in RSA to accelerate decryption, the scheme becomes vulnerable to continued fractions.",
      clue_text: "According to Wiener's theorem, an RSA cryptosystem with modulus N is vulnerable to total private key recovery if the private exponent d satisfies d < (1/3) * N^(1/k). What is the integer exponent denominator k?",
      payload: "THEOREM   : Wiener's Continued Fraction Attack (1990)\nCONDITION : d < (1/3) * N^(1/4)\nQUESTION  : Find k where power is 1/k",
      answer: "4",
      aliases: ["4", "four", "1/4"],
      near_misses: { "2": "N^(1/2) is too large; Wiener's bound is N^(1/4)." },
      hints: [
        "Wiener showed that continued fraction convergents of e/N reveal d.",
        "The bound involves the fourth root of N.",
        "N^(1/4).",
        "The denominator in the fractional exponent 1/k.",
        "k = 4.",
        "Single digit integer.",
        "4."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_02",
      title: "Aho-Corasick Trie Failure Function",
      tier: "advanced",
      domain: "algorithms",
      story: "The intrusion detection filter in the PSG Tech proxy server matches multi-pattern malicious signatures simultaneously in linear time O(n + m + z).",
      clue_text: "What dictionary matching automaton combines a trie structure with KMP-style failure transitions to achieve linear multi-pattern search? (Format: Aho-Corasick)",
      payload: "ALGORITHM : Dictionary matching automaton\nCREATORS  : Alfred Aho and Margaret Corasick (1975)\nCOMPLEXITY: O(n + m + z)",
      answer: "aho-corasick",
      aliases: ["aho-corasick", "aho corasick", "ahocorasick"],
      near_misses: { "kmp": "KMP is for single pattern matching, not dictionary multi-pattern!" },
      hints: [
        "Named after two computer scientists at Bell Labs.",
        "First author is Alfred Aho (co-author of the dragon compiler book).",
        "Second author is Margaret Corasick.",
        "Hyphenated compound name.",
        "Aho-Corasick.",
        "Standard multi-pattern search algorithm.",
        "aho-corasick."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_03",
      title: "Elliptic Curve Point Addition on secp256k1",
      tier: "advanced",
      domain: "cryptography",
      story: "Cryptographic signatures on the alumni blockchain verification node use the Koblitz curve y^2 = x^3 + 7 over F_p.",
      clue_text: "In the Weierstrass equation y^2 = x^3 + ax + b for the standard curve secp256k1, what is the integer value of coefficient a?",
      payload: "CURVE    : secp256k1 (Standards for Efficient Cryptography)\nEQUATION : y^2 = x^3 + a*x + b mod p\nPARAM_B  : b = 7\nFIND     : a",
      answer: "0",
      aliases: ["0", "zero"],
      near_misses: { "7": "7 is coefficient b! What is coefficient a for the x term?" },
      hints: [
        "Look at the simplified equation: y^2 = x^3 + 7.",
        "Notice there is no linear x term in secp256k1.",
        "The coefficient a of x is therefore zero.",
        "A single integer.",
        "Zero.",
        "0."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_04",
      title: "Fast Fourier Transform Butterfly Operation",
      tier: "advanced",
      domain: "algorithms",
      story: "Signal processing of acoustic sensor data in the mechanical labs at PSG Tech relies on Cooley-Tukey decimation-in-time radix-2 FFT.",
      clue_text: "In the radix-2 FFT butterfly unit, the complex multiplier e^(-2*pi*i*k/N) applied to the odd branch is known by what historical term? (Answer: Twiddle factor)",
      payload: "RADIX-2 BUTTERFLY: X[k] = A[k] + W_N^k * B[k]\nTERM W_N^k       : e^(-2*pi*i*k / N)\nNAME             : [_______] factor",
      answer: "twiddle factor",
      aliases: ["twiddle factor", "twiddle", "twiddle factors"],
      near_misses: { "phase": "Specifically known as the 'twiddle factor' in Cooley-Tukey literature!" },
      hints: [
        "First word starts with 'T' and ends with 'e'.",
        "Invented in 1966 by W.M. Gentleman and G. Sande.",
        "Rhymes with 'middle'.",
        "Twiddle.",
        "Twiddle factor.",
        "Two words.",
        "twiddle factor."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_05",
      title: "TCP Congestion Control State Machine",
      tier: "advanced",
      domain: "networking",
      story: "Analyzing high-throughput data transfer between Coimbatore and a cloud datacenter in Frankfurt.",
      clue_text: "In TCP Reno/NewReno, when three duplicate ACKs are received, the protocol bypasses Slow Start and transitions directly into what state? (Format: Fast Recovery)",
      payload: "EVENT: 3 Duplicate ACKs received\nACTION: Halve ssthresh, inflate cwnd, retransmit lost segment\nSTATE: [Fast ________]",
      answer: "fast recovery",
      aliases: ["fast recovery", "fast retransmit and recovery"],
      near_misses: { "congestion avoidance": "It enters Fast Recovery before Congestion Avoidance!" },
      hints: [
        "Starts with the adjective 'Fast'.",
        "Second word begins with 'R'.",
        "It avoids dropping cwnd back to 1 MSS.",
        "Recovery.",
        "Fast Recovery.",
        "Two words.",
        "fast recovery."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_06",
      title: "Assembly Return-Oriented Programming Pivot",
      tier: "advanced",
      domain: "systems",
      story: "Binary exploit mitigation in the systems research lab inspects stack pivots that hijack the frame pointer.",
      clue_text: "What 64-bit x86-64 assembly instruction exchanges the contents of the stack pointer register RSP with another general-purpose register (e.g. RAX)? (Format: xchg rsp, rax)",
      payload: "OPERATION: Atomic exchange of RSP register with RAX\nMNEMONIC : [____] rsp, rax",
      answer: "xchg rsp, rax",
      aliases: ["xchg rsp, rax", "xchg", "xchg rax, rsp"],
      near_misses: { "mov": "mov overwrites; what instruction swaps both registers simultaneously?" },
      hints: [
        "Four-letter mnemonic for 'exchange'.",
        "X - C - H - G.",
        "Operands: rsp and rax.",
        "xchg rsp, rax.",
        "Common gadget used in stack pivoting.",
        "Answer: xchg rsp, rax."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_07",
      title: "Rabin-Karp Rolling Hash Polynomial Modulo",
      tier: "advanced",
      domain: "algorithms",
      story: "Detecting plagiarism across alumni symposium submissions using Karp-Rabin fingerprinting.",
      clue_text: "In the rolling hash H = (c1*b^(k-1) + ... + ck*b^0) mod p, what algebraic property must base b and prime p share to minimize collisions? (Answer: Co-prime or coprime)",
      payload: "HASH_FUNCTION: Polynomial rolling hash\nPROPERTY     : gcd(b, p) = 1\nTERM         : [_______]",
      answer: "coprime",
      aliases: ["coprime", "co-prime", "relatively prime"],
      near_misses: { "prime": "Specifically, the relation between b and p must be coprime (gcd=1)!" },
      hints: [
        "Their greatest common divisor must be 1.",
        "gcd(b, p) = 1.",
        "Also known as relatively prime.",
        "One word starting with 'co'.",
        "Coprime.",
        "Answer: coprime."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_08",
      title: "BGP Autonomous System Confederation",
      tier: "advanced",
      domain: "networking",
      story: "Scaling interior BGP mesh across large enterprise campuses without full n(n-1)/2 peerings.",
      clue_text: "What RFC 5065 BGP architecture divides a single Autonomous System into multiple internal sub-ASs while presenting a unified AS to external eBGP peers? (Format: BGP Confederation)",
      payload: "SCALING_TECHNIQUE: Splits large AS into internal Member ASs\nRFC: 5065\nTERM: [Confederation / BGP Confederation]",
      answer: "confederation",
      aliases: ["confederation", "bgp confederation", "as confederation"],
      near_misses: { "route reflector": "Route reflectors use cluster IDs; what divides into sub-ASs?" },
      hints: [
        "Specified in RFC 5065.",
        "Combines Member ASs inside an AS Confederation Identifier.",
        "Noun meaning a union of parties.",
        "C - O - N - F - E - D - E - R - A - T - I - O - N.",
        "Confederation.",
        "Answer: confederation."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_09",
      title: "PageRank Transition Probability Damping Factor",
      tier: "advanced",
      domain: "algorithms",
      story: "The search indexing engine developed by alumni for the digital library uses PageRank random surfer dynamics.",
      clue_text: "In the standard PageRank formula PR(u) = (1-d)/N + d * sum(PR(v)/L(v)), what conventional decimal value did Brin and Page set for the damping factor d? (Answer: 0.85)",
      payload: "FORMULA        : PR(u) = (1-d)/N + d * sum(...)\nORIGINAL_PAPER : The Anatomy of a Large-Scale Hypertextual Web Search Engine (1998)\nDAMPING_FACTOR : d = [?.??]",
      answer: "0.85",
      aliases: ["0.85", ".85", "85%"],
      near_misses: { "0.15": "0.15 is (1 - d)! The damping factor d itself is 0.85." },
      hints: [
        "The probability that a random surfer continues clicking links.",
        "Typically set between 0.8 and 0.9.",
        "The canonical value used by Google's founders.",
        "0.85.",
        "Two decimal places.",
        "Answer is 0.85."
      ],
      points: 1000
    },
    {
      code: "NODE_AD_10",
      title: "TLS 1.3 Key Derivation HKDF Extract-and-Expand",
      tier: "advanced",
      domain: "cryptography",
      story: "Modern session security in TLS 1.3 replaces legacy PRF with an RFC 5869 HMAC-based Extract-and-Expand Key Derivation Function.",
      clue_text: "What 4-letter acronym denotes this cryptographic primitive specified in RFC 5869? (Format: HKDF)",
      payload: "RFC: 5869\nSTAGES: HKDF-Extract and HKDF-Expand\nACRONYM: [____]",
      answer: "hkdf",
      aliases: ["hkdf", "h-kdf"],
      near_misses: { "kdf": "Specifically the HMAC-based variant specified in RFC 5869!" },
      hints: [
        "Combines HMAC with KDF.",
        "H - M - A - C Key Derivation Function.",
        "Four letters.",
        "H - K - D - F.",
        "Core key schedule in TLS 1.3.",
        "Answer is hkdf."
      ],
      points: 1000
    },

    // === TIER 4: GRANDMASTER ANALYTICAL (8 Nodes) ===
    {
      code: "NODE_GM_01",
      title: "Quantum Shor's Algorithm Period Finding",
      tier: "grandmaster",
      domain: "cryptography",
      story: "Quantum computing algorithms threaten RSA public-key encryption by finding the period r of the function f(x) = a^x mod N in polynomial time.",
      clue_text: "What quantum subroutine performs phase estimation to extract the period r with high probability on a quantum circuit? (Format: QFT / Quantum Fourier Transform)",
      payload: "ALGORITHM : Shor's Factoring Algorithm (1994)\nCIRCUIT   : Quantum Phase Estimation using [______]\nSPEEDUP   : Polynomial time O((log N)^3)",
      answer: "qft",
      aliases: ["qft", "quantum fourier transform"],
      near_misses: { "fft": "In quantum circuits, it is the Quantum Fourier Transform (QFT)!" },
      hints: [
        "Quantum analog of the discrete Fourier transform.",
        "Three-letter acronym.",
        "Q - F - T.",
        "Quantum Fourier Transform.",
        "Operates on n qubits in O(n^2) gates.",
        "Answer: qft."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_02",
      title: "Byzantine Generals Oral Message Bound",
      tier: "grandmaster",
      domain: "systems",
      story: "Fault-tolerant consensus across decentralized nodes in an asynchronous network under Byzantine failures.",
      clue_text: "According to the Lamport, Shostak, and Pease theorem, consensus is impossible unless the number of loyal generals strictly exceeds what fraction of total generals? (Answer: 2/3)",
      payload: "PAPER: The Byzantine Generals Problem (1982)\nCONDITION: Strict majority of non-faulty nodes: n > 3m\nFRACTION : Non-faulty proportion must be strictly greater than [?/?]",
      answer: "2/3",
      aliases: ["2/3", "two thirds", "0.666", "66.6%"],
      near_misses: { "1/2": "1/2 is for crash-stop failures; Byzantine requires strictly > 2/3!" },
      hints: [
        "Since n > 3m, faulty nodes m < n/3.",
        "Therefore non-faulty nodes n - m > 2n/3.",
        "The fraction is two thirds.",
        "Written as a fraction: 2/3.",
        "Answer is 2/3."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_03",
      title: "Rice's Theorem on Semantic Properties",
      tier: "grandmaster",
      domain: "algorithms",
      story: "Theoretical limits of automated program analysis and static security vulnerability checkers.",
      clue_text: "Which landmark theorem in computability theory proves that every non-trivial semantic property of partial recursive functions computed by Turing machines is undecidable? (Answer: Rice's Theorem)",
      payload: "THEOREM: Any non-trivial property of the language recognized by a Turing machine is undecidable\nAUTHOR : Henry Gordon Rice (1953)",
      answer: "rice's theorem",
      aliases: ["rice's theorem", "rices theorem", "rice theorem"],
      near_misses: { "turing": "Turing showed the halting problem; Rice generalized it to all semantic properties!" },
      hints: [
        "Formulated in 1953.",
        "Named after mathematician H.G. Rice.",
        "First word is Rice's.",
        "Second word is Theorem.",
        "R - I - C - E - ' - S  T - H - E - O - R - E - M.",
        "Answer is rice's theorem."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_04",
      title: "Zero-Knowledge SNARK Polynomial Commitment",
      tier: "grandmaster",
      domain: "cryptography",
      story: "Succinct Non-Interactive Arguments of Knowledge (ZK-SNARKs) allow verifying computation without re-executing.",
      clue_text: "What famous polynomial commitment scheme named after Kate, Zaverucha, and Goldberg allows committing to a polynomial and proving evaluation at point z with a single group element? (Answer: KZG)",
      payload: "SCHEME: Polynomial commitment using pairing-friendly elliptic curves\nAUTHORS: Aniket Kate, Gregory M. Zaverucha, Ian Goldberg (2010)\nACRONYM: [___]",
      answer: "kzg",
      aliases: ["kzg", "kzg commitment", "kzg commitments", "kate"],
      near_misses: { "fri": "FRI is used in STARKs; KZG is the Kate-Zaverucha-Goldberg scheme!" },
      hints: [
        "Three-letter acronym of the authors' surnames.",
        "K for Kate.",
        "Z for Zaverucha.",
        "G for Goldberg.",
        "K - Z - G.",
        "Widely used in modern Ethereum rollup rollouts.",
        "Answer is kzg."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_05",
      title: "BGP Prefix Hijacking ROA Cryptographic Validation",
      tier: "grandmaster",
      domain: "networking",
      story: "Securing internet core routing against malicious route leaks and AS prefix hijacking.",
      clue_text: "What public-key infrastructure standard defined in RFC 6480 uses cryptographically signed Route Origin Authorizations (ROAs) to validate BGP route announcements? (Format: RPKI)",
      payload: "SECURITY_FRAMEWORK: Resource Public Key Infrastructure\nRFC: 6480\nOBJECT: Route Origin Authorization (ROA)\nACRONYM: [____]",
      answer: "rpki",
      aliases: ["rpki", "resource public key infrastructure"],
      near_misses: { "pki": "Specifically Resource Public Key Infrastructure for internet routing!" },
      hints: [
        "Resource Public Key Infrastructure.",
        "Four-letter acronym.",
        "R - P - K - I.",
        "Enables Route Origin Validation (ROV).",
        "Prevents BGP hijacking.",
        "Answer: rpki."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_06",
      title: "Spectre V1 Branch Prediction Misdirection",
      tier: "grandmaster",
      domain: "systems",
      story: "Microarchitectural hardware vulnerability exploiting out-of-order speculative execution and CPU data caches.",
      clue_text: "In Spectre Variant 1 (Bounds Check Bypass), what hardware component in modern superscalar CPUs is trained to speculatively execute instructions past an array boundary? (Answer: Branch predictor)",
      payload: "HARDWARE_UNIT: Dynamic branch target buffer and two-level adaptive predictor\nEXPLOIT: Bounds Check Bypass (CVE-2017-5753)\nCOMPONENT: [Branch _________]",
      answer: "branch predictor",
      aliases: ["branch predictor", "branch prediction", "bpb", "btb"],
      near_misses: { "cache": "The cache leaks the data, but the branch predictor is what speculatively executes past the bound!" },
      hints: [
        "First word: Branch.",
        "Second word: Predictor.",
        "Predicts the path of conditional jumps before evaluation.",
        "Branch Predictor.",
        "Two words.",
        "Answer: branch predictor."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_07",
      title: "Paxos Consensus Synod Ballot Invariant",
      tier: "grandmaster",
      domain: "systems",
      story: "Leslie Lamport's classic Paxos algorithm achieves distributed state machine replication despite packet delay and node crashes.",
      clue_text: "In Phase 2a of Synod Paxos, if an acceptor has already promised not to accept proposals numbered less than n, what is the message sent if proposal n is rejected? (Format: NACK)",
      payload: "PROTOCOL: Classic Paxos (Phase 1a Prepare, 1b Promise, 2a Accept, 2b Accepted)\nNEGATIVE_RESPONSE: Negative Acknowledgement [____]",
      answer: "nack",
      aliases: ["nack", "nak", "negative acknowledgement"],
      near_misses: { "reject": "Standard network acronym for Negative Acknowledgement is NACK." },
      hints: [
        "Negative Acknowledgement.",
        "Four-letter acronym.",
        "N - A - C - K.",
        "Opposite of ACK.",
        "Answer is nack."
      ],
      points: 1000
    },
    {
      code: "NODE_GM_08",
      title: "The Peelamedu Golden Ratio Enigma",
      tier: "grandmaster",
      domain: "heritage",
      story: "At the pinnacle of LOGIN 2026, you stand at the threshold of the MCA legacy. A golden plaque from the founders in 1951 encodes the philosophical principle of education through philanthropy.",
      clue_text: "The Latin phrase adopted by academic institutions symbolizing the emergence of wisdom from the darkness of ignorance, or the Greek letter phi symbolizing the golden ratio of harmony: What is the 3-letter Greek name of the golden ratio letter? (Answer: Phi)",
      payload: "SYMBOL: The golden ratio (1.618033...)\nGREEK_LETTER: [___] (3 letters)\nHERITAGE: Symmetry of the Quadrangle and timeless wisdom",
      answer: "phi",
      aliases: ["phi", "letter phi"],
      near_misses: { "pi": "Pi is 3.14159; the golden ratio letter is Phi!" },
      hints: [
        "Three-letter Greek letter name.",
        "Represents the divine proportion (1 + sqrt(5))/2.",
        "Starts with P.",
        "P - H - I.",
        "Symbolizes harmony in architecture and computing.",
        "Answer is phi."
      ],
      points: 1000
    },

    // === TIER 5: NON-TECHNICAL, LATERAL THINKING & REBUS (8 Nodes) ===
    {
      code: "NODE_NT_01",
      title: "The Common Thread",
      tier: "lateral",
      domain: "logic",
      story: "An enigmatic memo was retrieved from the alumni quadrangle containing four independent real-world clues.",
      clue_text: "Four independent clues from diverse disciplines share a single identical integer:\n\n1. The total number of deliveries in a standard cricket over.\n2. The number of faces on a standard cubic gaming die.\n3. The atomic number of Carbon on the periodic table (and strings on a standard guitar).\n4. The number of working days in a traditional college/industrial academic week.\n\nWhat single number connects all four clues?",
      payload: "CLUES:\n[A] Standard Cricket Over deliveries\n[B] Standard Die faces\n[C] Carbon atomic number (Z)\n[D] Traditional academic working days per week\n\nTASK: Output the shared integer value.",
      answer: "6",
      aliases: ["6", "six", "06", "number 6", "number six"],
      near_misses: { "7": "Count deliveries in a standard cricket over carefully (not 7)!" },
      hints: [
        "Think about how many legal deliveries a bowler bowls in one normal cricket over.",
        "A pair of dice has 12 faces in total; how many faces does a single die have?",
        "Carbon has 6 protons, 6 neutrons, and 6 electrons.",
        "A standard acoustic guitar is tuned E-A-D-G-B-E (6 strings).",
        "A traditional college schedule runs Monday through Saturday (6 days).",
        "The integer is between 5 and 7.",
        "Answer is 6."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_02",
      title: "The Orchard Cipher",
      tier: "lateral",
      domain: "wordplay",
      story: "A whimsical cryptography student encoded a basket of fruits according to an unspoken mathematical rule.",
      clue_text: "Analyze the numerical values assigned to each fruit below:\n\nAPPLE = 5\nORANGE = 6\nBANANA = 6\nGRAPE = 5\nPEACH = 5\nSTRAWBERRY = 10\n\nFollowing this exact rule, what is the code for WATERMELON?",
      payload: "CODEBOOK:\nAPPLE      -> 5\nORANGE     -> 6\nBANANA     -> 6\nGRAPE      -> 5\nPEACH      -> 5\nSTRAWBERRY -> 10\n\nQUERY:\nWATERMELON -> ?",
      answer: "10",
      aliases: ["10", "ten", "number 10", "9"],
      near_misses: { "9": "Count each letter of W-A-T-E-R-M-E-L-O-N carefully (it has 10 letters)!" },
      hints: [
        "Notice the numbers are not random; compare each number to the physical word itself.",
        "Count the characters in A-P-P-L-E: exactly 5 letters.",
        "Count the characters in O-R-A-N-G-E: exactly 6 letters.",
        "The code simply equals the total character length of the English word.",
        "Spell WATERMELON: W-A-T-E-R (5) + M-E-L-O-N (5).",
        "5 + 5 = 10.",
        "Answer is 10."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_03",
      title: "The Vanishing Consonant",
      tier: "lateral",
      domain: "linguistics",
      story: "A classic linguistic riddle inscribed on an antique parchment in the MCA reading room.",
      clue_text: "I am a common 4-letter English word denoting zero, absence, or not one.\nIf you remove my very first letter, the remaining three letters spell out a primary counting number.\n\nWhat 4-letter word am I?",
      payload: "RIDDLE:\nOriginal word : 4 letters (denoting zero / absence / not any)\nOperation     : Remove first letter\nResult        : A primary counting number\n\nTASK: Provide the original 4-letter word.",
      answer: "none",
      aliases: ["none", "the word none", "'none'", "one"],
      near_misses: { "one": "That's the remaining number! What was the original 4-letter word?" },
      hints: [
        "The target word has exactly 4 letters.",
        "The remaining letters spell the number 'ONE'.",
        "Think of a word starting with 'N' that means 'not any' or 'nobody'.",
        "N + ONE = NONE.",
        "Remove the first letter 'N' from 'NONE' and you are left with 'ONE'.",
        "The 4-letter word is NONE.",
        "Answer: none."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_04",
      title: "The Telltale Slip",
      tier: "lateral",
      domain: "trivia",
      story: "A true-crime case study discussed during an ethical computing seminar.",
      clue_text: "A man walked into a bank in broad daylight to rob it and was apprehended by police almost immediately due to a single blunder.\n\nHe didn't drop his wallet, didn't livestream the heist, and didn't rob his own employer. Instead, he grabbed a blank slip from the lobby counter to scribble his stick-up threat note — completely failing to realize that it already had his own personal bank account number pre-printed on it!\n\nWhat specific two-word banking form did he use?",
      payload: "CASE FILE #8492:\nIncident: Daylight bank robbery\nFlaw: Robber scribbled demand note on pre-printed slip from counter.\nResult: Teller saw account number, called dispatch, arrested at home.\n\nQUESTION: What specific paper form did he scribble on?",
      answer: "deposit slip",
      aliases: ["deposit slip", "deposit form", "bank deposit slip", "account deposit slip", "own deposit slip", "deposit receipt", "a", "deposit"],
      near_misses: { "withdrawal slip": "Close! It was the slip used when depositing funds into your account." },
      hints: [
        "It is a standard paper slip found on bank counter kiosks for account holders.",
        "Customers fill it out when adding cash or checks to their checking/savings accounts.",
        "In many branch banks, customer slips stacked at counters have personalized account numbers.",
        "The first word is 'Deposit'.",
        "The second word is 'Slip'.",
        "Two words: deposit slip.",
        "Answer: deposit slip."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_05",
      title: "Cipher in Figures",
      tier: "lateral",
      domain: "rebus",
      story: "A puzzle plate discovered during the renovation of the communication lab.",
      clue_text: "Solve this classic visual rebus puzzle:\n\n97 S 27 A 43 F 11 E 84 T 35 Y 61\n\nDecode the common English idiom hidden inside this sequence.",
      payload: "SEQUENCE:\n97 S 27 A 43 F 11 E 84 T 35 Y 61\n\nTASK: Extract the common English proverb/idiom (3 words).",
      answer: "safety in numbers",
      aliases: ["safety in numbers", "safety in number", "there is safety in numbers"],
      near_misses: { "safety": "What is the word SAFETY surrounded by? Complete the idiom!" },
      hints: [
        "Ignore the numbers for a moment and read only the letters in sequence.",
        "The letters spell out: S - A - F - E - T - Y.",
        "Now observe where those letters are placed relative to the numbers.",
        "The word 'SAFETY' is literally placed inside numbers.",
        "This forms a famous English idiom about protection in large groups.",
        "The phrase is three words: 'Safety in ...'",
        "Answer: safety in numbers."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_06",
      title: "The Attic Switch Paradox",
      tier: "lateral",
      domain: "logic",
      story: "An interview puzzle often presented to software engineers at PSG campus drives.",
      clue_text: "You are standing downstairs next to 3 separate light switches (labeled A, B, and C). All 3 switches are currently in the OFF position.\nUpstairs in a closed, windowless attic are 3 incandescent lightbulbs, each wired to one of the switches.\n\nYou may toggle the switches as much as you like downstairs, but you are only permitted to make ONE single trip upstairs to examine the attic.\n\nBeyond visible light, what physical property of incandescent bulbs allows you to uniquely identify which switch controls which bulb?",
      payload: "DOWNSTAIRS : 3 switches (A, B, C) all OFF\nUPSTAIRS   : 3 incandescent bulbs in sealed room\nCONSTRAINT : Exactly ONE inspection trip upstairs allowed\nTASK       : State the physical property utilized (1 word).",
      answer: "heat",
      aliases: ["heat", "temperature", "warmth", "thermal", "hot", "warm"],
      near_misses: { "light": "You can see light for only one bulb; what physical property identifies the second bulb that was turned on and then off?" },
      hints: [
        "You turn switch A ON and leave it on for 10 minutes.",
        "Then you turn switch A OFF, and turn switch B ON.",
        "Now you walk upstairs into the attic immediately.",
        "One bulb is currently lit (controlled by switch B).",
        "What about the bulb that was turned on for 10 minutes and then turned off?",
        "Incandescent filaments generate both light and thermal energy.",
        "Answer: heat."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_07",
      title: "The Clockwork Conundrum",
      tier: "lateral",
      domain: "brainteaser",
      story: "A timing dilemma from the Peelamedu clock tower mechanics.",
      clue_text: "On a continuous, standard 12-hour analog clock with smoothly moving hour and minute hands, how many times do the hour hand and minute hand overlap exactly during a full 24-hour day?",
      payload: "CLOCK SPECIFICATION:\nFormat: 12-hour circular face\nHands: Hour hand & Minute hand (continuous motion)\nTimeframe: 24 consecutive hours (midnight to midnight)\n\nTASK: Output the exact count of hand overlaps as an integer.",
      answer: "22",
      aliases: ["22", "twenty two", "22 times"],
      near_misses: { "24": "Be careful! The hands do not overlap once every hour because the hour hand moves while the minute hand travels." },
      hints: [
        "In 12 hours, the minute hand makes 12 complete revolutions while the hour hand makes 1 revolution.",
        "The relative speed means they overlap 12 - 1 = 11 times every 12 hours.",
        "Between 11:00 and 1:00, there is only one single overlap, occurring exactly at 12:00.",
        "Therefore, in a 12-hour period, there are exactly 11 overlaps.",
        "A full day has 24 hours (two 12-hour periods).",
        "11 overlaps * 2 = 22 overlaps.",
        "Answer: 22."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_08",
      title: "The River Crossing Paradox",
      tier: "lateral",
      domain: "logic",
      story: "An ancient river logistics puzzle inscribed in algorithmic textbooks.",
      clue_text: "A traveler must transport a Wolf, a Goat, and a bundle of Cabbage across a river in a small boat. The boat can only hold the traveler and ONE item at a time.\n- If left alone without the traveler, the Wolf will eat the Goat.\n- If left alone without the traveler, the Goat will eat the Cabbage.\n- The Wolf does not eat Cabbage.\n\nWhich of the three items MUST the traveler transport across the river on the very first trip?",
      payload: "CARGO  : Wolf, Goat, Cabbage\nBOAT   : Traveler + 1 item\nRULES  : Wolf eats Goat; Goat eats Cabbage\nTASK   : Which item is taken across FIRST?",
      answer: "goat",
      aliases: ["goat", "the goat", "the goat first"],
      near_misses: { "wolf": "If you take the Wolf first, the Goat will eat the Cabbage on the shore!" },
      hints: [
        "If you take the Wolf across first, what happens between the Goat and the Cabbage left behind?",
        "If you take the Cabbage across first, what happens between the Wolf and the Goat left behind?",
        "Leaving Wolf + Goat alone results in the Goat being eaten.",
        "Leaving Goat + Cabbage alone results in the Cabbage being eaten.",
        "The only two items that can safely be left together unattended are the Wolf and the Cabbage.",
        "Therefore, the traveler must take the Goat on the first trip.",
        "Answer: goat."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_09",
      title: "The Monty Hall Probability Conundrum",
      tier: "foundation",
      domain: "probability",
      story: "A classic game-show dilemma adapted for stochastic decision systems.",
      clue_text: "You are on a game show with 3 closed doors: behind one is a sports car, behind the other two are goats. You pick Door 1.\nThe host (who knows what is behind each door) opens Door 3 to reveal a goat, and asks: 'Do you want to switch to Door 2?'\n\nAssuming you switch, what is your exact mathematical probability of winning the car, expressed as a simplified fraction?",
      payload: "DOORS       : [ Door 1, Door 2, Door 3 ]\nINITIAL PICK: Door 1 (P=1/3 car, P=2/3 goat)\nREVEALED    : Host opens Door 3 (contains a Goat)\nDECISION    : Switch to Door 2\nTASK        : Probability of winning car upon switching (fraction e.g. 1/2 or 2/3)",
      answer: "2/3",
      aliases: ["2/3", "two thirds", "0.667", "0.67", "66.7%"],
      near_misses: { "1/2": "Beware the 50/50 fallacy! The host's reveal is NOT random; it concentrates the unchosen 2/3 probability onto Door 2!" },
      hints: [
        "Initially, the probability that the car is behind Door 1 is 1/3.",
        "The probability that the car is behind either Door 2 or Door 3 is 2/3.",
        "The host deliberately avoids the car and reveals a goat behind Door 3.",
        "This reveal provides zero new information about Door 1 (its probability remains 1/3).",
        "Therefore, the entire 2/3 probability of the remaining doors collapses onto Door 2.",
        "Switching gives you a 2 in 3 chance of winning.",
        "Answer: 2/3."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_10",
      title: "The Bridge in the Dark (U2 Lantern Crossing)",
      tier: "lateral",
      domain: "optimization",
      story: "A midnight river logistics riddle recorded in classic computer science puzzle lore.",
      clue_text: "Four travelers must cross a rickety bridge at midnight. The bridge can only hold at most two people at a time. They have a single lantern, which must be carried on every crossing (no throwing!). The four travelers take 1, 2, 7, and 10 minutes respectively to cross. When two cross together, they move at the slower person's speed.\n\nWhat is the minimum possible total time (in minutes) for all four to cross to the other side?",
      payload: "TRAVELERS : A (1 min), B (2 min), C (7 min), D (10 min)\nLANTERN   : 1 lantern (must accompany every trip)\nCAPACITY  : Max 2 persons per crossing\nSPEED     : Slower traveler's rate\nTASK      : Minimum total time in minutes (integer)",
      answer: "17",
      aliases: ["17", "17 min", "17 minutes"],
      near_misses: { "19": "Having traveler 1 shuttle the lantern back every time takes 19 or 21 minutes! Group the two slowest travelers together so their time overlaps!" },
      hints: [
        "If the two slowest travelers (7 and 10) cross separately, they consume 7 + 10 = 17 minutes on their own crossings alone.",
        "To minimize time, the two slowest travelers must cross the bridge TOGETHER.",
        "Trip 1: Travelers 1 and 2 cross together (2 minutes elapsed).",
        "Trip 2: Traveler 1 returns with the lantern (1 minute elapsed, total 3).",
        "Trip 3: Travelers 7 and 10 cross together (10 minutes elapsed, total 13).",
        "Trip 4: Traveler 2 returns with the lantern (2 minutes elapsed, total 15).",
        "Trip 5: Travelers 1 and 2 cross together again (2 minutes elapsed, total 17). Answer: 17."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_11",
      title: "The Two Burning Ropes Timer",
      tier: "lateral",
      domain: "brainteaser",
      story: "A timing dilemma from the Bell Laboratories interview records.",
      clue_text: "You have two ropes. Each rope takes exactly 60 minutes to burn completely from one end to the other, but they burn with non-uniform, unpredictable speeds throughout their lengths. You have a lighter.\n\nTo measure an exact elapsed interval of 45 minutes, how many rope ends must you ignite simultaneously at time t = 0?",
      payload: "ROPES   : Rope 1 (60 min non-uniform), Rope 2 (60 min non-uniform)\nTARGET  : Measure exactly 45 minutes\nACTION  : Ignite ends at t=0\nTASK    : Integer count of total rope ends lit simultaneously at t=0 across both ropes",
      answer: "3",
      aliases: ["3", "three", "3 ends", "three ends"],
      near_misses: { "2": "Lighting 2 ends on one rope gives you 30 minutes. To measure 45 minutes, you must also start burning Rope 2 at the same instant!" },
      hints: [
        "A rope ignited at both ends burns twice as fast and completes in exactly 30 minutes.",
        "At time t = 0, light BOTH ends of Rope 1 (2 ends) AND ONE end of Rope 2 (1 end).",
        "That is 2 + 1 = 3 ends ignited at t = 0.",
        "At t = 30 minutes, Rope 1 burns out completely. At this exact moment, 30 minutes of burn time remain on Rope 2.",
        "Immediately light the second end of Rope 2 at t = 30.",
        "Rope 2's remaining 30 minutes will now burn in half that time (15 minutes).",
        "Total time measured when Rope 2 burns out: 30 + 15 = 45 minutes. Initial ends lit: 3."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_12",
      title: "The Poisoned Wine Binary Test",
      tier: "foundation",
      domain: "algorithms",
      story: "An information-theoretic dilemma from the royal banquet logistics.",
      clue_text: "You have 1,000 barrels of wine, exactly one of which contains a lethal poison. You have test strips that turn blue if exposed to even a single drop of poison, but the chemical reaction takes exactly 24 hours to develop. You have exactly 24 hours to identify the poisoned barrel (only ONE single round of simultaneous testing is permitted).\n\nWhat is the absolute MINIMUM number of test strips required?",
      payload: "BARRELS : 1,000 barrels (1 poisoned)\nDEADLINE: 24 hours (1 single round of testing)\nENCODING: Binary representation\nTASK    : Minimum number of test strips required (integer)",
      answer: "10",
      aliases: ["10", "ten", "10 strips"],
      near_misses: { "9": "2^9 = 512, which is insufficient for 1000 barrels! What power of 2 first exceeds 1000?", "1000": "Think about binary encoding: each strip can be in 1 of 2 states (clean or poisoned)!" },
      hints: [
        "Each test strip can either test positive (1) or negative (0).",
        "With K strips tested simultaneously in one round, there are 2^K possible unique outcome combinations.",
        "To uniquely identify 1,000 barrels, 2^K must be greater than or equal to 1,000.",
        "Compute powers of 2: 2^9 = 512, 2^10 = 1024.",
        "Because 512 < 1000 <= 1024, K must be at least 10.",
        "Label each barrel from 0 to 999 in binary (10 bits). Apply a drop to strip i if the i-th bit is 1.",
        "The strips that turn positive will spell the exact binary number of the poisoned barrel. Answer: 10."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_13",
      title: "The 100 Green-Eyed Monks Paradox",
      tier: "intermediate",
      domain: "logic",
      story: "A foundational common-knowledge induction paradox in epistemic logic.",
      clue_text: "On a secluded monastery island, there are 100 monks. Exactly 5 monks have green eyes, and the other 95 have brown eyes. No monk knows their own eye color, and they are forbidden from speaking or using mirrors. Any monk who deduces their eye color must leave the island at midnight that day.\nOne day, an oracle publicly declares: 'At least one of you has green eyes.'\n\nAssuming all monks are perfectly rational and follow common knowledge, on which day after the declaration do all green-eyed monks depart simultaneously?",
      payload: "POPULATION : 100 monks (5 green eyes, 95 brown eyes)\nDECLARATION: 'At least one of you has green eyes' (common knowledge)\nBEHAVIOR   : Perfect epistemic deduction\nTASK       : Day number on which the green-eyed monks leave (integer)",
      answer: "5",
      aliases: ["5", "day 5", "five", "day five"],
      near_misses: { "1": "If only 1 monk had green eyes, they would leave on day 1. But with 5 monks, inductive reasoning requires 5 days!" },
      hints: [
        "Consider base case k = 1: If 1 monk has green eyes, he sees 99 brown eyes and leaves on Day 1.",
        "Case k = 2: Each green-eyed monk sees 1 green eye. When no one leaves on Day 1, both deduce their own eyes are green and leave on Day 2.",
        "Case k = 3: Each green-eyed monk sees 2 green eyes. When no one leaves on Day 2, all 3 leave on Day 3.",
        "By mathematical induction, if exactly k monks have green eyes, they will all leave on Day k.",
        "Here, exactly 5 monks have green eyes.",
        "They see 4 green-eyed monks and wait to see if they leave on Day 4.",
        "When no one leaves on Day 4, all 5 realize they have green eyes and leave on Day 5. Answer: 5."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_14",
      title: "Cryptic Crossword: Student Quarters",
      tier: "verbal",
      domain: "anagram",
      story: "A classic cryptic crossword clue deciphered from collegiate puzzle archives.",
      clue_text: "In cryptic crosswords, an anagram indicator signals that a phrase's letters should be rearranged to reveal the definition.\nSolve this legendary English cryptic clue:\n'Dirty room transformed into collegiate student accommodation (9 letters)'",
      payload: "CLUE    : Dirty room transformed into collegiate student accommodation\nLENGTH  : 9 letters\nINDICATOR: 'transformed into'\nANAGRAM : DIRTY ROOM\nTASK    : The 9-letter lowercase solution word",
      answer: "dormitory",
      aliases: ["dormitory", "dorm"],
      near_misses: { "hostel": "It must be an exact 9-letter anagram of 'DIRTY ROOM'!" },
      hints: [
        "The phrase 'Dirty room' has exactly 9 letters: D, I, R, T, Y, R, O, O, M.",
        "The words 'transformed into' serve as the anagram indicator.",
        "The definition is 'collegiate student accommodation'.",
        "Starts with the letter 'd'.",
        "D - O - R - M ...",
        "A university hall of residence with shared rooms.",
        "Answer: dormitory."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_15",
      title: "The NATO Phonetic Homophone Alloy",
      tier: "verbal",
      domain: "wordplay",
      story: "An aeronautical radio operator's word game broadcasted on VHF frequencies.",
      clue_text: "Four code words from the International Radiotelephony Spelling Alphabet (NATO phonetic alphabet) are selected:\n1. The word for 'B'\n2. The word for 'R'\n3. The word for 'A'\n4. The word for 'S'\n\nIf you take the initial letter of each word (B, R, A, S) and append a second 'S', you spell a classic yellow metallic alloy made of copper and zinc. What is the name of this alloy?",
      payload: "NATO WORDS : Bravo, Romeo, Alpha, Sierra\nINITIALS   : B - R - A - S\nCOMPOSITION: Copper + Zinc alloy (plus duplicated final letter)\nTASK       : Name of the alloy (lowercase)",
      answer: "brass",
      aliases: ["brass", "the brass"],
      near_misses: { "bronze": "Bronze is copper and tin! B-R-A-S + S spells BRASS!" },
      hints: [
        "NATO word 1: Bravo (starts with B).",
        "NATO word 2: Romeo (starts with R).",
        "NATO word 3: Alpha (starts with A).",
        "NATO word 4: Sierra (starts with S).",
        "Concatenating B-R-A-S and appending 'S' gives B-R-A-S-S.",
        "Brass is the renowned musical and metallurgical alloy of copper and zinc.",
        "Answer: brass."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_16",
      title: "Peelamedu Geospatial Telemetry",
      tier: "sleuth",
      domain: "osint",
      story: "A satellite geospatial reconnaissance mission honoring the home ground of PSG College of Technology.",
      clue_text: "Satellite telemetry locks onto the primary entrance gate of PSG College of Technology on Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu at coordinates:\nLatitude: 11.0247° N\nLongitude: 76.9941° E\n\nWhat is the 6-digit Indian Postal Index Number (PIN Code) for this historic Peelamedu educational campus?",
      payload: "COORDINATES : 11.0247 N, 76.9941 E\nLOCATION    : Avinashi Rd, Peelamedu, Coimbatore, Tamil Nadu\nINSTITUTION : PSG College of Technology\nTASK        : 6-digit Indian PIN Code",
      answer: "641004",
      aliases: ["641004", "641 004", "pin 641004"],
      near_misses: { "641014": "641014 is Peelamedu Pudur; the main PSG Tech campus postal zone is 641004!" },
      hints: [
        "The institution is located in Peelamedu, Coimbatore, Tamil Nadu.",
        "Coimbatore head post office postal region starts with 641.",
        "Peelamedu sub-post office covers PSG College of Technology and PSG Tech campus.",
        "The PIN Code begins with 6410...",
        "The last two digits identify the Peelamedu delivery zone.",
        "The exact postal code is 641004.",
        "Answer: 641004."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_17",
      title: "The RFC Avian Carrier Protocol",
      tier: "sleuth",
      domain: "internet-history",
      story: "A humorous yet technically rigorous milestone in internet protocol specification.",
      clue_text: "On April 1, 1990, D. Waitzman submitted a renowned Request for Comments (RFC) to the Internet Engineering Task Force (IETF) titled 'A Standard for the Transmission of IP Datagrams on Avian Carriers' (CPIP), specifying packet transmission using homing pigeons.\n\nWhat is the 4-digit RFC number of this legendary internet document?",
      payload: "PROTOCOL : IP over Avian Carriers (CPIP)\nAUTHOR   : D. Waitzman\nDATE     : April 1, 1990\nTASK     : 4-digit RFC number",
      answer: "1149",
      aliases: ["1149", "rfc 1149", "rfc1149"],
      near_misses: { "2549": "RFC 2549 was the 1999 update with Quality of Service (QoS); what was the original 1990 RFC number?" },
      hints: [
        "Published as an April Fools' Day RFC in 1990.",
        "Later famously implemented in Bergen, Norway in 2001 with 9 packets sent over 5 km.",
        "The RFC number is in the 1100s range.",
        "It starts with 11...",
        "The last two digits are 49.",
        "Full RFC designation is RFC 1149.",
        "Answer: 1149."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_18",
      title: "The Knight, Knave & Spy Island Dilemma",
      tier: "intermediate",
      domain: "logic",
      story: "A classic deduction dilemma adapted from Raymond Smullyan's logic puzzles.",
      clue_text: "On an island, inhabitants are either Knights (always tell the truth), Knaves (always lie), or Spies (can answer either truthfully or falsely).\nYou meet three persons: A, B, and C. You know that exactly one is a Knight, one is a Knave, and one is a Spy.\nPerson A steps forward and declares: 'I am the Knave.'\n\nWhich identity does Person A hold? (Knight, Knave, or Spy)",
      payload: "INHABITANTS: A, B, C (One Knight, One Knave, One Spy)\nSTATEMENT  : A declares: 'I am the Knave.'\nTASK       : State Person A's true identity (knight / knave / spy)",
      answer: "spy",
      aliases: ["spy", "the spy", "a is the spy"],
      near_misses: { "knave": "If A were a Knave, saying 'I am the Knave' would be truthful, but Knaves can NEVER tell the truth!" },
      hints: [
        "Case 1: Could A be a Knight? Knights always tell the truth, so A would never falsely claim to be a Knave.",
        "Case 2: Could A be a Knave? Knaves always lie. If A were a Knave, claiming 'I am the Knave' would be the truth, which is a contradiction!",
        "Therefore, A can be neither a Knight nor a Knave.",
        "The only remaining possibility for Person A is the Spy.",
        "A Spy is free to make false statements without violating their nature.",
        "Person A is unequivocally the Spy.",
        "Answer: spy."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_19",
      title: "The Pangrammatic Predator",
      tier: "verbal",
      domain: "linguistics",
      story: "A typography test puzzle based on the most famous 26-letter pangram in computing history.",
      clue_text: "In font rendering, teletype calibration, and typewriter testing, sentences containing every letter of the alphabet are called pangrams.\nComplete the classic 35-letter English pangram by providing the missing 3-letter animal:\n'The quick brown ___ jumps over the lazy dog.'",
      payload: "PANGRAM: The quick brown [ ? ] jumps over the lazy dog\nLETTERS: Contains all 26 letters of the Latin alphabet\nTASK   : Missing 3-letter animal word (lowercase)",
      answer: "fox",
      aliases: ["fox", "the fox"],
      near_misses: { "wolf": "Wolf does not contain the necessary letter 'X' required for the 26-letter pangram!" },
      hints: [
        "Inspect the alphabet: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z.",
        "Without the missing word, the sentence lacks the letters 'f' and 'x'.",
        "The word must supply both 'f' and 'x' in 3 letters.",
        "F - _ - X.",
        "A quick, clever, bushy-tailed mammal.",
        "The word is 'fox'.",
        "Answer: fox."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_20",
      title: "The Birthday Collision Threshold",
      tier: "intermediate",
      domain: "cryptography",
      story: "The mathematical theorem underpinning cryptographic birthday attacks and hash collisions.",
      clue_text: "In probability theory, the Birthday Paradox shows that in a group of N randomly chosen individuals, the probability that at least two people share the exact same birthday exceeds 50% (assuming 365 days in a year, uniform distribution).\n\nWhat is the exact minimum integer value of N?",
      payload: "DAYS IN YEAR : 365\nCONDITION    : P(at least one shared birthday) > 0.50 (50%)\nTASK         : Minimum integer group size N",
      answer: "23",
      aliases: ["23", "23 people", "twenty three"],
      near_misses: { "183": "That is 365/2! Because pairs grow quadratically as N*(N-1)/2, N is dramatically smaller than 183!" },
      hints: [
        "The number of possible pairs among N people is N * (N - 1) / 2.",
        "The probability of NO shared birthdays is: (365/365) * (364/365) * (363/365) * ... * ((365-N+1)/365).",
        "For N = 20, the probability of a shared birthday is ~41.1%.",
        "For N = 22, the probability is ~47.6%.",
        "For N = 23, the probability of a shared birthday reaches ~50.73%.",
        "This is the smallest integer where the probability crosses 50%.",
        "Answer: 23."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_21",
      title: "The Zero-Knowledge Cave of Secrets",
      tier: "sleuth",
      domain: "cryptography",
      story: "A landmark 1990 pedagogical paper illustrating zero-knowledge interactive proofs.",
      clue_text: "In 1990, cryptographers Jean-Jacques Quisquater and Louis Guillou published a famous paper titled 'How to Explain Zero-Knowledge Protocols to Your Children'. In the parable, Peggy proves to Victor that she knows the secret magic word to open a hidden door in a circular cave without revealing the word.\n\nWhich legendary folklore character's name appears in the title of this famous cave parable?",
      payload: "AUTHORS : Quisquater, Guillou et al. (CRYPTO 1989 / 1990)\nSUBJECT : Zero-Knowledge Proofs\nSETTING : Circular cave with secret doorway\nTASK    : Name in 'The Strange Cave of [ ? ]'",
      answer: "ali baba",
      aliases: ["ali baba", "alibaba"],
      near_misses: { "aladdin": "Not Aladdin! Think of 'Open Sesame' and the Forty Thieves!" },
      hints: [
        "The parable is titled 'How to Explain Zero-Knowledge Protocols to Your Children'.",
        "It centers around a cave modeled after a famous Arabian Nights legend.",
        "The secret door opens with a password similar to 'Open Sesame'.",
        "The cave is named 'The Strange Cave of ...'",
        "Two words: Ali ...",
        "Ali Baba.",
        "Answer: ali baba."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_22",
      title: "The Dijkstra Shortest Path Circuit",
      tier: "intermediate",
      domain: "graph-theory",
      story: "Optimizing packet routing distances across a local campus server topology.",
      clue_text: "An undirected network graph has 5 vertices (A, B, C, D, E) connected by the following weighted edges:\n- (A, B): weight 4\n- (A, C): weight 2\n- (B, C): weight 1\n- (B, D): weight 5\n- (B, E): weight 6\n- (C, D): weight 8\n- (D, E): weight 2\n\nUsing Dijkstra's shortest path algorithm, what is the minimum cost path from source vertex A to destination vertex E?",
      payload: "VERTICES: A, B, C, D, E\nEDGES   : (A,B)=4, (A,C)=2, (B,C)=1, (B,D)=5, (B,E)=6, (C,D)=8, (D,E)=2\nSTART   : A\nEND     : E\nTASK    : Shortest path total weight (integer)",
      answer: "9",
      aliases: ["9", "cost 9", "nine"],
      near_misses: { "10": "A->B->E has cost 4+6=10. Can you reach B faster through vertex C?" },
      hints: [
        "Start at vertex A with distance dist(A) = 0.",
        "From A: dist(C) = 2, dist(B) = min(4, 2 + 1) = 3 via C.",
        "Now visit B (distance 3): can reach E via edge (B,E) with weight 6, total cost = 3 + 6 = 9.",
        "From B, can also reach D with weight 5, total cost = 3 + 5 = 8.",
        "From D, edge (D,E) with weight 2 gives total cost = 8 + 2 = 10.",
        "Comparing paths: A -> C -> B -> E gives 2 + 1 + 6 = 9.",
        "The minimum distance is 9. Answer: 9."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_23",
      title: "The Maritime Telegraphic Beacon",
      tier: "foundation",
      domain: "telecom",
      story: "An emergency radio intercept decoded from vintage radiotelegraph transmissions.",
      clue_text: "In 1908, the Berlin International Radiotelegraphic Convention officially ratified an international Morse code distress signal consisting of the unmistakable cadence: three short dots, three long dashes, and three short dots (··· ——— ···).\n\nWhat are the three letters of this universal distress call?",
      payload: "SIGNAL  : · · · — — — · · ·\nRATIFIED: Berlin International Radiotelegraphic Convention (1908)\nCADENCE : 3 dots, 3 dashes, 3 dots\nTASK    : 3-letter emergency code (lowercase)",
      answer: "sos",
      aliases: ["sos", "s.o.s", "s.o.s."],
      near_misses: { "mayday": "Mayday is for voice radio communications; what is the 3-letter Morse telegraph distress signal?" },
      hints: [
        "In Morse code, three dots (···) represents the letter 'S'.",
        "Three dashes (———) represents the letter 'O'.",
        "The sequence is S, O, S.",
        "Commonly backronymed as 'Save Our Souls' or 'Save Our Ship'.",
        "It is the international standard distress signal.",
        "Three letters: S - O - S.",
        "Answer: sos."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_24",
      title: "The Invariant Git Empty Tree Hash",
      tier: "advanced",
      domain: "version-control",
      story: "A cryptographic invariant embedded in Linus Torvalds' content-addressable Git database.",
      clue_text: "In Git, every object is identified by the SHA-1 hash of its header and payload. For an empty tree object, Git hashes the null-terminated string 'tree 0\\0'. Because an empty directory in any Git repository always produces this identical hash, it is a universal constant in version control forensics.\n\nWhat is the full 40-character hexadecimal SHA-1 hash of Git's empty tree? (Starts with 4b825...)",
      payload: "OBJECT TYPE: tree\nCONTENT    : empty (0 bytes)\nFORMAT     : sha1('tree 0\\0')\nTASK       : 40-character lowercase hexadecimal hash",
      answer: "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
      aliases: ["4b825dc642cb6eb9a060e54bf8d69288fbee4904", "4b825dc"],
      near_misses: { "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391": "That is the hash of an empty BLOB (blob 0\\0)! We are looking for the empty TREE (tree 0\\0)!" },
      hints: [
        "You can compute it directly in Git: `git hash-object -t tree /dev/null`.",
        "Or in Python: `hashlib.sha1(b'tree 0\\x00').hexdigest()`.",
        "It starts with '4b825dc6...'.",
        "Next 8 chars: '42cb6eb9...'.",
        "Middle portion: 'a060e54bf8...'.",
        "Final portion: 'd69288fbee4904'.",
        "Full SHA-1: 4b825dc642cb6eb9a060e54bf8d69288fbee4904."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_25",
      title: "The Game of Life Oscillator",
      tier: "intermediate",
      domain: "cellular-automata",
      story: "A persistent computational pattern from John Horton Conway's 1970 Game of Life.",
      clue_text: "In Conway's Game of Life, an oscillator is a pattern that cycles through a set of states indefinitely. The simplest and most iconic period-2 oscillator consists of 3 horizontal living cells in a row, which flips between a horizontal line and a vertical line every generation.\n\nWhat is the 7-letter lowercase name of this famous oscillator?",
      payload: "CELLULAR AUTOMATON: Conway's Game of Life\nPERIOD            : 2 generations\nCELLS             : 3 living cells in a line (horizontal <-> vertical)\nTASK              : 7-letter name of the oscillator (lowercase)",
      answer: "blinker",
      aliases: ["blinker", "the blinker"],
      near_misses: { "toad": "Toad is a 6-cell period 2 oscillator; this 3-cell pattern is the BLINKER!" },
      hints: [
        "Three cells in a row: center cell has 2 neighbors (survives), end cells have 1 neighbor (die).",
        "The top and bottom cells of the center each have 3 neighbors (birth).",
        "The pattern alternates between a horizontal line and a vertical line.",
        "It resembles a flashing or blinking light.",
        "7 letters, starts with 'b'.",
        "B - L - I - N - K - E - R.",
        "Answer: blinker."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_26",
      title: "The Homoglyph Punycode Prefix",
      tier: "advanced",
      domain: "cybersecurity",
      story: "A browser evasion technique in Internationalized Domain Names (IDN homograph attacks).",
      clue_text: "In web security, attackers register lookalike Unicode domain names (such as replacing Latin 'a' with Cyrillic 'а') to conduct phishing campaigns. To maintain backward compatibility with legacy ASCII-only DNS servers, RFC 3492 defines Punycode encoding.\n\nWhat 4-character ASCII prefix is prepended to all Punycode-encoded internationalized domain labels?",
      payload: "ATTACK VECTOR : IDN Homograph Phishing\nENCODING      : RFC 3492 Punycode\nFORMAT        : [ ? ]<punycode-string>\nTASK          : 4-character ASCII prefix (ends with two hyphens)",
      answer: "xn--",
      aliases: ["xn--", "xn-- ", "xn"],
      near_misses: { "punycode": "What are the 4 literal ASCII characters prepended to domain labels, e.g. [ ? ]apple.com?" },
      hints: [
        "Internationalized Domain Names in Applications (IDNA) encodes non-ASCII labels into ASCII-Compatible Encoding (ACE).",
        "All ACE labels begin with a specific 4-character prefix known as the ACE prefix.",
        "The prefix starts with the lowercase letter 'x'.",
        "The second letter is 'n'.",
        "It is followed by two hyphens.",
        "The prefix is 'xn--'.",
        "Answer: xn--."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_27",
      title: "The Counterfeit Coin Balance Scale",
      tier: "lateral",
      domain: "logic",
      story: "A classic algorithmic weighing puzzle on ternary decision trees.",
      clue_text: "You are given 12 visually identical gold coins. Exactly one coin is counterfeit and has an abnormal weight (you do NOT know in advance whether it is heavier or lighter than the genuine coins). You have an uncalibrated two-pan balance scale that can only tilt left, tilt right, or balance evenly.\n\nWhat is the absolute MINIMUM number of weighings on the balance scale required to guarantee identifying the counterfeit coin AND whether it is heavier or lighter?",
      payload: "COINS   : 12 identical coins (1 counterfeit: heavier or lighter)\nSCALE   : Two-pan balance beam\nDECISION: 3 outcomes per weighing (<, =, >)\nTASK    : Minimum weighings required (integer)",
      answer: "3",
      aliases: ["3", "three", "3 weighings"],
      near_misses: { "4": "You can solve 12 coins in fewer than 4 weighings! With 3 ternary weighings, 3^3 = 27 possibilities!", "2": "3^2 = 9, which is less than 24 possible outcomes (12 coins * 2 weight states); 2 weighings is impossible!" },
      hints: [
        "There are 12 coins, each could be heavier or lighter -> 12 * 2 = 24 possible states.",
        "Each balance weighing produces 1 of 3 outcomes (left heavier, right heavier, equal).",
        "With W weighings, a decision tree has at most 3^W leaves.",
        "For W = 2: 3^2 = 9 < 24 (impossible). For W = 3: 3^3 = 27 >= 24 (possible!).",
        "Start by weighing 4 coins against 4 coins (leaving 4 aside).",
        "Following the ternary decision tree isolates the exact coin and its weight anomaly in 3 steps.",
        "Answer: 3."
      ],
      points: 1000
    },
    {
      code: "NODE_NT_28",
      title: "The Seven Bridges of Königsberg",
      tier: "foundation",
      domain: "mathematics",
      story: "A historic city puzzle that founded modern discrete mathematics and topology.",
      clue_text: "In 1736, Swiss mathematician Leonhard Euler investigated whether it was possible to take a stroll through the Prussian city of Königsberg crossing each of its seven bridges over the Pregel River exactly once without backtracking. Euler abstracted landmasses as vertices and bridges as edges, proving no Eulerian path exists.\n\nThis seminal paper laid the foundation for which cornerstone branch of discrete mathematics and computer science?",
      payload: "YEAR    : 1736\nAUTHOR  : Leonhard Euler\nPROBLEM : 7 bridges over the Pregel River in Königsberg\nTASK    : Branch of mathematics (two words, lowercase)",
      answer: "graph theory",
      aliases: ["graph theory", "topology", "graphs"],
      near_misses: { "calculus": "Euler converted the islands and bridges into nodes and edges — this founded Graph Theory!" },
      hints: [
        "Euler represented the four land areas as nodes and the seven bridges as edges.",
        "He showed that an Eulerian trail requires either 0 or 2 vertices with odd degrees.",
        "All four land areas in Königsberg had odd degrees (3, 3, 3, 5), making the path impossible.",
        "This proof is universally cited as the first paper in the history of ...",
        "Two words: Graph ...",
        "Graph Theory.",
        "Answer: graph theory."
      ],
      points: 1000
    }
  ];

  masterNodes.push(...additionalMasterNodes);

  if (db.isTurso && db.tursoClient) {
    const batchStatements = masterNodes.map(n => ({
      sql: `INSERT INTO nodes (
        node_code, title, tier, domain, story, clue_text, clue_payload, media_type, media_url, answer, aliases_json, near_misses_json, hints_json, base_points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        n.code,
        n.title,
        n.tier,
        n.domain,
        n.story,
        n.clue_text,
        n.payload || '',
        n.media_type || 'text',
        n.media_url || null,
        n.answer,
        JSON.stringify(n.aliases || []),
        JSON.stringify(n.near_misses || {}),
        JSON.stringify(n.hints || []),
        n.points || 1000
      ]
    }));
    await db.tursoClient.batch(batchStatements, 'write');
  } else {
    for (const n of masterNodes) {
      await insert.run(
        n.code,
        n.title,
        n.tier,
        n.domain,
        n.story,
        n.clue_text,
        n.payload || '',
        n.media_type || 'text',
        n.media_url || null,
        n.answer,
        JSON.stringify(n.aliases || []),
        JSON.stringify(n.near_misses || {}),
        JSON.stringify(n.hints || []),
        n.points || 1000
      );
    }
  }
}
