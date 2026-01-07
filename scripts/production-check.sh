#!/bin/bash

# Production Readiness Check Script
# This script checks if the application is ready for production deployment

echo "========================================="
echo "AIU Library Booking - Production Check"
echo "========================================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Helper functions
error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
    ((ERRORS++))
}

warning() {
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo "ℹ $1"
}

echo "1. Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        success "Node.js version $(node --version) is compatible"
    else
        error "Node.js version must be 18 or higher (current: $(node --version))"
    fi
else
    error "Node.js is not installed"
fi
echo ""

echo "2. Checking npm version..."
if command -v npm &> /dev/null; then
    success "npm version $(npm --version) found"
else
    error "npm is not installed"
fi
echo ""

echo "3. Checking server dependencies..."
if [ -f "server/package.json" ]; then
    cd server
    if [ -d "node_modules" ]; then
        success "Server dependencies installed"
    else
        warning "Server dependencies not installed. Run: cd server && npm install"
    fi

    # Check for security vulnerabilities
    echo "   Checking for security vulnerabilities..."
    if npm audit --production --json | grep -q '"high"'; then
        warning "High severity vulnerabilities found. Run: npm audit fix"
    else
        success "No high severity vulnerabilities found"
    fi
    cd ..
else
    error "server/package.json not found"
fi
echo ""

echo "4. Checking client dependencies..."
if [ -f "client/package.json" ]; then
    cd client
    if [ -d "node_modules" ]; then
        success "Client dependencies installed"
    else
        warning "Client dependencies not installed. Run: cd client && npm install"
    fi
    cd ..
else
    error "client/package.json not found"
fi
echo ""

echo "5. Checking environment configuration..."
if [ -f "server/.env" ]; then
    source server/.env

    # Check NODE_ENV
    if [ "$NODE_ENV" = "production" ]; then
        success "NODE_ENV is set to production"
    else
        warning "NODE_ENV is not set to production (current: ${NODE_ENV:-not set})"
    fi

    # Check JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        error "JWT_SECRET is not set in .env"
    elif [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production" ]; then
        error "JWT_SECRET is still set to default value. Generate a secure key!"
    elif [ ${#JWT_SECRET} -lt 32 ]; then
        warning "JWT_SECRET should be at least 32 characters long (current: ${#JWT_SECRET})"
    else
        success "JWT_SECRET is configured (${#JWT_SECRET} characters)"
    fi

    # Check DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL is not set in .env"
    elif [[ "$DATABASE_URL" == *"file:"* ]]; then
        warning "Using SQLite database. Consider MySQL or PostgreSQL for production"
    else
        success "Production database configured"
    fi

    # Check CLIENT_URL
    if [ -z "$CLIENT_URL" ]; then
        error "CLIENT_URL is not set in .env"
    elif [[ "$CLIENT_URL" == *"localhost"* ]]; then
        warning "CLIENT_URL still points to localhost. Set production domain"
    else
        success "CLIENT_URL configured: $CLIENT_URL"
    fi

else
    error "server/.env file not found. Copy from .env.production.example"
fi
echo ""

echo "6. Checking TypeScript compilation..."
cd server
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    error "TypeScript compilation errors found"
else
    success "TypeScript compiles without errors"
fi
cd ..
echo ""

echo "7. Checking build artifacts..."
if [ -d "server/dist" ]; then
    success "Server build directory exists"
else
    warning "Server not built yet. Run: cd server && npm run build"
fi

if [ -d "client/dist" ]; then
    success "Client build directory exists"
else
    warning "Client not built yet. Run: cd client && npm run build"
fi
echo ""

echo "8. Checking Prisma configuration..."
if [ -f "server/prisma/schema.prisma" ]; then
    PROVIDER=$(grep "provider" server/prisma/schema.prisma | head -1 | awk '{print $3}' | tr -d '"')
    if [ "$PROVIDER" = "sqlite" ]; then
        warning "Database provider is SQLite. Consider MySQL or PostgreSQL for production"
    else
        success "Database provider: $PROVIDER"
    fi
else
    error "Prisma schema not found"
fi
echo ""

echo "9. Checking for sensitive files..."
SENSITIVE_FILES=(".env" ".env.local" "*.log" "*.db" "dev.db")
for file in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$file" 2>/dev/null; then
        warning "Sensitive file '$file' is tracked in git. Add to .gitignore"
    fi
done
success "Sensitive files check complete"
echo ""

echo "10. Checking security best practices..."
cd server/src
if grep -r "console.log" . --include="*.ts" --exclude-dir=node_modules | grep -v "logger"; then
    warning "Found console.log statements. Use logger instead"
else
    success "No console.log statements found"
fi
cd ../..
echo ""

echo "========================================="
echo "Production Readiness Summary"
echo "========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Application is ready for production.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found. Review and address before deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Please fix all errors before deploying to production.${NC}"
    exit 1
fi
