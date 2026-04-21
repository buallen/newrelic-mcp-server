# New Relic MCP Server - Docker Setup

## ✅ Setup Complete

The New Relic MCP Server is now running in Docker and configured for Claude Code.

### What was created:

1. **Dockerfile.simple** - Lightweight container for the MCP server
2. **docker-compose.mcp.yml** - Docker Compose configuration
3. **.env.mcp** - Environment variables
4. **start-mcp-docker.sh** - Startup script
5. **docker-mcp-wrapper.sh** - Claude Code integration script
6. **test-docker-mcp.sh** - Testing script

### Current Status:

```
Container: newrelic-mcp-server
Status: Running ✅
Image: newrelic-mcp-server-newrelic-mcp
Server: working-mcp-main.js
```

### Claude Code Configuration:

The Claude Code settings.json has been updated to use the Docker container:

```json
"newrelic": {
  "command": "/Users/kan.lu/.claude/mcp-servers/newrelic-mcp-server/docker-mcp-wrapper.sh",
  "args": [],
  "env": {
    "NEWRELIC_API_KEY": "your_newrelic_api_key_here",
    "NEWRELIC_ACCOUNT_ID": "464254"
  }
}
```

### Management Commands:

```bash
# Start the server
./start-mcp-docker.sh

# Test the server
./test-docker-mcp.sh

# Stop the server
docker-compose -f docker-compose.mcp.yml down

# View logs
docker logs newrelic-mcp-server

# Restart the server
docker-compose -f docker-compose.mcp.yml restart

# Rebuild and restart
docker-compose -f docker-compose.mcp.yml up -d --build
```

### How It Works:

1. **Container Auto-Start**: The `docker-mcp-wrapper.sh` script ensures the container is running before connecting
2. **Persistent Running**: Container runs with `restart: unless-stopped` policy
3. **MCP Protocol**: Uses stdio mode for direct communication with Claude Code
4. **Environment**: Uses production-ready configuration with proper logging

### Benefits:

- 🔄 **Auto-restart**: Container restarts automatically if it crashes
- 🔒 **Isolation**: Runs in isolated environment with proper user permissions
- 📊 **Logging**: Structured logging with log rotation
- ⚡ **Performance**: Always running, no startup delay
- 🛠 **Easy Management**: Simple scripts for all operations

### Next Steps:

1. Restart Claude Code to load the new configuration: `claude restart`
2. Test the New Relic MCP integration in Claude Code
3. The server will automatically start on system boot (if Docker is configured to start on boot)

### Troubleshooting:

If you encounter issues:

1. Check container status: `docker ps`
2. View container logs: `docker logs newrelic-mcp-server`
3. Test connectivity: `./test-docker-mcp.sh`
4. Restart container: `./start-mcp-docker.sh`

The server is now fully containerized and ready for production use!