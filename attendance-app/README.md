# Bisync RMS Web

Web client for the Bisync RMS mobile API (Operator + Vendor), mirroring [BisyncRMSMobile](../).

## Backends (UAT)

| Service | URL |
|---------|-----|
| Mobile API | `https://uat.mobileapi.bisync.cloud/` |
| Identity | `https://uat.identity.bisync.cloud/` |

Configured in `.env` / `.env.uat`. Dev server proxies `/mobile-api` and `/identity` to avoid CORS (`VITE_USE_PROXY=true`).

**Note:** `VITE_CLIENT_SECRET` is held in the SPA the same way the Flutter app embeds `tokenSecret`. Prefer a BFF for production.

## Run

```powershell
cd web
npm install
npm run dev
```

Open http://localhost:5174

### Dev login bypass

`VITE_DEV_BYPASS_AUTH=true` (default in `.env`) auto-signs in as `VITE_DEV_USERNAME` / `VITE_DEV_PASSWORD` (operator UAT account). Set `VITE_DEV_BYPASS_AUTH=false` to use the login form. Restart `npm run dev` after changing env.

### Test accounts (from mobile README)

- Vendor: `vendor@cubevalue.com` / `1234`
- Operator: `ms@cubevalue.com` / `12345678`

## Features (v1)

- Password login via Identity `connect/token` + `Account/Detail`
- Role routing (`userType` Vendor vs Operator)
- Operator: status chips, order detail, approve/reject/receive/cancel, new order cart checkout
- Vendor: status chips, accept/reject/approve/proceed-to-DO/receive, new order (Sales), manual order lookup (QR substitute)

Deferred: biometrics, push, live QR camera, inventory, Pasar flavor.

## Scripts

- `npm run dev` — Vite dev server (port 5174)
- `npm run build` — production build
- `npm run preview` — preview build

## Deploy to production

Host on **Cloudflare Pages** (no Azure needed). See **[DEPLOY.md](./DEPLOY.md)** — point `mobile.bisync.cloud` at Pages, **not** `*.trycloudflare.com`.
