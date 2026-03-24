#!/bin/bash

# Start HTTP server for CMS Flutter web build on port 9001
cd "$(dirname "$0")/.."

echo "🚀 Starting CMS Flutter Web Server on port 9001..."
echo "📁 Serving from: $(pwd)/cms-build"
echo "🔥 Cache Control: HTML=no-cache, Assets=1year"

# Use custom Node.js server with proper cache headers
exec node scripts/cms-server.js
