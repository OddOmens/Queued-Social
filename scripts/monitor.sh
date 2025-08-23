#!/bin/bash

# Production Monitoring Script
# Monitors application health and performance

set -e

# Configuration
APP_URL="${1:-http://localhost:3000}"
CONTAINER_NAME="social-media-scheduler-app"
LOG_FILE="/tmp/monitor.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

# Check container status
check_container() {
    if docker ps | grep -q "$CONTAINER_NAME"; then
        print_status "Container is running ✓"
        return 0
    else
        print_error "Container is not running!"
        return 1
    fi
}

# Check health endpoint
check_health() {
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" "$APP_URL/api/health" || echo "000")
    status_code="${response: -3}"
    
    if [ "$status_code" = "200" ]; then
        print_status "Health check passed ✓"
        return 0
    else
        print_error "Health check failed (HTTP $status_code)"
        return 1
    fi
}

# Check readiness endpoint
check_readiness() {
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" "$APP_URL/api/ready" || echo "000")
    status_code="${response: -3}"
    
    if [ "$status_code" = "200" ]; then
        print_status "Readiness check passed ✓"
        return 0
    else
        print_error "Readiness check failed (HTTP $status_code)"
        return 1
    fi
}

# Check resource usage
check_resources() {
    if ! docker ps | grep -q "$CONTAINER_NAME"; then
        print_error "Container not found for resource check"
        return 1
    fi
    
    local stats
    stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" "$CONTAINER_NAME" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Resource usage: $stats"
        
        # Extract CPU percentage (remove % sign)
        local cpu_percent
        cpu_percent=$(echo "$stats" | tail -n 1 | awk '{print $1}' | sed 's/%//')
        
        # Extract memory percentage
        local mem_percent
        mem_percent=$(echo "$stats" | tail -n 1 | awk '{print $3}' | sed 's/%//')
        
        # Check thresholds
        if (( $(echo "$cpu_percent > 80" | bc -l) )); then
            print_warning "High CPU usage: ${cpu_percent}%"
        fi
        
        if (( $(echo "$mem_percent > 80" | bc -l) )); then
            print_warning "High memory usage: ${mem_percent}%"
        fi
        
        return 0
    else
        print_error "Failed to get resource stats"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    local usage
    usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    print_status "Disk usage: ${usage}%"
    
    if [ "$usage" -gt 80 ]; then
        print_warning "High disk usage: ${usage}%"
    fi
    
    if [ "$usage" -gt 90 ]; then
        print_error "Critical disk usage: ${usage}%"
        return 1
    fi
    
    return 0
}

# Check application logs for errors
check_logs() {
    local error_count
    error_count=$(docker logs --since="5m" "$CONTAINER_NAME" 2>&1 | grep -i "error" | wc -l)
    
    if [ "$error_count" -gt 0 ]; then
        print_warning "Found $error_count errors in recent logs"
        
        # Show recent errors
        print_status "Recent errors:"
        docker logs --since="5m" "$CONTAINER_NAME" 2>&1 | grep -i "error" | tail -5
    else
        print_status "No recent errors in logs ✓"
    fi
}

# Send alert (placeholder for notification system)
send_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    print_error "ALERT [$severity]: $message"
    
    # Add your notification logic here:
    # - Send email
    # - Post to Slack
    # - Send to monitoring system
    # - etc.
}

# Main monitoring function
monitor() {
    print_status "Starting monitoring check..."
    
    local failures=0
    
    # Run all checks
    check_container || ((failures++))
    check_health || ((failures++))
    check_readiness || ((failures++))
    check_resources || ((failures++))
    check_disk_space || ((failures++))
    check_logs
    
    # Summary
    if [ "$failures" -eq 0 ]; then
        print_status "All checks passed ✓"
    else
        print_error "$failures checks failed!"
        send_alert "Application monitoring detected $failures failures" "critical"
        exit 1
    fi
}

# Continuous monitoring mode
continuous_monitor() {
    local interval="${1:-60}"
    
    print_status "Starting continuous monitoring (interval: ${interval}s)"
    
    while true; do
        monitor
        sleep "$interval"
    done
}

# Usage information
usage() {
    echo "Usage: $0 [URL] [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -c, --continuous [INTERVAL]  Run continuous monitoring (default: 60s)"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Single check on localhost:3000"
    echo "  $0 https://myapp.com                  # Single check on custom URL"
    echo "  $0 -c 30                             # Continuous monitoring every 30s"
    echo "  $0 https://myapp.com -c 120          # Continuous monitoring custom URL"
}

# Parse command line arguments
case "${2:-}" in
    -c|--continuous)
        continuous_monitor "${3:-60}"
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    "")
        monitor
        ;;
    *)
        echo "Unknown option: $2"
        usage
        exit 1
        ;;
esac