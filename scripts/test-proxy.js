const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// ONLY proxy, no static files
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  logLevel: 'debug'
}));

app.listen(9001, () => {
  console.log('Test proxy on port 9001');
});
