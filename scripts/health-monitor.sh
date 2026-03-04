#!/bin/bash

# Health Monitor Script for Artist Monetization Platform
# Checks server health and restarts if needed

LOG_FILE="./logs/health-monitor.log"
HEALTH_URL="http://localhost:3000/health"
MAX_FAILURES=3
FAILURES=0

# Create logs directory if it doesn't exist
mkdir -p ./logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 10)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

restart_services() {
    log "⚠️ Restarting services due to health check failures..."
    pm2 restart artist-api-dev
    sleep 5
    log "✅ Services restarted"
    FAILURES=0
}

log "🏥 Starting health monitor..."

while true; do
    if check_health; then
        if [ $FAILURES -gt 0 ]; then
            log "✅ Service recovered (was failing)"
        fi
        FAILURES=0
    else
        FAILURES=$((FAILURES + 1))
        log "❌ Health check failed ($FAILURES/$MAX_FAILURES)"
        
        if [ $FAILURES -ge $MAX_FAILURES ]; then
            restart_services
        fi
    fi
    
    # Check every 30 seconds
    sleep 30
done
