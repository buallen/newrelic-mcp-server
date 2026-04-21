#!/bin/bash

# Start New Relic MCP Server in Docker
# This script ensures the MCP server is always running in a container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting New Relic MCP Server in Docker..."

# Load environment variables
if [ -f ".env.mcp" ]; then
    export $(cat .env.mcp | grep -v '^#' | xargs)
    echo "✅ Loaded environment variables from .env.mcp"
fi

# Check if container already exists and is running
if docker ps -q --filter "name=newrelic-mcp-server" | grep -q .; then
    echo "⚡ Container already running. Restarting..."
    docker-compose -f docker-compose.mcp.yml restart
else
    # Check if container exists but is stopped
    if docker ps -aq --filter "name=newrelic-mcp-server" | grep -q .; then
        echo "🔄 Starting stopped container..."
        docker-compose -f docker-compose.mcp.yml start
    else
        echo "🔨 Building and starting new container..."
        docker-compose -f docker-compose.mcp.yml up -d --build
    fi
fi

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 3

# Check container status
if docker ps -q --filter "name=newrelic-mcp-server" | grep -q .; then
    echo "✅ New Relic MCP Server is running in Docker!"
    echo "📋 Container status:"
    docker ps --filter "name=newrelic-mcp-server" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    
    echo ""
    echo "🔧 To test the MCP server:"
    echo "  docker exec -it newrelic-mcp-server node working-mcp-main.js"
    echo ""
    echo "📊 To view logs:"
    echo "  docker logs newrelic-mcp-server"
    echo ""
    echo "🛑 To stop the server:"
    echo "  docker-compose -f docker-compose.mcp.yml down"
else
    echo "❌ Failed to start New Relic MCP Server!"
    exit 1
fi