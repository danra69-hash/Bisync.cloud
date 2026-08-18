# Pulse — standalone Cloud Run image (NOT Bisync).
# Build context: repository root (needed for COPY pulse/*).
#   docker build -f pulse/Dockerfile -t pulse-cloud .

# ── Web (Team SPA) ───────────────────────────────────────────────────────────
FROM node:22-alpine AS web-build
WORKDIR /src/web
COPY pulse/web/package.json pulse/web/package-lock.json ./
RUN npm ci
COPY pulse/web/ ./
RUN npm run build \
  && test -f dist/index.html \
  && test -f dist/favicon.svg

# ── API ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS api-build
WORKDIR /src/api
COPY pulse/api/package.json pulse/api/package-lock.json ./
RUN npm ci --omit=dev
COPY pulse/api/ ./

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV PULSE_WEB_DIST=/app/web/dist
RUN addgroup -S pulse && adduser -S pulse -G pulse
COPY --from=api-build --chown=pulse:pulse /src/api /app
COPY --from=web-build --chown=pulse:pulse /src/web/dist /app/web/dist
USER pulse
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "src/server.mjs"]
