#!/bin/bash

# Validation script to check if the project is set up correctly

set -e

echo "🔍 Validating HashHive setup..."
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current: $(node -v)"
    exit 1
else
    echo "✅ Node.js version: $(node -v)"
fi

# Check npm version
echo "Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 10 ]; then
    echo "❌ npm 10+ required. Current: $(npm -v)"
    exit 1
else
    echo "✅ npm version: $(npm -v)"
fi

# Check Docker
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found"
    exit 1
else
    echo "✅ Docker version: $(docker --version)"
fi

# Check Docker Compose
echo "Checking Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose not found"
    exit 1
else
    echo "✅ Docker Compose available"
fi

# Check project structure
echo "Checking project structure..."
REQUIRED_DIRS=("backend" "frontend" "shared" "openapi")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "❌ Missing directory: $dir"
        exit 1
    fi
done
echo "✅ Project structure valid"

# Check package.json files
echo "Checking package.json files..."
REQUIRED_PACKAGES=("package.json" "backend/package.json" "frontend/package.json" "shared/package.json")
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if [ ! -f "$pkg" ]; then
        echo "❌ Missing: $pkg"
        exit 1
    fi
done
echo "✅ All package.json files present"

# Check TypeScript configs
echo "Checking TypeScript configs..."
REQUIRED_TSCONFIGS=("tsconfig.base.json" "backend/tsconfig.json" "frontend/tsconfig.json" "shared/tsconfig.json")
for tsconfig in "${REQUIRED_TSCONFIGS[@]}"; do
    if [ ! -f "$tsconfig" ]; then
        echo "❌ Missing: $tsconfig"
        exit 1
    fi
done
echo "✅ All TypeScript configs present"

# Check environment files
echo "Checking environment files..."
if [ ! -f "backend/.env.example" ]; then
    echo "❌ Missing: backend/.env.example"
    exit 1
fi
if [ ! -f "frontend/.env.example" ]; then
    echo "❌ Missing: frontend/.env.example"
    exit 1
fi
echo "✅ Environment example files present"

# Check Docker Compose file
echo "Checking Docker Compose configuration..."
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Missing: docker-compose.yml"
    exit 1
fi
echo "✅ Docker Compose file present"

# Check if node_modules exists
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  Root dependencies not installed. Run: npm install"
else
    echo "✅ Root dependencies installed"
fi

if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  Backend dependencies not installed. Run: npm install -w backend"
else
    echo "✅ Backend dependencies installed"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Frontend dependencies not installed. Run: npm install -w frontend"
else
    echo "✅ Frontend dependencies installed"
fi

echo ""
echo "✅ Validation complete!"
echo ""
echo "To complete setup:"
echo "  1. Install dependencies: npm install"
echo "  2. Copy environment files:"
echo "     cp backend/.env.example backend/.env"
echo "     cp frontend/.env.example frontend/.env"
echo "  3. Start services: docker compose up -d"
echo "  4. Start development: npm run dev"
echo ""
