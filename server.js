const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const DATA_DIR = path.join(__dirname, 'data');
const KV_FILE = path.join(DATA_DIR, 'kv.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persistent KV store emulator matching Cloudflare Workers KV API
class LocalKV {
  constructor(filePath) {
    this.filePath = filePath;
    this.store = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          this.store.set(k, v);
        }
      }
    } catch (e) {
      console.error('Failed to load KV cache:', e);
    }
  }

  save() {
    try {
      const obj = {};
      for (const [k, v] of this.store.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save KV cache:', e);
    }
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.save();
      return null;
    }
    return entry.value;
  }

  async put(key, value, options = {}) {
    let expiresAt = null;
    if (options && options.expirationTtl) {
      expiresAt = Date.now() + options.expirationTtl * 1000;
    }
    this.store.set(key, { value: String(value), expiresAt });
    this.save();
  }

  async delete(key) {
    this.store.delete(key);
    this.save();
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const now = Date.now();
    const keys = [];
    for (const [k, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        continue;
      }
      if (k.startsWith(prefix)) {
        keys.push({ name: k });
      }
    }
    return { keys };
  }
}

const localKV = new LocalKV(KV_FILE);

async function start() {
  // Import the worker module dynamically
  const workerModule = await import('./src/index.js');
  const worker = workerModule.default;

  const env = {
    URL_KV: localKV,
    ADMIN_PASSCODE: process.env.ADMIN_PASSCODE || '600266',
    BASE_URL: process.env.BASE_URL || `http://localhost:${PORT}`,
    DEFAULT_COUNTDOWN: process.env.DEFAULT_COUNTDOWN || '5',
    SECRET: process.env.SECRET || 'url_cf_worker_secret_key_600266'
  };

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || `localhost:${PORT}`;
      const url = new URL(req.url, `http://${host}`);

      // Read incoming body for POST / PUT
      let body = undefined;
      if (!['GET', 'HEAD'].includes(req.method)) {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      }

      // Construct native Web API Request
      const webReq = new Request(url.toString(), {
        method: req.method,
        headers: req.headers,
        body
      });

      const ctx = {
        waitUntil: (promise) => {
          Promise.resolve(promise).catch(err => console.error('ctx.waitUntil error:', err));
        }
      };

      const webRes = await worker.fetch(webReq, env, ctx);

      res.statusCode = webRes.status;
      
      // Handle headers and Set-Cookie properly
      const setCookies = [];
      for (const [key, value] of webRes.headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
          setCookies.push(value);
        } else {
          res.setHeader(key, value);
        }
      }
      if (setCookies.length > 0) {
        res.setHeader('Set-Cookie', setCookies.length === 1 ? setCookies[0] : setCookies);
      }

      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      console.error('Local runner request error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Internal Server Error: ' + err.message);
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`URL Shortener (Cloudflare Worker Runtime) running at http://localhost:${PORT}`);
    console.log(`Using persistent KV storage at ${KV_FILE}`);
  });
}

start().catch(err => {
  console.error('Fatal error starting local worker runner:', err);
  process.exit(1);
});
