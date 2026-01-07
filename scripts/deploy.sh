#!/bin/bash

# Deployment Script for AIU Library Room Booking System
# This script automates the build and deployment process

set -e  # Exit on error

echo "========================================="
echo "AIU Library Booking - Deployment Script"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
error() {
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -d "server" ] || [ ! -d "client" ]; then
    error "Please run this script from the project root directory"
fi

# Check for production environment file
if [ ! -f "server/.env" ]; then
    error "server/.env not found. Create it from .env.production.example"
fi

# Confirm deployment
read -p "Are you sure you want to deploy to production? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
info "Step 1/7: Installing server dependencies..."
cd server
npm install --production=false
success "Server dependencies installed"

echo ""
info "Step 2/7: Running TypeScript compilation check..."
npx tsc --noEmit || error "TypeScript compilation failed"
success "TypeScript check passed"

echo ""
info "Step 3/7: Building server..."
npm run build
success "Server built successfully"

echo ""
info "Step 4/7: Installing client dependencies..."
cd ../client
npm install
success "Client dependencies installed"

echo ""
info "Step 5/7: Building client..."
npm run build
success "Client built successfully"

echo ""
info "Step 6/7: Running security audit..."
cd ../server
if npm audit --production | grep -q "high"; then
    echo -e "${YELLOW}Warning: High severity vulnerabilities found${NC}"
    read -p "Continue anyway? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        error "Deployment cancelled due to security vulnerabilities"
    fi
fi
success "Security audit complete"

echo ""
info "Step 7/7: Checking database migrations..."
echo "To apply database migrations in production, run:"
echo "  cd server && npx prisma migrate deploy"
echo ""

echo ""
echo "========================================="
echo -e "${GREEN}Build Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review the DEPLOYMENT_GUIDE.md for deployment instructions"
echo "2. Copy the built files to your production server:"
echo "   - server/dist/ (compiled server code)"
echo "   - client/dist/ (static client files)"
echo "3. Set up your production .env file"
echo "4. Run database migrations: npx prisma migrate deploy"
echo "5. Start the server with PM2 or your process manager"
echo ""
echo "For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""
