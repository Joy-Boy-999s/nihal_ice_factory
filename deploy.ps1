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

$CONFIG_FILE  = "$APP_DIR\libs\shared-services\src\lib\config.ts"
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
# STEP 2 — Patch frontend API URL to point at this server
# ─────────────────────────────────────────────────────────────
Write-Step "Patching frontend API URL -> http://$SERVER_IP`:$BACKEND_PORT"
if (-not (Test-Path $CONFIG_FILE)) {
    Write-Host "ERROR: $CONFIG_FILE not found" -ForegroundColor Red
    exit 1
}
$configContent = Get-Content $CONFIG_FILE -Raw
if ($configContent -match "http://$([regex]::Escape($SERVER_IP)):$BACKEND_PORT") {
    Write-OK "API URL already set to http://$SERVER_IP`:$BACKEND_PORT — skipping"
} else {
    $configContent = $configContent -replace "APP_INO_SERVICE_URL:\s*'[^']*'", "APP_INO_SERVICE_URL: 'http://$SERVER_IP`:$BACKEND_PORT'"
    Set-Content -Path $CONFIG_FILE -Value $configContent -Encoding utf8 -NoNewline
    Write-OK "config.ts updated"
}

# ─────────────────────────────────────────────────────────────
# STEP 3 — Write .env for backend
# ─────────────────────────────────────────────────────────────
Write-Step "Writing backend .env"
Set-Content -Path $ENV_FILE -Encoding utf8 -Value @"
PORT=$BACKEND_PORT
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=5082093
DB_NAME=ice-999

EMAIL_USER=mkillmessage18@gmail.com
EMAIL_PASS=hhjj ghaw zuer oiwk

JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9-a2f8c3e9d7b1f4a5e8c2d9b6f3a7
ENCRYPTION_KEY=4e8c6d1f3b5e0a9d2c7f4e8b1a3c5d9f6e2a7b0c4d8e1f3a5b9d6c2e7f2a9b3c
"@
Write-OK ".env written to $ENV_FILE"

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
