#!/bin/bash

# Disk Cleanup Script for API Project
# Purpose: Free up disk space by cleaning logs, temp files, and old uploads
# Run manually or via cron: 0 2 * * * /path/to/cleanup-disk.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/cleanup.log"

echo "==================================" | tee -a "$LOG_FILE"
echo "Starting cleanup: $(date)" | tee -a "$LOG_FILE"
echo "==================================" | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check disk space before
DISK_BEFORE=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $5}')
log "Disk usage before: $DISK_BEFORE"

# 1. Clean old PM2 logs (older than 7 days)
log "Cleaning old PM2 logs..."
find "$PROJECT_DIR/logs" -name "*.log" -type f -mtime +7 -exec rm -f {} \; 2>/dev/null || true
CLEANED_LOGS=$(find "$PROJECT_DIR/logs" -name "*.log" -type f -mtime +7 | wc -l || echo "0")
log "Removed $CLEANED_LOGS old log files"

# 2. Clean old compressed logs (older than 30 days)
log "Cleaning old compressed logs..."
find "$PROJECT_DIR/logs" -name "*.gz" -type f -mtime +30 -exec rm -f {} \; 2>/dev/null || true
CLEANED_GZ=$(find "$PROJECT_DIR/logs" -name "*.gz" -type f -mtime +30 | wc -l || echo "0")
log "Removed $CLEANED_GZ compressed log files"

# 3. Clean temp directory
log "Cleaning temp directory..."
if [ -d "$PROJECT_DIR/temp" ]; then
    find "$PROJECT_DIR/temp" -type f -mtime +1 -exec rm -f {} \; 2>/dev/null || true
    CLEANED_TEMP=$(find "$PROJECT_DIR/temp" -type f -mtime +1 | wc -l || echo "0")
    log "Removed $CLEANED_TEMP temp files"
fi

# 4. Clean npm cache (optional, uncomment if needed)
# log "Cleaning npm cache..."
# npm cache clean --force 2>/dev/null || true

# 5. Clean old uploads (legacy - only if using local storage)
# Uncomment if you have local uploads older than 90 days
# log "Cleaning old uploads..."
# if [ -d "$PROJECT_DIR/uploads" ]; then
#     find "$PROJECT_DIR/uploads" -name "*.mp3" -type f -mtime +90 -exec rm -f {} \; 2>/dev/null || true
#     CLEANED_UPLOADS=$(find "$PROJECT_DIR/uploads" -name "*.mp3" -type f -mtime +90 | wc -l || echo "0")
#     log "Removed $CLEANED_UPLOADS old upload files"
# fi

# 6. Clean node_modules in unused projects (be careful!)
# Uncomment only if you're sure about removing node_modules
# log "Finding large node_modules directories..."
# find "$PROJECT_DIR/.." -name "node_modules" -type d -exec du -sh {} \; 2>/dev/null | sort -rh | head -5 | tee -a "$LOG_FILE"

# 7. Truncate large log files instead of deleting (safer approach)
log "Truncating large log files..."
find "$PROJECT_DIR/logs" -name "*.log" -type f -size +100M -exec truncate -s 10M {} \; 2>/dev/null || true
TRUNCATED=$(find "$PROJECT_DIR/logs" -name "*.log" -type f -size +100M | wc -l || echo "0")
log "Truncated $TRUNCATED large log files"

# 8. Clean Docker if installed (optional)
if command -v docker &> /dev/null; then
    log "Cleaning Docker artifacts..."
    docker system prune -af --volumes 2>/dev/null || true
fi

# Check disk space after
DISK_AFTER=$(df -h "$PROJECT_DIR" | tail -1 | awk '{print $5}')
log "Disk usage after: $DISK_AFTER"

# Calculate space freed
SPACE_BEFORE=$(df "$PROJECT_DIR" | tail -1 | awk '{print $3}')
SPACE_AFTER=$(df "$PROJECT_DIR" | tail -1 | awk '{print $3}')
SPACE_FREED=$((SPACE_BEFORE - SPACE_AFTER))
SPACE_FREED_MB=$((SPACE_FREED / 1024))

log "Space freed: ${SPACE_FREED_MB}MB"
log "Cleanup completed successfully!"

# Send alert if disk usage is still critical (>90%)
DISK_USAGE=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    log "WARNING: Disk usage still critical at ${DISK_USAGE}%!"
    log "Manual intervention may be required."
    # Uncomment to send email/notification
    # echo "Disk usage critical: ${DISK_USAGE}%" | mail -s "Disk Alert" admin@example.com
fi

echo "==================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

exit 0
