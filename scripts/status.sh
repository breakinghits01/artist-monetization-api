#!/bin/bash

# Server Status Script - Shows comprehensive server health

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎵 ARTIST MONETIZATION PLATFORM - SERVER STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check PM2 processes
echo "📊 PM2 PROCESSES:"
pm2 list

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 HEALTH CHECK:"
HEALTH=$(curl -s http://localhost:3000/health)
if [ $? -eq 0 ]; then
    echo "✅ API Server: HEALTHY"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo "❌ API Server: UNHEALTHY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 MEMORY USAGE:"
pm2 info artist-api-dev | grep -E "memory|cpu"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 RESTART HISTORY:"
pm2 info artist-api-dev | grep -E "restart time|uptime|unstable restarts"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 RECENT LOGS (Last 20 lines):"
tail -n 20 ./logs/pm2-dev-combined.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 ENDPOINTS:"
echo "   Health Check:  http://localhost:3000/health"
echo "   API:           http://localhost:3000/api/v1"
echo "   Production:    https://artistmonetization.xyz"
echo ""
echo "💡 Commands:"
echo "   pm2 restart artist-api-dev  - Restart API"
echo "   pm2 logs artist-api-dev     - View logs"
echo "   pm2 monit                   - Real-time monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
