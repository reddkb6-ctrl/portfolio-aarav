
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'index.html');
const ROBLOX_ID = '3175667757';

const AVATAR_TTL = 10 * 60 * 1000;
const PROFILE_TTL = 10 * 60 * 1000;

let avatarCache = null;
let avatarAt = 0;
let profileCache = null;
let profileAt = 0;

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    throw new Error('Request failed: ' + res.status);
  }

  return res.json();
}

async function getAvatar() {
  if (avatarCache && Date.now() - avatarAt < AVATAR_TTL) {
    return avatarCache;
  }

  const meta = await getJson(
    'https://thumbnails.roblox.com/v1/users/avatar?userIds=' +
    ROBLOX_ID +
    '&size=420x420&format=Png&isCircular=false'
  );

  const url = meta && meta.data && meta.data[0] &&
    meta.data[0].imageUrl;

  if (!url) throw new Error('No avatar url');

  const img = await fetch(url);

  if (!img.ok) throw new Error('Avatar fetch failed');

  avatarCache = Buffer.from(await img.arrayBuffer());
  avatarAt = Date.now();

  return avatarCache;
}

async function getProfile() {
  if (profileCache && Date.now() - profileAt < PROFILE_TTL) {
    return profileCache;
  }

  const [user, friends, followers] = await Promise.allSettled([
    getJson('https://users.roblox.com/v1/users/' + ROBLOX_ID),
    getJson('https://friends.roblox.com/v1/users/' + ROBLOX_ID + '/friends/count'),
    getJson('https://friends.roblox.com/v1/users/' + ROBLOX_ID + '/followers/count')
  ]);

  const data = {
    displayName: user.status === 'fulfilled'
      ? user.value.displayName : null,
    username: user.status === 'fulfilled'
      ? user.value.name : null,
    description: user.status === 'fulfilled'
      ? user.value.description : null,
    friends: friends.status === 'fulfilled'
      ? friends.value.count : null,
    followers: followers.status === 'fulfilled'
      ? followers.value.count : null
  };

  if (data.username) {
    profileCache = data;
    profileAt = Date.now();
  }

  return data;
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  // Discord domain verification
  if (url === '/.well-known/discord') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('dh=4e87b56ab4882300b0762ef8c56edc5818f69f2d');
    return;
  }

  // Favicon route — keep this before the generic HTML handler
  if (url === '/favicon.svg') {
    const faviconFile = path.join(__dirname, 'favicon.svg');

    console.log('Favicon path:', faviconFile);
    console.log('Favicon exists:', fs.existsSync(faviconFile));

    return fs.readFile(faviconFile, (err, data) => {
      if (err) {
        console.error('Favicon error:', err.code, err.message);

        res.writeHead(404, {
          'Content-Type': 'text/plain; charset=utf-8'
        });

        res.end('Favicon not found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      });

      res.end(data);
    });
  }

  // Roblox avatar route
  if (url === '/avatar.png') {
    try {
      const buf = await getAvatar();

      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=600'
      });

      res.end(buf);
    } catch (e) {
      console.error('Avatar error:', e.message);

      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      });

      res.end('No avatar');
    }

    return;
  }

  // Roblox profile API
  if (url === '/api/roblox') {
    try {
      const data = await getProfile();

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      });

      res.end(JSON.stringify(data));
    } catch (e) {
      console.error('Roblox API error:', e.message);

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({}));
    }

    return;
  }

  // Serve the existing portfolio page
  fs.readFile(FILE, (err, data) => {
    if (err) {
      console.error('HTML error:', err.message);

      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8'
      });

      res.end('Server error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });

    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Portfolio running on port ' + PORT);
});
