const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

const FILE = path.join(__dirname, 'index.html');
const ROBLOX_ID = '3175667757';
const AVATAR_TTL = 10 * 60 * 1000;
const PROFILE_TTL = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const PROFILE_REFRESH_COOLDOWN_MS = 30 * 1000;

let avatarCache = null;
let avatarAt = 0;
let profileCache = null;
let profileAt = 0;
let profileLastRefreshAt = 0;
let avatarRequest = null;
let profileRequest = null;

function setSecurityHeaders(res, nonce) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'nonce-" + nonce + "' https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js https://unpkg.com/lenis@1.3.26/dist/lenis.min.js",
    "style-src 'self' 'nonce-" + nonce + "' https://unpkg.com/lenis@1.3.26/dist/lenis.css https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https://*.rbxcdn.com",
    "connect-src 'self'",
    "upgrade-insecure-requests"
  ].join('; '));
}

function send(req, res, status, body, contentType, extraHeaders) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? '' : String(body));
  res.statusCode = status;
  if (contentType) res.setHeader('Content-Type', contentType);
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (name) {
      res.setHeader(name, extraHeaders[name]);
    });
  }
  res.setHeader('Content-Length', String(payload.length));
  if (req.method === 'HEAD') return res.end();
  return res.end(payload);
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    redirect: 'error'
  });

  if (!res.ok) {
    throw new Error('Upstream request failed with status ' + res.status);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error('Upstream returned an unexpected content type');
  }

  return res.json();
}

async function readLimited(response, maxBytes) {
  const lengthHeader = response.headers.get('content-length');
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && Number.isFinite(length) && length > maxBytes) {
    if (response.body) await response.body.cancel().catch(function () {});
    throw new Error('Avatar image exceeds the size limit');
  }
  if (!response.body) {
    throw new Error('Avatar response had no body');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Avatar image exceeds the size limit');
      }
      chunks.push(Buffer.from(item.value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

function validateAvatarUrl(value) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  const trustedHost = host === 'rbxcdn.com' || host.endsWith('.rbxcdn.com');
  if (parsed.protocol !== 'https:' || !trustedHost ||
      parsed.username || parsed.password ||
      (parsed.port && parsed.port !== '443')) {
    throw new Error('Avatar URL failed validation');
  }
  return parsed;
}

async function fetchAvatarImage(value) {
  let target = validateAvatarUrl(value);

  // Validate every redirect target before following it.
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(target.href, {
      headers: { Accept: 'image/png, image/webp, image/jpeg' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: 'manual'
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (response.body) await response.body.cancel().catch(function () {});
      if (!location || redirects === 3) {
        throw new Error('Avatar redirect limit reached');
      }
      target = validateAvatarUrl(new URL(location, target.href).href);
      continue;
    }

    if (!response.ok) throw new Error('Avatar image request failed');
    const contentType = (response.headers.get('content-type') || '')
      .split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(contentType)) {
      if (response.body) await response.body.cancel().catch(function () {});
      throw new Error('Avatar response was not a supported image');
    }

    const buffer = await readLimited(response, MAX_AVATAR_BYTES);
    return { buffer: buffer, contentType: contentType };
  }

  throw new Error('Avatar redirect limit reached');
}

async function getAvatar() {
  if (avatarCache && Date.now() - avatarAt < AVATAR_TTL) {
    return avatarCache;
  }
  if (avatarRequest) return avatarRequest;

  avatarRequest = (async function () {
    const meta = await getJson(
      'https://thumbnails.roblox.com/v1/users/avatar?userIds=' +
      ROBLOX_ID +
      '&size=420x420&format=Png&isCircular=false'
    );

    const imageUrl = meta && meta.data && meta.data[0] && meta.data[0].imageUrl;
    if (!imageUrl) throw new Error('No avatar URL was returned');

    const avatar = await fetchAvatarImage(imageUrl);
    avatarCache = avatar;
    avatarAt = Date.now();
    return avatar;
  })();

  try {
    return await avatarRequest;
  } finally {
    avatarRequest = null;
  }
}

async function getProfile(forceRefresh) {
  if (profileCache && Date.now() - profileAt < PROFILE_TTL && !forceRefresh) {
    return profileCache;
  }
  if (forceRefresh && profileCache && Date.now() - profileLastRefreshAt < PROFILE_REFRESH_COOLDOWN_MS) {
    return profileCache;
  }
  if (profileRequest) return profileRequest;
  if (forceRefresh) profileLastRefreshAt = Date.now();

  profileRequest = (async function () {
    const results = await Promise.allSettled([
      getJson('https://users.roblox.com/v1/users/' + ROBLOX_ID),
      getJson('https://friends.roblox.com/v1/users/' + ROBLOX_ID + '/friends/count'),
      getJson('https://friends.roblox.com/v1/users/' + ROBLOX_ID + '/followers/count')
    ]);

    const user = results[0];
    const friends = results[1];
    const followers = results[2];
    const data = {
      displayName: user.status === 'fulfilled' ? user.value.displayName : null,
      username: user.status === 'fulfilled' ? user.value.name : null,
      description: user.status === 'fulfilled' ? user.value.description : null,
      friends: friends.status === 'fulfilled' ? friends.value.count : null,
      followers: followers.status === 'fulfilled' ? followers.value.count : null
    };

    if (data.username) {
      profileCache = data;
      profileAt = Date.now();
    }
    return data;
  })();

  try {
    return await profileRequest;
  } finally {
    profileRequest = null;
  }
}

const server = http.createServer(async function (req, res) {
  const nonce = randomBytes(18).toString('base64');
  setSecurityHeaders(res, nonce);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(req, res, 405, 'Method not allowed', 'text/plain; charset=utf-8', {
      Allow: 'GET, HEAD',
      'Cache-Control': 'no-store'
    });
  }

  let requestUrl;
  let pathname;
  try {
    requestUrl = new URL(req.url || '/', 'http://localhost');
    pathname = requestUrl.pathname;
  } catch (_) {
    return send(req, res, 400, 'Bad request', 'text/plain; charset=utf-8', {
      'Cache-Control': 'no-store'
    });
  }

  if (pathname === '/.well-known/discord') {
    return send(req, res, 200, 'dh=4e87b56ab4882300b0762ef8c56edc5818f69f2d',
      'text/plain; charset=utf-8', { 'Cache-Control': 'public, max-age=3600' });
  }

  if (pathname === '/favicon.svg') {
    const faviconFile = path.join(__dirname, 'favicon.svg');
    return fs.readFile(faviconFile, function (err, data) {
      if (err) {
        console.error('Favicon read failed:', err.code || 'I/O error');
        return send(req, res, 404, 'Favicon not found', 'text/plain; charset=utf-8', {
          'Cache-Control': 'no-store'
        });
      }
      return send(req, res, 200, data, 'image/svg+xml; charset=utf-8', {
        'Cache-Control': 'public, max-age=3600'
      });
    });
  }

  if (pathname === '/avatar.png') {
    try {
      const avatar = await getAvatar();
      return send(req, res, 200, avatar.buffer, avatar.contentType, {
        'Cache-Control': 'public, max-age=600'
      });
    } catch (err) {
      console.error('Avatar fetch failed:', err && err.name ? err.name : 'Error');
      return send(req, res, 502, 'Avatar unavailable', 'text/plain; charset=utf-8', {
        'Cache-Control': 'no-store',
        'Retry-After': '30'
      });
    }
  }

  if (pathname === '/api/roblox') {
    try {
      const forceRefresh = requestUrl.searchParams.get('refresh') === '1';
      const data = await getProfile(forceRefresh);
      return send(req, res, 200, JSON.stringify(data), 'application/json; charset=utf-8', {
        'Cache-Control': forceRefresh ? 'no-store' : 'public, max-age=300'
      });
    } catch (err) {
      console.error('Roblox profile request failed:', err && err.name ? err.name : 'Error');
      return send(req, res, 503, JSON.stringify({}), 'application/json; charset=utf-8', {
        'Cache-Control': 'no-store',
        'Retry-After': '30'
      });
    }
  }

  if (pathname !== '/' && pathname !== '/index.html') {
    return send(req, res, 404, 'Not found', 'text/plain; charset=utf-8', {
      'Cache-Control': 'no-store'
    });
  }

  fs.readFile(FILE, 'utf8', function (err, html) {
    if (err) {
      console.error('Homepage read failed:', err.code || 'I/O error');
      return send(req, res, 500, 'Server error', 'text/plain; charset=utf-8', {
        'Cache-Control': 'no-store'
      });
    }

    const securedHtml = html.replace(/<(script|style)\b(?![^>]*\bnonce\s*=)/gi,
      '<$1 nonce="' + nonce + '"');

    return send(req, res, 200, securedHtml, 'text/html; charset=utf-8', {
      'Cache-Control': 'no-store'
    });
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('Portfolio running on configured port.');
});
