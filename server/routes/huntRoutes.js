import express from 'express';
import { db, assignPathToUser, calculateNodePoints } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcastEvent } from '../events.js';
import { leaderboardCache } from '../leaderboardCache.js';

export const huntRouter = express.Router();

// Strict Per-User Sliding Window Rate Limiter: 5 attempts per 60 seconds
const userRateWindows = new Map();

function checkSlidingWindowRateLimit(userId) {
  const now = Date.now();
  const windowDurationMs = 60000; // 60 seconds
  const maxAttempts = 5;

  const history = userRateWindows.get(userId) || [];
  // Keep only attempts within the rolling 60-second window
  const recent = history.filter(t => now - t < windowDurationMs);

  if (recent.length >= maxAttempts) {
    const oldestInWindow = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((windowDurationMs - (now - oldestInWindow)) / 1000));
    userRateWindows.set(userId, recent);
    return {
      limited: true,
      retryAfter: retryAfterSeconds,
      remainingAttempts: 0
    };
  }

  recent.push(now);
  userRateWindows.set(userId, recent);
  return {
    limited: false,
    remainingAttempts: maxAttempts - recent.length
  };
}

function normalizeAnswer(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, '')
    .replace(/\s+/g, ' ');
}

// GET Current Assigned Node (ZERO CLIENT-SIDE CLUE LEAKS)
huntRouter.get('/current-node', requireAuth, (req, res) => {
  const user = req.user;

  let path = [];
  try { path = JSON.parse(user.assigned_path_json || '[]'); } catch (e) {}

  if (!path || path.length === 0) {
    path = assignPathToUser(user.id);
  }

  const currentStep = user.current_step || 0;
  const totalSteps = path.length;

  if (currentStep >= totalSteps) {
    return res.json({
      completed: true,
      currentStep,
      totalSteps,
      score: user.score,
      tabViolations: user.tab_violations || 0
    });
  }

  const nodeId = path[currentStep];
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    return res.status(404).json({ error: 'Assigned node unavailable' });
  }

  let progress = db.prepare(`
    SELECT * FROM user_node_progress WHERE user_id = ? AND step_index = ?
  `).get(user.id, currentStep);

  if (!progress) {
    db.prepare(`
      INSERT INTO user_node_progress (user_id, node_id, step_index, hints_unlocked, attempts_count, solved, points_awarded)
      VALUES (?, ?, ?, 0, 0, 0, 0)
    `).run(user.id, nodeId, currentStep);

    progress = {
      hints_unlocked: 0,
      attempts_count: 0,
      solved: 0,
      points_awarded: 0
    };
  }

  let hints = [];
  try { hints = JSON.parse(node.hints_json || '[]'); } catch (e) {}

  // ZERO LEAK: Only transmit hints the user has explicitly unlocked so far
  const unlockedHintsList = hints.slice(0, progress.hints_unlocked).map((text, idx) => ({
    hintNumber: idx + 1,
    text
  }));

  const potentialPoints = calculateNodePoints(node.base_points, progress.hints_unlocked);

  // ZERO LEAK: Exclude answer, aliases_json, near_misses_json, and unrevealed hint texts
  res.json({
    completed: false,
    currentStep,
    totalSteps,
    score: user.score,
    tabViolations: user.tab_violations || 0,
    node: {
      code: node.node_code,
      title: node.title,
      tier: node.tier,
      domain: node.domain,
      story: node.story,
      clue_text: node.clue_text,
      clue_payload: node.clue_payload,
      media_type: node.media_type,
      media_url: node.media_url,
      basePoints: node.base_points,
      currentPotentialPoints: potentialPoints,
      hintsUnlockedCount: progress.hints_unlocked,
      totalHintsAvailable: hints.length,
      unlockedHints: unlockedHintsList
    }
  });
});

// POST Submit Answer with Sliding Window Rate Limit & Sub-Millisecond Tie Breaking
huntRouter.post('/submit', requireAuth, (req, res) => {
  const user = req.user;
  const { answer } = req.body;

  const eventStatus = db.prepare("SELECT value FROM config WHERE key = 'event_status'").get()?.value || 'active';
  if (eventStatus === 'paused') {
    return res.status(403).json({ error: 'Nethunt is currently paused by organizers.' });
  }
  if (eventStatus === 'ended') {
    return res.status(403).json({ error: 'LOGIN Nethunt event has concluded.' });
  }

  // Enforce 5 attempts / 60 seconds sliding window
  const rateCheck = checkSlidingWindowRateLimit(user.id);
  if (rateCheck.limited) {
    res.setHeader('Retry-After', String(rateCheck.retryAfter));
    return res.status(429).json({
      error: `Rate limit reached. Maximum 5 attempts allowed per 60-second window. Cooldown: ${rateCheck.retryAfter}s remaining.`,
      retryAfter: rateCheck.retryAfter
    });
  }

  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ error: 'Answer input cannot be empty.' });
  }

  let path = [];
  try { path = JSON.parse(user.assigned_path_json || '[]'); } catch (e) {}
  const currentStep = user.current_step || 0;

  if (currentStep >= path.length) {
    return res.status(400).json({ error: 'All assigned nodes are completed.' });
  }

  const nodeId = path[currentStep];
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    return res.status(404).json({ error: 'Node reference error.' });
  }

  const progress = db.prepare(`
    SELECT * FROM user_node_progress WHERE user_id = ? AND step_index = ?
  `).get(user.id, currentStep);

  const hintsUnlocked = progress?.hints_unlocked || 0;
  const normalizedAttempt = normalizeAnswer(answer);
  const primaryAnswer = normalizeAnswer(node.answer);

  let aliases = [];
  try { aliases = JSON.parse(node.aliases_json || '[]').map(normalizeAnswer); } catch (e) {}

  let nearMisses = {};
  try { nearMisses = JSON.parse(node.near_misses_json || '{}'); } catch (e) {}

  const isCorrect = normalizedAttempt === primaryAnswer || aliases.includes(normalizedAttempt);

  let nearMissFeedback = null;
  if (!isCorrect) {
    for (const [key, feedback] of Object.entries(nearMisses)) {
      if (normalizeAnswer(key) === normalizedAttempt || normalizedAttempt.includes(normalizeAnswer(key))) {
        nearMissFeedback = feedback;
        break;
      }
    }
  }

  // Sub-millisecond high-resolution timestamp
  const submsNow = (Date.now() + (process.hrtime()[1] / 1000000000));
  const pointsEarned = isCorrect ? calculateNodePoints(node.base_points, hintsUnlocked) : 0;

  db.prepare(`
    INSERT INTO submissions (user_id, username, batch, step_index, node_id, attempt, is_correct, points_earned, created_at_subms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    user.batch,
    currentStep,
    nodeId,
    answer.trim().substring(0, 150),
    isCorrect ? 1 : 0,
    pointsEarned,
    submsNow
  );

  db.prepare(`
    UPDATE user_node_progress SET attempts_count = attempts_count + 1 WHERE user_id = ? AND step_index = ?
  `).run(user.id, currentStep);

  if (isCorrect) {
    const nextStep = currentStep + 1;
    const newTotalScore = user.score + pointsEarned;

    db.prepare(`
      UPDATE user_node_progress SET solved = 1, points_awarded = ?, solved_at = ?
      WHERE user_id = ? AND step_index = ?
    `).run(pointsEarned, submsNow, user.id, currentStep);

    // Update with sub-millisecond timestamp for strict tie breaking
    db.prepare(`
      UPDATE users SET score = ?, current_step = ?, last_solved_subms = ?
      WHERE id = ?
    `).run(newTotalScore, nextStep, submsNow, user.id);

    // Invalidate and refresh in-memory leaderboard cache immediately
    leaderboardCache.refreshNow();

    broadcastEvent('NODE_SOLVED', {
      batch: user.batch,
      step: currentStep + 1,
      timestamp: Date.now()
    });

    return res.json({
      correct: true,
      pointsEarned,
      nextStep,
      completed: nextStep >= path.length,
      message: `Node verified. +${pointsEarned} points awarded.`
    });
  } else if (nearMissFeedback) {
    return res.json({
      correct: false,
      isNearMiss: true,
      message: nearMissFeedback,
      remainingAttempts: rateCheck.remainingAttempts
    });
  } else {
    return res.json({
      correct: false,
      isNearMiss: false,
      message: 'Invalid key. Re-examine the payload or unlock a progressive hint.',
      remainingAttempts: rateCheck.remainingAttempts
    });
  }
});

// POST Unlock Progressive Hint (Zero leak: Returns only the single newly unlocked hint)
huntRouter.post('/unlock-hint', requireAuth, (req, res) => {
  const user = req.user;
  let path = [];
  try { path = JSON.parse(user.assigned_path_json || '[]'); } catch (e) {}
  const currentStep = user.current_step || 0;

  if (currentStep >= path.length) {
    return res.status(400).json({ error: 'No active node.' });
  }

  const nodeId = path[currentStep];
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  let hints = [];
  try { hints = JSON.parse(node.hints_json || '[]'); } catch (e) {}

  let progress = db.prepare(`
    SELECT * FROM user_node_progress WHERE user_id = ? AND step_index = ?
  `).get(user.id, currentStep);

  const currentlyUnlocked = progress ? progress.hints_unlocked : 0;
  if (currentlyUnlocked >= hints.length) {
    return res.status(400).json({ error: 'All available hints for this node have been unlocked.' });
  }

  const nextHintIndex = currentlyUnlocked;
  const newUnlockedCount = currentlyUnlocked + 1;

  db.prepare(`
    UPDATE user_node_progress SET hints_unlocked = ?
    WHERE user_id = ? AND step_index = ?
  `).run(newUnlockedCount, user.id, currentStep);

  const newPotentialPoints = calculateNodePoints(node.base_points, newUnlockedCount);

  res.json({
    hintNumber: newUnlockedCount,
    totalHints: hints.length,
    hintText: hints[nextHintIndex], // Only send this specific unlocked hint
    currentPotentialPoints: newPotentialPoints,
    message: `Stage ${newUnlockedCount} hint unlocked. Potential reward: ${newPotentialPoints} pts.`
  });
});

// POST Proctor Event
huntRouter.post('/proctor-event', requireAuth, (req, res) => {
  const user = req.user;
  const { event_type, metadata } = req.body;

  if (!event_type) return res.status(400).json({ error: 'Event type required' });

  const currentStep = user.current_step || 0;
  const now = Date.now();

  db.prepare(`
    INSERT INTO proctor_logs (user_id, event_type, step_index, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, event_type, currentStep, now, metadata ? JSON.stringify(metadata) : null);

  const newViolations = (user.tab_violations || 0) + 1;
  db.prepare('UPDATE users SET tab_violations = ? WHERE id = ?').run(newViolations, user.id);

  res.json({ recorded: true, totalViolations: newViolations });
});
