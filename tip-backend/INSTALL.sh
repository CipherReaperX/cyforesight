#!/bin/bash

echo "🛡️  TIP Backend - Quick Installation"
echo "===================================="
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created - please configure your settings!"
fi

# Create logs directory
mkdir -p logs

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Configure .env file with your database credentials"
echo "2. Ensure PostgreSQL and Redis are running"
echo "3. Run: npm run db:push"
echo "4. Run: npm run seed"
echo "5. Run: npm run dev"
echo ""
echo "Default credentials after seeding:"
echo "  Admin: admin / admin123"
echo "  Analyst: analyst / analyst123"
echo ""
