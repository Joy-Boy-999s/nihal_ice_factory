# ============================================================
# setup-server.ps1
# Nihal Ice Factory — Windows Server Setup Script
# Run this ONCE on the RDP server as Administrator in PowerShell
# Usage: Right-click PowerShell → Run as Administrator
#        Then: Set-ExecutionPolicy Bypass -Scope Process -Force
#              .\setup-server.ps1
# ============================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

# ── Config ───────────────────────────────────────────────────
$SERVER_IP    = "52.87.217.163"
$DB_NAME      = "ice-999"
$DB_USER      = "root"
$DB_PASS      = "5082093"
$BACKEND_PORT = 3000
$FRONTEND_PORT= 80
$APP_DIR      = "C:\app\nihal_ice_factory"
$NGINX_DIR    = "C:\nginx"
# ─────────────────────────────────────────────────────────────

function Write-Step {
    param([string]$msg)
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$msg)
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Warn {
    param([string]$msg)
    Write-Host "    [WARN] $msg" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────
# STEP 0 — Verify running as Administrator
# ─────────────────────────────────────────────────────────────
Write-Step "Checking Administrator privileges"
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal   = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run this script as Administrator." -ForegroundColor Red
    exit 1
}
Write-OK "Running as Administrator"

# ─────────────────────────────────────────────────────────────
# STEP 1 — Install Chocolatey (Windows package manager)
# ─────────────────────────────────────────────────────────────
Write-Step "Installing Chocolatey package manager"
if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-OK "Chocolatey already installed: $(choco --version)"
} else {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    $chocoScript = "$env:TEMP\choco-install.ps1"
    (New-Object System.Net.WebClient).DownloadFile('https://community.chocolatey.org/install.ps1', $chocoScript)
    & $chocoScript
    # Reload PATH so choco is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-OK "Chocolatey installed: $(choco --version)"
}

# ─────────────────────────────────────────────────────────────
# STEP 2 — Install Node.js LTS
# ─────────────────────────────────────────────────────────────
Write-Step "Installing Node.js LTS"
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-OK "Node.js already installed: $(node -v)"
} else {
    choco install nodejs-lts -y --no-progress
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-OK "Node.js installed: $(node -v)"
}

# Verify npm
Write-OK "npm version: $(npm -v)"

# ─────────────────────────────────────────────────────────────
# STEP 3 — Install Git
# ─────────────────────────────────────────────────────────────
Write-Step "Installing Git"
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-OK "Git already installed: $(git --version)"
} else {
    choco install git -y --no-progress
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-OK "Git installed: $(git --version)"
}

# ─────────────────────────────────────────────────────────────
# STEP 4 — Install MySQL 8
# ─────────────────────────────────────────────────────────────
Write-Step "Installing MySQL 8"
$mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
if ($mysqlService) {
    Write-OK "MySQL service already exists: $($mysqlService.Name)"
} else {
    choco install mysql -y --no-progress
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    # Wait for MySQL service to start
    Write-Host "    Waiting for MySQL service to be ready..." -ForegroundColor Gray
    $timeout = 60
    $elapsed = 0
    do {
        Start-Sleep -Seconds 3
        $elapsed += 3
        $svc = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
    } while ((-not $svc -or $svc.Status -ne 'Running') -and $elapsed -lt $timeout)

    if ($svc -and $svc.Status -eq 'Running') {
        Write-OK "MySQL service is running"
    } else {
        Write-Warn "MySQL service may not have started automatically. Starting manually..."
        Start-Service -Name "MySQL*" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
    }
}

# ─────────────────────────────────────────────────────────────
# STEP 5 — Configure MySQL (set root password + create database)
# ─────────────────────────────────────────────────────────────
Write-Step "Configuring MySQL database"

# Find mysql.exe in PATH or common locations
$mysqlExe = Get-Command mysql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $mysqlExe) {
    $mysqlExe = Get-ChildItem "C:\tools\mysql*","C:\Program Files\MySQL\*" -Recurse -Filter "mysql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $mysqlExe) {
    Write-Warn "mysql.exe not found in PATH. Refreshing PATH..."
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $mysqlExe = (Get-Command mysql -ErrorAction SilentlyContinue).Source
}

if ($mysqlExe) {
    Write-OK "Found mysql at: $mysqlExe"

    # Try connecting with no password first (fresh install), then with existing password
    $sqlSetup = @"
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS';
CREATE DATABASE IF NOT EXISTS \``$DB_NAME\`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
FLUSH PRIVILEGES;
"@

    # Try no-password first (fresh MySQL install)
    $result = & $mysqlExe -u root --connect-expired-password -e $sqlSetup 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Try with the target password (already configured)
        $result = & $mysqlExe -u root -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS \`\`${DB_NAME}\`\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Could not auto-configure MySQL. Run manually after install:"
            Write-Host "    mysql -u root -e `"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; CREATE DATABASE \`\`$DB_NAME\`\`; FLUSH PRIVILEGES;`"" -ForegroundColor Gray
        } else {
            Write-OK "Database '$DB_NAME' created (password already set)"
        }
    } else {
        Write-OK "MySQL root password set and database '$DB_NAME' created"
    }
} else {
    Write-Warn "mysql.exe not found. After reboot/new PowerShell, run:"
    Write-Host "    mysql -u root -e `"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASS'; CREATE DATABASE \`\`$DB_NAME\`\`; FLUSH PRIVILEGES;`"" -ForegroundColor Gray
}

# ─────────────────────────────────────────────────────────────
# STEP 6 — Install PM2 (Node.js process manager)
# ─────────────────────────────────────────────────────────────
Write-Step "Installing PM2 globally"
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-OK "PM2 already installed: $(pm2 --version)"
} else {
    npm install -g pm2
    npm install -g pm2-windows-startup
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-OK "PM2 installed: $(pm2 --version)"
}

# Register PM2 to start on Windows boot
pm2-startup install 2>&1 | Out-Null
Write-OK "PM2 startup configured"

# ─────────────────────────────────────────────────────────────
# STEP 7 — Install Nginx for Windows
# ─────────────────────────────────────────────────────────────
Write-Step "Installing Nginx for Windows"
if (Test-Path "$NGINX_DIR\nginx.exe") {
    Write-OK "Nginx already present at $NGINX_DIR"
} else {
    # Download latest stable Nginx for Windows
    $nginxVersion = "1.26.3"
    $nginxZip     = "$env:TEMP\nginx.zip"
    $nginxUrl     = "https://nginx.org/download/nginx-$nginxVersion.zip"

    Write-Host "    Downloading Nginx $nginxVersion..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing

    Write-Host "    Extracting Nginx..." -ForegroundColor Gray
    Expand-Archive -Path $nginxZip -DestinationPath "C:\" -Force
    Rename-Item -Path "C:\nginx-$nginxVersion" -NewName "nginx" -Force -ErrorAction SilentlyContinue

    Remove-Item $nginxZip -Force
    Write-OK "Nginx installed at $NGINX_DIR"
}

# ─────────────────────────────────────────────────────────────
# STEP 8 — Write Nginx config
# ─────────────────────────────────────────────────────────────
Write-Step "Writing Nginx configuration"

$nginxConf = @"
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
        listen $FRONTEND_PORT;
        server_name $SERVER_IP;

        # Serve the React frontend
        root $($APP_DIR.Replace('\','/') + '/dist/packages/ui');
        index index.html;

        # React Router - all paths serve index.html
        location / {
            try_files `$uri `$uri/ /index.html;
        }

        # Proxy API calls to the NestJS backend
        location /api/ {
            proxy_pass         http://127.0.0.1:$BACKEND_PORT/;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade `$http_upgrade;
            proxy_set_header   Connection 'upgrade';
            proxy_set_header   Host `$host;
            proxy_cache_bypass `$http_upgrade;
        }
    }
}
"@

$nginxConf | Out-File -FilePath "$NGINX_DIR\conf\nginx.conf" -Encoding utf8 -Force
Write-OK "Nginx config written to $NGINX_DIR\conf\nginx.conf"

# Test the Nginx config
$testResult = & "$NGINX_DIR\nginx.exe" -t 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "Nginx config syntax is valid"
} else {
    Write-Warn "Nginx config test output: $testResult"
}

# ─────────────────────────────────────────────────────────────
# STEP 9 — Register Nginx as a Windows scheduled task (auto-start)
# ─────────────────────────────────────────────────────────────
Write-Step "Registering Nginx as a startup task"
$taskName = "NginxAutoStart"
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-OK "Nginx startup task already registered"
} else {
    $action  = New-ScheduledTaskAction -Execute "$NGINX_DIR\nginx.exe"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -RunLevel Highest -Settings $settings -Force | Out-Null
    Write-OK "Nginx startup task registered"
}

# ─────────────────────────────────────────────────────────────
# STEP 10 — Open Windows Firewall ports
# ─────────────────────────────────────────────────────────────
Write-Step "Configuring Windows Firewall"

$firewallRules = @(
    @{ Name="HTTP Port 80 (Nginx)";     Port=80   },
    @{ Name="NestJS API Port 3000";     Port=3000 },
    @{ Name="MySQL Port 3306 (local)";  Port=3306 }
)

foreach ($rule in $firewallRules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-OK "Firewall rule already exists: $($rule.Name)"
    } else {
        New-NetFirewallRule `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort $rule.Port `
            -Action Allow | Out-Null
        Write-OK "Opened port $($rule.Port): $($rule.Name)"
    }
}

# ─────────────────────────────────────────────────────────────
# STEP 11 — Create app directory
# ─────────────────────────────────────────────────────────────
Write-Step "Creating app directory"
if (-not (Test-Path $APP_DIR)) {
    New-Item -ItemType Directory -Path $APP_DIR -Force | Out-Null
    Write-OK "Created $APP_DIR"
} else {
    Write-OK "$APP_DIR already exists"
}

# ─────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SERVER SETUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Installed:" -ForegroundColor White
Write-Host "    Node.js  : $(node -v 2>$null)" -ForegroundColor Gray
Write-Host "    npm      : $(npm -v 2>$null)" -ForegroundColor Gray
Write-Host "    PM2      : $(pm2 --version 2>$null)" -ForegroundColor Gray
Write-Host "    MySQL    : $(mysql --version 2>$null)" -ForegroundColor Gray
Write-Host "    Git      : $(git --version 2>$null)" -ForegroundColor Gray
Write-Host "    Nginx    : $(& $NGINX_DIR\nginx.exe -v 2>&1)" -ForegroundColor Gray
Write-Host ""
Write-Host "  App directory : $APP_DIR" -ForegroundColor White
Write-Host "  Nginx config  : $NGINX_DIR\conf\nginx.conf" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Copy your project into $APP_DIR" -ForegroundColor White
Write-Host "     (ZIP it on your local PC, paste via RDP, extract here)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Update the frontend API URL before building:" -ForegroundColor White
Write-Host "     File: libs\shared-services\src\lib\config.ts" -ForegroundColor Gray
Write-Host "     Change: 'http://localhost:3000'" -ForegroundColor Gray
Write-Host "         To: 'http://$SERVER_IP`:3000'" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Build both apps from project root:" -ForegroundColor White
Write-Host "     cd $APP_DIR" -ForegroundColor Gray
Write-Host "     npm install" -ForegroundColor Gray
Write-Host "     npx nx build @nihal-ice-factory/services --configuration=production" -ForegroundColor Gray
Write-Host "     npx nx build @nihal-ice-factory/ui --configuration=production" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Start the backend with PM2:" -ForegroundColor White
Write-Host "     cd $APP_DIR\packages\services" -ForegroundColor Gray
Write-Host "     pm2 start dist\main.js --name ice-factory-api" -ForegroundColor Gray
Write-Host "     pm2 save" -ForegroundColor Gray
Write-Host ""
Write-Host "  5. Start Nginx:" -ForegroundColor White
Write-Host "     $NGINX_DIR\nginx.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "  6. Open in browser: http://$SERVER_IP" -ForegroundColor Cyan
Write-Host ""
Write-Host "  See deployment.md for full details." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Green
