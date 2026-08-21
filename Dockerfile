# ── Stage 1: Build main React client ─────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /src/client
# Bake Dev Console SPA path into the production bundle (must match Cloud Run URL).
ARG VITE_DEV_CONSOLE_PATH=/dev/console
ENV VITE_DEV_CONSOLE_PATH=$VITE_DEV_CONSOLE_PATH
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build \
  && test -f dist/favicon.svg \
  && grep -q '#F37021' dist/favicon.svg \
  && ! grep -qiE '863bff|aa3bff|vite-logo' dist/favicon.svg \
  && grep -q 'favicon.svg?v=' dist/index.html \
  && test ! -e src/assets/vite.svg \
  && test ! -e src/assets/react.svg \
  && test ! -e src/App.css \
  && test ! -e dist/vite.svg \
  && test ! -e dist/react.svg \
  && test ! -e dist/icons.svg \
  && test ! -e public/icons.svg

# ── Stage 1b: Build Clock / Attendance SPA (/Attendance/app) ─────────────────
FROM node:22-alpine AS attendance-build
WORKDIR /src/attendance-app
COPY attendance-app/package.json attendance-app/package-lock.json ./
RUN npm ci
COPY attendance-app/ ./
# Write mode env for Vite (no secrets — path + clock flags only).
RUN printf '%s\n' \
  'VITE_BASE_PATH=/Attendance/app/' \
  'VITE_CLOCK_MODE=true' \
  'VITE_ATTENDANCE_MOCK=false' \
  'VITE_USE_PROXY=false' \
  'VITE_HR_SAME_ORIGIN=true' \
  'VITE_DEV_BYPASS_AUTH=false' \
  > .env.attendance
RUN npm run build:attendance

# ── Stage 2: Build .NET API ───────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY src/Bisync.Api/Bisync.Api.csproj src/Bisync.Api/
RUN dotnet restore src/Bisync.Api/Bisync.Api.csproj
COPY src/Bisync.Api/ src/Bisync.Api/
# Canonical floor plans referenced by Bisync.Api.csproj (../../data/floor-plans).
COPY data/floor-plans/ data/floor-plans/
# Wipe any accidental local/committed wwwroot so only this build's SPA ships.
RUN rm -rf src/Bisync.Api/wwwroot
COPY --from=client-build /src/client/dist/ src/Bisync.Api/wwwroot/
COPY --from=attendance-build /src/attendance-app/dist/ src/Bisync.Api/wwwroot/Attendance/app/
RUN test -f src/Bisync.Api/wwwroot/favicon.svg \
  && grep -q '#F37021' src/Bisync.Api/wwwroot/favicon.svg \
  && ! grep -qiE '863bff|aa3bff|vite-logo' src/Bisync.Api/wwwroot/favicon.svg \
  && grep -q 'favicon.svg?v=' src/Bisync.Api/wwwroot/index.html \
  && test ! -e src/Bisync.Api/wwwroot/vite.svg \
  && test ! -e src/Bisync.Api/wwwroot/react.svg \
  && test ! -e src/Bisync.Api/wwwroot/icons.svg \
  && test -f src/Bisync.Api/wwwroot/Attendance/app/index.html \
  && test -f data/floor-plans/weissbrau-pavilion-kuala-lumpur.json \
  && dotnet publish src/Bisync.Api/Bisync.Api.csproj -c Release -o /app/publish /p:UseAppHost=false \
  && test -f /app/publish/data/floor-plans/weissbrau-pavilion-kuala-lumpur.json

# ── Stage 3: Runtime (Cloud Run) ───────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# curl for HEALTHCHECK (CKV_DOCKER_2). Prefer the image's built-in non-root
# `app` user / $APP_UID (CKV_DOCKER_3) — do not recreate it (.NET 8+ already defines it).
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# RDS certificate authority bundle — required by SSL Mode=VerifyFull
ADD https://truststore.pki.rds.amazonaws.com/ap-southeast-1/ap-southeast-1-bundle.pem /app/rds-ca.pem

COPY --from=api-build --chown=app:app /app/publish .
# Canonical venue floor plans — restored on startup when DB is empty/stock.
COPY --chown=app:app data/floor-plans/ /app/data/floor-plans/

# /app itself is created as root; give the runtime user ownership so ephemeral
# archives (COGS audit history, stock-card archive) can be created under ContentRoot.
RUN mkdir -p /app/data-archives/cogs-audit-history/system \
             /app/data-archives/stock-card \
             /app/data/floor-plans \
  && chown -R app:app /app
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["dotnet", "Bisync.Api.dll"]
