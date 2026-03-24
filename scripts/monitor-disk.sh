#!/bin/bash

# Disk Space Monitoring Script
# Purpose: Check disk space and send alerts when usage exceeds thresholds
# Run via cron: */15 * * * * /path/to/monitor-disk.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/disk-monitor.log"
ALERT_FILE="$PROJECT_DIR/logs/disk-alert.txt"

# Thresholds
WARNING_THRESHOLD=85
CRITICAL_THRESHOLD=95

# Get current disk usage
DISK_USAGE=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_INFO=$(df -h "$PROJECT_DIR" | tail -1)

# Log current status
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Disk usage: ${DISK_USAGE}%" >> "$LOG_FILE"

# Check if usage exceeds thresholds
if [ "$DISK_USAGE" -ge "$CRITICAL_THRESHOLD" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] CRITICAL: Disk usage at ${DISK_USAGE}%!" >> "$LOG_FILE"
    echo "$DISK_INFO" >> "$LOG_FILE"
    
    # Create alert file
    cat > "$ALERT_FILE" << EOF
CRITICAL DISK ALERT
===================
Time: $(date)
Disk Usage: ${DISK_USAGE}%
Status: CRITICAL - Immediate action required!

Details:
$DISK_INFO

Recommended Actions:
1. Run cleanup script: ./scripts/cleanup-disk.sh
2. Check large files: du -h $PROJECT_DIR | sort -rh | head -20
3. Remove unnecessary files manually
4. Consider expanding disk space

EOF
    
    # Try to run cleanup automatically
    if [ -f "$PROJECT_DIR/scripts/cleanup-disk.sh" ]; then
        echo "Running automatic cleanup..." >> "$LOG_FILE"
        bash "$PROJECT_DIR/scripts/cleanup-disk.sh" >> "$LOG_FILE" 2>&1 || true
    fi
    
elif [ "$DISK_USAGE" -ge "$WARNING_THRESHOLD" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Disk usage at ${DISK_USAGE}%" >> "$LOG_FILE"
    
    # Create warning
    cat > "$ALERT_FILE" << EOF
DISK WARNING
============
Time: $(date)
Disk Usage: ${DISK_USAGE}%
Status: WARNING - Monitor closely

Details:
$DISK_INFO

Recommended Actions:
1. Plan cleanup activities
2. Monitor disk growth rate
3. Schedule cleanup script

EOF
else
    # Clear alert file if usage is normal
    [ -f "$ALERT_FILE" ] && rm "$ALERT_FILE"
fi

# Rotate monitor log if too large (keep last 1000 lines)
if [ -f "$LOG_FILE" ]; then
    LINE_COUNT=$(wc -l < "$LOG_FILE")
    if [ "$LINE_COUNT" -gt 1000 ]; then
        tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
fi

exit 0
