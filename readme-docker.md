# Numel AI Docker Setup

This Docker setup allows you to run the Numel AI application with live code editing capabilities and optional database services.

## Project Structure

```
numel-docker/
├── src/                    # Source code (mounted as volume)
│   ├── numel.py
│   ├── launch.py
│   ├── tools.py
│   ├── agno_impl.py
│   └── static/            # Frontend files
│       ├── index.html
│       ├── numel.js
│       └── graph.js
├── config/                # Configuration files
│   └── config.json
├── storage/              # Persistent storage
│   ├── knowledge/
│   ├── memory/
│   └── session/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── requirements.txt
├── Makefile
├── setup.sh
└── .env

```

## Quick Start

### 1. Initial Setup

```bash
# Make setup script executable and run it
chmod +x setup.sh
./setup.sh

# Or use make
make setup
```

### 2. Organize Your Files

Move your files to the appropriate directories:
- Python files (`*.py`) → `src/`
- HTML/JS/CSS files → `src/static/`
- Configuration → `config/config.json`

### 3. Configure Dependencies

**Important:** The `agno` package needs special handling. Update `requirements.txt`:

```python
# If agno is on PyPI:
agno==x.x.x

# If it's a private GitHub repo:
git+https://github.com/yourusername/agno.git#egg=agno

# If it's local, copy it to src/agno/ and it will be in PYTHONPATH
```

### 4. Build and Run

```bash
# Build the Docker image
make build

# Start all services
make up

# Or for development with hot-reload
make dev
```

## Available Commands

```bash
make help          # Show all available commands
make build         # Build Docker images
make up            # Start all services
make down          # Stop all services
make dev           # Start in development mode with hot reload
make logs          # View logs from all containers
make shell         # Open shell in app container
make clean         # Clean up containers and volumes
make rebuild       # Rebuild and restart everything
make postgres-up   # Start only PostgreSQL
make pgadmin       # Start pgAdmin interface
```

## Development Mode

The development setup provides:
- **Hot Reload**: Automatically restarts when Python files change
- **Live Editing**: Edit files locally, changes reflect immediately
- **Debug Output**: Enhanced logging and error messages

```bash
# Start development mode
docker-compose -f docker-compose.dev.yml up

# Or simply
make dev
```

## Database Configuration

### SQLite (Default)
- Automatically created in `storage/numel.db`
- No additional configuration needed

### PostgreSQL (Optional)
- Enabled by default in docker-compose.yml
- Connection string: `postgresql://numel:numel_password@postgres:5432/numel_db`
- Access pgAdmin at http://localhost:5050

### Switching Databases
Update your `config/config.json` or environment variables:

```json
{
  "memory_dbs": [{
    "type": "sqlite",
    "db_url": "/app/storage/memory.db"
  }]
}
```

## Environment Variables

Edit `.env` file for configuration:

```bash
# Database
DATABASE_URL=postgresql://numel:numel_password@postgres:5432/numel_db
SQLITE_PATH=/app/storage/numel.db

# API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Development
ENV=development
DEBUG=true
```

## Accessing the Application

- Main API: http://localhost:8000
- Agent endpoints: http://localhost:8001-8010
- pgAdmin: http://localhost:5050 (if enabled)

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Change ports in docker-compose.yml
ports:
  - "8080-8090:8000-8010"  # Use different host ports
```

### Permission Issues
```bash
# Fix storage permissions
sudo chown -R $USER:$USER storage/
chmod -R 755 storage/
```

### Dependency Issues
```bash
# Rebuild without cache
docker-compose build --no-cache
```

### View Logs
```bash
# All containers
make logs

# Specific container
docker-compose logs -f numel-app
```

## Production Deployment

For production, create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  numel-app:
    image: numel-ai:latest
    restart: always
    environment:
      - ENV=production
      - DEBUG=false
    # Remove volume mounts for source code
    # Keep only storage volumes
```

## Notes

1. **Live Editing**: The `src/` directory is mounted as a volume, so changes to Python files are immediately available in the container.

2. **Storage Persistence**: The `storage/` directory is mounted to persist data between container restarts.

3. **Multiple Agents**: The setup exposes ports 8000-8010 to support multiple agent instances.

4. **Network**: All services are on the same Docker network for inter-container communication.

5. **Security**: Remember to change default passwords and add proper authentication for production use.

## Support

For issues or questions about the Docker setup, check:
- Container logs: `make logs`
- Shell access: `make shell`
- Service status: `make status`