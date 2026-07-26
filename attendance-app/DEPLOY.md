# Deploying Bisync RMS Web on Cloudflare Pages

Host the static PWA on **Cloudflare Pages** and point **`mobile.bisync.cloud`** at it. No Azure subscription required.

> **Do not CNAME to `*.trycloudflare.com`.** Quick tunnels are for temporary dev previews only. They return **HTTP 409** for custom hostnames and the URL changes every restart.

---

## Architecture

```
Browser → https://mobile.bisync.cloud (Cloudflare DNS + Pages)
       → static files (web/dist)
       → API calls to mobileapi.bisync.cloud / identity.bisync.cloud (browser direct)
```

---

## One-time setup (≈20 min)

### 1. Create Cloudflare Pages project

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. **Pages** → **Upload assets** (Direct Upload — no GitHub required)
3. Project name: **`bisync-rms-mobile`** (production)
4. Optional UAT project: **`bisync-rms-mobile-uat`**

You can skip the first manual upload — the pipeline or `npm run deploy:pages` will push `dist/`.

### 2. API token for CI / CLI deploy

1. **My Profile** → **API Tokens** → **Create Token**
2. Use template **Edit Cloudflare Workers** or custom permissions:
   - Account → **Cloudflare Pages** → **Edit**
3. Copy token

**Account ID**: Cloudflare dashboard → any zone → right sidebar, or Workers & Pages overview.

### 3. Azure DevOps variable group

**Pipelines** → **Library** → **bisync-web-production**

| Variable | Secret? |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | No |
| `VITE_CLIENT_SECRET` | Yes |

Optional **`bisync-web-uat`** for UAT API URLs + `bisync-rms-mobile-uat` project.

### 4. Pipeline

1. **New pipeline** → YAML: `/azure-pipelines/web-cloudflare-pages.yml`
2. Run with parameter **production**

Or deploy manually from your machine:

```powershell
cd web
copy .env.production.example .env.production
# edit VITE_CLIENT_SECRET
npm ci
npm run build
$env:CLOUDFLARE_API_TOKEN = "your-token"
$env:CLOUDFLARE_ACCOUNT_ID = "your-account-id"
npm run deploy:pages
```

### 5. Fix DNS — point domain at Pages (not trycloudflare)

**Remove** the existing record:

| Type | Name | Target (delete this) |
|------|------|----------------------|
| CNAME | `mobile` | `physiology-formatting-specific-adam.trycloudflare.com` |

**Add custom domain in Pages** (recommended — same Cloudflare account as `bisync.cloud`):

1. Pages → **bisync-rms-mobile** → **Custom domains** → **Set up a custom domain**
2. Enter **`mobile.bisync.cloud`**
3. Cloudflare **creates/updates DNS automatically** (CNAME to `bisync-rms-mobile.pages.dev` or similar)
4. Wait for **Active** status + SSL certificate (usually minutes)

Manual DNS alternative (if not auto):

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `mobile` | `bisync-rms-mobile.pages.dev` | Proxied (orange cloud) |

### 6. Cloudflare SSL settings (zone bisync.cloud)

- **SSL/TLS** → **Overview** → **Full** (or Full strict)
- **Edge Certificates** → **Always Use HTTPS**: On

### 7. Backend CORS

Ask API team to allow origin **`https://mobile.bisync.cloud`** on:

- `https://mobileapi.bisync.cloud`
- `https://identity.bisync.cloud`

---

## URLs after deploy

| Environment | Pages default | Custom domain |
|-------------|---------------|---------------|
| Production | `https://bisync-rms-mobile.pages.dev` | **`https://mobile.bisync.cloud`** |
| UAT (optional) | `https://bisync-rms-mobile-uat.pages.dev` | `https://mobile-uat.bisync.cloud` |

---

## Why trycloudflare failed

| Approach | Works for `mobile.bisync.cloud`? |
|----------|----------------------------------|
| CNAME → `*.trycloudflare.com` | **No** — quick tunnels reject foreign Host headers (409) |
| **Cloudflare Pages** + custom domain | **Yes** — stable, HTTPS, global CDN |
| Named Cloudflare Tunnel (`*.cfargotunnel.com`) | Yes — only if you run `cloudflared` 24/7 on a server |

---

## Optional: AWS instead of Pages

If you prefer AWS (you have a subscription):

- **S3** bucket (static website) + **CloudFront** + ACM cert
- Cloudflare DNS: CNAME `mobile` → CloudFront distribution
- Still use `web/dist` + `_redirects` / CloudFront error pages for SPA routing

Cloudflare Pages is simpler when DNS is already on Cloudflare.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 409 on `mobile.bisync.cloud` | Remove trycloudflare CNAME; attach domain in Pages |
| Blank page on `/operator` refresh | Confirm `dist/_redirects` contains `/* /index.html 200` |
| Login CORS error | Add `https://mobile.bisync.cloud` to API CORS |
| Old app version | Hard refresh or Pages → Purge cache; redeploy |

---

## Deployment files

| File | Purpose |
|------|---------|
| `web/public/_redirects` | SPA fallback on Cloudflare Pages |
| `web/wrangler.toml` | Wrangler Pages project name |
| `azure-pipelines/web-cloudflare-pages.yml` | CI build + deploy |
| `web/.env.production.example` | Production build env |

Legacy (optional): `azure-pipelines/web-static-web-app.yml`, `web/public/staticwebapp.config.json` (Azure SWA).
