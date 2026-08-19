# urlshrtnr

[![Runtime: Node.js](https://img.shields.io/badge/runtime-Node.js-18181f?style=flat-square)](https://nodejs.org/)
[![Database: SQLite](https://img.shields.io/badge/database-node:sqlite-18181f?style=flat-square)](https://nodejs.org/api/sqlite.html)
[![License: MIT](https://img.shields.io/badge/license-MIT-18181f?style=flat-square)](LICENSE)

A lightweight, self-hosted URL redirector, link management suite, and click telemetry service designed for deployment on cloud instances with Nginx and Cloudflare.

## Overview

urlshrtnr provides high-performance URL redirection with optional interstitial countdown landing pages, administrative link management, and click tracking. It utilizes Node.js's native SQLite database engine with automatic fallback to JSON persistence, ensuring minimal resource consumption on low-memory VPS environments.

## Key Capabilities

- Instant direct 301/302 redirects or customizable interstitial countdown landing pages.
- Native SQLite database storage via `node:sqlite` with zero external database dependencies.
- Passcode-authenticated administrative dashboard for creating, expiring, and tracking links.
- Production-ready deployment configurations for PM2 process management, Nginx reverse proxying, and Cloudflare DNS routing.

## Tech Stack

- **Runtime & Backend:** Node.js, Express.js
- **Database:** `node:sqlite` (Native SQLite Sync), JSON storage fallback
- **Security & Auth:** Cookie-parser, Crypto (SHA-256 session tokens)
- **Deployment & Infra:** PM2, Nginx, Oracle Cloud Infrastructure (OCI VPS), Cloudflare DNS

## Usage

```bash
# Clone and install dependencies
git clone https://github.com/innocous06/urlshrtnr.git
cd urlshrtnr
npm install

# Configure environment variables
cp .env.example .env

# Run server
npm start
```

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 innocous. All rights reserved.
