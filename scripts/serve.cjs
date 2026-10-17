// A small local preview server with the same byte-range support used by static hosting.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.mp4': 'video/mp4', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json' };

function createServer(root = path.resolve(__dirname, '..')) {
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404).end(); return; }
      // Validators allow native media's partial responses to be reused from cache.
      const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes', 'Cache-Control': 'public,max-age=600',
        'ETag': `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`,
        'Last-Modified': stat.mtime.toUTCString() };
      let start = 0, end = stat.size - 1, status = 200;
      if (request.headers.range) {
        const match = request.headers.range.match(/^bytes=(\d*)-(\d*)$/);
        if (!match || (!match[1] && !match[2])) { response.writeHead(416).end(); return; }
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      if (start > end) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      headers['Content-Length'] = end - start + 1;
      response.writeHead(status, headers);
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = fs.createReadStream(file, { start, end });
      stream.pipe(response);
      response.on('close', () => stream.destroy());
      stream.on('error', () => response.destroy());
    });
  });
}

module.exports = { createServer };
if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/`));
}
