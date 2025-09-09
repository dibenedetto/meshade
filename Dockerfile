# Dockerfile
FROM python:3.13-slim

# Install system dependencies
# and upgrade system packages to latest versions for security
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    gcc \
    g++ \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --root-user-action=ignore --upgrade pip

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV PYTHONUNBUFFERED=1


# ENV PYTHONDONTWRITEBYTECODE=1
# ENV PYDEVD_DISABLE_FILE_VALIDATION=1
# ENV PYTHONPATH=/app/src:$PYTHONPATH

# Create directories for storage
# RUN mkdir -p /app/storage/knowledge /app/storage/memory /app/storage/session

# Expose ports for the main app and agents
# EXPOSE 8000-8010

# Default command (can be overridden in docker-compose)
# CMD ["python", "/app/src/launch.py", "--config_path", "/app/src/config.json"]
