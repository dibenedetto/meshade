#!/bin/bash
# setup.sh - Setup script for Numel AI Docker environment

echo "Setting up Numel AI Docker environment..."

# Create directory structure
echo "Creating project directories..."
mkdir -p src
mkdir -p src/static
mkdir -p config
mkdir -p storage/knowledge
mkdir -p storage/memory
mkdir -p storage/session

# Move Python files to src directory
echo "Organizing Python source files..."
if [ -f "numel.py" ]; then
    mv numel.py launch.py tools.py agno_impl.py src/ 2>/dev/null
fi

# Move HTML/JS files to static directory
echo "Organizing static files..."
if [ -f "index.html" ]; then
    mv index.html numel.js graph.js src/static/ 2>/dev/null
fi

# Create a sample config.json if it doesn't exist
if [ ! -f "config/config.json" ]; then
    echo "Creating sample config.json..."
    cat > config/config.json << 'EOF'
{
    "version": "1.0.0",
    "name": "Numel Playground",
    "description": "Numel AI Playground",
    "author": "marco@numel.app",
    "backend": 0,
    "port": 8000,
    "seed": 42,
    "reload": true,
    "data": null,
    "backends": [
        {
            "type": "agno",
            "version": ""
        }
    ],
    "models": [
        {
            "type": "ollama",
            "id": "mistral"
        }
    ],
    "embeddings": [
        {
            "type": "ollama",
            "id": "mistral"
        }
    ],
    "agents": [
        {
            "version": "1.0.0",
            "name": "Numel Assistant",
            "author": "user@numel.app",
            "description": "Numel AI Assistant",
            "instructions": [
                "Be helpful and informative",
                "Provide accurate and relevant information"
            ],
            "backend": 0,
            "model": 0
        }
    ]
}
EOF
fi

# Create .env file for environment variables
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Environment variables for Numel AI

# Database configuration
DATABASE_URL=postgresql://numel:numel_password@postgres:5432/numel_db
SQLITE_PATH=/app/storage/numel.db

# API Keys (add your keys here)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Development settings
ENV=development
DEBUG=true
EOF
fi

# Create .dockerignore
echo "Creating .dockerignore..."
cat > .dockerignore << 'EOF'
__pycache__
*.pyc
*.pyo
*.pyd
.git
.gitignore
.env.local
.venv
venv/
env/
*.log
.DS_Store
.idea/
.vscode/
*.swp
*.swo
node_modules/
dist/
EOF

# Set permissions
chmod +x setup.sh

echo "Setup complete!"
echo ""
echo "Project structure:"
echo "  src/           - Python source files"
echo "  src/static/    - HTML/JS/CSS files"
echo "  config/        - Configuration files"
echo "  storage/       - Data storage directories"
echo ""
echo "Next steps:"
echo "1. Move your Python files to the src/ directory"
echo "2. Move your HTML/JS files to the src/static/ directory"
echo "3. Update config/config.json with your settings"
echo "4. Build and run with Docker Compose:"
echo "   docker-compose build"
echo "   docker-compose up"
echo ""
echo "For development with hot-reload:"
echo "   docker-compose -f docker-compose.dev.yml up"