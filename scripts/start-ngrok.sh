#!/bin/bash
# Start ngrok with config that forwards both flutter web and API

# Kill existing ngrok
pkill ngrok

# Start ngrok with port 9000 (flutter web)
# We'll use a reverse proxy in the serve command to handle API calls
nohup ngrok http 9000 > /tmp/ngrok.log 2>&1 &

sleep 3

# Get the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])")

echo "✅ ngrok tunnel started"
echo "📱 Public URL: $PUBLIC_URL"
echo ""
echo "⚠️  IMPORTANT: You need a reverse proxy to route /api requests to localhost:3000"
echo "   Flutter web (port 9000) and API (port 3000) are separate"
echo ""
echo "🔧 Quick fix: Update Flutter app to use localhost:3000 for development"
echo "   OR set up nginx/caddy to proxy /api/* to localhost:3000"
