#!/bin/bash

# Production Build Script
# Prepares the application for production deployment

set -e

echo "🏗️  Building Social Media Scheduler for Production"
echo "================================================"

# Colors for output
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

# Check Node.js version
check_node_version() {
    print_status "Checking Node.js version..."
    
    NODE_VERSION=$(node --version)
    REQUIRED_VERSION="v18"
    
    if [[ $NODE_VERSION == $REQUIRED_VERSION* ]]; then
        print_status "Node.js version: $NODE_VERSION ✓"
    else
        print_warning "Node.js version $NODE_VERSION detected. Recommended: $REQUIRED_VERSION+"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing production dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --only=production
    else
        npm install --only=production
    fi
    
    print_status "Dependencies installed ✓"
}

# Run tests
run_tests() {
    print_status "Running test suite..."
    
    # Install dev dependencies for testing
    npm install
    
    # Run tests
    npm run test -- --run --reporter=verbose
    
    if [ $? -eq 0 ]; then
        print_status "All tests passed ✓"
    else
        print_error "Tests failed! Aborting build."
        exit 1
    fi
}

# Build application
build_app() {
    print_status "Building Next.js application..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Build the application
    npm run build
    
    if [ $? -eq 0 ]; then
        print_status "Application built successfully ✓"
    else
        print_error "Build failed!"
        exit 1
    fi
}

# Validate build
validate_build() {
    print_status "Validating build output..."
    
    if [ ! -d ".next" ]; then
        print_error ".next directory not found!"
        exit 1
    fi
    
    if [ ! -f ".next/standalone/server.js" ]; then
        print_error "Standalone server.js not found!"
        exit 1
    fi
    
    print_status "Build validation passed ✓"
}

# Generate build info
generate_build_info() {
    print_status "Generating build information..."
    
    BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    
    cat > build-info.json << EOF
{
  "buildTime": "$BUILD_TIME",
  "gitCommit": "$GIT_COMMIT",
  "gitBranch": "$GIT_BRANCH",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF
    
    print_status "Build info generated ✓"
}

# Main build process
main() {
    check_node_version
    install_dependencies
    run_tests
    build_app
    validate_build
    generate_build_info
    
    print_status "🎉 Production build completed successfully!"
    print_status "Build artifacts are ready in .next/standalone/"
}

# Run main function
main "$@"