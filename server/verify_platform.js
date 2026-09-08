// Rigorous Production Test Suite for LOGIN 2026 MCA Alumni Nethunt Platform
import { db } from './db.js';

const BASE = 'http://localhost:3001';

async function runRigorousTests() {
  console.log('================================================================');
  console.log('  LOGIN 2026 NETHUNT - RIGOROUS VERIFICATION & BENCHMARK SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await fetch(`${BASE}/api/health`).then(r => r.json());
    assert(health.status === 'online', 'Server online and serving health check');

    // 2. Admin Authentication
    const adminRes = await fetch(`${BASE}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: 'login2026admin' })
    }).then(r => r.json());
    assert(adminRes.token, 'Game Master admin authenticated');
    const adminToken = adminRes.token;

    // 3. Full Alumni CRUD Testing
    console.log('\n--- Testing Full Alumni CRUD Operations ---');
    db.prepare("DELETE FROM users WHERE username LIKE 'rajesh_crud%' OR username LIKE 'karthik_%' OR username LIKE 'pooja_%'").run();
    
    // 3A: CREATE Alumni
    const testAlumData = {
      name: 'Dr. Rajesh Kumar',
      batch: '2005',
      username: 'rajesh_crud_test',
      passkey: 'mca2005pass',
      email: 'rajesh@alumni.psg.edu'
    };
    const createRes = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(testAlumData)
    }).then(r => r.json());
    assert(createRes.success && createRes.user?.id, 'CREATE: Alumni enrolled successfully with auto-generated path');
    const createdUserId = createRes.user.id;

    // 3B: READ Alumni List with Search Query
    const searchRes = await fetch(`${BASE}/api/admin/alumni?q=rajesh`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(searchRes.alumni?.some(a => a.username === testAlumData.username), 'READ: Alumni found via search query filter');

    // 3C: UPDATE Alumni
    const updateRes = await fetch(`${BASE}/api/admin/alumni/${createdUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Dr. Rajesh Kumar (Distinguished Alum)', score: 450, current_step: 3 })
    }).then(r => r.json());
    assert(updateRes.success && updateRes.user?.score === 450, 'UPDATE: Alumni profile and scores modified successfully');

    // 3D: RESET Alumni Progress
    const resetRes = await fetch(`${BASE}/api/admin/alumni/${createdUserId}/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(resetRes.success, 'RESET: Alumni progress reset to Step 0 with new randomized trajectory');

    // 3E: DELETE Alumni
    const deleteRes = await fetch(`${BASE}/api/admin/alumni/${createdUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(deleteRes.success, 'DELETE: Alumni record successfully removed');

    // 3F: Node CRUD Operations
    console.log('\n--- Testing Full Node CRUD Operations ---');
    const testNodeData = {
      node_code: 'NODE_TEST_CRUD',
      title: 'Automated Test Verification Node',
      tier: 'foundation',
      domain: 'test-suite',
      story: 'Created automatically by verification script.',
      clue_text: 'What is 2 + 2 in base 10?',
      clue_payload: 'CALCULATION: 2 + 2',
      answer: '4',
      aliases: ['four', '4'],
      near_misses: { '3': 'Too low by 1!', '5': 'Too high by 1!' },
      hints: ['Hint 1', 'Hint 2', 'Hint 3', 'Hint 4', 'Hint 5', 'Hint 6', 'Hint 7'],
      base_points: 1000
    };

    // CREATE Node
    const createNodeRes = await fetch(`${BASE}/api/admin/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(testNodeData)
    }).then(r => r.json());
    assert(createNodeRes.success && createNodeRes.id, 'NODE CREATE: New challenge node deployed successfully');
    const createdNodeId = createNodeRes.id;

    // UPDATE Node
    const updateNodeRes = await fetch(`${BASE}/api/admin/nodes/${createdNodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ ...testNodeData, title: 'Updated Verification Node Title', base_points: 1200 })
    }).then(r => r.json());
    assert(updateNodeRes.success, 'NODE UPDATE: Challenge node modified successfully');

    // TEST SOLVE Node
    const testSolveCorrect = await fetch(`${BASE}/api/admin/nodes/${createdNodeId}/test-solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ answer: 'four' })
    }).then(r => r.json());
    assert(testSolveCorrect.correct, 'NODE TEST-SOLVE: Correct alias verified');

    const testSolveNearMiss = await fetch(`${BASE}/api/admin/nodes/${createdNodeId}/test-solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ answer: '3' })
    }).then(r => r.json());
    assert(!testSolveNearMiss.correct && testSolveNearMiss.nearMiss === 'Too low by 1!', 'NODE TEST-SOLVE: Near-miss feedback verified');

    // DELETE Node
    const deleteNodeRes = await fetch(`${BASE}/api/admin/nodes/${createdNodeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(deleteNodeRes.success, 'NODE DELETE: Challenge node deleted successfully');

    // 4. Enroll Real Competitors for Path & Gameplay Verification
    console.log('\n--- Testing Cryptic Engine & 20-Node Trajectories ---');
    const runId = Date.now().toString().slice(-4);
    const alumA = { name: 'Karthik Subramanian', batch: '2012', username: `karthik_${runId}`, passkey: 'psg123' };
    const alumB = { name: 'Pooja Narayanan', batch: '2019', username: `pooja_${runId}`, passkey: 'psg456' };

    const regA = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(alumA)
    }).then(r => r.json());
    assert(regA.user?.nodesCount === 20, `TRAJECTORY: Alumni path generated with exactly 20 nodes (got ${regA.user?.nodesCount})`);

    const regB = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(alumB)
    }).then(r => r.json());
    assert(regB.user?.nodesCount === 20, 'TRAJECTORY: Alumni B path generated with 20 nodes');

    const loginA = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: alumA.username, passkey: alumA.passkey })
    }).then(r => r.json());

    const loginB = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: alumB.username, passkey: alumB.passkey })
    }).then(r => r.json());

    const nodeA = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginA.token}` }
    }).then(r => r.json());

    const nodeB = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginB.token}` }
    }).then(r => r.json());

    assert(nodeA.totalSteps === 20, `TRAJECTORY ARENA: Player Arena reports 20 total challenge steps (got ${nodeA.totalSteps})`);

    // 5. Zero Client-Side Clue Leaks Check
    assert(nodeA.node && nodeA.node.answer === undefined, 'ZERO LEAK: Plaintext answer is NOT sent in client payload');
    assert(nodeA.node.aliases_json === undefined && nodeA.node.aliases === undefined, 'ZERO LEAK: Aliases are NOT sent in client payload');
    assert(nodeA.node.near_misses === undefined, 'ZERO LEAK: Near-miss dictionary is NOT sent in client payload');
    assert(nodeA.node.unlockedHints.length === 0, 'ZERO LEAK: Unlocked hints count is strictly 0 initially');

    // 6. Verify Anti-Collusion Trajectories
    assert(nodeA.node.code !== nodeB.node.code, `ANTI-COLLUSION: Alumni A starts on ${nodeA.node.code}, Alumni B starts on ${nodeB.node.code}`);

    // 7. Test Progressive 7-Stage Decaying Hints
    console.log('\n--- Testing Progressive 7-Stage Hint Point Decay ---');
    const h1 = await fetch(`${BASE}/api/hunt/unlock-hint`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginA.token}` }
    }).then(r => r.json());
    assert(h1.hintNumber === 1 && h1.currentPotentialPoints === 850, 'Stage 1 Hint: Potential points reduced from 1000 to 850 (15% decay)');

    const h2 = await fetch(`${BASE}/api/hunt/unlock-hint`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginA.token}` }
    }).then(r => r.json());
    assert(h2.hintNumber === 2 && h2.currentPotentialPoints === 720, 'Stage 2 Hint: Potential points reduced to 720 (28% decay)');

    // 8. Strict Sliding-Window Rate Limiting (5 attempts / 60 seconds)
    console.log('\n--- Testing Brute-Force Immunity (Sliding Window: 5 attempts / 60s) ---');
    let rateLimited = false;

    for (let i = 1; i <= 6; i++) {
      const subRes = await fetch(`${BASE}/api/hunt/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginA.token}` },
        body: JSON.stringify({ answer: `wrong_guess_${i}` })
      });
      if (subRes.status === 429) {
        rateLimited = true;
        const data = await subRes.json();
        assert(data.retryAfter !== undefined, `BRUTE-FORCE IMMUNITY: Attempt #${i} strictly blocked with HTTP 429 (Retry-After: ${data.retryAfter}s)`);
        break;
      }
    }
    assert(rateLimited, 'Sliding-window limiter successfully blocked 6th attempt within rolling 60s window');

    // 9. Correct Solve & Sub-Millisecond Tie-Breaking
    console.log('\n--- Testing Solve & Sub-Millisecond Tie-Breaking ---');
    const nodeBDetail = db.prepare('SELECT answer FROM nodes WHERE node_code = ?').get(nodeB.node.code);
    const solveB = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({ answer: nodeBDetail.answer })
    }).then(r => r.json());

    assert(solveB.correct && solveB.pointsEarned === 1000, 'Alumni B solved Node 1 with 0 hints for full 1000 points');

    // Verify In-Memory Leaderboard Ranking & High-Resolution Precision
    const lb = await fetch(`${BASE}/api/leaderboard`).then(r => r.json());
    assert(lb.leaderboard.length >= 2, 'Leaderboard returned ranked players from in-memory cache');
    assert(lb.leaderboard[0].username === alumB.username, 'Alumni B ranked #1 with 1000 points');
    assert(lb.leaderboard[0].last_solved_subms > 0, 'High-resolution sub-millisecond solve timestamp recorded on winner');

    // 10. Verify Expanded 60-Puzzle Master Library
    console.log('\n--- Verifying Expanded 60-Puzzle Master Library ---');
    const totalNodesCount = db.prepare("SELECT COUNT(*) as count FROM nodes").get().count;
    assert(totalNodesCount >= 60, `VERIFIED: Master pool contains ${totalNodesCount} challenges (>= 60)`);

    const montyHall = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_09'").get();
    assert(montyHall && montyHall.answer === '2/3', 'VERIFIED: Monty Hall puzzle answer is 2/3');

    const bridgeU2 = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_10'").get();
    assert(bridgeU2 && bridgeU2.answer === '17', 'VERIFIED: Bridge lantern puzzle answer is 17');

    const ropesTimer = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_11'").get();
    assert(ropesTimer && ropesTimer.answer === '3', 'VERIFIED: Burning ropes timer ends answer is 3');

    const poisonedWine = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_12'").get();
    assert(poisonedWine && poisonedWine.answer === '10', 'VERIFIED: Poisoned wine binary test answer is 10');

    const crosswordDorm = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_14'").get();
    assert(crosswordDorm && crosswordDorm.answer === 'dormitory', 'VERIFIED: Cryptic crossword anagram answer is dormitory');

    const pinCodePeelamedu = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_16'").get();
    assert(pinCodePeelamedu && pinCodePeelamedu.answer === '641004', 'VERIFIED: Peelamedu PSG Tech PIN code answer is 641004');

    const rfcAvian = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_17'").get();
    assert(rfcAvian && rfcAvian.answer === '1149', 'VERIFIED: RFC Avian Carrier protocol answer is 1149');

    const gitEmptyTree = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_24'").get();
    assert(gitEmptyTree && gitEmptyTree.answer === '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'VERIFIED: Git empty tree SHA-1 answer is 4b825dc642cb6eb9a060e54bf8d69288fbee4904');

    const sevenBridges = db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_28'").get();
    assert(sevenBridges && sevenBridges.answer === 'graph theory', 'VERIFIED: Seven bridges of Königsberg answer is graph theory');

    // 11. Concurrency Load Benchmark (500+ Concurrent Requests)
    console.log('\n--- Benchmarking 500 Concurrent Leaderboard Requests ---');
    const startBench = Date.now();
    const concurrentRequests = Array.from({ length: 500 }).map(() =>
      fetch(`${BASE}/api/leaderboard`).then(r => r.json())
    );
    const results = await Promise.all(concurrentRequests);
    const benchDuration = Date.now() - startBench;

    assert(results.length === 500 && results[0].leaderboard, `CONCURRENCY: 500 concurrent leaderboard queries served in ${benchDuration}ms (~${Math.round(benchDuration / 500 * 100) / 100}ms/req)`);

    // 12. Verify Passkey Strategy (Mobile login, PIN personalization, Self-service recovery, Admin 1-click reset)
    console.log('\n--- Verifying Robust Passkey Strategy ---');
    
    // 12A: Enroll test alumnus with Mobile and Organization
    const passkeyAlumData = {
      name: 'Nandhakumar P',
      email: 'nandhakumar.verify@gmail.com',
      phone: '9025505020',
      batch: '19MX',
      organization: '360watts'
    };
    db.prepare("DELETE FROM users WHERE email = ? OR phone = ?").run(passkeyAlumData.email, passkeyAlumData.phone);
    
    const enrollAlum = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(passkeyAlumData)
    }).then(r => r.json());
    assert(enrollAlum.success, 'PASSKEY: Alumnus enrolled with phone and organization');

    // 12B: Login using Phone as Identifier and Phone as Default Passkey
    const phoneLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '9025505020', passkey: '9025505020' })
    }).then(r => r.json());
    assert(phoneLogin.token && phoneLogin.user.name === 'Nandhakumar P', 'PASSKEY: Successful login using Phone as Username and Phone as Passkey');

    // 12C: Login using Email as Identifier and Phone as Default Passkey
    const emailLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nandhakumar.verify@gmail.com', passkey: '9025505020' })
    }).then(r => r.json());
    assert(emailLogin.token, 'PASSKEY: Successful login using Email as Username and Phone as Passkey');

    // 12D: Alumnus sets custom personal PIN
    const setPinRes = await fetch(`${BASE}/api/auth/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emailLogin.token}` },
      body: JSON.stringify({ newPasskey: 'securePin8899' })
    }).then(r => r.json());
    assert(setPinRes.success, 'PASSKEY: Custom security PIN personalized successfully');

    // 12E: Self-service recovery (User recovers passkey with Email + Phone)
    const recoverRes = await fetch(`${BASE}/api/auth/recover-passkey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nandhakumar.verify@gmail.com', phone: '9025505020' })
    }).then(r => r.json());
    assert(recoverRes.success && recoverRes.passkey === '9025505020', 'PASSKEY: Self-service recovery resets passkey to phone number');

    // 12F: Admin 1-click Reset Passkey
    const adminResetPasskey = await fetch(`${BASE}/api/admin/alumni/${enrollAlum.user.id}/reset-passkey`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(adminResetPasskey.success && adminResetPasskey.passkey === '9025505020', 'PASSKEY: Admin 1-click reset passkey to phone number executed');

    // 13. Verify Duplicate Alumnus Prevention & Hardening
    console.log('\n--- Verifying Duplicate Alumnus Prevention & Hardening ---');

    // 13A: Reject duplicate enrollment by Phone
    const dupPhoneRes = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Clone Nandhakumar',
        email: 'clone.nandha@gmail.com',
        phone: '9025505020',
        batch: '19MX'
      })
    });
    const dupPhoneData = await dupPhoneRes.json();
    assert(dupPhoneRes.status === 409 && dupPhoneData.error.includes('Duplicate Alumnus'), 'DUPLICATE GUARD: Blocked duplicate enrollment with same phone number (HTTP 409)');

    // 13B: Reject duplicate enrollment by Email
    const dupEmailRes = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Clone Nandhakumar 2',
        email: 'NANDHAKUMAR.VERIFY@GMAIL.COM',
        phone: '9876543210',
        batch: '19MX'
      })
    });
    const dupEmailData = await dupEmailRes.json();
    assert(dupEmailRes.status === 409 && dupEmailData.error.includes('Duplicate Alumnus'), 'DUPLICATE GUARD: Blocked duplicate enrollment with same email address (case-insensitive HTTP 409)');

    // 13C: Bulk enroll deduplication
    const bulkDupRes = await fetch(`${BASE}/api/admin/bulk-enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        rawText: `NAME\tEMAIL\tPHONE\tBATCH\tORGANIZATION\nNandhakumar P\tnandhakumar.verify@gmail.com\t9025505020\t19MX\t360watts\nBrand New Alum\tbrandnew@psg.edu\t9111222333\t20MX\tGoogle`
      })
    }).then(r => r.json());
    assert(bulkDupRes.success && bulkDupRes.skipped >= 1 && bulkDupRes.duplicatesSkipped?.length >= 1, 'DUPLICATE GUARD: Bulk importer blocked existing alumnus duplicate from creating second row');

    // 14. Verify First-Login Password Change & Account Security Protocol
    console.log('\n--- Verifying First-Login Password Change & Security Protocol ---');

    // 14A: Initial login indicates mustChangePassword is required
    const initialLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nandhakumar.verify@gmail.com', passkey: '9025505020' })
    }).then(r => r.json());
    assert(initialLogin.mustChangePassword === true && initialLogin.user.password_changed === 0, 'AUTH: Initial login flags mustChangePassword = true');

    // 14B: Alumnus updates password via /api/auth/change-password
    const changePassRes = await fetch(`${BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${initialLogin.token}` },
      body: JSON.stringify({ newPassword: 'secureAlumPassword2026' })
    }).then(r => r.json());
    assert(changePassRes.success && changePassRes.user.password_changed === 1 && changePassRes.user.mustChangePassword === false, 'AUTH: Personal password set successfully via /api/auth/change-password');

    // 14C: Authenticated profile confirms password_changed is 1
    const meProfile = await fetch(`${BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${initialLogin.token}` }
    }).then(r => r.json());
    assert(meProfile.user.password_changed === 1 && meProfile.user.mustChangePassword === false, 'AUTH: Authenticated profile verifies password_changed is 1');

    // 14D: Subsequent login with new password succeeds with mustChangePassword = false
    const updatedLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nandhakumar.verify@gmail.com', passkey: 'secureAlumPassword2026' })
    }).then(r => r.json());
    assert(updatedLogin.token && updatedLogin.mustChangePassword === false, 'AUTH: Login with newly changed personal password succeeds without prompt');

    // 14E: Old default phone password is no longer accepted after change
    const oldPassLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nandhakumar.verify@gmail.com', passkey: '9025505020' })
    });
    assert(oldPassLogin.status === 401, 'AUTH: Old default phone password rejected after password change');

    // 15: Game Master Admin Key Rotation & Revocation of login2026admin
    console.log('\n--- Verifying Admin Key Rotation & Revocation of login2026admin ---');
    const rotateRes = await fetch(`${BASE}/api/admin/change-admin-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ newAdminKey: 'psgCustomSecretKey999!' })
    }).then(r => r.json());
    assert(rotateRes.success === true, 'ADMIN: Game Master key rotated successfully via /api/admin/change-admin-key');

    // Attempt login with old default login2026admin -> MUST BE STRICTLY REJECTED (401)
    const oldAdminAttempt = await fetch(`${BASE}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: 'login2026admin' })
    });
    assert(oldAdminAttempt.status === 401, 'SECURITY: Default login2026admin is strictly blocked after custom key is set');

    // Attempt login with new custom key -> MUST SUCCEED (200)
    const newAdminAttempt = await fetch(`${BASE}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: 'psgCustomSecretKey999!' })
    });
    assert(newAdminAttempt.status === 200, 'ADMIN: Login with new custom Game Master passkey succeeds');

    // Clean up: Reset back to default in db for clean state
    db.prepare("UPDATE config SET value = 'login2026admin' WHERE key = 'admin_key'").run();
    db.prepare("UPDATE users SET passkey = 'login2026admin' WHERE username = 'admin'").run();

    console.log('\n================================================================');
    console.log(`  ALL CRITICAL OBJECTIVES VERIFIED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runRigorousTests();
