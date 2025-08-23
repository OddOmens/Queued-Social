#!/bin/bash

# Production Startup Script
# Handles application initialization and startup

set -e

echo "🚀 Starting Social Media Scheduler in Production Mode"
echo "===================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check environment variables
check_environment() {
    print_status "Checking environment configuration..."
    
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "NEXTAUTH_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_status "Environment variables validated ✓"
    else
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
}

# Create necessary directories
setup_directories() {
    print_status "Setting up directories..."
    
    mkdir -p logs
    mkdir -p temp
    mkdir -p uploads
    
    # Set proper permissions
    chmod 755 logs temp uploads
    
    print_status "Directories created ✓"
}

# Initialize database
init_database() {
    print_status "Initializing database..."
    
    # Run database migrations if needed
    if [ -f "scripts/migrate.js" ]; then
        node scripts/migrate.js run || {
            print_warning "Database migration failed or not needed"
        }
    fi
    
    # Validate database schema
    if [ -f "scripts/validate-schema.js" ]; then
        node scripts/validate-schema.js || {
            print_error "Database schema validation failed"
            exit 1
        }
    fi
    
    print_status "Database initialized ✓"
}

# Setup storage
init_storage() {
    print_status "Initializing storage..."
    
    if [ -f "scripts/setup-storage.js" ]; then
        node scripts/setup-storage.js || {
            print_warning "Storage setup failed or not needed"
        }
    fi
    
    print_status "Storage initialized ✓"
}

# Health check before startup
pre_startup_check() {
    print_status "Running pre-startup checks..."
    
    # Check if port is available
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port 3000 is already in use"
    fi
    
    # Check disk space
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        print_error "Critical disk space: ${disk_usage}% used"
        exit 1
    elif [ "$disk_usage" -gt 80 ]; then
        print_warning "High disk usage: ${disk_usage}% used"
    fi
    
    print_status "Pre-startup checks passed ✓"
}

# Start the application
start_application() {
    print_status "Starting Next.js application..."
    
    # Set production environment
    export NODE_ENV=production
    export PORT=3000
    export HOSTNAME=0.0.0.0
    
    # Start the application
    if [ -f "server.js" ]; then
        # Standalone mode
        print_status "Starting in standalone mode..."
        exec node server.js
    elif [ -f ".next/standalone/server.js" ]; then
        # Standalone mode from build output
        print_status "Starting from standalone build..."
        cd .next/standalone
        exec node server.js
    else
        # Standard Next.js start
        print_status "Starting with Next.js..."
        exec npm start
    fi
}

# Graceful shutdown handler
cleanup() {
    print_status "Received shutdown signal, cleaning up..."
    
    # Kill background processes
    jobs -p | xargs -r kill
    
    # Clean up temporary files
    rm -rf temp/*
    
    print_status "Cleanup completed"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main startup sequence
main() {
    check_environment
    setup_directories
    init_database
    init_storage
    pre_startup_check
    start_application
}

# Run main function
main "$@"