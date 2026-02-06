const express = require('express');
const path = require('path');

const app = express();
const PORT = 9000;

// Completely disable all security headers
app.disable('x-powered-by');

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
