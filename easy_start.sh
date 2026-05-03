#!/usr/bin/env bash
# =============================================================================
# Lakshmi Q2 — Easy Start (Mac / Linux)
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# =============================================================================
# Uso:  chmod +x easy_start.sh && ./easy_start.sh
# =============================================================================

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================"
echo "  Lakshmi Q2 - Easy Start (Mac/Linux)"
echo "========================================"
echo ""

# ── 1. Verificar Python ──────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 no esta instalado."
    echo "        Mac:   brew install python3"
    echo "        Linux: sudo apt install python3 python3-venv"
    exit 1
fi
echo "[OK] $(python3 --version)"

# ── 2. Verificar Node.js ─────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js no esta instalado."
    echo "        Mac:   brew install node"
    echo "        Linux: https://nodejs.org/"
    exit 1
fi
echo "[OK] Node.js $(node --version)"

# ── 3. Pedir ElevenLabs Agent ID ─────────────────────────────────
echo ""
echo "El asistente de voz requiere un Agent ID de ElevenLabs."
echo "Si no lo tienes, presiona Enter para omitirlo (el portal funciona sin el)."
echo ""
read -rp "ElevenLabs Agent ID: " AGENT_ID

# ── 4. Crear entorno virtual de Python ───────────────────────────
echo ""
echo "[...] Creando entorno virtual de Python..."
VENV_PATH="$ROOT/backend/venv"
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
    echo "[OK] Entorno virtual creado en backend/venv"
else
    echo "[OK] Entorno virtual ya existe"
fi

# ── 5. Instalar dependencias de Python ───────────────────────────
echo "[...] Instalando dependencias de Python..."
"$VENV_PATH/bin/pip" install -r "$ROOT/backend/requirements.txt" --quiet
echo "[OK] Dependencias de Python instaladas"

# ── 6. Instalar dependencias de Node.js ──────────────────────────
echo "[...] Instalando dependencias de Node.js..."
cd "$ROOT/frontend"
npm install --silent 2>&1
cd "$ROOT"
echo "[OK] Dependencias de Node.js instaladas"

# ── 7. Crear frontend/.env con ElevenLabs ID ─────────────────────
ENV_FILE="$ROOT/frontend/.env"
if [ -n "$AGENT_ID" ]; then
    echo "VITE_ELEVENLABS_AGENT_ID=$AGENT_ID" > "$ENV_FILE"
    echo "[OK] frontend/.env creado con Agent ID"
else
    if [ ! -f "$ENV_FILE" ]; then
        echo "# VITE_ELEVENLABS_AGENT_ID=tu-agent-id-aqui" > "$ENV_FILE"
    fi
    echo "[--] Sin Agent ID, el asistente de voz estara deshabilitado"
fi

# ── 8. Levantar Backend ──────────────────────────────────────────
echo ""
echo "[...] Levantando backend (puerto 5000)..."
LAKSHMI_DEMO=1 "$VENV_PATH/bin/python" "$ROOT/backend/run.py" &
BACKEND_PID=$!
echo "[OK] Backend iniciado (PID: $BACKEND_PID) con datos demo"

# ── 9. Esperar a que el backend responda ─────────────────────────
echo "[...] Esperando a que el backend este listo..."
READY=false
for i in $(seq 1 30); do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/portafolios 2>/dev/null | grep -q "200"; then
        READY=true
        break
    fi
done
if $READY; then
    echo "[OK] Backend listo"
else
    echo "[WARN] Backend tardo mas de lo esperado, puede seguir cargando..."
fi

# ── 10. Levantar Frontend ────────────────────────────────────────
echo "[...] Levantando frontend (puerto 5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"
echo "[OK] Frontend iniciado (PID: $FRONTEND_PID)"

# ── Listo ─────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Lakshmi Q2 esta corriendo!"
echo "========================================"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:5000"
echo ""
echo "  Para detener: presiona Ctrl+C"
echo ""

# Abrir navegador
if command -v open &>/dev/null; then
    open "http://localhost:5173"
elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:5173"
fi

# Esperar y limpiar al salir
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

wait $BACKEND_PID
