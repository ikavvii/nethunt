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
    await db.prepare("DELETE FROM users WHERE username LIKE 'rajesh_crud%' OR username LIKE 'karthik_%' OR username LIKE 'pooja_%'").run();
    
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
    assert(regA.user?.nodesCount === 12, `TRAJECTORY: Alumni path generated with exactly 12 nodes (got ${regA.user?.nodesCount})`);

    const regB = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(alumB)
    }).then(r => r.json());
    assert(regB.user?.nodesCount === 12, 'TRAJECTORY: Alumni B path generated with 12 nodes');

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

    assert(nodeA.totalSteps === 12, `TRAJECTORY ARENA: Player Arena reports 12 total challenge steps (got ${nodeA.totalSteps})`);

    // 5. Zero Client-Side Clue Leaks Check
    assert(nodeA.node && nodeA.node.answer === undefined, 'ZERO LEAK: Plaintext answer is NOT sent in client payload');
    assert(nodeA.node.aliases_json === undefined && nodeA.node.aliases === undefined, 'ZERO LEAK: Aliases are NOT sent in client payload');
    assert(nodeA.node.near_misses === undefined, 'ZERO LEAK: Near-miss dictionary is NOT sent in client payload');
    assert(nodeA.node.unlockedHints.length === 0, 'ZERO LEAK: Unlocked hints count is strictly 0 initially');

    // 6. Verify Anti-Collusion Trajectories
    assert(nodeA.node.code !== nodeB.node.code, `ANTI-COLLUSION: Alumni A starts on ${nodeA.node.code}, Alumni B starts on ${nodeB.node.code}`);

    // Start test session for both participants so they can proceed with gameplay
    await fetch(`${BASE}/api/hunt/start-test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginA.token}` }
    });
    await fetch(`${BASE}/api/hunt/start-test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginB.token}` }
    });

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
    const nodeBDetail = await db.prepare('SELECT answer FROM nodes WHERE node_code = ?').get(nodeB.node.code);
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
    const countRow = await db.prepare("SELECT COUNT(*) as count FROM nodes").get();
    const totalNodesCount = countRow ? Number(countRow.count) : 0;
    assert(totalNodesCount >= 60, `VERIFIED: Master pool contains ${totalNodesCount} challenges (>= 60)`);

    const montyHall = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_09'").get();
    assert(montyHall && montyHall.answer === '2/3', 'VERIFIED: Monty Hall puzzle answer is 2/3');

    const bridgeU2 = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_10'").get();
    assert(bridgeU2 && bridgeU2.answer === '17', 'VERIFIED: Bridge lantern puzzle answer is 17');

    const ropesTimer = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_11'").get();
    assert(ropesTimer && ropesTimer.answer === '3', 'VERIFIED: Burning ropes timer ends answer is 3');

    const poisonedWine = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_12'").get();
    assert(poisonedWine && poisonedWine.answer === '10', 'VERIFIED: Poisoned wine binary test answer is 10');

    const crosswordDorm = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_14'").get();
    assert(crosswordDorm && crosswordDorm.answer === 'dormitory', 'VERIFIED: Cryptic crossword anagram answer is dormitory');

    const pinCodePeelamedu = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_16'").get();
    assert(pinCodePeelamedu && pinCodePeelamedu.answer === '641004', 'VERIFIED: Peelamedu PSG Tech PIN code answer is 641004');

    const rfcAvian = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_17'").get();
    assert(rfcAvian && rfcAvian.answer === '1149', 'VERIFIED: RFC Avian Carrier protocol answer is 1149');

    const gitEmptyTree = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_24'").get();
    assert(gitEmptyTree && gitEmptyTree.answer === '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'VERIFIED: Git empty tree SHA-1 answer is 4b825dc642cb6eb9a060e54bf8d69288fbee4904');

    const sevenBridges = await db.prepare("SELECT answer FROM nodes WHERE node_code = 'NODE_NT_28'").get();
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
      name: 'Test Alumnus S',
      email: 'test.alumnus@psgtech.ac.in',
      phone: '9876543200',
      batch: '19MX',
      organization: 'Example Corp'
    };
    await db.prepare("DELETE FROM users WHERE email = ? OR phone = ?").run(passkeyAlumData.email, passkeyAlumData.phone);
    
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
      body: JSON.stringify({ username: '9876543200', passkey: '9876543200' })
    }).then(r => r.json());
    assert(phoneLogin.token && phoneLogin.user.name === 'Test Alumnus S', 'PASSKEY: Successful login using Phone as Username and Phone as Passkey');

    // 12C: Login using Email as Identifier and Phone as Default Passkey
    const emailLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test.alumnus@psgtech.ac.in', passkey: '9876543200' })
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
      body: JSON.stringify({ email: 'test.alumnus@psgtech.ac.in', phone: '9876543200' })
    }).then(r => r.json());
    assert(recoverRes.success && recoverRes.passkey === '9876543200', 'PASSKEY: Self-service recovery resets passkey to phone number');

    // 12F: Admin 1-click Reset Passkey
    const adminResetPasskey = await fetch(`${BASE}/api/admin/alumni/${enrollAlum.user.id}/reset-passkey`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(adminResetPasskey.success && adminResetPasskey.passkey === '9876543200', 'PASSKEY: Admin 1-click reset passkey to phone number executed');

    // 13. Verify Duplicate Alumnus Prevention & Hardening
    console.log('\n--- Verifying Duplicate Alumnus Prevention & Hardening ---');

    // 13A: Reject duplicate enrollment by Phone
    const dupPhoneRes = await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Clone Alumnus',
        email: 'clone.alumnus@psgtech.ac.in',
        phone: '9876543200',
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
        name: 'Clone Alumnus 2',
        email: 'TEST.ALUMNUS@PSGTECH.AC.IN',
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
        rawText: `NAME\tEMAIL\tPHONE\tBATCH\tORGANIZATION\nTest Alumnus S\ttest.alumnus@psgtech.ac.in\t9876543200\t19MX\tExample Corp\nBrand New Alum\tbrandnew@psg.edu\t9111222333\t20MX\tGoogle`
      })
    }).then(r => r.json());
    assert(bulkDupRes.success && bulkDupRes.skipped >= 1 && bulkDupRes.duplicatesSkipped?.length >= 1, 'DUPLICATE GUARD: Bulk importer blocked existing alumnus duplicate from creating second row');

    // 14. Verify First-Login Password Change & Account Security Protocol
    console.log('\n--- Verifying First-Login Password Change & Security Protocol ---');

    // 14A: Initial login indicates mustChangePassword is required
    const initialLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test.alumnus@psgtech.ac.in', passkey: '9876543200' })
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
      body: JSON.stringify({ username: 'test.alumnus@psgtech.ac.in', passkey: 'secureAlumPassword2026' })
    }).then(r => r.json());
    assert(updatedLogin.token && updatedLogin.mustChangePassword === false, 'AUTH: Login with newly changed personal password succeeds without prompt');

    // 14E: Old default phone password is no longer accepted after change
    const oldPassLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test.alumnus@psgtech.ac.in', passkey: '9876543200' })
    });
    assert(oldPassLogin.status === 401, 'AUTH: Old default phone password rejected after password change');

    // Clean up test alumnus from database so no scratch users remain
    await db.prepare("DELETE FROM users WHERE email = ? OR phone = ?").run(passkeyAlumData.email, passkeyAlumData.phone);

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

    // 16: Verify Event Status Management (Paused / Ended / Active) & Clear Messages
    console.log('\n--- Verifying Event Status Enforcement & Descriptive Messages ---');

    // 16A: Set event status to 'paused'
    await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ event_status: 'paused' })
    });

    const pausedStatus = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(pausedStatus.status === 'paused', 'STATUS: /api/events/status reports paused');

    const pausedSubmit = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({ answer: 'any_answer' })
    });
    const pausedSubmitData = await pausedSubmit.json();
    assert(pausedSubmit.status === 403 && pausedSubmitData.error.includes('paused by organizers'), 'STATUS: Submitting during pause returns HTTP 403 with explicit paused message');

    const pausedHint = await fetch(`${BASE}/api/hunt/unlock-hint`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginB.token}` }
    });
    const pausedHintData = await pausedHint.json();
    assert(pausedHint.status === 403 && pausedHintData.error.includes('paused by organizers'), 'STATUS: Unlocking hint during pause returns HTTP 403 with explicit paused message');

    // 16B: Set event status to 'ended' / 'stopped'
    await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ event_status: 'stopped' })
    });

    const endedStatus = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(endedStatus.status === 'ended', 'STATUS: /api/events/status normalized "stopped" to "ended"');

    const endedSubmit = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({ answer: 'any_answer' })
    });
    const endedSubmitData = await endedSubmit.json();
    assert(endedSubmit.status === 403 && endedSubmitData.error.includes('concluded'), 'STATUS: Submitting after event conclusion returns HTTP 403 with explicit concluded message');

    // 16C: Restore event status to 'active'
    await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ event_status: 'active' })
    });

    const activeStatus = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(activeStatus.status === 'active', 'STATUS: Restored event status to active');

    // 17: Leaderboard Visibility Toggle & Admin Preview Verification
    console.log('\n--- Verifying Standings Leaderboard Visibility & Admin Preview ---');

    // 17A: Initial status check
    const initialEventStatus = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(initialEventStatus.leaderboardVisible === true, 'LEADERBOARD: /api/events/status reports leaderboardVisible = true initially');

    // 17B: Admin toggles leaderboard to hidden / frozen
    const freezeRes = await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ leaderboard_visible: false })
    }).then(r => r.json());
    assert(freezeRes.success === true, 'ADMIN: Set leaderboard_visible = false via /api/admin/config');

    const frozenEventStatus = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(frozenEventStatus.leaderboardVisible === false, 'LEADERBOARD: /api/events/status reports leaderboardVisible = false');

    // 17C: Public participant requests standings -> Masked (empty array)
    const publicLbRes = await fetch(`${BASE}/api/leaderboard`, {
      headers: { 'Authorization': `Bearer ${loginB.token}` }
    }).then(r => r.json());
    assert(publicLbRes.visible === false && Array.isArray(publicLbRes.leaderboard) && publicLbRes.leaderboard.length === 0, 'LEADERBOARD: Public participant receives empty standings array with visible = false');

    const publicBatchRes = await fetch(`${BASE}/api/leaderboard/batches`, {
      headers: { 'Authorization': `Bearer ${loginB.token}` }
    }).then(r => r.json());
    assert(publicBatchRes.visible === false && Array.isArray(publicBatchRes.batches) && publicBatchRes.batches.length === 0, 'LEADERBOARD: Public participant receives empty batches array with visible = false');

    // 17D: Game Master requests standings -> Admin Preview (full live standings)
    const adminLbRes = await fetch(`${BASE}/api/leaderboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(adminLbRes.visible === false && adminLbRes.isAdminPreview === true && adminLbRes.leaderboard.length > 0, 'LEADERBOARD: Game Master receives full standings with isAdminPreview = true');

    const adminBatchRes = await fetch(`${BASE}/api/leaderboard/batches`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(adminBatchRes.visible === false && adminBatchRes.batches.length > 0, 'LEADERBOARD: Game Master receives full batches list during freeze');

    // 17E: Admin restores leaderboard visibility to true
    const unfreezeRes = await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ leaderboard_visible: true })
    }).then(r => r.json());
    assert(unfreezeRes.success === true, 'ADMIN: Restored leaderboard_visible = true');

    const restoredLbRes = await fetch(`${BASE}/api/leaderboard`).then(r => r.json());
    assert(restoredLbRes.visible === true && restoredLbRes.isAdminPreview === false && restoredLbRes.leaderboard.length > 0, 'LEADERBOARD: Public participant can view full standings again after unfreeze');

    // 18: Test Integrity & Proctoring Telemetry Suite
    console.log('\n--- Verifying Test Integrity & Proctoring Telemetry Suite ---');

    // 18A: Participant logs FULLSCREEN_EXIT
    const fsExitRes = await fetch(`${BASE}/api/hunt/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({
        event_type: 'FULLSCREEN_EXIT',
        metadata: { reason: 'User exited fullscreen window during solve' }
      })
    }).then(r => r.json());
    assert(fsExitRes.recorded === true && fsExitRes.event_type === 'FULLSCREEN_EXIT', 'PROCTOR: FULLSCREEN_EXIT logged successfully');

    // 18B: Participant logs TAB_SWITCH
    const tabSwitchRes = await fetch(`${BASE}/api/hunt/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({
        event_type: 'TAB_SWITCH',
        metadata: { reason: 'Browser tab lost visibility' }
      })
    }).then(r => r.json());
    assert(tabSwitchRes.recorded === true && tabSwitchRes.event_type === 'TAB_SWITCH', 'PROCTOR: TAB_SWITCH logged successfully');

    // 18C: Participant logs WINDOW_BLUR (Alt-Tab)
    const blurRes = await fetch(`${BASE}/api/hunt/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({
        event_type: 'WINDOW_BLUR',
        metadata: { reason: 'Alt-Tab focus lost' }
      })
    }).then(r => r.json());
    assert(blurRes.recorded === true && blurRes.event_type === 'WINDOW_BLUR', 'PROCTOR: WINDOW_BLUR (Alt-Tab) logged successfully');

    // 18D: Participant logs DEVTOOLS_SHORTCUT
    const devtoolsRes = await fetch(`${BASE}/api/hunt/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({
        event_type: 'DEVTOOLS_SHORTCUT',
        metadata: { combo: 'Ctrl+Shift+I', key: 'I' }
      })
    }).then(r => r.json());
    assert(devtoolsRes.recorded === true && devtoolsRes.event_type === 'DEVTOOLS_SHORTCUT', 'PROCTOR: DEVTOOLS_SHORTCUT logged successfully');

    // 18E: Participant logs CLIPBOARD_PASTE_ATTEMPT
    const pasteRes = await fetch(`${BASE}/api/hunt/proctor-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginB.token}` },
      body: JSON.stringify({
        event_type: 'CLIPBOARD_PASTE_ATTEMPT',
        metadata: { target: 'answer_input' }
      })
    }).then(r => r.json());
    assert(pasteRes.recorded === true && pasteRes.totalViolations >= 5, 'PROCTOR: Cumulative infractions incremented tab_violations (>= 5)');

    // 18F: Admin fetches Proctor Logs with event filtering
    const allProctorLogs = await fetch(`${BASE}/api/admin/proctor-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(allProctorLogs.logs && allProctorLogs.logs.length >= 5, 'ADMIN PROCTOR: Admin retrieved audit logs containing all recorded events');

    const filteredFsLogs = await fetch(`${BASE}/api/admin/proctor-logs?type=FULLSCREEN_EXIT`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(filteredFsLogs.logs.every(l => l.event_type === 'FULLSCREEN_EXIT'), 'ADMIN PROCTOR: Filtered query ?type=FULLSCREEN_EXIT returned only fullscreen exit logs');

    // 18G: Admin resets alumnus violations
    const resetWarnsRes = await fetch(`${BASE}/api/admin/alumni/${loginB.user.id}/reset-violations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    assert(resetWarnsRes.success === true, 'ADMIN PROCTOR: Reset alumnus infractions to 0 via /api/admin/alumni/:id/reset-violations');

    const clearedUser = await db.prepare('SELECT tab_violations FROM users WHERE id = ?').get(loginB.user.id);
    assert(clearedUser.tab_violations === 0, 'ADMIN PROCTOR: Database confirms alumnus tab_violations is now 0');

    console.log('\n--- Verifying Event Window (11-17 Aug) & Desktop-Only Device Enforcement ---');
    // 19A: Verify Event Status endpoint returns official 11th Aug - 17th Aug 2026 window
    const evStatusRes = await fetch(`${BASE}/api/events/status`).then(r => r.json());
    assert(evStatusRes.eventWindow === '11th Aug 2026 – 17th Aug 2026', 'EVENT WINDOW: /api/events/status reports 11th Aug 2026 – 17th Aug 2026');
    assert(evStatusRes.eventStartDate === '2026-08-11T00:00:00+05:30', 'EVENT WINDOW: Start date is 2026-08-11T00:00:00+05:30');
    assert(evStatusRes.eventEndDate === '2026-08-17T23:59:59+05:30', 'EVENT WINDOW: End date is 2026-08-17T23:59:59+05:30');

    // 19B: Mobile device blocking on current-node endpoint
    const mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    const mobileCurrentNode = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: {
        'Authorization': `Bearer ${loginB.token}`,
        'User-Agent': mobileUA
      }
    });
    assert(mobileCurrentNode.status === 403, 'DEVICE INTEGRITY: Mobile iPhone blocked on /current-node with HTTP 403');
    const mobileNodeJson = await mobileCurrentNode.json();
    assert(mobileNodeJson.deviceBlocked === true, 'DEVICE INTEGRITY: Response flags deviceBlocked = true');

    // 19C: Mobile device blocking on submit endpoint
    const mobileSubmit = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginB.token}`,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
      },
      body: JSON.stringify({ answer: 'test' })
    });
    assert(mobileSubmit.status === 403, 'DEVICE INTEGRITY: Mobile Android blocked on /submit with HTTP 403');

    // 19D: Verify MOBILE_DEVICE_BLOCKED logged in proctor logs
    const mobileLog = await db.prepare("SELECT * FROM proctor_logs WHERE event_type = 'MOBILE_DEVICE_BLOCKED'").get();
    assert(mobileLog && mobileLog.event_type === 'MOBILE_DEVICE_BLOCKED', 'PROCTOR LOG: MOBILE_DEVICE_BLOCKED recorded in database');

    // 19E: Admin mobile bypass: Admin is exempt from device block
    const adminMobileCurrentNode = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'User-Agent': mobileUA
      }
    });
    assert(adminMobileCurrentNode.status !== 403, 'DEVICE INTEGRITY: Game Master admin exempt from mobile device block');

    console.log('\n--- Section 20: Verifying 104 Puzzles Pool & Timed Test Session System ---');
    // 20A: Verify 104 puzzles populated in DB with Login'26 Puzzles-add (NODE_ADD_01 to NODE_ADD_44)
    const nodeCountRow = await db.prepare('SELECT COUNT(*) as count FROM nodes').get();
    assert(nodeCountRow.count === 104, `PUZZLE REPOSITORY: Total nodes in DB is 104 (Found: ${nodeCountRow.count})`);

    const add01 = await db.prepare("SELECT * FROM nodes WHERE node_code = 'NODE_ADD_01'").get();
    assert(add01 && add01.answer === '158', 'PUZZLE VERIFICATION: NODE_ADD_01 (The Doubling Step Series) answer is 158');

    const add44 = await db.prepare("SELECT * FROM nodes WHERE node_code = 'NODE_ADD_44'").get();
    assert(add44 && add44.answer === '66', 'PUZZLE VERIFICATION: NODE_ADD_44 (Handshake Combinatorics) answer is 66');

    const rebusNode = await db.prepare("SELECT * FROM nodes WHERE node_code = 'NODE_ADD_22'").get();
    assert(rebusNode && rebusNode.media_url === '/puzzles/puzzle_img_2.png', 'PUZZLE VERIFICATION: NODE_ADD_22 has image asset linked');

    // 20B: Enroll dedicated participant to verify timer lifecycle
    const timerUserPayload = { name: 'Timed Session Tester', batch: '2024', username: `timer_user_${runId}`, passkey: 'timerpass123' };
    await fetch(`${BASE}/api/admin/alumni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify(timerUserPayload)
    });

    const loginTimer = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: timerUserPayload.username, passkey: timerUserPayload.passkey })
    }).then(r => r.json());

    // Pre-test state: Verify user has not started test yet
    const preTestNodeRes = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(preTestNodeRes.testStarted === false, 'TIMED SESSION: Participant testStarted is false before briefing initiation');
    assert(preTestNodeRes.totalDurationMinutes === 60, 'TIMED SESSION: Default total duration is 60 minutes');
    assert(preTestNodeRes.timeRemainingSeconds === 3600, 'TIMED SESSION: Time remaining is 3600s (60 mins)');
    assert(preTestNodeRes.isTimeExpired === false, 'TIMED SESSION: isTimeExpired is false');

    // 20C: Submissions and hints are blocked before test is started
    const prematureSubmit = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginTimer.token}`
      },
      body: JSON.stringify({ answer: 'test' })
    });
    assert(prematureSubmit.status === 403, 'TIMED SESSION: Submission blocked with HTTP 403 if test not initiated');
    const prematureSubmitJson = await prematureSubmit.json();
    assert(prematureSubmitJson.testNotStarted === true, 'TIMED SESSION: Response flags testNotStarted = true');

    const prematureHint = await fetch(`${BASE}/api/hunt/unlock-hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginTimer.token}`
      },
      body: JSON.stringify({ hint_index: 0 })
    });
    assert(prematureHint.status === 403, 'TIMED SESSION: Hint unlock blocked with HTTP 403 if test not initiated');

    // 20D: Start test session via /api/hunt/start-test
    const startTestRes = await fetch(`${BASE}/api/hunt/start-test`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(startTestRes.success === true, 'TIMED SESSION: /api/hunt/start-test initiates test successfully');
    assert(startTestRes.testStartedAt, 'TIMED SESSION: start-test returns testStartedAt timestamp');
    assert(startTestRes.totalDurationMinutes === 60, 'TIMED SESSION: start-test reports 60 minutes total duration');

    // Verify TEST_STARTED logged in proctor audit
    const startLog = await db.prepare("SELECT * FROM proctor_logs WHERE event_type = 'TEST_STARTED' AND user_id = ?").get(loginTimer.user.id);
    assert(startLog !== undefined, 'TIMED SESSION: TEST_STARTED logged to proctor audit trail');

    // 20E: After starting, current-node reflects active countdown
    const activeTestNodeRes = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(activeTestNodeRes.testStarted === true, 'TIMED SESSION: Participant testStarted is now true');
    assert(activeTestNodeRes.timeRemainingSeconds <= 3600 && activeTestNodeRes.timeRemainingSeconds > 3500, 'TIMED SESSION: Time remaining active countdown between 3500s and 3600s');

    // 20F: Admin grants extra time (+15m)
    const grantTimeRes = await fetch(`${BASE}/api/admin/alumni/${loginTimer.user.id}/timer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'grant_extra_time', extraMinutes: 15 })
    }).then(r => r.json());
    assert(grantTimeRes.success === true && grantTimeRes.extra_time_minutes === 15, 'ADMIN TIMER: Admin granted +15 minutes extra time');

    const extendedNodeRes = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(extendedNodeRes.totalDurationMinutes === 75, 'TIMED SESSION: Total duration updated to 75 minutes after +15m grant');
    assert(extendedNodeRes.timeRemainingSeconds > 3600, 'TIMED SESSION: Time remaining increased with extra 15m');

    // 20G: Simulate timer expiration on test participant
    // Set test_started_at to 3 hours ago (180 mins ago)
    const threeHoursAgo = Date.now() - (180 * 60 * 1000);
    await db.prepare('UPDATE users SET test_started_at = ?, extra_time_minutes = 0 WHERE id = ?').run(threeHoursAgo, loginTimer.user.id);

    const expiredNodeRes = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(expiredNodeRes.isTimeExpired === true, 'TIMED SESSION: User marked isTimeExpired = true after elapsed time exceeds duration');
    assert(expiredNodeRes.timeRemainingSeconds === 0, 'TIMED SESSION: User timeRemainingSeconds is 0');

    // Submissions strictly blocked on expired session
    const expiredSubmit = await fetch(`${BASE}/api/hunt/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginTimer.token}`
      },
      body: JSON.stringify({ answer: 'test' })
    });
    assert(expiredSubmit.status === 403, 'TIMED SESSION: Expired user submission blocked with HTTP 403');
    const expiredSubmitJson = await expiredSubmit.json();
    assert(expiredSubmitJson.timeExpired === true, 'TIMED SESSION: Response flags timeExpired = true');

    // 20H: Admin resets timer for User
    const resetTimerRes = await fetch(`${BASE}/api/admin/alumni/${loginTimer.user.id}/timer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: 'reset_timer' })
    }).then(r => r.json());
    assert(resetTimerRes.success === true, 'ADMIN TIMER: Admin successfully reset timer for participant');

    const postResetNodeRes = await fetch(`${BASE}/api/hunt/current-node`, {
      headers: { 'Authorization': `Bearer ${loginTimer.token}` }
    }).then(r => r.json());
    assert(postResetNodeRes.testStarted === false, 'TIMED SESSION: Participant testStarted is false again after admin reset');

    // 20I: Admin configures global test duration to 90 minutes
    const configTimerRes = await fetch(`${BASE}/api/admin/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ test_duration_minutes: 90 })
    }).then(r => r.json());
    assert(configTimerRes.success === true, 'ADMIN CONFIG: Admin set test_duration_minutes to 90');

    const dbConfigDuration = await db.prepare("SELECT value FROM config WHERE key = 'test_duration_minutes'").get();
    assert(dbConfigDuration.value === '90', 'ADMIN CONFIG: Database config persists test_duration_minutes = 90');

    // Reset back to 60 minutes and 12 nodes for normal operation
    await db.prepare("UPDATE config SET value = '60' WHERE key = 'test_duration_minutes'").run();
    await db.prepare("UPDATE config SET value = '12' WHERE key = 'path_length'").run();

    // Clean up: Reset back to default in db for clean state
    await db.prepare("UPDATE config SET value = 'login2026admin' WHERE key = 'admin_key'").run();
    await db.prepare("UPDATE users SET passkey = 'login2026admin' WHERE username = 'admin'").run();
    await db.prepare("UPDATE config SET value = 'active' WHERE key = 'event_status'").run();
    await db.prepare("UPDATE config SET value = 'true' WHERE key = 'leaderboard_visible'").run();

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
