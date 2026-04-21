# NewRelic MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for NewRelic integration, enabling AI agents (Claude Code, etc.) to query and analyze your NewRelic observability data.

## Features

- **NRQL Queries** — Execute NRQL with configurable LIMIT (1–10,000+), solving the hardcoded LIMIT 10 restriction in other MCP servers
- **Alert Management** — List and inspect alert policies
- **APM Integration** — Access application performance data
- **Incident Analysis** — AI-powered root cause analysis
- **Log Queries** — Search and analyze log data
- **MCP Protocol** — Supports versions `2024-11-05` and `2025-06-18`
- **Caching** — Built-in result caching for performance

## Installation

```bash
git clone https://github.com/buallen/newrelic-mcp-server.git
cd newrelic-mcp-server
npm install
npm run build
```

## Configuration

### Environment variables

```bash
NEWRELIC_API_KEY=your_api_key_here
NEWRELIC_ACCOUNT_ID=your_account_id
```

Create a `.env` file or pass them directly.

### Claude Code (stdio mode)

Add to your `~/.claude/settings.json`:

```json
"newrelic": {
  "command": "node",
  "args": ["/path/to/newrelic-mcp-server/working-mcp-main.js"],
  "env": {
    "NEWRELIC_API_KEY": "your_api_key_here",
    "NEWRELIC_ACCOUNT_ID": "your_account_id"
  }
}
```

### Docker (stdio mode)

```bash
# Build and start
docker compose -f docker-compose.mcp.yml up -d

# Or use the helper script
./start-mcp-docker.sh
```

See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for full Docker configuration.

## Usage Examples

### NRQL Query

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "nrql_query",
    "arguments": {
      "query": "SELECT average(duration) FROM Transaction WHERE appName = 'MyApp' SINCE 1 hour ago LIMIT 100"
    }
  }
}
```

### Analyze Incident

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "analyze_incident",
    "arguments": {
      "incidentId": "12345"
    }
  }
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agent      │    │  MCP Server     │    │   NewRelic      │
│  (Claude Code)  │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ MCP Client  │◄┼────┼►│ Protocol    │ │    │ │ REST API    │ │
│ └─────────────┘ │    │ │ Handler     │ │    │ └─────────────┘ │
│                 │    │ └─────────────┘ │    │                 │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│                 │    │ │ Service     │◄┼────┼►│ NerdGraph   │ │
│                 │    │ │ Layer       │ │    │ │ (GraphQL)   │ │
│                 │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- NewRelic account and API key

### Setup

```bash
git clone https://github.com/buallen/newrelic-mcp-server.git
cd newrelic-mcp-server
npm install
cp .env.example .env   # then edit with your credentials
npm run dev
```

### Testing

```bash
npm test                        # run all tests
npm run test:coverage           # with coverage report
npm run test -- tests/unit/     # unit tests only
```

### Building

```bash
npm run build   # compile TypeScript to dist/
npm start       # run production build
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Push and open a Pull Request

## License

MIT — see [LICENSE](LICENSE) for details.

## Links

- [Issue Tracker](https://github.com/buallen/newrelic-mcp-server/issues)
- [Docker Setup](./DOCKER_SETUP.md)
- [Claude Code Setup](./CLAUDE_CODE_SETUP.md)
