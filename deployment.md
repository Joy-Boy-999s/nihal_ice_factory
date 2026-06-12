# Deployment Guide — Nihal Ice Factory

## Stack Overview
| Layer | Technology | Port |
|---|---|---|
| Backend | NestJS (Node.js, webpack bundle) | 3000 |
| Frontend | React + Vite (static files) | 80 |
| Database | MySQL 8.x | 3306 |
| Process Manager | PM2 | — |
| Web Server | Nginx for Windows | 80 |

**Server**: Windows Server (AWS EC2, us-east-1)  
**Server IP**: `52.87.217.163`  
**RDP User**: `Administrator`

> **Security notice**: Change the RDP password immediately after deployment.  
> Run in PowerShell: `net user Administrator NewStrongPassword123!`

---

## Part 1 — Connect to Server

Open **Remote Desktop Connection** (`Win+R` → `mstsc`) and connect to `52.87.217.163` with user `Administrator`.

All commands below are run inside the **RDP session** using PowerShell (run as Administrator).

---

## Part 2 — Install Prerequisites

### 2.1 Install Node.js 20 LTS
1. Open browser in RDP and download from: https://nodejs.org/en/download  
   Choose **Windows Installer (.msi) — LTS x64**
2. Run the installer with defaults
3. Verify in PowerShell:
```powershell
node -v   # should print v20.x.x or higher
npm -v
```

### 2.2 Install PM2 (process manager)
```powershell
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

### 2.3 Install MySQL 8.x
1. Download from: https://dev.mysql.com/downloads/installer/
2. Choose **MySQL Installer for Windows** → **Full**
3. During setup select: **MySQL Server** + **MySQL Workbench** (optional)
4. Set root password to: `5082093` (must match the `.env` file)
5. Leave port at `3306`
6. Verify:
```powershell
mysql -u root -p5082093 -e "SELECT VERSION();"
```

### 2.4 Install Git (optional — if cloning from GitHub)
Download from: https://git-scm.com/download/win and install with defaults.

### 2.5 Install Nginx for Windows
1. Download from: https://nginx.org/en/download.html  
   Choose the latest **Stable** Windows zip
2. Extract to `C:\nginx`
3. Verify:
```powershell
C:\nginx\nginx.exe -v
```

---

## Part 3 — Transfer the Project

### Option A — Copy via Git (if repo is on GitHub)
```powershell
cd C:\
git clone https://github.com/YOUR_USERNAME/nihal_ice_factory.git app
cd app
```

### Option B — Copy via ZIP (no GitHub)
1. On your local machine, zip the project **excluding** `node_modules` and `dist`:
   - Right-click the project folder → Compress, or run:
   ```powershell
   # On your LOCAL machine
   cd C:\projects\mine
   Compress-Archive -Path nihal_ice_factory -DestinationPath nihal_ice_factory.zip -CompressionLevel Optimal
   ```
2. Copy the zip to the server via RDP clipboard or a file transfer tool (WinSCP, etc.)
3. On the **server**:
```powershell
Expand-Archive -Path C:\Users\Administrator\Desktop\nihal_ice_factory.zip -DestinationPath C:\app
cd C:\app\nihal_ice_factory
```

> All remaining steps assume the project root is `C:\app\nihal_ice_factory`.

---

## Part 4 — Setup the MySQL Database

```powershell
mysql -u root -p5082093 -e "CREATE DATABASE IF NOT EXISTS \`ice-999\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p5082093 -e "SHOW DATABASES;"
```

If the app uses TypeORM migrations, run them after building the backend (see Step 6).

---

## Part 5 — Configure Environment Variables

Create the `.env` file for the backend on the server:

```powershell
cd C:\app\nihal_ice_factory\packages\services
```

Edit `.env` (create if missing). **Use your own values — never commit real
secrets.** Generate secrets with `openssl rand -hex 32` (or any strong random
string). If any credential below was ever committed to this repo, rotate it.

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<your-mysql-root-password>
DB_NAME=ice-999
# Set to false once the schema is stable (manage changes via migrations)
DB_SYNCHRONIZE=true

# Password-reset OTP emails (Gmail app password or SMTP)
EMAIL_USER=<your-email@gmail.com>
EMAIL_PASS=<gmail-app-password>

JWT_SECRET=<long-random-string>
ENCRYPTION_KEY=<64-char-hex>

# Razorpay (test keys start with rzp_test_)
RAZORPAY_KEY_ID=<rzp_test_...>
RAZORPAY_KEY_SECRET=<...>
# Secret you choose when creating the webhook in the Razorpay dashboard
RAZORPAY_WEBHOOK_SECRET=<...>

# CORS allowlist — MUST include the origin the frontend is served from,
# e.g. http://52.87.217.163 for this Nginx setup. Comma-separated.
ALLOWED_ORIGINS=http://52.87.217.163

# Frontend URL used in WhatsApp replies
APP_WEB_URL=http://52.87.217.163

# Optional — WhatsApp Business Cloud API (ordering + alerts stay dormant when unset)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
```

> **`ALLOWED_ORIGINS` is critical**: the API rejects browser requests from
> origins not on this list. If the frontend loads but every API call fails
> with a CORS error, this is the first thing to check.

---

## Part 6 — Frontend Environment (API URL + GST)

The frontend reads its API base URL from `packages/ui/.env` at **build time**
(`deploy.ps1` writes this automatically):

```env
VITE_API_URL=http://52.87.217.163:3000

# Optional — GST tax invoices (HSN column + CGST/SGST breakup when GSTIN is set)
VITE_COMPANY_GSTIN=
VITE_COMPANY_ADDRESS=
VITE_ICE_HSN_CODE=2201
VITE_GST_RATE=5
```

Changing any `VITE_*` value requires rebuilding the frontend.

---

## Part 7 — Install Dependencies & Build

```powershell
cd C:\app\nihal_ice_factory

# Install all dependencies
npm install

# Build the backend (outputs to packages/services/dist/main.js)
npx nx build @nihal-ice-factory/services --configuration=production

# Build the frontend (outputs to dist/packages/ui/)
npx nx build @nihal-ice-factory/ui --configuration=production
```

Verify the builds:
```powershell
Test-Path "C:\app\nihal_ice_factory\packages\services\dist\main.js"   # should be True
Test-Path "C:\app\nihal_ice_factory\dist\packages\ui\index.html"       # should be True
```

---

## Part 8 — Run Migrations (if applicable)

If TypeORM migrations exist:
```powershell
cd C:\app\nihal_ice_factory
node packages/services/dist/main.js migration:run
```

Or if the app runs `synchronize: true` in development it will auto-create tables on first start.

---

## Part 9 — Start the Backend with PM2

```powershell
cd C:\app\nihal_ice_factory\packages\services

pm2 start dist\main.js --name "ice-factory-api" --env production

# Save the PM2 process list (auto-restart on reboot)
pm2 save

# Check status
pm2 status
pm2 logs ice-factory-api --lines 30
```

Verify the backend is running:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

---

## Part 10 — Configure Nginx to Serve the Frontend

Replace `C:\nginx\conf\nginx.conf` with:

```nginx
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name 52.87.217.163;

        # Serve the React frontend
        root C:/app/nihal_ice_factory/dist/packages/ui;
        index index.html;

        # React Router — serve index.html for all routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Proxy API calls to the NestJS backend
        location /api/ {
            proxy_pass http://127.0.0.1:3000/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;

            # Required for SSE (notification bell / inventory live streams):
            # without these, Nginx buffers the stream and events never arrive.
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 1h;
            proxy_set_header X-Request-Id $request_id;
        }
    }
}
```

> The app currently calls the API directly on port 3000 (`VITE_API_URL`), so the
> `/api/` proxy is optional. If you later switch the frontend to same-origin
> `/api/` calls, the SSE settings above are mandatory.

Start Nginx:
```powershell
C:\nginx\nginx.exe

# Test config first (recommended)
C:\nginx\nginx.exe -t

# To reload config without downtime:
C:\nginx\nginx.exe -s reload

# To stop:
C:\nginx\nginx.exe -s stop
```

#### Make Nginx start on Windows boot
Create a scheduled task:
```powershell
$action  = New-ScheduledTaskAction -Execute "C:\nginx\nginx.exe"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "Nginx" -Action $action -Trigger $trigger -RunLevel Highest -Force
```

---

## Part 11 — Open Windows Firewall Ports

```powershell
# Allow HTTP (port 80) — for the frontend via Nginx
New-NetFirewallRule -DisplayName "HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow backend API port directly (useful for testing)
New-NetFirewallRule -DisplayName "NestJS API 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Also verify in AWS Console:
- Go to **EC2 → Security Groups** for this instance
- Add **Inbound Rules**: TCP port 80 and 3000 from `0.0.0.0/0`

---

## Part 12 — Verify the Deployment

| Check | URL | Expected |
|---|---|---|
| Frontend | `http://52.87.217.163` | App loads in browser |
| Backend direct | `http://52.87.217.163:3000` | NestJS response / Swagger |
| Backend via Nginx | `http://52.87.217.163/api/` | Proxied API response |

```powershell
# Quick health check from server itself
Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

---

## Part 13 — Post-Deploy Configuration (Payments, WhatsApp, GST)

### Razorpay webhook (recommended)
Without it, payment status relies on the browser completing checkout.
1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
2. URL: `http://<server-ip>:3000/payment/webhook` (use HTTPS in real production)
3. Secret: any strong random string → set the same value as `RAZORPAY_WEBHOOK_SECRET` in `.env`
4. Events: `payment.captured`, `payment.failed`, `order.paid`
5. Restart the backend: `pm2 restart ice-factory-api`

### WhatsApp ordering + alerts (optional)
Full step-by-step guide: **`whatsapp-setup.md`**. Summary:
1. Create a Meta app at developers.facebook.com → add the **WhatsApp** product
2. Webhook URL: `https://<server>/whatsapp/webhook` (Meta requires HTTPS), subscribe to
   **messages**, verify token = your `WHATSAPP_VERIFY_TOKEN`
3. Fill all four `WHATSAPP_*` vars in `.env` and restart the backend
4. Only registered users with a linked mobile can order — customers auto-link on their
   first in-app order; staff link via the user menu ("Link WhatsApp number")

### GST invoices (optional)
Set `VITE_COMPANY_GSTIN` / `VITE_COMPANY_ADDRESS` in `packages/ui/.env` and **rebuild
the frontend** — invoices then render as GST tax invoices with HSN and CGST/SGST breakup.

### First admin user
Self-registration only creates CUSTOMER accounts. Create the first ADMIN directly in MySQL
or temporarily via Swagger (`http://<server-ip>:3000/api`) before the createUser endpoint
requires an admin token.

---

## Useful PM2 Commands

```powershell
pm2 status                        # List all processes
pm2 logs ice-factory-api          # Tail logs
pm2 logs ice-factory-api --lines 100  # Last 100 lines
pm2 restart ice-factory-api       # Restart backend
pm2 stop ice-factory-api          # Stop backend
pm2 delete ice-factory-api        # Remove from PM2
```

---

## Re-deployment (Code Updates)

```powershell
cd C:\app\nihal_ice_factory

# Pull latest changes (if using Git) — use your deployment branch
git pull origin main          # or: git pull origin razorpay-demo

# Run backend tests (payment webhook money-path suite)
npx nx test @nihal-ice-factory/services

# Rebuild
npx nx build @nihal-ice-factory/services --configuration=production
npx nx build @nihal-ice-factory/ui --configuration=production

# Restart backend
pm2 restart ice-factory-api

# Nginx serves static files directly — no restart needed for frontend changes
```

> New tables/columns are created automatically on backend start while
> `DB_SYNCHRONIZE=true`. If you've set it to `false`, apply schema changes manually
> before restarting.

---

## Troubleshooting

| Issue | Command to check |
|---|---|
| Backend not starting | `pm2 logs ice-factory-api` |
| Port 3000 already in use | `netstat -ano \| findstr :3000` |
| MySQL connection refused | `Get-Service -Name "MySQL*"` |
| Nginx config error | `C:\nginx\nginx.exe -t` |
| Cannot reach from browser | Check AWS Security Group inbound rules |
