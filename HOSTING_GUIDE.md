# 🌐 LOGIN 2026 NETHUNT — COMPREHENSIVE HOSTING & DEPLOYMENT GUIDE
**PSG College of Technology &bull; Department of Computer Applications (MCA)**  
*Cryptic Nethunt Platform for Alumni &bull; 48-Hour High-Concurrency Competition System*

---

## 🏗️ Architecture Overview

The **LOGIN 2026 Nethunt** platform uses a high-efficiency **unified full-stack architecture**:
- **Single Process / Unified Port**: The Node.js Express backend (`server/index.js`) serves both the REST API endpoints (`/api/*`) and the compiled production React 19 / TailwindCSS v4 frontend bundle (`dist/`) on one single port (default: `3001` or `$PORT`).
- **Zero Heavy External Dependencies**: Employs Node.js native `node:sqlite` in WAL (Write-Ahead Logging) mode, delivering sub-millisecond database queries without requiring external PostgreSQL, Redis, or Docker services (though Docker is supported).
- **500+ Concurrent Player Capacity**: Benchmarked at ~0.86ms per leaderboard query with sliding-window in-memory throttling.

```
┌─────────────────────────────────────────────────────────────┐
│                    Public Traffic (HTTPS)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    Nginx / Cloud Reverse Proxy│
               │         (Port 80 / 443)       │
               └───────────────┬───────────────┘
                               │ proxy_pass http://localhost:3001
               ┌───────────────▼────────────────┐
               │      LOGIN 2026 Unified Host   │
               │   (Express + Vite Production)  │
               ├────────────────────────────────┤
               │ • Static Files: dist/*         │
               │ • API Routes:   /api/*         │
               │ • Embedded DB:  nethunt.db     │
               └────────────────────────────────┘
```

---

## ⚡ Option 1: 1-Command Docker Deployment (Recommended)

Requires **Docker** and **Docker Compose** installed.

### Step 1: Clone or Copy Repository to Server
```bash
git clone <repository-url> nethunt
cd nethunt
```

### Step 2: Configure Environment
Copy the environment template:
```bash
cp .env.example .env
```
*(Optional: edit `.env` to set your custom `ADMIN_KEY` or `PORT`)*

### Step 3: Launch Container
```bash
docker compose up -d --build
```

### Step 4: Verify Status
```bash
docker compose ps
docker logs -f login2026_nethunt
```
The platform is live at `http://your-server-ip:3001`.  
All database records (`nethunt.db`) are mounted to `./server/data/` on the host, ensuring **data persists safely across container updates and restarts**.

---

## 🖥️ Option 2: Linux VPS / On-Premise Server (Ubuntu / Debian / PSG Tech Server)

Ideal for standard cloud servers (AWS EC2, DigitalOcean, Hetzner, Linode) or on-premise PSG Tech college server hardware.

### Prerequisites: Install Node.js 22 LTS
Node.js version **>= 22.5.0** is required for native `node:sqlite`.

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# Enable pnpm
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Verify Node and pnpm versions
node -v    # Must be v22.5.0+ or v24+
pnpm -v
```

### Step 1: Install Dependencies & Build Frontend
```bash
cd /var/www  # or your preferred deployment directory
git clone <repo-url> nethunt
cd nethunt

# Install all dependencies
pnpm install

# Compile the production React bundle into /dist
pnpm run build
```

### Step 2: Setup PM2 Process Manager
PM2 keeps the server running 24/7, restarts on crash, and starts automatically on system reboot.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the Nethunt unified server
pm2 start server/index.js --name "login2026-nethunt"

# Save process list and enable startup on boot
pm2 save
pm2 startup
```

### Step 3: Setup Nginx Reverse Proxy with Domain & SSL

1. Install Nginx:
```bash
sudo apt install -y nginx
```

2. Create an Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/nethunt
```

Paste the following configuration (replace `nethunt.psglogin.in` with your domain or IP):
```nginx
server {
    listen 80;
    server_name nethunt.psglogin.in;

    # Maximum request size for file uploads if needed
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/nethunt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. Install Free SSL Certificate (HTTPS) via Let's Encrypt Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nethunt.psglogin.in
```

Your Nethunt platform is now securely accessible via **`https://nethunt.psglogin.in`**!

---

## ☁️ Option 3: Cloud PaaS (Render, Railway, Fly.io)

### Render.com Setup
1. Create a **New Web Service** and connect your GitHub repository.
2. Select **Node** environment.
3. Configure build & start settings:
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `node server/index.js`
4. Set Environment Variables:
   - `PORT`: `3001`
   - `NODE_ENV`: `production`
   - `NODE_VERSION`: `22.12.0`
5. **Attach Persistent Disk** *(Critical for SQLite database preservation)*:
   - Mount path: `/app/server/data`
   - Size: `1 GB` (sufficient for millions of hunt submissions)

### Railway.app Setup
1. Deploy from GitHub repository.
2. Railway auto-detects `Dockerfile` or `package.json`.
3. Add a **Persistent Volume** in Railway dashboard attached to `/app/server/data`.
4. Deploy!

---

## 🏫 Option 4: PSG Tech Campus LAN / Intranet (Offline Setup)

If you are hosting the competition exclusively within the **PSG College of Technology campus intranet or computer lab** without external internet access:

1. Connect the host server machine to the campus network switch or lab router.
2. Determine the host server's static or DHCP IP address:
   - Linux: `hostname -I` or `ip addr`
   - Windows: `ipconfig` (e.g. `10.1.20.45` or `172.16.8.100`)
3. Start the server with `npm run start` or `pm2 start server/index.js`.
4. Direct participants to:
   ```
   http://10.1.20.45:3001
   ```
   *(Or map an internal DNS entry on the campus router such as `http://nethunt.local`)*

---

## 💾 Database Backups During the 48-Hour Live Event

SQLite WAL mode allows zero-downtime hot backups while participants are actively playing.

### Automated Backup Script
Create a simple cron backup script:
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/nethunt"
mkdir -p "$BACKUP_DIR"

# Hot backup using sqlite3 online backup API
sqlite3 /var/www/nethunt/server/data/nethunt.db ".backup '$BACKUP_DIR/nethunt_$TIMESTAMP.db'"

# Keep only last 24 backups (purge older ones)
ls -dt $BACKUP_DIR/*.db | tail -n +25 | xargs -r rm -f
```

Make executable and add to crontab every 30 minutes:
```bash
chmod +x /usr/local/bin/backup_nethunt.sh
crontab -e
# Add line:
*/30 * * * * /usr/local/bin/backup_nethunt.sh
```

---

## 🛡️ Pre-Flight Competition Checklist

Before opening the portal to alumni:
- [ ] Verify health status: `curl http://localhost:3001/api/health`
- [ ] Login as Game Master admin (`/api/admin` or via `[ ACCESS_GATEWAY ]` with admin credentials)
- [ ] Verify event parameters in Admin Dashboard &bull; Settings tab (`20 NODES ★ (OFFICIAL)`)
- [ ] Test the Theme Matrix selector (`⚡ CYBER`, `📟 MATRIX`, `💾 AMBER`, `🌆 SYNTHWAVE`, `🚨 CRIMSON`, `📋 TACTICAL`)
- [ ] Ensure `event_status` is toggled to **ACTIVE** in Admin Dashboard header
- [ ] Enroll alumni batches via single or bulk CSV upload in Admin Dashboard
