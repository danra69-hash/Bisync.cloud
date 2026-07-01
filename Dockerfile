# ── Stage 1: Build React client ──────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Build .NET API ───────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY src/Bisync.Api/Bisync.Api.csproj src/Bisync.Api/
RUN dotnet restore src/Bisync.Api/Bisync.Api.csproj
COPY src/Bisync.Api/ src/Bisync.Api/
COPY --from=client-build /src/client/dist/ src/Bisync.Api/wwwroot/
RUN dotnet publish src/Bisync.Api/Bisync.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ── Stage 3: Runtime (Cloud Run) ───────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN mkdir -p /app/data /app/seed
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=api-build /app/publish .
COPY src/Bisync.Api/bisync.db /app/seed/bisync.db
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
