const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 9000;
const API_PORT = 3000;

// Completely disable all security headers
app.disable('x-powered-by');

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}`,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} /api${req.url} -> http://localhost:${API_PORT}/api${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy Error]', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  },
}));

// Serve static files from Flutter build
app.use(express.static(path.join(__dirname, '../../dynamic_artist_monetization/build/web'), {
  setHeaders: (res) => {
    // Remove all CSP and security headers
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Security-Policy');
    res.removeHeader('X-WebKit-CSP');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
  }
}));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../dynamic_artist_monetization/build/web/index.html');
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Flutter web server running on http://0.0.0.0:${PORT}`);
});
