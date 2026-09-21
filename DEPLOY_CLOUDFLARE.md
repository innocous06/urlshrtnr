# Deploying URL Shortener to Cloudflare Workers

The architecture is 100% Cloudflare Worker native with KV storage.

### 1. Local Development
```bash
# Run locally on http://localhost:3002
npm start
# or run start.bat
```

### 2. Deploy to Cloudflare
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Create KV namespace (if not created yet)
npx wrangler kv:namespace create URL_KV

# 3. Paste the generated id into wrangler.toml:
# kv_namespaces = [
#   { binding = "URL_KV", id = "<YOUR_KV_ID>" }
# ]

# 4. Deploy
npx wrangler deploy
```

### Production Edge Domain
- URL: `https://url.600266.xyz`
- Admin Passcode: `600266`
