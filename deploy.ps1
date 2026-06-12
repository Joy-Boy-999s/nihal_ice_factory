# ============================================================
# deploy.ps1
# Nihal Ice Factory — Project Deploy Script
# Run this from the project root AFTER cloning:
#   cd C:\app\nihal_ice_factory
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────
$SERVER_IP    = "52.87.217.163"
$APP_DIR      = $PSScriptRoot                  # wherever this script lives
$NGINX_DIR    = "C:\nginx"
$BACKEND_PORT = 3000
$PM2_APP_NAME = "ice-factory-api"

$UI_ENV_FILE  = "$APP_DIR\packages\ui\.env"
$ENV_FILE     = "$APP_DIR\packages\services\.env"
$BACKEND_DIST = "$APP_DIR\packages\services\dist\main.js"
$FRONTEND_DIST= "$APP_DIR\dist\packages\ui\index.html"
# ─────────────────────────────────────────────────────────────

function Write-Step { param([string]$msg)
    Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg)
    Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg)
    Write-Host "    [WARN] $msg" -ForegroundColor Yellow }

# ─────────────────────────────────────────────────────────────
# STEP 1 — Verify we are in the right directory
# ─────────────────────────────────────────────────────────────
Write-Step "Verifying project directory"
if (-not (Test-Path "$APP_DIR\package.json")) {
    Write-Host "ERROR: package.json not found in $APP_DIR" -ForegroundColor Red
    Write-Host "       Run this script from the project root." -ForegroundColor Red
    exit 1
}
Write-OK "Project root: $APP_DIR"

# ─────────────────────────────────────────────────────────────
# STEP 2 — Frontend .env (created only if missing — never clobbered)
# ─────────────────────────────────────────────────────────────
Write-Step "Checking frontend .env"
if (Test-Path $UI_ENV_FILE) {
    Write-OK "packages/ui/.env exists — leaving as-is (verify VITE_API_URL points at this server)"
} else {
    Set-Content -Path $UI_ENV_FILE -Encoding utf8 -Value @"
VITE_API_URL=http://$SERVER_IP`:$BACKEND_PORT

# Optional — GST tax invoices (set GSTIN to enable HSN + CGST/SGST breakup)
VITE_COMPANY_GSTIN=
VITE_COMPANY_ADDRESS=
VITE_ICE_HSN_CODE=2201
VITE_GST_RATE=5
"@
    Write-OK "packages/ui/.env created with VITE_API_URL=http://$SERVER_IP`:$BACKEND_PORT"
}

# ─────────────────────────────────────────────────────────────
# STEP 3 — Backend .env (template only — secrets are NEVER stored
#          in this script; fill the placeholders before continuing)
# ─────────────────────────────────────────────────────────────
Write-Step "Checking backend .env"
if (Test-Path $ENV_FILE) {
    Write-OK "packages/services/.env exists — leaving as-is"
} else {
    Set-Content -Path $ENV_FILE -Encoding utf8 -Value @"
PORT=$BACKEND_PORT
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=CHANGE_ME
DB_NAME=ice-999
DB_SYNCHRONIZE=true

# Password-reset OTP emails (Gmail app password or SMTP)
EMAIL_USER=CHANGE_ME
EMAIL_PASS=CHANGE_ME

# Generate with: openssl rand -hex 32 (or any long random string)
JWT_SECRET=CHANGE_ME
ENCRYPTION_KEY=CHANGE_ME

# Razorpay (test keys start with rzp_test_)
RAZORPAY_KEY_ID=CHANGE_ME
RAZORPAY_KEY_SECRET=CHANGE_ME
RAZORPAY_WEBHOOK_SECRET=

# CORS allowlist — must include the frontend origin served by Nginx
ALLOWED_ORIGINS=http://$SERVER_IP

# Frontend URL used in WhatsApp replies
APP_WEB_URL=http://$SERVER_IP

# Optional — WhatsApp Business Cloud API (features dormant when unset)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
"@
    Write-Warn "packages/services/.env created with PLACEHOLDERS."
    Write-Host "    Fill in every CHANGE_ME value, then re-run .\deploy.ps1" -ForegroundColor Yellow
    exit 1
}

# Refuse to deploy with placeholder secrets still in place
if (Select-String -Path $ENV_FILE -Pattern "CHANGE_ME" -Quiet) {
    Write-Warn "packages/services/.env still contains CHANGE_ME placeholders."
    Write-Host "    Fill in real values, then re-run .\deploy.ps1" -ForegroundColor Yellow
    exit 1
}
Write-OK "Backend .env looks configured"

# ─────────────────────────────────────────────────────────────
# STEP 4 — Install npm dependencies
# ─────────────────────────────────────────────────────────────
Write-Step "Installing npm dependencies"
Set-Location $APP_DIR
npm install --prefer-offline
if ($LASTEXITCODE -ne 0) { npm install }
Write-OK "Dependencies installed"

# ─────────────────────────────────────────────────────────────
# STEP 5 — Build backend (NestJS + webpack)
# ─────────────────────────────────────────────────────────────
Write-Step "Building backend"
npx nx build @nihal-ice-factory/services --configuration=production
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend build failed" -ForegroundColor Red; exit 1
}
if (Test-Path $BACKEND_DIST) {
    Write-OK "Backend built -> $BACKEND_DIST"
} else {
    Write-Host "ERROR: $BACKEND_DIST not found after build" -ForegroundColor Red; exit 1
}

# ─────────────────────────────────────────────────────────────
# STEP 6 — Build frontend (React + Vite)
# ─────────────────────────────────────────────────────────────
Write-Step "Building frontend"
npx nx build @nihal-ice-factory/ui --configuration=production
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend build failed" -ForegroundColor Red; exit 1
}
if (Test-Path $FRONTEND_DIST) {
    Write-OK "Frontend built -> $APP_DIR\dist\packages\ui"
} else {
    Write-Host "ERROR: $FRONTEND_DIST not found after build" -ForegroundColor Red; exit 1
}

# ─────────────────────────────────────────────────────────────
# STEP 7 — Start / restart backend with PM2
# ─────────────────────────────────────────────────────────────
Write-Step "Starting backend with PM2"

# Refresh PATH so pm2 is available
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$existing = pm2 list 2>&1 | Select-String $PM2_APP_NAME
if ($existing) {
    Write-Host "    Restarting existing PM2 process..." -ForegroundColor Gray
    pm2 restart $PM2_APP_NAME
} else {
    Write-Host "    Starting new PM2 process..." -ForegroundColor Gray
    Set-Location "$APP_DIR\packages\services"
    pm2 start dist\main.js --name $PM2_APP_NAME --env production
    Set-Location $APP_DIR
}

pm2 save
Write-OK "PM2 process '$PM2_APP_NAME' running"

# ─────────────────────────────────────────────────────────────
# STEP 8 — Start / reload Nginx
# ─────────────────────────────────────────────────────────────
Write-Step "Starting Nginx"
$nginxExe = "$NGINX_DIR\nginx.exe"
if (-not (Test-Path $nginxExe)) {
    Write-Warn "Nginx not found at $NGINX_DIR — skipping"
} else {
    $nginxRunning = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxRunning) {
        & $nginxExe -s reload
        Write-OK "Nginx reloaded"
    } else {
        & $nginxExe
        Start-Sleep -Seconds 2
        $check = Get-Process nginx -ErrorAction SilentlyContinue
        if ($check) { Write-OK "Nginx started" }
        else { Write-Warn "Nginx may not have started — check C:\nginx\logs\error.log" }
    }
}

# ─────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://$SERVER_IP" -ForegroundColor Cyan
Write-Host "  Backend  : http://$SERVER_IP`:$BACKEND_PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PM2 status : pm2 status" -ForegroundColor Gray
Write-Host "  PM2 logs   : pm2 logs $PM2_APP_NAME" -ForegroundColor Gray
Write-Host "  Nginx logs : C:\nginx\logs\error.log" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Green
