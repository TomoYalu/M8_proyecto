# =============================================================================
# Lakshmi Q2 — Easy Start (Windows / PowerShell)
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# =============================================================================
# Uso:  .\easy_start.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lakshmi Q2 - Easy Start (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar Python ──────────────────────────────────────────
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "[ERROR] Python no esta instalado." -ForegroundColor Red
    Write-Host "        Descargalo en https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "        Asegurate de marcar 'Add Python to PATH' al instalar." -ForegroundColor Yellow
    exit 1
}
$pyVer = python --version 2>&1
Write-Host "[OK] $pyVer" -ForegroundColor Green

# ── 2. Verificar Node.js ─────────────────────────────────────────
$nd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nd) {
    Write-Host "[ERROR] Node.js no esta instalado." -ForegroundColor Red
    Write-Host "        Descargalo en https://nodejs.org/ (version LTS recomendada)" -ForegroundColor Yellow
    exit 1
}
$nodeVer = node --version 2>&1
Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green

# ── 3. Pedir ElevenLabs Agent ID ─────────────────────────────────
Write-Host ""
Write-Host "El asistente de voz requiere un Agent ID de ElevenLabs." -ForegroundColor Yellow
Write-Host "Si no lo tienes, presiona Enter para omitirlo (el portal funciona sin el)." -ForegroundColor Yellow
Write-Host ""
$agentId = Read-Host "ElevenLabs Agent ID"

# ── 4. Crear entorno virtual de Python ───────────────────────────
Write-Host ""
Write-Host "[...] Creando entorno virtual de Python..." -ForegroundColor Cyan
$venvPath = Join-Path $ROOT "backend\venv"
if (-not (Test-Path $venvPath)) {
    python -m venv "$venvPath"
    Write-Host "[OK] Entorno virtual creado en backend\venv" -ForegroundColor Green
} else {
    Write-Host "[OK] Entorno virtual ya existe" -ForegroundColor Green
}

# ── 5. Instalar dependencias de Python ───────────────────────────
Write-Host "[...] Instalando dependencias de Python..." -ForegroundColor Cyan
$pipExe = Join-Path $venvPath "Scripts\pip.exe"
& $pipExe install -r "$ROOT\backend\requirements.txt" --quiet 2>&1 | Out-Null
Write-Host "[OK] Dependencias de Python instaladas" -ForegroundColor Green

# ── 6. Instalar dependencias de Node.js ──────────────────────────
Write-Host "[...] Instalando dependencias de Node.js..." -ForegroundColor Cyan
Push-Location "$ROOT\frontend"
npm install --silent 2>&1 | Out-Null
Pop-Location
Write-Host "[OK] Dependencias de Node.js instaladas" -ForegroundColor Green

# ── 7. Crear frontend/.env con ElevenLabs ID ─────────────────────
$envFile = Join-Path $ROOT "frontend\.env"
if ($agentId -and $agentId.Trim() -ne "") {
    Set-Content -Path $envFile -Value "VITE_ELEVENLABS_AGENT_ID=$($agentId.Trim())"
    Write-Host "[OK] frontend\.env creado con Agent ID" -ForegroundColor Green
} else {
    if (-not (Test-Path $envFile)) {
        Set-Content -Path $envFile -Value "# VITE_ELEVENLABS_AGENT_ID=tu-agent-id-aqui"
    }
    Write-Host "[--] Sin Agent ID, el asistente de voz estara deshabilitado" -ForegroundColor Yellow
}

# ── 8. Levantar Backend ──────────────────────────────────────────
Write-Host ""
Write-Host "[...] Levantando backend (puerto 5000)..." -ForegroundColor Cyan
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$env:LAKSHMI_DEMO = "1"
$backendProc = Start-Process -FilePath $pythonExe -ArgumentList "run.py" `
    -WorkingDirectory "$ROOT\backend" -PassThru -WindowStyle Minimized
Write-Host "[OK] Backend iniciado (PID: $($backendProc.Id)) con datos demo" -ForegroundColor Green

# ── 9. Esperar a que el backend responda ─────────────────────────
Write-Host "[...] Esperando a que el backend este listo..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5000/api/portafolios" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}
if ($ready) {
    Write-Host "[OK] Backend listo" -ForegroundColor Green
} else {
    Write-Host "[WARN] Backend tardo mas de lo esperado, puede seguir cargando..." -ForegroundColor Yellow
}

# ── 10. Levantar Frontend ────────────────────────────────────────
Write-Host "[...] Levantando frontend (puerto 5173)..." -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath "npm" -ArgumentList "run","dev" `
    -WorkingDirectory "$ROOT\frontend" -PassThru -WindowStyle Minimized
Write-Host "[OK] Frontend iniciado (PID: $($frontendProc.Id))" -ForegroundColor Green

# ── Listo ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Lakshmi Q2 esta corriendo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:   http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "  Para detener: cierra esta ventana o ejecuta:" -ForegroundColor Gray
Write-Host "    Stop-Process -Id $($backendProc.Id),$($frontendProc.Id)" -ForegroundColor Gray
Write-Host ""

# Abrir navegador
Start-Process "http://localhost:5173"

# Mantener la ventana abierta
Write-Host "Presiona Ctrl+C para detener los servicios." -ForegroundColor Yellow
try { Wait-Process -Id $backendProc.Id } catch {}
