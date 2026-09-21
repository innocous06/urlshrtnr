# urlshrtnr

[![Status: Production](https://img.shields.io/badge/STATUS-PRODUCTION-18181f?style=for-the-badge)](https://github.com/innocous06/urlshrtnr)
[![Runtime: Cloudflare Workers](https://img.shields.io/badge/RUNTIME-CLOUDFLARE_WORKERS-18181f?style=for-the-badge)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-18181f?style=for-the-badge)](LICENSE)

An ultra-fast edge shortlink redirection engine, management dashboard, and interstitial router deployed natively on Cloudflare Workers with Workers KV persistence.

## Overview

`urlshrtnr` powers edge-based link shortening and branded interstitial redirects at edge locations worldwide for `url.600266.xyz`. Designed with an immutable shortlink architecture, automatic system theme detection (Dark/Light), a 5-second countdown landing page with author note support, and zero VPS hosting dependency.

Includes a standalone local Node.js runtime (`server.js`) with persistent KV emulation for offline development and verification.

## Highlights & Capabilities

- **Immutable Shortlinks**: Links cannot be altered after deployment, eliminating redirection tampering and routing drift.
- **Interstitial Transition Engine**: 5-second countdown interstitial landing page displaying the destination domain, custom author notes, and a direct click-through action.
- **Social Crawler Unfurl**: OpenGraph and Twitter Card metadata allow link preview cards to unfurl natively on Discord, Telegram, WhatsApp, and Twitter without executing client JavaScript.
- **Non-JS Fallback**: Incorporates `<meta http-equiv="refresh">` fallback for automated scrapers, non-JS environments, and legacy browsers.
- **KV Rate-Limit Fault Tolerance**: Background click-counter increments are protected by non-blocking handlers, preventing KV write rate limits (1 write/sec per key) from interrupting user redirects.
- **Edge Brute-Force Guard**: Enforces a strict 5-attempt / 15-minute lock on passcode authentication (`600266`) directly in the worker isolate.
- **Modern Editorial UI**: High-contrast black and white layout, warm orange container tint, and under 10% orange accents.

## Tech Stack

- **Edge Runtime:** Cloudflare Workers (V8 Isolates)
- **Edge Storage:** Cloudflare Workers KV
- **Local Dev Runtime:** Node.js 20+ (`server.js` with local KV cache in `data/kv.json`)
- **CLI & Tooling:** Cloudflare Wrangler v3+
- **Frontend Architecture:** Semantic HTML5, Vanilla JavaScript, CSS Custom Properties

## Local Development

```bash
# Clone the repository
git clone https://github.com/innocous06/urlshrtnr.git
cd urlshrtnr

# Start local offline dev server (port 3002)
node server.js
```

Access the management dashboard at `http://localhost:3002`. Default Passcode: `600266`.

## Cloudflare Deployment

### 1. Authenticate Wrangler
```bash
npx wrangler login
```

### 2. Provision Workers KV Namespace
```bash
npx wrangler kv namespace create URL_KV
```

Copy the generated namespace ID into `wrangler.toml`:
```toml
name = "url-600266-xyz"
main = "src/index.js"
compatibility_date = "2024-04-01"

kv_namespaces = [
  { binding = "URL_KV", id = "<YOUR_NAMESPACE_ID>" }
]

[vars]
ADMIN_PASSCODE = "600266"
BASE_URL = "https://url.600266.xyz"
DEFAULT_COUNTDOWN = "5"
```

### 3. Set Secret Passcode
```bash
npx wrangler secret put ADMIN_PASSCODE
# Enter: 600266
```

### 4. Deploy to Edge Network
```bash
npx wrangler deploy
```

### 5. Custom Domain Configuration
In the [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **`url-600266-xyz`** -> **Settings** -> **Domains & Routes** -> **Add Custom Domain** -> enter `url.600266.xyz`.

## API Reference

| Route | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/:code` | `GET` | Public | Resolves shortlink to interstitial screen or direct 302 redirect |
| `/api/auth/login` | `POST` | Public | Authenticates via 6-digit passcode; rate limited to 5 attempts |
| `/api/links` | `GET` | Required | Lists all active and expired shortlinks sorted by creation timestamp |
| `/api/links` | `POST` | Required | Provisions a new immutable shortlink with optional expiry and custom slug |
| `/api/links/:code` | `DELETE` | Required | Permanently removes shortlink from KV store |
| `/api/check-code/:code` | `GET` | Required | Verifies slug availability |

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 innocous06. All rights reserved.
