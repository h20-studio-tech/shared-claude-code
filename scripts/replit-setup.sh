#!/bin/bash

# Replit Setup Script for Claude Code UI Cloud
# This script prepares the environment for Replit deployment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

log_info "Setting up Claude Code UI Cloud for Replit..."

# Install dependencies
log_info "Installing Node.js dependencies..."
npm install

# Create environment file for Replit
if [ ! -f ".env" ]; then
    log_info "Creating .env file from template..."
    cp .env.cloud .env
    
    # Generate JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    
    # Update .env with generated values
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/NODE_ENV=.*/NODE_ENV=production/" .env
    sed -i "s/CLOUD_MODE=.*/CLOUD_MODE=true/" .env
    sed -i "s/PORT=.*/PORT=3000/" .env
    
    log_success "Environment file created with generated JWT secret"
else
    log_info "Environment file already exists"
fi

# Create data directory for SQLite database
mkdir -p ./data/database
chmod 755 ./data/database

# Build the application
log_info "Building the application..."
npm run build

# Initialize cloud database
log_info "Initializing cloud database..."
node -e "
const { initializeCloudDatabase } = require('./server/database/cloud-db.js');
initializeCloudDatabase().then(() => {
  console.log('Database initialized successfully');
  process.exit(0);
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
"

# Check if migration is needed
if [ -d "$HOME/.claude/projects" ]; then
    log_info "Found existing Claude projects, running migration..."
    node server/migrate-to-cloud.js || log_warning "Migration failed, you can run it manually later"
else
    log_info "No existing Claude projects found, skipping migration"
fi

log_success "Setup completed! You can now run the server."
log_info "Default admin credentials (change after first login):"
log_info "  Username: admin"
log_info "  Password: admin123"
log_info ""
log_info "To start the server: npm run cloud"
log_info "The app will be available at: https://your-repl-name.your-username.repl.co"