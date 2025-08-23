#!/bin/bash

# Social Media Scheduler Deployment Script
# This script handles the deployment process for production

set -e  # Exit on any error

echo "🚀 Starting deployment process..."

# Configuration
DOCKER_IMAGE_NAME="social-media-scheduler"
DOCKER_TAG="${1:-latest}"
CONTAINER_NAME="social-media-scheduler-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required files exist
check_requirements() {
    print_status "Checking deployment requirements..."
    
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile not found!"
        exit 1
    fi
    
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found!"
        exit 1
    fi
    
    if [ ! -f ".env.production" ]; then
        print_warning ".env.production not found. Make sure environment variables are set."
    fi
    
    print_status "Requirements check passed ✓"
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."
    
    docker build -t "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}" .
    
    if [ $? -eq 0 ]; then
        print_status "Docker image built successfully ✓"
    else
        print_error "Docker build failed!"
        exit 1
    fi
}

# Run health checks
health_check() {
    print_status "Running health checks..."
    
    # Wait for container to be ready
    sleep 10
    
    # Check if container is running
    if docker ps | grep -q "${CONTAINER_NAME}"; then
        print_status "Container is running ✓"
    else
        print_error "Container is not running!"
        docker logs "${CONTAINER_NAME}"
        exit 1
    fi
    
    # Check health endpoint
    for i in {1..30}; do
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            print_status "Health check passed ✓"
            return 0
        fi
        print_status "Waiting for application to be ready... (${i}/30)"
        sleep 2
    done
    
    print_error "Health check failed after 60 seconds!"
    docker logs "${CONTAINER_NAME}"
    exit 1
}

# Deploy with docker-compose
deploy() {
    print_status "Deploying application..."
    
    # Stop existing containers
    docker-compose down || true
    
    # Start new containers
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_status "Application deployed successfully ✓"
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Cleanup old images
cleanup() {
    print_status "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions (keep last 3)
    docker images "${DOCKER_IMAGE_NAME}" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
    tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | xargs -r docker rmi
    
    print_status "Cleanup completed ✓"
}

# Main deployment process
main() {
    echo "🔧 Social Media Scheduler Deployment"
    echo "=================================="
    
    check_requirements
    build_image
    deploy
    health_check
    cleanup
    
    print_status "🎉 Deployment completed successfully!"
    print_status "Application is running at: http://localhost:3000"
    print_status "Health check: http://localhost:3000/api/health"
    print_status "Readiness check: http://localhost:3000/api/ready"
}

# Run main function
main "$@"