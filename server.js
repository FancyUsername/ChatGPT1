const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';

let tokenCache = { token: null, expiresAt: 0 };

function respondJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath || 'index.html');

  if (!filePath.startsWith(PUBLIC_DIR)) {
    respondJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      respondJson(res, 404, { error: 'Not found' });
      return;
    }

    const resolvedPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(resolvedPath, (readErr, content) => {
      if (readErr) {
        respondJson(res, 500, { error: 'Failed to load file' });
        return;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const typeMap = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };

      res.writeHead(200, { 'Content-Type': typeMap[ext] || 'text/plain' });
      res.end(content);
    });
  });
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60 * 1000) {
    return tokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Bitte SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET in der .env setzen.');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify({ grant_type: 'client_credentials' }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Spotify Token Fehler: ${response.status} ${message}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return tokenCache.token;
}

function buildCodeUrl(uri, background = '000000', barColor = 'white', size = 1080) {
  const cleanUri = encodeURIComponent(uri);
  return `https://scannables.scdn.co/uri/plain/png/${background}/${barColor}/${size}/${cleanUri}`;
}

function mapItem(item, type) {
  const base = {
    id: item.id,
    type,
    name: item.name,
    url: item.external_urls?.spotify,
    uri: item.uri,
  };

  if (type === 'album' || type === 'track') {
    const images = item.album ? item.album.images : item.images;
    base.coverUrl = images?.[0]?.url;
    base.subtitle = type === 'track' ? item.artists.map((a) => a.name).join(', ') : item.artists?.map((a) => a.name).join(', ');
  } else if (type === 'artist') {
    base.coverUrl = item.images?.[0]?.url;
    base.subtitle = 'Artist';
  } else if (type === 'playlist') {
    base.coverUrl = item.images?.[0]?.url;
    base.subtitle = item.owner?.display_name ? `Playlist • ${item.owner.display_name}` : 'Playlist';
  }

  base.codeUrl = base.uri ? buildCodeUrl(base.uri) : null;
  return base;
}

async function handleSearch(req, res, urlObj) {
  const query = urlObj.searchParams.get('q');
  const typeParam = urlObj.searchParams.get('type') || 'album,artist,playlist,track';

  if (!query) {
    respondJson(res, 400, { error: 'Parameter "q" fehlt.' });
    return;
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (error) {
    respondJson(res, 500, { error: error.message });
    return;
  }

  const searchUrl = `${SEARCH_URL}?q=${encodeURIComponent(query)}&type=${encodeURIComponent(typeParam)}&limit=12`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const message = await response.text();
    respondJson(res, response.status, { error: `Spotify Suche fehlgeschlagen: ${message}` });
    return;
  }

  const data = await response.json();
  const results = [];

  if (data.albums?.items) {
    data.albums.items.forEach((item) => results.push(mapItem(item, 'album')));
  }
  if (data.artists?.items) {
    data.artists.items.forEach((item) => results.push(mapItem(item, 'artist')));
  }
  // if (data.playlists?.items) {
  //   data.playlists.items.forEach((item) => results.push(mapItem(item, 'playlist')));
  // }
  if (data.tracks?.items) {
    data.tracks.items.forEach((item) => results.push(mapItem(item, 'track')));
  }

  respondJson(res, 200, {
    query,
    type: typeParam,
    count: results.length,
    results,
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);

  if (urlObj.pathname === '/api/search') {
    handleSearch(req, res, urlObj).catch((error) => {
      respondJson(res, 500, { error: error.message || 'Unbekannter Fehler' });
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
