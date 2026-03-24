#!/usr/bin/env node
const express = require('express');
const path = require('path');

const app = express();
const PORT = 9001;
const BUILD_DIR = path.join(__dirname, '../cms-build');

// NO CACHE for HTML files
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.path.match(/\.(js|css|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)$/)) {
    // Cache static assets for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

// Serve static files
app.use(express.static(BUILD_DIR));

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 CMS Flutter Web Server running on port ${PORT}`);
  console.log(`📁 Serving from: ${BUILD_DIR}`);
  console.log(`🔥 HTML files: NO CACHE`);
  console.log(`📦 Assets: cached 1 year`);
});
