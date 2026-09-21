/**
 * Cloudflare Worker URL Redirector & Shortener
 * Modern Editorial Theme (Black/White high-contrast, warm orange container tint, <= 10% vibrant orange accents)
 * Immutable short links by design.
 */

const ADMIN_DEFAULT_PASSCODE = "600266";
const DEFAULT_CD = 5;

function generateRandomCode(length) {
  const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[array[i] % chars.length];
  }
  return res;
}

async function getAuthToken(passcode, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret || 'url_cf_worker_secret_key_600266'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`admin_auth_${passcode}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const parts = c.trim().split('=');
    if (parts.length >= 2) cookies[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
  });
  return cookies;
}

async function isAuth(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies.admin_token || request.headers.get('x-admin-token');
  const passcode = env.ADMIN_PASSCODE || ADMIN_DEFAULT_PASSCODE;
  const expectedToken = await getAuthToken(passcode, env.SECRET);
  return token === expectedToken;
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers }
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInterstitialHtml(targetUrl, note, countdown, code) {
  const safeTarget = escapeHtml(targetUrl);
  const safeNote = escapeHtml(note || '');
  let domain = targetUrl;
  try {
    domain = new URL(targetUrl).hostname;
  } catch (e) {}

  const cd = Math.max(1, parseInt(countdown, 10) || 5);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting to ${escapeHtml(domain)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #000000;
      --card-bg: #0c0c0e;
      --container-tint: rgba(249, 115, 22, 0.05);
      --container-border: rgba(249, 115, 22, 0.22);
      --text: #ffffff;
      --text-muted: #d4d4d8;
      --border: rgba(255, 255, 255, 0.16);
      --accent: #f97316;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    [data-theme="light"] {
      --bg: #ffffff;
      --card-bg: #fbfbfb;
      --container-tint: rgba(249, 115, 22, 0.04);
      --container-border: rgba(249, 115, 22, 0.25);
      --text: #09090b;
      --text-muted: #3f3f46;
      --border: rgba(0, 0, 0, 0.14);
      --accent: #f97316;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      line-height: 1.5;
    }

    .card {
      width: 100%;
      max-width: 520px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
    }

    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.3px;
    }
    .brand span { color: var(--accent); }

    .theme-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      text-transform: uppercase;
    }
    .theme-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .main-title {
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--text);
    }

    .timer-text {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-bottom: 20px;
    }
    .timer-bold {
      color: var(--accent);
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .dest-container {
      background: var(--container-tint);
      border: 1px solid var(--container-border);
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 18px;
    }

    .dest-label {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 6px;
    }

    .dest-link {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .note-container {
      background: var(--container-tint);
      border-left: 3px solid var(--accent);
      border-top: 1px solid var(--container-border);
      border-right: 1px solid var(--container-border);
      border-bottom: 1px solid var(--container-border);
      border-radius: 0 8px 8px 0;
      padding: 14px 16px;
      margin-bottom: 20px;
    }

    .note-label {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 4px;
    }

    .note-body {
      font-size: 0.95rem;
      color: var(--text);
      line-height: 1.5;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 24px;
    }

    .progress-fill {
      width: 100%;
      height: 100%;
      background: var(--accent);
      transform-origin: left;
      transition: transform 1s linear;
    }

    .action-row {
      display: flex;
      gap: 10px;
    }

    .btn-proceed {
      flex: 1;
      background: var(--accent);
      color: #000000;
      font-family: var(--font-body);
      font-size: 0.92rem;
      font-weight: 700;
      padding: 12px 18px;
      border-radius: 6px;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-proceed:hover {
      opacity: 0.92;
    }

    .btn-pause {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.88rem;
      font-weight: 600;
      padding: 12px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-pause:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-nav">
      <div class="brand">600266<span>.</span>xyz</div>
      <button class="theme-btn" id="themeToggleBtn">Theme</button>
    </div>

    <h1 class="main-title">You are being redirected</h1>
    <p class="timer-text">Forwarding in <span class="timer-bold" id="tVal">${cd}s</span></p>

    <div class="dest-container">
      <div class="dest-label">Destination</div>
      <a href="${safeTarget}" class="dest-link">${safeTarget}</a>
    </div>

    ${safeNote ? `
    <div class="note-container">
      <div class="note-label">Message from Author</div>
      <div class="note-body">${safeNote}</div>
    </div>
    ` : ''}

    <div class="progress-bar">
      <div class="progress-fill" id="pFill"></div>
    </div>

    <div class="action-row">
      <a href="${safeTarget}" id="proceedBtn" class="btn-proceed">Proceed Now &rarr;</a>
      <button id="pauseBtn" class="btn-pause">Pause</button>
    </div>
  </div>

  <script>
    const TARGET_URL = ${JSON.stringify(targetUrl)};
    const INITIAL_CD = ${cd};
    let rem = INITIAL_CD;
    let isPaused = false;

    // Determine Theme via System Theme with User Storage Fallback
    const htmlEl = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    const activeTheme = savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light');

    function applyTheme(theme) {
      htmlEl.setAttribute('data-theme', theme);
      themeBtn.textContent = theme === 'dark' ? '☼ Light' : '☾ Dark';
    }

    applyTheme(activeTheme);

    themeBtn.addEventListener('click', () => {
      const current = htmlEl.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      applyTheme(next);
    });

    // Listen to OS system theme changes if user hasn't chosen a preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    const tVal = document.getElementById('tVal');
    const pFill = document.getElementById('pFill');
    const pauseBtn = document.getElementById('pauseBtn');

    pauseBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      if (isPaused) {
        tVal.textContent = 'PAUSED';
      } else {
        tVal.textContent = rem + 's';
      }
    });

    const interval = setInterval(() => {
      if (isPaused) return;
      rem--;
      if (rem <= 0) {
        clearInterval(interval);
        pFill.style.transform = 'scaleX(0)';
        tVal.textContent = '0s';
        window.location.href = TARGET_URL;
      } else {
        tVal.textContent = rem + 's';
        pFill.style.transform = 'scaleX(' + (rem / INITIAL_CD) + ')';
      }
    }, 1000);
  </script>
</body>
</html>`;
}

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>url.600266.xyz // Edge Shortlink Registry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #000000;
      --bg-surface: #0a0a0c;
      --container-bg: rgba(249, 115, 22, 0.045);
      --container-border: rgba(249, 115, 22, 0.18);
      --text: #ffffff;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border: rgba(255, 255, 255, 0.12);
      --border-subtle: rgba(255, 255, 255, 0.06);
      --accent-orange: #f97316;
      --accent-dim: rgba(249, 115, 22, 0.12);
      --status-green: #34d399;
      --status-red: #f87171;
      --font-serif: 'Fraunces', Georgia, serif;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    [data-theme="light"] {
      --bg: #ffffff;
      --bg-surface: #fafafa;
      --container-bg: rgba(249, 115, 22, 0.04);
      --container-border: rgba(249, 115, 22, 0.22);
      --text: #09090b;
      --text-secondary: #52525b;
      --text-muted: #71717a;
      --border: rgba(0, 0, 0, 0.12);
      --border-subtle: rgba(0, 0, 0, 0.06);
      --accent-orange: #f97316;
      --accent-dim: rgba(249, 115, 22, 0.1);
      --status-green: #059669;
      --status-red: #dc2626;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      min-height: 100vh;
      line-height: 1.5;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .container {
      max-width: 1040px;
      margin: 0 auto;
      padding: 36px 24px 80px;
    }

    /* Navigation */
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      margin-bottom: 40px;
    }

    .nav-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .brand-logo {
      font-family: var(--font-serif);
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.5px;
    }

    .brand-logo span { color: var(--accent-orange); }

    .brand-tag {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .count-badge {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      padding: 4px 10px;
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }

    .btn-nav {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 6px 14px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.2s;
    }
    .btn-nav:hover {
      border-color: var(--accent-orange);
      color: var(--accent-orange);
    }

    /* Auth Overlay */
    .auth-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .auth-card {
      width: 100%;
      max-width: 420px;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 44px 36px;
      text-align: center;
    }

    .auth-header {
      font-family: var(--font-serif);
      font-size: 2rem;
      font-weight: 400;
      margin-bottom: 6px;
    }
    .auth-header span { color: var(--accent-orange); }

    .auth-sub {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 30px;
    }

    .pin-group {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .pin-input {
      width: 44px;
      height: 52px;
      background: var(--container-bg);
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 1.4rem;
      font-weight: 600;
      text-align: center;
      outline: none;
      transition: border-color 0.2s;
    }
    .pin-input:focus {
      border-color: var(--accent-orange);
    }

    .auth-err {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--status-red);
      min-height: 20px;
      margin-bottom: 16px;
    }

    .btn-block-orange {
      width: 100%;
      background: var(--accent-orange);
      color: #000000;
      border: none;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-block-orange:hover { opacity: 0.9; }

    /* Sections */
    .section-box {
      border: 1px solid var(--border);
      background: var(--bg-surface);
      padding: 36px 32px;
      margin-bottom: 36px;
    }

    .section-meta {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent-orange);
      margin-bottom: 6px;
    }

    .section-title {
      font-family: var(--font-serif);
      font-size: 1.6rem;
      font-weight: 400;
      letter-spacing: -0.3px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .form-row {
      margin-bottom: 22px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 22px;
    }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
    }

    .input-label {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .input-text, .input-area {
      width: 100%;
      background: var(--container-bg);
      border: 1px solid var(--container-border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.9rem;
      padding: 12px 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .input-text:focus, .input-area:focus {
      border-color: var(--accent-orange);
    }

    .input-area {
      min-height: 80px;
      font-family: var(--font-body);
      font-size: 0.92rem;
      resize: vertical;
    }

    .slug-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .slug-badge {
      position: absolute;
      right: 12px;
      font-family: var(--font-mono);
      font-size: 0.7rem;
      letter-spacing: 1px;
      padding: 2px 8px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .slug-badge.avail { color: var(--status-green); }
    .slug-badge.taken { color: var(--status-red); }

    /* Chips */
    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip-item {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 6px 14px;
      border: 1px solid var(--border);
      background: var(--container-bg);
      color: var(--text-secondary);
      cursor: pointer;
      letter-spacing: 1px;
      transition: all 0.2s;
    }
    .chip-item:hover {
      border-color: var(--text);
      color: var(--text);
    }
    .chip-item.active {
      background: var(--accent-orange);
      color: #000000;
      border-color: var(--accent-orange);
      font-weight: 600;
    }

    /* Switch */
    .toggle-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--container-bg);
      border: 1px solid var(--container-border);
      padding: 14px 18px;
      margin-bottom: 24px;
    }

    .toggle-info {
      font-size: 0.88rem;
    }
    .toggle-sub {
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .switch {
      position: relative;
      width: 44px;
      height: 24px;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      inset: 0;
      background: var(--border);
      cursor: pointer;
      transition: 0.2s;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background: #ffffff;
      transition: 0.2s;
    }
    input:checked + .slider { background: var(--accent-orange); }
    input:checked + .slider:before {
      transform: translateX(20px);
      background: #000000;
    }

    /* Success Result Box */
    .result-box {
      background: var(--container-bg);
      border: 1px solid var(--accent-orange);
      padding: 20px;
      margin-top: 24px;
      display: none;
    }

    .result-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
    }

    .result-url {
      font-family: var(--font-mono);
      font-size: 0.95rem;
      color: var(--text);
      flex: 1;
      word-break: break-all;
    }

    /* Table */
    .table-container {
      overflow-x: auto;
      margin-top: 16px;
    }

    .editorial-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .editorial-table th {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-secondary);
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }

    .editorial-table td {
      padding: 14px;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.88rem;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .link-code {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
    }
    .link-code:hover { color: var(--accent-orange); }

    .link-dest {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      color: var(--text-secondary);
    }

    .pill {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      letter-spacing: 1px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      text-transform: uppercase;
    }
    .pill.perm { color: var(--text-muted); }
    .pill.active { color: var(--accent-orange); border-color: var(--accent-orange); }
    .pill.dead { color: var(--status-red); border-color: var(--status-red); }

    .btn-action-sm {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.72rem;
      padding: 4px 10px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.2s;
    }
    .btn-action-sm:hover {
      border-color: var(--accent-orange);
      color: var(--accent-orange);
    }
    .btn-action-sm.del:hover {
      border-color: var(--status-red);
      color: var(--status-red);
    }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--bg-surface);
      border: 1px solid var(--accent-orange);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      padding: 12px 20px;
      letter-spacing: 1px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 10000;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.2s;
      pointer-events: none;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
  </style>
</head>
<body>
  <!-- Auth Overlay -->
  <div id="authOverlay" class="auth-overlay">
    <div class="auth-card">
      <div style="display:flex; justify-content:flex-end; margin-bottom: 10px;">
        <button class="btn-nav" id="overlayThemeBtn">Theme</button>
      </div>
      <h1 class="auth-header">600266<span>.</span>xyz</h1>
      <div class="auth-sub">// Authentication Required</div>
      <div class="pin-group">
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric" autofocus>
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric">
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric">
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric">
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric">
        <input type="password" maxlength="1" class="pin-input" inputmode="numeric">
      </div>
      <div id="authError" class="auth-err"></div>
      <button id="btnUnlock" class="btn-block-orange">Unlock Console &rarr;</button>
    </div>
  </div>

  <!-- Main App -->
  <div id="appContainer" class="container" style="display:none;">
    <header class="nav">
      <div class="nav-brand">
        <div class="brand-logo">600266<span>.</span>xyz</div>
        <div class="brand-tag">// URL SHORTENER</div>
      </div>
      <div class="nav-actions">
        <span id="linkCountBadge" class="count-badge">0 Links</span>
        <button class="btn-nav" id="themeToggleBtn">Theme</button>
        <button class="btn-nav" id="btnLogout">Lock</button>
      </div>
    </header>

    <main>
      <!-- Section 1: Create Link -->
      <section class="section-box">
        <div class="section-meta">01 / Generation</div>
        <h2 class="section-title">Deploy New Shortlink</h2>

        <form id="createLinkForm">
          <div class="form-row">
            <label class="input-label" for="targetUrl">
              <span>Destination URL *</span>
              <span>Must be valid protocol</span>
            </label>
            <input type="url" id="targetUrl" class="input-text" placeholder="https://target-domain.com/path" required>
          </div>

          <div class="form-grid">
            <div>
              <label class="input-label" for="customSlug">
                <span>Custom Alias</span>
                <span>Optional (2-30 chars)</span>
              </label>
              <div class="slug-wrapper">
                <input type="text" id="customSlug" class="input-text" placeholder="custom-slug" maxlength="30">
                <span id="slugStatus" class="slug-badge" style="display:none;"></span>
              </div>
            </div>

            <div>
              <label class="input-label">
                <span>Lifespan Expiry</span>
                <span>Auto-deletion</span>
              </label>
              <div class="chip-list" id="expiryChips">
                <div class="chip-item active" data-val="permanent">Permanent</div>
                <div class="chip-item" data-val="1h">1 Hour</div>
                <div class="chip-item" data-val="24h">24 Hours</div>
                <div class="chip-item" data-val="7d">7 Days</div>
                <div class="chip-item" data-val="30d">30 Days</div>
                <div class="chip-item" data-val="custom">Custom</div>
              </div>
              <div id="customDateRow" style="display:none; margin-top:10px;">
                <input type="datetime-local" id="customExpiryDate" class="input-text">
              </div>
            </div>
          </div>

          <div class="form-row">
            <label class="input-label" for="creatorNote">
              <span>Attached Dispatch Note</span>
              <span>Presented on interstitial screen</span>
            </label>
            <textarea id="creatorNote" class="input-area" placeholder="Optional author message displayed before destination redirect..."></textarea>
          </div>

          <div class="toggle-bar">
            <div>
              <div class="toggle-info">Interstitial Notice Screen</div>
              <div class="toggle-sub">Shows 3-second animated transfer screen with your note</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="interstitialToggle" checked>
              <span class="slider"></span>
            </label>
          </div>

          <button type="submit" class="btn-block-orange" id="btnSubmit">Deploy Link &rarr;</button>
        </form>

        <div id="resultBox" class="result-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:var(--font-mono); font-size:0.75rem; letter-spacing:1px; text-transform:uppercase; color:var(--accent-orange); font-weight:600;">Link Deployed Successfully</span>
            <span id="resultExpiryInfo" class="pill perm">Permanent</span>
          </div>
          <div class="result-row">
            <span id="resultShortUrl" class="result-url"></span>
            <button id="btnCopyResult" class="btn-action-sm">Copy Link</button>
            <a id="btnTestResult" href="#" target="_blank" class="btn-action-sm" style="text-decoration:none;">Open ↗</a>
          </div>
        </div>
      </section>

      <!-- Section 2: Directory -->
      <section class="section-box">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:16px;">
          <div>
            <div class="section-meta">02 / Directory</div>
            <h2 class="section-title" style="margin-bottom:0; padding-bottom:0; border:none;">Shortlink Registry</h2>
          </div>
          <input type="text" id="searchLinks" class="input-text" placeholder="Filter registry..." style="max-width:200px; padding:6px 10px; font-size:0.8rem;">
        </div>

        <div class="table-container">
          <table class="editorial-table">
            <thead>
              <tr>
                <th>Alias</th>
                <th>Destination</th>
                <th>Note</th>
                <th>Mode</th>
                <th>Hits</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="linksTableBody">
              <tr>
                <td colspan="7" style="text-align:center; padding:32px;">Loading registry data...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <div id="toast" class="toast"><span id="toastMsg">Copied</span></div>

  <script>
    let linksData = [];
    let activeExpiry = 'permanent';
    let checkTimeout = null;

    // Theme Management
    const htmlEl = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const overlayThemeBtn = document.getElementById('overlayThemeBtn');

    function applyTheme(theme) {
      htmlEl.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      const label = theme === 'dark' ? '☼ Light' : '☾ Dark';
      if (themeToggleBtn) themeToggleBtn.textContent = label;
      if (overlayThemeBtn) overlayThemeBtn.textContent = label;
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    function toggleTheme() {
      const current = htmlEl.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (overlayThemeBtn) overlayThemeBtn.addEventListener('click', toggleTheme);

    // Toast
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    function showToast(msg) {
      toastMsg.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // Pin Inputs
    const pinInputs = document.querySelectorAll('.pin-input');
    const authOverlay = document.getElementById('authOverlay');
    const appContainer = document.getElementById('appContainer');
    const authError = document.getElementById('authError');
    const btnUnlock = document.getElementById('btnUnlock');
    const btnLogout = document.getElementById('btnLogout');

    pinInputs.forEach((box, idx) => {
      box.addEventListener('input', e => {
        if (e.target.value.length === 1) {
          if (idx < pinInputs.length - 1) pinInputs[idx + 1].focus();
          else submitPin();
        }
      });
      box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          pinInputs[idx - 1].focus();
        }
      });
      box.addEventListener('paste', e => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\\d{6}$/.test(pasted)) {
          pasted.split('').forEach((char, i) => {
            if (pinInputs[i]) pinInputs[i].value = char;
          });
          submitPin();
        }
      });
    });

    async function submitPin() {
      const pin = Array.from(pinInputs).map(b => b.value).join('');
      if (pin.length !== 6) {
        authError.textContent = 'Enter complete 6-digit passcode';
        return;
      }
      authError.textContent = '';
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: pin })
        });
        const data = await res.json();
        if (data.success) {
          authOverlay.style.display = 'none';
          appContainer.style.display = 'block';
          fetchLinks();
        } else {
          authError.textContent = data.error || 'Invalid passcode';
          pinInputs.forEach(b => b.value = '');
          pinInputs[0].focus();
        }
      } catch (err) {
        authError.textContent = 'Connection error';
      }
    }

    btnUnlock.addEventListener('click', submitPin);

    btnLogout.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      appContainer.style.display = 'none';
      authOverlay.style.display = 'flex';
      pinInputs.forEach(b => b.value = '');
      pinInputs[0].focus();
    });

    async function checkInitialAuth() {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (data.authenticated) {
          authOverlay.style.display = 'none';
          appContainer.style.display = 'block';
          fetchLinks();
        } else {
          authOverlay.style.display = 'flex';
          appContainer.style.display = 'none';
          pinInputs[0].focus();
        }
      } catch (e) {
        authOverlay.style.display = 'flex';
        appContainer.style.display = 'none';
      }
    }

    // Expiry Chips
    const expiryChips = document.getElementById('expiryChips');
    const customDateRow = document.getElementById('customDateRow');
    const customExpiryDate = document.getElementById('customExpiryDate');

    expiryChips.querySelectorAll('.chip-item').forEach(chip => {
      chip.addEventListener('click', () => {
        expiryChips.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeExpiry = chip.dataset.val;
        if (activeExpiry === 'custom') {
          customDateRow.style.display = 'block';
        } else {
          customDateRow.style.display = 'none';
        }
      });
    });

    // Custom Slug Debounce Check
    const customSlugInput = document.getElementById('customSlug');
    const slugStatus = document.getElementById('slugStatus');

    customSlugInput.addEventListener('input', () => {
      clearTimeout(checkTimeout);
      const val = customSlugInput.value.trim();
      if (!val) {
        slugStatus.style.display = 'none';
        return;
      }
      if (!/^[a-zA-Z0-9_-]{2,30}$/.test(val)) {
        slugStatus.textContent = 'Invalid';
        slugStatus.className = 'slug-badge taken';
        slugStatus.style.display = 'inline-block';
        return;
      }
      checkTimeout = setTimeout(async () => {
        try {
          const res = await fetch('/api/check-code/' + encodeURIComponent(val));
          const data = await res.json();
          if (data.available) {
            slugStatus.textContent = 'Available';
            slugStatus.className = 'slug-badge avail';
          } else {
            slugStatus.textContent = 'Taken';
            slugStatus.className = 'slug-badge taken';
          }
          slugStatus.style.display = 'inline-block';
        } catch (e) {}
      }, 300);
    });

    // Create Link Form
    const createLinkForm = document.getElementById('createLinkForm');
    const targetUrlInput = document.getElementById('targetUrl');
    const creatorNote = document.getElementById('creatorNote');
    const interstitialToggle = document.getElementById('interstitialToggle');
    const resultBox = document.getElementById('resultBox');
    const resultShortUrl = document.getElementById('resultShortUrl');
    const resultExpiryInfo = document.getElementById('resultExpiryInfo');
    const btnCopyResult = document.getElementById('btnCopyResult');
    const btnTestResult = document.getElementById('btnTestResult');

    createLinkForm.addEventListener('submit', async e => {
      e.preventDefault();
      let target_url = targetUrlInput.value.trim();
      if (!/^https?:\\/\\//i.test(target_url)) {
        target_url = 'https://' + target_url;
      }
      const custom_code = customSlugInput.value.trim();
      const note = creatorNote.value.trim();
      const redirect_type = interstitialToggle.checked ? 'interstitial' : 'direct';

      let expires_in = activeExpiry;
      if (activeExpiry === 'custom') {
        const customVal = customExpiryDate.value;
        if (!customVal) {
          showToast('Select custom expiry date');
          return;
        }
        expires_in = new Date(customVal).getTime();
      }

      const payload = { target_url, custom_code, expires_in, note, redirect_type };
      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          resultShortUrl.textContent = data.link.short_url;
          resultExpiryInfo.textContent = data.link.expires_at ? ('Expires: ' + new Date(data.link.expires_at).toLocaleString()) : 'Permanent';
          resultBox.style.display = 'block';
          btnTestResult.href = data.link.short_url;
          showToast('Shortlink deployed!');
          customSlugInput.value = '';
          slugStatus.style.display = 'none';
          creatorNote.value = '';
          fetchLinks();
        } else {
          showToast(data.error || 'Deployment failed');
        }
      } catch (err) {
        showToast('Network error');
      }
    });

    btnCopyResult.addEventListener('click', () => {
      if (resultShortUrl.textContent) {
        navigator.clipboard.writeText(resultShortUrl.textContent);
        showToast('Link copied!');
      }
    });

    // Links Registry & Directory
    const linksTableBody = document.getElementById('linksTableBody');
    const linkCountBadge = document.getElementById('linkCountBadge');
    const searchLinks = document.getElementById('searchLinks');

    async function fetchLinks() {
      try {
        const res = await fetch('/api/links');
        if (res.status === 401) {
          appContainer.style.display = 'none';
          authOverlay.style.display = 'flex';
          return;
        }
        const data = await res.json();
        linksData = data.links || [];
        linkCountBadge.textContent = linksData.length + ' Link' + (linksData.length === 1 ? '' : 's');
        renderLinks(linksData);
      } catch (e) {}
    }

    function renderLinks(list) {
      if (!list || list.length === 0) {
        linksTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-secondary);">No shortlinks created yet.</td></tr>';
        return;
      }
      const now = Date.now();
      linksTableBody.innerHTML = list.map(link => {
        let expiryBadge = '<span class="pill perm">Permanent</span>';
        if (link.expires_at) {
          if (now > link.expires_at) {
            expiryBadge = '<span class="pill dead">Expired</span>';
          } else {
            const diffMin = Math.round((link.expires_at - now) / (60 * 1000));
            if (diffMin < 60) {
              expiryBadge = '<span class="pill active">' + diffMin + 'm left</span>';
            } else if (diffMin < 1440) {
              expiryBadge = '<span class="pill active">' + Math.round(diffMin / 60) + 'h left</span>';
            } else {
              expiryBadge = '<span class="pill active">' + Math.round(diffMin / 1440) + 'd left</span>';
            }
          }
        }

        const modeBadge = link.redirect_type === 'direct'
          ? '<span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--status-green);">Direct</span>'
          : '<span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-orange);">Interstitial</span>';

        const safeNote = link.note
          ? '<span title="' + escapeHtml(link.note) + '">' + escapeHtml(link.note) + '</span>'
          : '<span style="color:var(--text-muted);">-</span>';

        return '<tr>' +
          '<td><a href="/' + link.code + '" target="_blank" class="link-code">/' + link.code + '</a></td>' +
          '<td><span class="link-dest" title="' + escapeHtml(link.target_url) + '">' + escapeHtml(link.target_url) + '</span></td>' +
          '<td>' + safeNote + '</td>' +
          '<td>' + modeBadge + '</td>' +
          '<td><span style="font-family:var(--font-mono); font-weight:600; color:var(--text);">' + (link.click_count || 0) + '</span></td>' +
          '<td>' + expiryBadge + '</td>' +
          '<td>' +
            '<button class="btn-action-sm" onclick="copyLink(\\'' + escapeHtml(link.short_url) + '\\')">Copy</button> ' +
            '<button class="btn-action-sm del" onclick="deleteLink(\\'' + link.code + '\\')">Del</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    window.copyLink = function(url) {
      navigator.clipboard.writeText(url);
      showToast('Copied: ' + url);
    };

    window.deleteLink = async function(code) {
      if (!confirm('Are you sure you want to permanently delete shortlink /' + code + '?')) return;
      try {
        const res = await fetch('/api/links/' + encodeURIComponent(code), { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('Link deleted');
          fetchLinks();
        } else {
          showToast(data.error || 'Delete failed');
        }
      } catch (e) {
        showToast('Connection error');
      }
    };

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    searchLinks.addEventListener('input', () => {
      const q = searchLinks.value.toLowerCase().trim();
      if (!q) {
        renderLinks(linksData);
        return;
      }
      renderLinks(linksData.filter(i =>
        i.code.toLowerCase().includes(q) ||
        i.target_url.toLowerCase().includes(q) ||
        (i.note && i.note.toLowerCase().includes(q))
      ));
    });

    checkInitialAuth();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathName = url.pathname;
    const passcode = env.ADMIN_PASSCODE || ADMIN_DEFAULT_PASSCODE;
    const baseUrl = env.BASE_URL || `${url.protocol}//${url.host}`;
    const countdown = parseInt(env.DEFAULT_COUNTDOWN || String(DEFAULT_CD), 10);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,x-admin-token'
        }
      });
    }

    // Dashboard Home
    if (pathName === '/') {
      return htmlResponse(getDashboardHtml());
    }

    // Auth Verify & Login
    if ((pathName === '/api/auth/verify' || pathName === '/api/auth/login') && request.method === 'POST') {
      try {
        const body = await request.json();
        const inputPass = body.passcode || body.pin || body.password;
        if (!inputPass || String(inputPass).trim() !== String(passcode).trim()) {
          return jsonResponse({ success: false, error: 'Invalid 6-digit passcode' }, 401);
        }
        const token = await getAuthToken(passcode, env.SECRET);
        return jsonResponse({ success: true, token }, 200, {
          'Set-Cookie': `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
        });
      } catch (e) {
        return jsonResponse({ error: 'Bad Request' }, 400);
      }
    }

    // Auth Check
    if (pathName === '/api/auth/check') {
      const authed = await isAuth(request, env);
      return jsonResponse({ authenticated: authed });
    }

    // Auth Logout
    if (pathName === '/api/auth/logout' && request.method === 'POST') {
      return jsonResponse({ success: true }, 200, {
        'Set-Cookie': 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      });
    }

    // Slug Availability Check
    if (pathName.startsWith('/api/check-code/')) {
      const authed = await isAuth(request, env);
      if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
      const code = decodeURIComponent(pathName.replace('/api/check-code/', ''));
      const existing = await env.URL_KV.get(`link:${code}`);
      return jsonResponse({ available: !existing });
    }

    // Links Management
    if (pathName === '/api/links') {
      const authed = await isAuth(request, env);
      if (!authed) return jsonResponse({ error: 'Unauthorized. 6-digit passcode required.' }, 401);

      if (request.method === 'GET') {
        const listRes = await env.URL_KV.list({ prefix: 'link:' });
        const keys = listRes.keys || [];
        const links = [];
        const now = Date.now();

        for (const k of keys) {
          const raw = await env.URL_KV.get(k.name);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const isExpired = parsed.expires_at && now > parsed.expires_at;
              links.push({
                ...parsed,
                slug: parsed.code || parsed.slug,
                clicks: parsed.click_count || parsed.clicks || 0,
                click_count: parsed.click_count || parsed.clicks || 0,
                is_expired: isExpired,
                short_url: `${baseUrl}/${parsed.code || parsed.slug}`
              });
            } catch (e) {}
          }
        }

        links.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return jsonResponse({ links, base_url: baseUrl });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json();
          let target_url = body.target_url;
          if (!target_url || typeof target_url !== 'string') {
            return jsonResponse({ error: 'Target URL is required' }, 400);
          }
          target_url = target_url.trim();
          if (/^(javascript|data|file|vbscript):/i.test(target_url)) {
            return jsonResponse({ error: 'Unsafe URL scheme' }, 400);
          }
          if (!/^https?:\/\//i.test(target_url)) {
            target_url = 'https://' + target_url;
          }
          try {
            new URL(target_url);
          } catch (e) {
            return jsonResponse({ error: 'Invalid URL format' }, 400);
          }

          let code = '';
          let isExpiring = false;
          let expires_at = null;
          let kvTtl = undefined;

          const expires_in = body.expires_in;
          if (expires_in && expires_in !== 'permanent') {
            isExpiring = true;
            const now = Date.now();
            let expMs = null;
            if (expires_in === '1h') expMs = now + 3600 * 1000;
            else if (expires_in === '24h') expMs = now + 86400 * 1000;
            else if (expires_in === '7d') expMs = now + 7 * 86400 * 1000;
            else if (expires_in === '30d') expMs = now + 30 * 86400 * 1000;
            else if (!isNaN(Number(expires_in))) expMs = Number(expires_in);
            else {
              const parsedDate = new Date(expires_in).getTime();
              if (!isNaN(parsedDate) && parsedDate > now) expMs = parsedDate;
            }

            if (expMs) {
              expires_at = expMs;
              const diffSec = Math.floor((expMs - now) / 1000);
              if (diffSec >= 60) kvTtl = diffSec;
            }
          }

          if (body.expires_at !== undefined) {
            if (body.expires_at === null) {
              isExpiring = false;
              expires_at = null;
            } else if (!isNaN(Number(body.expires_at))) {
              isExpiring = true;
              expires_at = Number(body.expires_at);
            }
          }

          const custom_code = body.custom_code || body.custom_slug;
          if (custom_code && typeof custom_code === 'string' && custom_code.trim()) {
            const clean = custom_code.trim();
            if (!/^[a-zA-Z0-9_-]{2,30}$/.test(clean)) {
              return jsonResponse({ error: 'Custom code must be 2-30 alphanumeric characters' }, 400);
            }
            const reserved = ['api', 'public', 'favicon.ico', 'robots.txt', 'static', 'admin'];
            if (reserved.includes(clean.toLowerCase())) {
              return jsonResponse({ error: 'Reserved code' }, 400);
            }
            const existing = await env.URL_KV.get(`link:${clean}`);
            if (existing) {
              return jsonResponse({ error: 'This code is already taken' }, 409);
            }
            code = clean;
          } else {
            const codeLen = isExpiring ? 6 : 5;
            let attempts = 0;
            while (attempts < 20) {
              const candidate = generateRandomCode(codeLen);
              const exists = await env.URL_KV.get(`link:${candidate}`);
              if (!exists) {
                code = candidate;
                break;
              }
              attempts++;
            }
            if (!code) return jsonResponse({ error: 'Failed to generate unique code' }, 500);
          }

          const newLink = {
            code,
            slug: code,
            target_url,
            note: typeof body.note === 'string' ? body.note.trim() : '',
            expires_at,
            created_at: Date.now(),
            click_count: 0,
            redirect_type: (body.redirect_type === 'direct' || body.interstitial === false) ? 'direct' : 'interstitial'
          };

          const kvOptions = kvTtl ? { expirationTtl: kvTtl } : {};
          await env.URL_KV.put(`link:${code}`, JSON.stringify(newLink), kvOptions);

          return jsonResponse({
            success: true,
            slug: code,
            target_url,
            link: {
              ...newLink,
              short_url: `${baseUrl}/${code}`,
              is_expired: false
            }
          });
        } catch (e) {
          return jsonResponse({ error: 'Internal Error: ' + e.message }, 500);
        }
      }
    }

    // Delete Shortlink (Immutable - No PUT / Edit by choice)
    if (pathName.startsWith('/api/links/')) {
      const authed = await isAuth(request, env);
      if (!authed) return jsonResponse({ error: 'Unauthorized' }, 401);
      const code = decodeURIComponent(pathName.replace('/api/links/', ''));
      if (request.method === 'DELETE') {
        await env.URL_KV.delete(`link:${code}`);
        return jsonResponse({ success: true, message: 'Deleted' });
      }
    }

    // Redirection Resolver
    const shortCode = pathName.slice(1);
    if (!shortCode || ['favicon.ico', 'robots.txt', 'api'].includes(shortCode)) {
      return new Response('Not Found', { status: 404 });
    }

    const rawLink = await env.URL_KV.get(`link:${shortCode}`);
    if (!rawLink) {
      return htmlResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>404 // Link Not Found</title>
  <style>
    body { background: #000; color: #fff; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { border: 1px solid rgba(249,115,22,0.3); background: rgba(249,115,22,0.04); padding: 40px; text-align: center; max-width: 440px; }
    h1 { color: #f97316; margin-bottom: 10px; font-size: 2.2rem; }
    p { color: #a1a1aa; font-size: 0.9rem; margin-bottom: 20px; }
    a { color: #f97316; text-decoration: none; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>The short link <code>/${escapeHtml(shortCode)}</code> was not found or has expired.</p>
    <a href="/">&larr; Return Home</a>
  </div>
</body>
</html>`, 404);
    }

    let linkData = {};
    try {
      linkData = JSON.parse(rawLink);
    } catch (e) {
      return new Response('Error parsing link', { status: 500 });
    }

    const now = Date.now();
    if (linkData.expires_at && now > linkData.expires_at) {
      return htmlResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Link Expired // 600266.xyz</title>
  <style>
    body { background: #000; color: #fff; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { border: 1px solid rgba(249,115,22,0.3); background: rgba(249,115,22,0.04); padding: 40px; text-align: center; max-width: 440px; }
    h1 { color: #f97316; margin-bottom: 10px; font-size: 1.8rem; }
    p { color: #a1a1aa; font-size: 0.9rem; margin-bottom: 20px; }
    a { color: #f97316; text-decoration: none; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Link Expired</h1>
    <p>This temporary short link (<code>/${escapeHtml(shortCode)}</code>) has reached its lifespan limit.</p>
    <a href="/">&larr; Return Home</a>
  </div>
</body>
</html>`, 410);
    }

    // Increment click count asynchronously
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil((async () => {
        try {
          linkData.click_count = (linkData.click_count || 0) + 1;
          await env.URL_KV.put(`link:${shortCode}`, JSON.stringify(linkData));
        } catch (err) {}
      })());
    } else {
      linkData.click_count = (linkData.click_count || 0) + 1;
      await env.URL_KV.put(`link:${shortCode}`, JSON.stringify(linkData));
    }

    if (linkData.redirect_type === 'direct') {
      return Response.redirect(linkData.target_url, 302);
    }

    return htmlResponse(getInterstitialHtml(linkData.target_url, linkData.note, countdown, shortCode));
  }
};
