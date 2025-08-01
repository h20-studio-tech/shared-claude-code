#!/bin/bash

# Claude Code UI Cloud - Deployment Script
# This script helps deploy the cloud version to various platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Show usage
show_usage() {
    echo "Usage: $0 [PLATFORM] [OPTIONS]"
    echo ""
    echo "Platforms:"
    echo "  docker     - Build and run with Docker"
    echo "  fly        - Deploy to Fly.io"
    echo "  railway    - Deploy to Railway"
    echo "  vercel     - Deploy to Vercel"
    echo "  replit     - Setup for Replit deployment"
    echo "  local      - Run locally in cloud mode"
    echo "  migrate    - Run migration from local to cloud"
    echo ""
    echo "Options:"
    echo "  --build    - Force rebuild"
    echo "  --prod     - Use production settings"
    echo "  --help     - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 migrate           # Migrate existing data to cloud"
    echo "  $0 local             # Run locally in cloud mode"
    echo "  $0 docker --build   # Build and run with Docker"
    echo "  $0 fly --prod       # Deploy to Fly.io production"
    echo "  $0 replit            # Setup for Replit deployment"
}

# Validate environment
validate_env() {
    log_info "Validating environment..."
    
    if [ ! -f ".env.cloud" ]; then
        log_warning ".env.cloud not found, creating from template..."
        cp .env.cloud .env.cloud.new
        log_warning "Please edit .env.cloud.new and rename to .env.cloud"
        return 1
    fi
    
    # Source environment variables
    source .env.cloud
    
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-in-production-make-it-very-long-and-random" ]; then
        log_error "JWT_SECRET must be set to a secure random value"
        log_info "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
        return 1
    fi
    
    log_success "Environment validation passed"
}

# Build the application
build_app() {
    log_info "Building application..."
    npm run build
    log_success "Build completed"
}

# Run migration
run_migration() {
    log_info "Running migration from local to cloud database..."
    
    if [ ! -d "$HOME/.claude/projects" ]; then
        log_warning "No Claude projects found at $HOME/.claude/projects"
        log_info "Skipping migration - you can add sessions manually later"
        return 0
    fi
    
    node server/migrate-to-cloud.js
    log_success "Migration completed"
}

# Docker deployment
deploy_docker() {
    log_info "Deploying with Docker..."
    
    # Build image
    if [[ "$*" == *"--build"* ]] || ! docker image inspect claude-code-ui-cloud >/dev/null 2>&1; then
        log_info "Building Docker image..."
        docker build -t claude-code-ui-cloud .
    fi
    
    # Stop existing container
    if docker ps -q -f name=claude-code-ui >/dev/null 2>&1; then
        log_info "Stopping existing container..."
        docker stop claude-code-ui || true
        docker rm claude-code-ui || true
    fi
    
    # Create data directory
    mkdir -p ./data/database
    
    # Run container
    log_info "Starting container..."
    docker run -d \
        --name claude-code-ui \
        -p 3000:3000 \
        -v "$(pwd)/data:/app/data" \
        -v "$(pwd)/.env.cloud:/app/.env" \
        --restart unless-stopped \
        claude-code-ui-cloud
    
    log_success "Container started at http://localhost:3000"
}

# Fly.io deployment
deploy_fly() {
    if ! command_exists flyctl; then
        log_error "flyctl not found. Install from https://fly.io/docs/hands-on/install-flyctl/"
        return 1
    fi
    
    log_info "Deploying to Fly.io..."
    
    # Check if app exists
    if ! flyctl apps list | grep -q "claude-code-ui"; then
        log_info "Creating new Fly.io app..."
        flyctl apps create claude-code-ui
        
        # Create volume for database
        flyctl volumes create claude_data --region sjc --size 1
    fi
    
    # Set secrets
    log_info "Setting secrets..."
    source .env.cloud
    flyctl secrets set JWT_SECRET="$JWT_SECRET"
    [ -n "$API_KEY" ] && flyctl secrets set API_KEY="$API_KEY"
    
    # Deploy
    flyctl deploy
    
    log_success "Deployed to Fly.io"
    flyctl open
}

# Railway deployment
deploy_railway() {
    if ! command_exists railway; then
        log_error "Railway CLI not found. Install from https://docs.railway.app/develop/cli"
        return 1
    fi
    
    log_info "Deploying to Railway..."
    
    # Login if not authenticated
    if ! railway whoami >/dev/null 2>&1; then
        railway login
    fi
    
    # Initialize project if needed
    if [ ! -f "railway.json" ]; then
        railway init
    fi
    
    # Set environment variables
    log_info "Setting environment variables..."
    source .env.cloud
    railway variables set NODE_ENV=production
    railway variables set CLOUD_MODE=true
    railway variables set JWT_SECRET="$JWT_SECRET"
    [ -n "$API_KEY" ] && railway variables set API_KEY="$API_KEY"
    
    # Deploy
    railway up
    
    log_success "Deployed to Railway"
}

# Vercel deployment
deploy_vercel() {
    if ! command_exists vercel; then
        log_error "Vercel CLI not found. Install with: npm i -g vercel"
        return 1
    fi
    
    log_info "Deploying to Vercel..."
    
    # Build first
    build_app
    
    # Set environment variables
    log_info "Setting environment variables..."
    source .env.cloud
    vercel env add NODE_ENV production
    vercel env add CLOUD_MODE true
    vercel env add JWT_SECRET "$JWT_SECRET"
    [ -n "$API_KEY" ] && vercel env add API_KEY "$API_KEY"
    
    # Deploy
    if [[ "$*" == *"--prod"* ]]; then
        vercel --prod
    else
        vercel
    fi
    
    log_success "Deployed to Vercel"
}

# Replit setup
setup_replit() {
    log_info "Setting up for Replit deployment..."
    
    # Run the setup script
    ./scripts/replit-setup.sh
    
    log_success "Replit setup completed!"
    log_info "Next steps:"
    log_info "1. Push your code to GitHub"
    log_info "2. Import the repository to Replit"
    log_info "3. Run the Repl - it will auto-deploy!"
    log_info ""
    log_info "The setup script has:"
    log_info "- Generated a secure JWT secret"
    log_info "- Built the application"
    log_info "- Initialized the database"
    log_info "- Created default admin user (admin/admin123)"
    log_info ""
    log_info "Your Replit URL will be: https://your-repl-name.your-username.repl.co"
}

# Local cloud mode
run_local() {
    log_info "Running locally in cloud mode..."
    
    # Build if needed
    if [ ! -d "dist" ] || [[ "$*" == *"--build"* ]]; then
        build_app
    fi
    
    # Set environment
    export NODE_ENV=development
    export CLOUD_MODE=true
    
    # Start server
    log_info "Starting cloud server at http://localhost:3000"
    node server/cloud-server.js
}

# Main script
main() {
    cd "$(dirname "$0")/.."
    
    case "${1:-help}" in
        "docker")
            validate_env && deploy_docker "$@"
            ;;
        "fly")
            validate_env && deploy_fly "$@"
            ;;
        "railway")
            validate_env && deploy_railway "$@"
            ;;
        "vercel")
            validate_env && deploy_vercel "$@"
            ;;
        "replit")
            setup_replit "$@"
            ;;
        "local")
            validate_env && run_local "$@"
            ;;
        "migrate")
            validate_env && run_migration
            ;;
        "help"|"--help"|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"