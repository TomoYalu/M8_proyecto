# =============================================================================
# Lakshmi Q2 — Frontend Dockerfile (multi-stage)
# Stage 1: node:20-alpine para build de React/Vite
# Stage 2: nginx:alpine para servir archivos estáticos
# =============================================================================

# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias primero (cache de Docker layers)
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copiar código fuente y construir
COPY . .
RUN npm run build

# ── Stage 2: Servir con Nginx ────────────────────────────────────
FROM nginx:alpine

# Copiar archivos estáticos del build
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx para SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
