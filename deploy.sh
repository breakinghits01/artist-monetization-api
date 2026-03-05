#!/bin/bash

echo "🏗️  Building backend API..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "🔄 Restarting API server (PM2)..."
pm2 restart artist-api-dev

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🌐 Production URL: https://artistmonetization.xyz"
echo "🔌 API Endpoint: https://artistmonetization.xyz/api/v1"
echo ""
echo "💡 Local Development:"
echo "   - API Server: http://localhost:3000"
echo ""
echo "📊 Check server status:"
echo "   pm2 status"
echo "   pm2 logs artist-api-dev"
echo ""
