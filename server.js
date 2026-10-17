const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'index.html');
const ROBLOX_ID = '3175667757';

// Cache the Roblox avatar image in memory for an hour so we don't call Roblox on every visit.
let avatarCache = null;
let avatarCachedAt = 0;
const ONE_HOUR = 60 * 60 * 1000;

async function getAvatar() {
  if (avatarCache && Date.now() - avatarCachedAt < ONE_HOUR) return avatarCache;
  const api = 'https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' +
    ROBLOX_ID + '&size=420x420&format=Png&isCircular=false';
  const meta = await (await fetch(api)).json();
  const url = meta && meta.data && meta.data[0] && meta.data[0].imageUrl;
  if (!url) throw new Error('No avatar url');
  const img = await fetch(url);
  if (!img.ok) throw new Error('Avatar fetch failed');
  avatarCache = Buffer.from(await img.arrayBuffer());
  avatarCachedAt = Date.now();
  return avatarCache;
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/avatar.png') {
    try {
      const buf = await getAvatar();
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.end(buf);
    } catch (e) {
      // The page hides the image and shows an emoji instead if this fails.
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No avatar');
    }
    return;
  }

  fs.readFile(FILE, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Portfolio running on port ' + PORT);
});
