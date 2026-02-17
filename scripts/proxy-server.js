const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 9000;
const webDir = path.join(__dirname, '../web-build');

// IMPORTANT: Proxies must come BEFORE static file serving!
// Otherwise express.static will intercept all requests

console.log('Registering /uploads proxy...');

// Debug middleware to see if uploads requests reach Express
app.use('/uploads', (req, res, next) => {
  console.log(`!!!!! /UPLOADS REQUEST RECEIVED: ${req.method} ${req.url}`);
  next();
});

// Proxy for uploaded audio files - MUST be before static files
// When Express matches /uploads, it strips it from req.url
// So we need to PREPEND /uploads back when proxying
app.use('/uploads', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: (path, req) => {
    console.log(`[UPLOADS PATH REWRITE] Original: ${path} -> New: /uploads${path}`);
    return `/uploads${path}`;  // ADD /uploads back
  },
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[UPLOADS PROXY] ${req.method} ${req.originalUrl}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[UPLOADS SUCCESS] Status: ${proxyRes.statusCode}, Content-Type: ${proxyRes.headers['content-type']}`);
  },
  onError: (err, req, res) => {
    console.error(`[UPLOADS ERROR]: ${err.message}`);
    res.status(502).json({ error: 'Upload proxy error', message: err.message });
  }
}));

console.log('Registering /api proxy...');

// Test middleware to see if /api requests even reach express
app.use('/api', (req, res, next) => {
  console.log(`!!!!! /API REQUEST RECEIVED: ${req.method} ${req.url}`);
  next();
});

// CRITICAL: API proxy
// When Express matches /api, it strips it from req.url
// So we need to PREPEND /api back when proxying
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: (path, req) => {
    console.log(`[PATH REWRITE] Original: ${path} -> New: /api${path}`);
    return `/api${path}`;  // ADD /api back
  },
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.originalUrl}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY SUCCESS] Status: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR]: ${err.message}`);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}));

console.log('Registering static files...');
app.use(express.static(webDir));

console.log('Registering SPA fallback...');
app.get('*', (req, res) => {
  console.log(`[FALLBACK] ${req.path}`);
  res.sendFile(path.join(webDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Flutter web: http://0.0.0.0:${PORT}/`);
  console.log(`🔌 API proxy: http://0.0.0.0:${PORT}/api/* -> http://localhost:3000/api/*`);
});
