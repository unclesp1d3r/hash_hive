#!/bin/bash

# HashHive Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up HashHive development environment..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
npm install --workspaces

# Copy environment files if they don't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env from example..."
    cp backend/.env.example backend/.env
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend/.env from example..."
    cp frontend/.env.example frontend/.env
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🔍 Checking service health..."
docker compose ps

# Install pre-commit hooks
if command -v pre-commit &> /dev/null; then
    echo "🔧 Installing pre-commit hooks..."
    pre-commit install
else
    echo "⚠️  pre-commit not found. Install it with: pip install pre-commit"
    echo "   Then run: pre-commit install"
fi

# Install git hooks (pre-push)
echo "🔧 Installing git hooks..."
bash scripts/install-git-hooks.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development servers: npm run dev"
echo "  2. Backend API: http://localhost:3001"
echo "  3. Frontend UI: http://localhost:3000"
echo "  4. MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
