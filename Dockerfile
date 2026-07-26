# ── Stage 1: Build main React client ─────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

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
COPY --from=client-build /src/client/dist/ src/Bisync.Api/wwwroot/
COPY --from=attendance-build /src/attendance-app/dist/ src/Bisync.Api/wwwroot/Attendance/app/
RUN dotnet publish src/Bisync.Api/Bisync.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ── Stage 3: Runtime (Cloud Run) ───────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=api-build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bisync.Api.dll"]
