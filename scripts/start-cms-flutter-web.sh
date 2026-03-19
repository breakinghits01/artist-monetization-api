#!/bin/bash

# Start HTTP server for CMS Flutter web build on port 9001
cd "$(dirname "$0")/.."

echo "🚀 Starting CMS Flutter Web Server on port 9001..."
echo "📁 Serving from: $(pwd)/cms-build"

# Use serve with proper cache headers
exec npx serve cms-build -l 9001 --single --no-port-switching --no-clipboard
