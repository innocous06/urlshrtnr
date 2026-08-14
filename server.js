const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '600266';
const SESSION_SECRET = process.env.SESSION_SECRET || 'oracle_vps_redirector_secret_key_600266_xyz';
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DEFAULT_COUNTDOWN = parseInt(process.env.DEFAULT_COUNTDOWN || '3', 10);
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) { fs.mkdirSync(DATA_DIR, { recursive: true }); }
let db;
let useNativeSqlite = false;
try {
const { DatabaseSync } = require('node:sqlite');
const dbFile = path.join(DATA_DIR, 'links.sqlite');
db = new DatabaseSync(dbFile);
db.exec('CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, target_url TEXT NOT NULL, note TEXT DEFAULT "", expires_at INTEGER DEFAULT NULL, created_at INTEGER NOT NULL, click_count INTEGER DEFAULT 0, redirect_type TEXT DEFAULT "interstitial");');
useNativeSqlite = true;
} catch (e) {
const jsonFile = path.join(DATA_DIR, 'links.json');
if (!fs.existsSync(jsonFile)) { fs.writeFileSync(jsonFile, JSON.stringify([])); }
}
function dbGetLink(code) {
if (useNativeSqlite) {
const stmt = db.prepare('SELECT * FROM links WHERE code = ?');
return stmt.get(code);
} else {
const jsonFile = path.join(DATA_DIR, 'links.json');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
return data.find(item => item.code === code);
}
}
function dbGetAllLinks() {
if (useNativeSqlite) {
const stmt = db.prepare('SELECT * FROM links ORDER BY created_at DESC');
return stmt.all();
} else {
const jsonFile = path.join(DATA_DIR, 'links.json');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
return data.sort((a, b) => b.created_at - a.created_at);
}
}
function dbCreateLink(link) {
if (useNativeSqlite) {
const stmt = db.prepare('INSERT INTO links (code, target_url, note, expires_at, created_at, click_count, redirect_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
stmt.run(link.code, link.target_url, link.note, link.expires_at, link.created_at, link.click_count, link.redirect_type);
return link;
} else {
const jsonFile = path.join(DATA_DIR, 'links.json');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
data.push(link);
fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
return link;
}
}
function dbDeleteLink(code) {
if (useNativeSqlite) {
const stmt = db.prepare('DELETE FROM links WHERE code = ?');
stmt.run(code);
} else {
const jsonFile = path.join(DATA_DIR, 'links.json');
let data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
data = data.filter(item => item.code !== code);
fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
}
}
function dbIncrementClick(code) {
if (useNativeSqlite) {
const stmt = db.prepare('UPDATE links SET click_count = click_count + 1 WHERE code = ?');
stmt.run(code);
} else {
const jsonFile = path.join(DATA_DIR, 'links.json');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const item = data.find(i => i.code === code);
if (item) {
item.click_count = (item.click_count || 0) + 1;
fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
}
}
}
function generateRandomCode(length) {
const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
let result = '';
const bytes = crypto.randomBytes(length);
for (let i = 0; i < length; i++) {
result += chars[bytes[i] % chars.length];
}
return result;
}
function generateUniqueCode(length) {
let code = '';
let exists = true;
let attempts = 0;
while (exists && attempts < 50) {
code = generateRandomCode(length);
exists = !!dbGetLink(code);
attempts++;
}
return code;
}
function createAuthToken() {
return crypto.createHmac('sha256', SESSION_SECRET).update(`admin_auth_${ADMIN_PASSCODE}`).digest('hex');
}
function verifyAuth(req, res, next) {
const token = req.cookies?.admin_token || req.headers['x-admin-token'];
const expectedToken = createAuthToken();
if (token && token === expectedToken) {
return next();
}
return res.status(401).json({ error: 'Unauthorized. 6-digit passcode required.' });
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.post('/api/auth/verify', (req, res) => {
const { passcode } = req.body;
if (!passcode || String(passcode).trim() !== String(ADMIN_PASSCODE).trim()) {
return res.status(401).json({ success: false, error: 'Invalid 6-digit passcode' });
}
const token = createAuthToken();
res.cookie('admin_token', token, {
httpOnly: true,
secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
sameSite: 'lax',
maxAge: 30 * 24 * 60 * 60 * 1000
});
return res.json({ success: true, token });
});
app.get('/api/auth/check', (req, res) => {
const token = req.cookies?.admin_token || req.headers['x-admin-token'];
const expectedToken = createAuthToken();
if (token && token === expectedToken) {
return res.json({ authenticated: true });
}
return res.json({ authenticated: false });
});
app.post('/api/auth/logout', (req, res) => {
res.clearCookie('admin_token');
return res.json({ success: true });
});
app.get('/api/links', verifyAuth, (req, res) => {
const rawLinks = dbGetAllLinks();
const now = Date.now();
const links = rawLinks.map(link => {
const isExpired = link.expires_at && now > link.expires_at;
return {
...link,
is_expired: isExpired,
short_url: `${BASE_URL}/${link.code}`
};
});
return res.json({ links, base_url: BASE_URL });
});
app.post('/api/links', verifyAuth, (req, res) => {
let { target_url, custom_code, expires_in, note, redirect_type } = req.body;
if (!target_url || typeof target_url !== 'string') {
return res.status(400).json({ error: 'Target URL is required' });
}
target_url = target_url.trim();
if (!/^https?:\/\//i.test(target_url)) {
target_url = 'https://' + target_url;
}
try {
new URL(target_url);
} catch (e) {
return res.status(400).json({ error: 'Invalid URL format' });
}
let code = '';
let isExpiring = false;
let expires_at = null;
if (expires_in && expires_in !== 'permanent') {
isExpiring = true;
const now = Date.now();
if (expires_in === '1h') expires_at = now + 60 * 60 * 1000;
else if (expires_in === '24h') expires_at = now + 24 * 60 * 60 * 1000;
else if (expires_in === '7d') expires_at = now + 7 * 24 * 60 * 60 * 1000;
else if (expires_in === '30d') expires_at = now + 30 * 24 * 60 * 60 * 1000;
else if (!isNaN(Number(expires_in))) expires_at = Number(expires_in);
else {
const parsedDate = new Date(expires_in).getTime();
if (!isNaN(parsedDate) && parsedDate > now) {
expires_at = parsedDate;
}
}
}
if (custom_code && typeof custom_code === 'string' && custom_code.trim()) {
const cleanCode = custom_code.trim();
if (!/^[a-zA-Z0-9_-]{2,30}$/.test(cleanCode)) {
return res.status(400).json({ error: 'Custom code must be 2-30 alphanumeric characters, dashes or underscores' });
}
const reserved = ['api', 'public', 'static', 'favicon.ico', 'robots.txt', 'index.html', 'redirect.html', 'styles.css', 'app.js'];
if (reserved.includes(cleanCode.toLowerCase())) {
return res.status(400).json({ error: 'This custom code is reserved' });
}
if (dbGetLink(cleanCode)) {
return res.status(400).json({ error: 'This code is already taken' });
}
code = cleanCode;
} else {
const codeLength = isExpiring ? 6 : 5;
code = generateUniqueCode(codeLength);
if (!code) {
return res.status(500).json({ error: 'Failed to generate unique code. Please try a custom code.' });
}
}
const newLink = {
code,
target_url,
note: typeof note === 'string' ? note.trim() : '',
expires_at,
created_at: Date.now(),
click_count: 0,
redirect_type: redirect_type === 'direct' ? 'direct' : 'interstitial'
};
dbCreateLink(newLink);
return res.json({
success: true,
link: {
...newLink,
short_url: `${BASE_URL}/${code}`,
is_expired: false
}
});
});
app.delete('/api/links/:code', verifyAuth, (req, res) => {
const { code } = req.params;
const link = dbGetLink(code);
if (!link) {
return res.status(404).json({ error: 'Link not found' });
}
dbDeleteLink(code);
return res.json({ success: true, message: 'Link deleted' });
});
app.get('/api/check-code/:code', verifyAuth, (req, res) => {
const { code } = req.params;
const link = dbGetLink(code);
return res.json({ available: !link });
});
app.get('/api/resolve/:code', (req, res) => {
const { code } = req.params;
const link = dbGetLink(code);
if (!link) {
return res.status(404).json({ error: 'Link not found' });
}
const now = Date.now();
if (link.expires_at && now > link.expires_at) {
return res.status(410).json({ error: 'Link has expired' });
}
dbIncrementClick(code);
return res.json({
target_url: link.target_url,
note: link.note || '',
redirect_type: link.redirect_type,
countdown: DEFAULT_COUNTDOWN
});
});
app.get('/:code', (req, res) => {
const { code } = req.params;
if (['api', 'styles.css', 'app.js', 'favicon.ico', 'robots.txt'].includes(code)) {
return res.status(404).send('Not Found');
}
const link = dbGetLink(code);
if (!link) {
return res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404 - Link Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.box{border:1px solid rgba(255,255,255,0.08);background:#0a0a0c;padding:40px;border-radius:12px;max-width:440px;width:100%}h1{color:#ff6b4a;font-size:2.5rem;margin-bottom:12px}p{color:#8a8a96;font-size:0.95rem;margin-bottom:24px}a{color:#ff6b4a;text-decoration:none;font-weight:600}</style></head><body><div class="box"><h1>404</h1><p>No shortened link found for <code>/${code}</code></p><a href="/">Go to Home</a></div></body></html>`);
}
const now = Date.now();
if (link.expires_at && now > link.expires_at) {
return res.status(410).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Link Expired - 600266.xyz</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}.box{border:1px solid rgba(255,107,74,0.2);background:#0a0a0c;padding:40px;border-radius:12px;max-width:440px;width:100%}h1{color:#ff6b4a;font-size:1.8rem;margin-bottom:12px}p{color:#8a8a96;font-size:0.95rem;margin-bottom:24px}a{color:#ff6b4a;text-decoration:none;font-weight:600}</style></head><body><div class="box"><h1>Link Expired</h1><p>This temporary link (<code>/${code}</code>) has reached its expiration limit.</p><a href="/">Go to Home</a></div></body></html>`);
}
dbIncrementClick(code);
if (link.redirect_type === 'direct') {
return res.redirect(302, link.target_url);
}
let redirectHtml = fs.readFileSync(path.join(__dirname, 'public', 'redirect.html'), 'utf8');
const safeTarget = link.target_url.replace(/"/g, '&quot;');
const safeNote = (link.note || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let domain = '';
try { domain = new URL(link.target_url).hostname; } catch(e) { domain = link.target_url; }
redirectHtml = redirectHtml
.replace(/{{TARGET_URL}}/g, safeTarget)
.replace(/{{TARGET_DOMAIN}}/g, domain)
.replace(/{{NOTE}}/g, safeNote)
.replace(/{{COUNTDOWN}}/g, String(DEFAULT_COUNTDOWN));
res.setHeader('Content-Type', 'text/html; charset=utf-8');
return res.send(redirectHtml);
});
app.listen(PORT, () => {
console.log(`URL Redirector server running on port ${PORT}`);
});