import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_DIR = 'C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/apps/web/dist';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  let reqPath = req.url ? req.url.split('?')[0] : '/';
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(DIST_DIR, reqPath);

  // If path doesn't exist or is a client-side route, fallback to index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const rawContent = fs.readFileSync(filePath);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Cache assets aggressively, but revalidate HTML
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    if (acceptEncoding.includes('gzip') && rawContent.length > 1024) {
      const gzipped = zlib.gzipSync(rawContent);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Content-Length': gzipped.length,
      });
      res.end(gzipped);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': rawContent.length,
      });
      res.end(rawContent);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Production chunked static server active on http://0.0.0.0:8080');
});
