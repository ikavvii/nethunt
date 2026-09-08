# LOGIN 2026: MCA Alumni Nethunt Platform (Single-Player Proctored Edition)

The official online cryptic treasure hunt platform engineered exclusively for **MCA Alumni of PSG College of Technology** attending the **LOGIN 2026** celebration.

This platform is crafted specifically for competitive, skilled software engineers, architects, and technical leaders, featuring an individualized trajectory engine, proctored fullscreen environment, automated 7-stage decaying hint mechanisms, and admin-only alumni enrollment.

---

## 🌟 Architecture & Key Features

### 1. Randomized Trajectory from Master Pool (32 Cryptic Nodes)
- **Anti-Collusion & Anti-Pattern**: Rather than a static sequential ladder, the system contains a master pool of **32 multi-disciplinary cryptic nodes** spanning:
  - Binary forensics, memory dumps, and assembly analysis
  - Cryptography (Vigenère, Diffie-Hellman, SHA-256 digests, RSA Euler totients)
  - Systems & Networking (POSIX standards, TCP handshakes, CIDR subnetting, BGP path engineering)
  - Algorithms & Theory (Dijkstra Fibonacci bounds, Rice's theorem, B-Trees, Belady's anomaly, Byzantine consensus)
  - Authentic PSG Tech & Peelamedu computing heritage
- **Individualized Paths**: Each enrolled alumni is automatically assigned a balanced set of **10 or 12 playable nodes** (e.g., 2 Foundation + 3 Intermediate + 3 Advanced + 2 Grandmaster). No two alumni receive the same sequential pattern.

### 2. Autonomous 7-Stage Progressive Hint Degradation Engine
- Designed to run autonomously for 48 hours without requiring manual hints from organizers.
- **7 Progressive Stages**: Non-spoilery guidance moving gradually from broad conceptual pivots, standard libraries, and structural formatting to key fragment boundaries.
- **Point Decay Multiplier**: Unlocking hints progressively decays the maximum potential points attainable for that node:
  - Stage 0 (0 hints): **1000 pts (100%)**
  - Stage 1: **850 pts (85%)**
  - Stage 2: **720 pts (72%)**
  - Stage 3: **600 pts (60%)**
  - Stage 4: **490 pts (49%)**
  - Stage 5: **390 pts (39%)**
  - Stage 6: **300 pts (30%)**
  - Stage 7: **220 pts (22%)**

### 3. Proctored Fullscreen & Anti-Tamper Telemetry
- **Enforced Fullscreen Workspace**: Participants are required to maintain Fullscreen mode. Exiting fullscreen displays a blocking modal requiring re-entry and logs an incident.
- **Tab-Switch & Blur Tracking**: Tracks `visibilitychange` and `window.onblur` events, logging infractions to the server and displaying proctor alert toasts.
- **Telemetry Stream**: Admin monitors live proctor logs with timestamps and violation counts.

### 4. Admin-Only Alumni Enrollment
- No public self-registration. Alumni accounts are created exclusively by the organizing committee:
  - Single alumni enrollment form with instant path builder.
  - Bulk alumni import (JSON array format).
  - Enrolled alumni list showing step progress, scores, passkeys, and proctor infractions.

### 5. Clean, Accessible Design with Inter & Themes
- **Typography**: Standard **Inter** font family paired with **JetBrains Mono** for code and technical payloads.
- **Theme Switching**: High-contrast Light Mode and Dark Mode toggle.
- **Screen Space Utilization**: Broad dual-column workbench layout utilizing modern laptop and widescreen displays effectively.
- **Abstract & Uncluttered**: Free of marketing fluff, explicit feature captions, or promotional banners.

---

## 🚀 Running the Platform

### Start Production Server
```bash
cd d:/nethunt
pnpm start
```
- Open browser at **`http://localhost:3001`**

### Access Credentials
- **Admin / Game Master Access**:
  - Click **"Alumni Access"** in top navbar -> select **"Staff Portal"** tab.
  - Enter Secret Key: **`login2026admin`**
  - Use the Admin panel to enroll alumni or view live proctor telemetry.
- **Alumni Access**:
  - Alumni sign in using their issued username and access passkey.
  - Test enrolled alumni:
    - Username: `anand_8817` (Passkey: `peelamedu2004`)
    - Username: `kavitha_8837` (Passkey: `peelamedu2015`)

---

## 🧪 Automated Verification

Execute the complete end-to-end automated verification suite:
```bash
node server/verify_platform.js
```
Validates admin enrollment, path randomness, 7-stage hint point decay, answer validation, proctor telemetry, and standings.
