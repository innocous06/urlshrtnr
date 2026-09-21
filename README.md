# urlshrtnr

[![Runtime: Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f38020?style=flat-square)](https://workers.cloudflare.com/)
[![Storage: Workers KV](https://img.shields.io/badge/storage-Workers%20KV-f38020?style=flat-square)](https://developers.cloudflare.com/kv/)
[![License: MIT](https://img.shields.io/badge/license-MIT-18181f?style=flat-square)](LICENSE)

An ultra-fast edge shortlink redirection engine, management dashboard, and interstitial router deployed natively on Cloudflare Workers with Workers KV persistence.

## Overview

`urlshrtnr` powers high-speed link shortening and branded interstitial redirects at edge locations worldwide for `url.600266.xyz`. Designed with an immutable shortlink architecture, built-in system theme detection (Dark/Light), a 5-second countdown interstitial landing page with author note support, and zero VPS hosting dependency.

Includes a lightweight standalone local Node.js runtime (`server.js`) with persistent KV emulation for offline local development and testing.

## Key Capabilities

- **Global Edge Redirection**: Sub-millisecond direct 302 redirects or 5-second interstitial transition screens.
- **Workers KV Persistence**: Global distributed key-value storage with automatic TTL expiration.
- **Modern Editorial Interface**: High-contrast black and white UI, subtle warm orange container styling, and responsive design.
- **Immutable Shortlinks**: Links cannot be altered after deployment, preserving routing integrity and security.
- **Administrative Console**: 6-digit passcode authentication, custom alias reservation, auto-slug generation, click telemetry, and live status inspection.
- **Standalone Local Development**: Run offline locally via `node server.js` with zero Cloudflare configuration required.

## Tech Stack

- **Edge Runtime:** Cloudflare Workers (V8 Isolates)
- **Edge Storage:** Cloudflare Workers KV
- **Local Runtime:** Node.js 20+ (`server.js` with local KV cache in `data/kv.json`)
- **CLI & Deployment:** Wrangler v3+

## Local Development

```bash
# Clone repository
git clone https://github.com/innocous06/urlshrtnr.git
cd urlshrtnr

# Start local dev server (port 3002)
node server.js
# Access dashboard at http://localhost:3002 (Passcode: 600266)
```

## Cloudflare Worker Deployment

```bash
# Authenticate with Cloudflare
npx wrangler login

# Create KV namespace
npx wrangler kv namespace create URL_KV

# Set administrative passcode secret
npx wrangler secret put ADMIN_PASSCODE

# Deploy to Cloudflare edge network
npx wrangler deploy
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `URL_KV` | `URL_KV` | Workers KV namespace binding |
| `BASE_URL` | `https://url.600266.xyz` | Canonical base domain |
| `ADMIN_PASSCODE` | `600266` | 6-digit dashboard administrative passcode |
| `DEFAULT_COUNTDOWN` | `5` | Interstitial countdown delay in seconds |
| `SECRET` | - | HMAC signing secret for session tokens |

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 innocous06. All rights reserved.
