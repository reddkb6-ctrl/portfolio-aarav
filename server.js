const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomBytes, createHash, timingSafeEqual } = require('crypto');

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
const MAX_REVIEW_BODY_BYTES = 8192;
const MAX_STORED_REVIEWS = 1000;
const REVIEW_WINDOW_MS = 10 * 60 * 1000;
const REVIEW_WINDOW_MAX = 3;
const REVIEW_FILE = path.resolve(process.env.REVIEWS_FILE || path.join(__dirname, 'data', 'reviews.json'));
const SITE_CONTENT_FILE = path.resolve(process.env.SITE_CONTENT_FILE || path.join(__dirname, 'data', 'site-content.json'));
const MAX_SITE_CONTENT_BODY_BYTES = 32768;
const MODERATION_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MODERATION_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MODERATION_LOGIN_MAX_FAILURES = 5;
const SITE_CONTENT_SCHEMA = {
  siteTitle: { type: 'text', max: 100, default: 'Aarav | Personal Portfolio' },
  siteDescription: { type: 'text', max: 240, default: "Aarav's personal portfolio — gaming, sports, music and creative projects." },
  heroName: { type: 'text', max: 50, default: 'Aarav.' },
  heroIntro: { type: 'text', max: 400, default: 'I play a lot of games, and I love music and singing. Welcome to my corner of the internet.' },
  aboutText: { type: 'text', max: 700, default: "I'm Aarav. I enjoy gaming, sports and music, and I like bringing creative ideas to life. I'm also interested in teamwork, leadership and helping communities run smoothly." },
  aboutNoteTitle: { type: 'text', max: 100, default: "What I'm into" },
  aboutNoteText: { type: 'text', max: 400, default: 'Gaming, sports, music, creative projects and working with people.' },
  gamesIntro: { type: 'text', max: 300, default: 'A few of the games I enjoy spending time on.' },
  kfcTag: { type: 'text', max: 140, default: 'Built by me · Restaurant roleplay' },
  kfcTitle: { type: 'text', max: 100, default: 'KFC' },
  kfcDescription: { type: 'text', max: 500, default: "A restaurant roleplay game that I built. I own KFC v1–2, which has 7k visits, and I'm developing v3." },
  kfcUrl: { type: 'url', max: 500, default: 'https://discord.gg/v7GWdmR7Jd' },
  headteacherTag: { type: 'text', max: 140, default: 'Worked at · School roleplay' },
  headteacherTitle: { type: 'text', max: 100, default: 'Headteacher' },
  headteacherDescription: { type: 'text', max: 500, default: 'A school roleplay game where I\'m the headteacher. The campus is owned by Kyle, Harley Dyson and Simeon.' },
  headteacherUrl: { type: 'url', max: 500, default: 'https://discord.gg/4M5FFZ6EZ4' },
  avaraTag: { type: 'text', max: 140, default: 'Worked at · Custom airline' },
  avaraTitle: { type: 'text', max: 100, default: 'AVARA' },
  avaraDescription: { type: 'text', max: 500, default: 'I work as Head of Ground Operations at AVARA, a custom airline on Roblox.' },
  avaraUrl: { type: 'url', max: 500, default: 'https://discord.gg/V4qswt2qfe' },
  interestsIntro: { type: 'text', max: 300, default: 'A few things I enjoy and skills I bring to my projects.' },
  gamingTitle: { type: 'text', max: 100, default: 'Gaming' },
  gamingDescription: { type: 'text', max: 300, default: 'I enjoy exploring different games, challenges and experiences.' },
  sportsTitle: { type: 'text', max: 100, default: 'Sports' },
  sportsDescription: { type: 'text', max: 300, default: 'I enjoy following sports, watching matches and getting involved in the game.' },
  musicTitle: { type: 'text', max: 100, default: 'Music' },
  musicDescription: { type: 'text', max: 300, default: 'I enjoy singing and playing piano, and using music as a creative outlet.' },
  leadershipTitle: { type: 'text', max: 100, default: 'HR & Leadership' },
  leadershipDescription: { type: 'text', max: 300, default: 'I enjoy supporting people, helping teams work well together and keeping communities organised.' },
  socialsIntro: { type: 'text', max: 300, default: 'Choose a platform below, or find me directly on Discord.' },
  discordProfileTitle: { type: 'text', max: 100, default: 'Find me on Discord' },
  discordProfileDescription: { type: 'text', max: 300, default: 'Open my profile or copy my user ID if you need it.' },
  discordProfileUrl: { type: 'url', max: 500, default: 'https://discord.com/users/1015328404494635038' },
  socialRobloxUrl: { type: 'url', max: 500, default: 'https://www.roblox.com/users/3175667757/profile' },
  socialDiscordUrl: { type: 'url', max: 500, default: 'https://discord.com/users/1015328404494635038' },
  socialTikTokUrl: { type: 'url', max: 500, default: 'https://www.tiktok.com/@aarav_vibezz' },
  socialYouTubeUrl: { type: 'url', max: 500, default: 'https://www.youtube.com/@officialvibesyt12' },
  socialSnapchatUrl: { type: 'url', max: 500, default: 'https://www.snapchat.com/add/aarav_vibezz' },
  socialSignalUrl: { type: 'url', max: 500, default: 'https://signal.me/#eu/iNqqmPNqYWcdWaxe8cCzZh_jaYwcChGb3A2CMpk3HSxeohQQ4yxERoFcghJn1oCb' }
};
const PROFILE_REFRESH_COOLDOWN_MS = 30 * 1000;

let avatarCache = null;
let avatarAt = 0;
let profileCache = null;
let profileAt = 0;
let profileLastRefreshAt = 0;
let reviewWriteQueue = Promise.resolve();
const reviewRateLimit = new Map();
const moderationSessions = new Map();
const moderationLoginFailures = new Map();
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

function sendJson(req, res, status, value, extraHeaders) {
  const headers = Object.assign({ 'Cache-Control': 'no-store' }, extraHeaders || {});
  return send(req, res, status, JSON.stringify(value), 'application/json; charset=utf-8', headers);
}

async function readJsonBody(req, maxBytes) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    const error = new Error('Content-Type must be application/json.');
    error.statusCode = 415;
    throw error;
  }
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    req.resume();
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }

  let bodyText = '';
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      tooLarge = true;
      continue;
    }
    bodyText += chunk.toString('utf8');
  }
  if (tooLarge) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_) {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

async function readReviews() {
  try {
    const raw = await fs.promises.readFile(REVIEW_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Review storage has an invalid format.');
    return parsed;
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function readSiteContent() {
  try {
    const raw = await fs.promises.readFile(SITE_CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Website content storage has an invalid format.');
    }
    return Object.keys(SITE_CONTENT_SCHEMA).reduce(function (result, key) {
      const value = parsed[key];
      const schema = SITE_CONTENT_SCHEMA[key];
      result[key] = typeof value === 'string' ? value : schema.default;
      return result;
    }, {});
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return Object.keys(SITE_CONTENT_SCHEMA).reduce(function (result, key) {
        result[key] = SITE_CONTENT_SCHEMA[key].default;
        return result;
      }, {});
    }
    throw error;
  }
}

function normaliseSiteContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Website content must be an object.');
    error.statusCode = 400;
    throw error;
  }
  const unknownKeys = Object.keys(input).filter(function (key) {
    return !Object.prototype.hasOwnProperty.call(SITE_CONTENT_SCHEMA, key);
  });
  if (unknownKeys.length) {
    const error = new Error('The update contains unsupported website fields.');
    error.statusCode = 400;
    throw error;
  }

  return Object.keys(SITE_CONTENT_SCHEMA).reduce(function (result, key) {
    const schema = SITE_CONTENT_SCHEMA[key];
    const value = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : schema.default;
    if (typeof value !== 'string') {
      const error = new Error('Every website field must be text.');
      error.statusCode = 400;
      throw error;
    }
    const clean = value.replace(/\r\n?/g, '\n').trim();
    if (clean.length > schema.max) {
      const error = new Error('A website field exceeds its character limit.');
      error.statusCode = 400;
      throw error;
    }
    if (schema.type === 'url' && clean) {
      let url;
      try {
        url = new URL(clean);
      } catch (_) {
        const error = new Error('Website links must be valid HTTPS URLs.');
        error.statusCode = 400;
        throw error;
      }
      if (url.protocol !== 'https:' || url.username || url.password) {
        const error = new Error('Website links must use HTTPS and cannot contain credentials.');
        error.statusCode = 400;
        throw error;
      }
      result[key] = url.href;
    } else {
      result[key] = clean;
    }
    return result;
  }, {});
}

let siteContentWriteQueue = Promise.resolve();
function saveSiteContent(content) {
  const operation = siteContentWriteQueue.then(async function () {
    const directory = path.dirname(SITE_CONTENT_FILE);
    await fs.promises.mkdir(directory, { recursive: true });
    const temporaryPath = SITE_CONTENT_FILE + '.' + randomBytes(8).toString('hex') + '.tmp';
    try {
      await fs.promises.writeFile(temporaryPath, JSON.stringify(content, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
      await fs.promises.rename(temporaryPath, SITE_CONTENT_FILE);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(function () {});
      throw error;
    }
    return content;
  });
  siteContentWriteQueue = operation.catch(function () {});
  return operation;
}

function withReviewWriteLock(operation) {
  const result = reviewWriteQueue.then(operation, operation);
  reviewWriteQueue = result.catch(function () {});
  return result;
}

async function writeReviewsToDisk(reviews) {
  const directory = path.dirname(REVIEW_FILE);
  await fs.promises.mkdir(directory, { recursive: true });
  const temporaryPath = REVIEW_FILE + '.' + randomBytes(8).toString('hex') + '.tmp';
  try {
    await fs.promises.writeFile(temporaryPath, JSON.stringify(reviews, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    await fs.promises.rename(temporaryPath, REVIEW_FILE);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(function () {});
    throw error;
  }
}

function saveReview(review) {
  return withReviewWriteLock(async function () {
    const reviews = await readReviews();
    reviews.unshift(review);
    const retained = reviews.slice(0, MAX_STORED_REVIEWS);
    await writeReviewsToDisk(retained);
    return retained;
  });
}

function mutateStoredReview(id, action) {
  return withReviewWriteLock(async function () {
    const reviews = await readReviews();
    const index = reviews.findIndex(function (review) { return review.id === id; });
    if (index < 0) return null;
    let result;
    if (action === 'delete') {
      result = reviews.splice(index, 1)[0];
    } else {
      reviews[index].hidden = action === 'hide';
      result = reviews[index];
    }
    await writeReviewsToDisk(reviews);
    return result;
  });
}

function hasSameOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !req.headers.host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.host === req.headers.host;
  } catch (_) {
    return false;
  }
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0].trim().toLowerCase();
  return Boolean(req.socket.encrypted) || forwardedProto === 'https';
}

function moderationCookie(token, req, maxAge) {
  const attributes = [
    'portfolio_moderator=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + String(maxAge)
  ];
  if (isSecureRequest(req)) attributes.push('Secure');
  return attributes.join('; ');
}

function getCookie(req, name) {
  const cookieHeader = String(req.headers.cookie || '');
  const prefix = name + '=';
  for (const part of cookieHeader.split(';')) {
    const item = part.trim();
    if (item.indexOf(prefix) === 0) return item.slice(prefix.length);
  }
  return '';
}

function getModerationSession(req) {
  const token = getCookie(req, 'portfolio_moderator');
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expiry = moderationSessions.get(token);
  if (!expiry) return false;
  if (expiry <= Date.now()) {
    moderationSessions.delete(token);
    return false;
  }
  return token;
}

function moderationLoginRetryAfter(key) {
  const now = Date.now();
  const recent = (moderationLoginFailures.get(key) || []).filter(function (time) {
    return now - time < MODERATION_LOGIN_WINDOW_MS;
  });
  moderationLoginFailures.set(key, recent);
  if (recent.length < MODERATION_LOGIN_MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((MODERATION_LOGIN_WINDOW_MS - (now - recent[0])) / 1000));
}

function recordModerationLoginFailure(key) {
  const now = Date.now();
  const recent = (moderationLoginFailures.get(key) || []).filter(function (time) {
    return now - time < MODERATION_LOGIN_WINDOW_MS;
  });
  recent.push(now);
  moderationLoginFailures.set(key, recent);
  if (moderationLoginFailures.size > 2000) {
    moderationLoginFailures.forEach(function (times, client) {
      if (!times.some(function (time) { return now - time < MODERATION_LOGIN_WINDOW_MS; })) {
        moderationLoginFailures.delete(client);
      }
    });
  }
}

function validModerationPassword(candidate) {
  const configured = process.env.REVIEW_ADMIN_PASSWORD || '';
  if (configured.length < 16 || typeof candidate !== 'string') return false;
  const expected = createHash('sha256').update(configured, 'utf8').digest();
  const actual = createHash('sha256').update(candidate, 'utf8').digest();
  return timingSafeEqual(expected, actual);
}

function getReviewClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : (req.socket.remoteAddress || 'unknown');
}

function consumeReviewRateLimit(key) {
  const now = Date.now();
  const recent = (reviewRateLimit.get(key) || []).filter(function (time) {
    return now - time < REVIEW_WINDOW_MS;
  });
  if (recent.length >= REVIEW_WINDOW_MAX) {
    reviewRateLimit.set(key, recent);
    return Math.max(1, Math.ceil((REVIEW_WINDOW_MS - (now - recent[0])) / 1000));
  }
  recent.push(now);
  reviewRateLimit.set(key, recent);
  if (reviewRateLimit.size > 2000) {
    reviewRateLimit.forEach(function (times, client) {
      if (!times.some(function (time) { return now - time < REVIEW_WINDOW_MS; })) {
        reviewRateLimit.delete(client);
      }
    });
  }
  return 0;
}

function cleanReviewName(value) {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code <= 31 || code === 127 ? ' ' : char;
  }
  return result.split(' ').filter(Boolean).join(' ').trim();
}

function cleanReviewComment(value) {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 13) {
      result += String.fromCharCode(10);
    } else if (code === 10 || code === 9 || (code >= 32 && code !== 127)) {
      result += char;
    }
  }
  return result.trim();
}

function normaliseReview(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Please complete the review form.');
    error.statusCode = 400;
    throw error;
  }

  const name = typeof input.name === 'string' ? cleanReviewName(input.name) : '';
  const comment = typeof input.comment === 'string' ? cleanReviewComment(input.comment) : '';
  const rating = Number(input.rating);

  if (!name || name.length > 50) {
    const error = new Error('Enter a name between 1 and 50 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const error = new Error('Choose a rating from 1 to 5.');
    error.statusCode = 400;
    throw error;
  }
  if (comment.length > 600) {
    const error = new Error('Comments must be 600 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  return { name: name, rating: rating, comment: comment };
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

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST' && req.method !== 'DELETE') {
    return send(req, res, 405, 'Method not allowed', 'text/plain; charset=utf-8', {
      Allow: 'GET, HEAD, POST, DELETE',
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

  const moderationReviewPath = pathname.match(/^\/api\/moderation\/reviews\/([a-f0-9]{16})(?:\/(actions))?$/);
  const allowedPostPath = pathname === '/api/reviews' ||
    pathname === '/api/moderation/login' ||
    pathname === '/api/moderation/logout' ||
    Boolean(moderationReviewPath && moderationReviewPath[2] === 'actions');
  const allowedDeletePath = Boolean(moderationReviewPath && !moderationReviewPath[2]);
  if ((req.method === 'POST' && !allowedPostPath) ||
      (req.method === 'DELETE' && !allowedDeletePath)) {
    return send(req, res, 405, 'Method not allowed', 'text/plain; charset=utf-8', {
      Allow: 'GET, HEAD, POST, DELETE',
      'Cache-Control': 'no-store'
    });
  }

  if (pathname === '/api/moderation/session' && (req.method === 'GET' || req.method === 'HEAD')) {
    return sendJson(req, res, 200, { authenticated: Boolean(getModerationSession(req)) });
  }

  if (pathname === '/api/moderation/login' && req.method === 'POST') {
    if (!hasSameOrigin(req)) return sendJson(req, res, 403, { error: 'Sign-in must come from this website.' });
    const configuredPassword = process.env.REVIEW_ADMIN_PASSWORD || '';
    if (configuredPassword.length < 16) {
      return sendJson(req, res, 503, {
        error: 'Site moderation is not configured yet. Set REVIEW_ADMIN_PASSWORD in your hosting environment.'
      });
    }
    const clientKey = getReviewClientKey(req);
    const retryAfter = moderationLoginRetryAfter(clientKey);
    if (retryAfter) {
      return sendJson(req, res, 429, { error: 'Too many sign-in attempts. Please try again later.' }, {
        'Retry-After': String(retryAfter)
      });
    }
    let payload;
    try {
      payload = await readJsonBody(req, 2048);
    } catch (error) {
      return sendJson(req, res, error.statusCode || 400, { error: error.message || 'Invalid request.' });
    }
    if (!validModerationPassword(payload && payload.password)) {
      recordModerationLoginFailure(clientKey);
      return sendJson(req, res, 401, { error: 'That moderator password is not correct.' });
    }
    const token = randomBytes(32).toString('hex');
    const maxAge = Math.floor(MODERATION_SESSION_TTL_MS / 1000);
    moderationSessions.set(token, Date.now() + MODERATION_SESSION_TTL_MS);
    if (moderationSessions.size > 1000) {
      moderationSessions.forEach(function (expiry, sessionToken) {
        if (expiry <= Date.now()) moderationSessions.delete(sessionToken);
      });
    }
    moderationLoginFailures.delete(clientKey);
    return sendJson(req, res, 200, { ok: true, expiresIn: maxAge }, {
      'Set-Cookie': moderationCookie(token, req, maxAge),
      'Cache-Control': 'no-store'
    });
  }

  if (pathname === '/api/moderation/logout' && req.method === 'POST') {
    if (!hasSameOrigin(req)) return sendJson(req, res, 403, { error: 'Sign-out must come from this website.' });
    const token = getModerationSession(req);
    if (token) moderationSessions.delete(token);
    return sendJson(req, res, 200, { ok: true }, {
      'Set-Cookie': moderationCookie('', req, 0),
      'Cache-Control': 'no-store'
    });
  }

  if (pathname === '/api/moderation/reviews' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (!getModerationSession(req)) {
      return sendJson(req, res, 401, { error: 'Sign in to access site moderation.' });
    }
    try {
      return sendJson(req, res, 200, { reviews: await readReviews() });
    } catch (error) {
      console.error('Moderation review list could not be read:', error && error.name ? error.name : 'Error');
      return sendJson(req, res, 500, { error: 'Moderation is temporarily unavailable.' });
    }
  }

  if (moderationReviewPath && moderationReviewPath[2] === 'actions' && req.method === 'POST') {
    if (!hasSameOrigin(req)) return sendJson(req, res, 403, { error: 'Moderation actions must come from this website.' });
    if (!getModerationSession(req)) {
      return sendJson(req, res, 401, { error: 'Your moderation session has expired. Please sign in again.' });
    }
    let payload;
    try {
      payload = await readJsonBody(req, 2048);
    } catch (error) {
      return sendJson(req, res, error.statusCode || 400, { error: error.message || 'Invalid request.' });
    }
    const action = payload && payload.action;
    if (action !== 'hide' && action !== 'restore') {
      return sendJson(req, res, 400, { error: 'Choose hide or restore.' });
    }
    try {
      const review = await mutateStoredReview(moderationReviewPath[1], action);
      if (!review) return sendJson(req, res, 404, { error: 'That review could not be found.' });
      return sendJson(req, res, 200, { ok: true, review: review });
    } catch (error) {
      console.error('Review moderation failed:', error && error.name ? error.name : 'Error');
      return sendJson(req, res, 500, { error: 'That review could not be updated right now.' });
    }
  }

  if (moderationReviewPath && !moderationReviewPath[2] && req.method === 'DELETE') {
    if (!hasSameOrigin(req)) return sendJson(req, res, 403, { error: 'Review deletion must come from this website.' });
    if (!getModerationSession(req)) {
      return sendJson(req, res, 401, { error: 'Your moderation session has expired. Please sign in again.' });
    }
    try {
      const review = await mutateStoredReview(moderationReviewPath[1], 'delete');
      if (!review) return sendJson(req, res, 404, { error: 'That review could not be found.' });
      return sendJson(req, res, 200, { ok: true });
    } catch (error) {
      console.error('Review deletion failed:', error && error.name ? error.name : 'Error');
      return sendJson(req, res, 500, { error: 'That review could not be deleted right now.' });
    }
  }

  if (pathname === '/api/reviews' && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const allReviews = await readReviews();
      const reviews = allReviews.filter(function (review) { return review.hidden !== true; });
      const total = reviews.length;
      const average = total
        ? Math.round((reviews.reduce(function (sum, review) { return sum + Number(review.rating || 0); }, 0) / total) * 10) / 10
        : null;
      return sendJson(req, res, 200, { reviews: reviews, total: total, average: average });
    } catch (error) {
      console.error('Reviews could not be read:', error && error.name ? error.name : 'Error');
      return sendJson(req, res, 500, { error: 'Reviews are temporarily unavailable.' });
    }
  }

  if (pathname === '/api/reviews' && req.method === 'POST') {
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          return sendJson(req, res, 403, { error: 'Cross-origin submissions are not allowed.' });
        }
      } catch (_) {
        return sendJson(req, res, 403, { error: 'Invalid request origin.' });
      }
    }

    let payload;
    try {
      payload = await readJsonBody(req, MAX_REVIEW_BODY_BYTES);
    } catch (error) {
      return sendJson(req, res, error.statusCode || 400, { error: error.message || 'Invalid request.' });
    }

    const retryAfter = consumeReviewRateLimit(getReviewClientKey(req));
    if (retryAfter) {
      return sendJson(req, res, 429, { error: 'Too many reviews submitted from this connection. Please try again later.' }, {
        'Retry-After': String(retryAfter)
      });
    }

    if (payload && typeof payload === 'object' && typeof payload.website === 'string' && payload.website.trim()) {
      return sendJson(req, res, 201, { ok: true, review: null });
    }

    let fields;
    try {
      fields = normaliseReview(payload);
    } catch (error) {
      return sendJson(req, res, error.statusCode || 400, { error: error.message || 'Please check your review.' });
    }

    const review = {
      id: randomBytes(8).toString('hex'),
      name: fields.name,
      rating: fields.rating,
      comment: fields.comment,
      createdAt: new Date().toISOString(),
      hidden: false
    };

    try {
      await saveReview(review);
      return sendJson(req, res, 201, { ok: true, review: review });
    } catch (error) {
      console.error('Review could not be saved:', error && error.name ? error.name : 'Error');
      return sendJson(req, res, 500, { error: 'Your review could not be saved right now. Please try again later.' });
    }
  }

  if (pathname === '/reviews.css' || pathname === '/reviews.js') {
    const asset = pathname === '/reviews.css'
      ? { file: path.join(__dirname, 'reviews.css'), type: 'text/css; charset=utf-8' }
      : { file: path.join(__dirname, 'reviews.js'), type: 'text/javascript; charset=utf-8' };
    return fs.readFile(asset.file, function (err, data) {
      if (err) {
        console.error('Review asset read failed:', err.code || 'I/O error');
        return send(req, res, 404, 'Not found', 'text/plain; charset=utf-8', {
          'Cache-Control': 'no-store'
        });
      }
      return send(req, res, 200, data, asset.type, {
        'Cache-Control': 'public, max-age=300'
      });
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
