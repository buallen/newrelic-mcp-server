# NewRelic MCP Server

A Model Context Protocol (MCP) server for NewRelic integration, enabling AI agents to interact with NewRelic's monitoring and observability platform.

## ✅ Production Ready - Configurable LIMIT Support

This MCP server provides **configurable LIMIT values** (1-10,000 + MAX) for NewRelic queries, solving the external MCP server's hardcoded LIMIT 10 restriction.

## Features

- 🔌 **MCP Protocol Compliance**: Full MCP 1.0 specification support
- 🔍 **NRQL Queries**: Execute and validate NRQL queries
- 🚨 **Alert Management**: Create, update, and manage alert policies
- 📊 **APM Integration**: Access application performance data
- 🔧 **Incident Analysis**: AI-powered root cause analysis
- ⚡ **High Performance**: Built-in caching and connection pooling
- 🔒 **Secure**: API key management and data protection
- 📈 **Observable**: Built-in metrics and health checks

## Quick Start

### Installation

```bash
npm install newrelic-mcp-server
```

### Configuration

1. Set up your environment variables:

```bash
# Required
NEWRELIC_API_KEY=your_api_key_here
NEWRELIC_ACCOUNT_ID=your_account_id

# Optional
MCP_SERVER_PORT=3000
CACHE_TYPE=memory
LOG_LEVEL=info
```

2. Start the server:

```typescript
import { NewRelicMCPServer } from 'newrelic-mcp-server';

const server = new NewRelicMCPServer();
await server.start();
```

### Docker

```bash
docker run -p 3000:3000 \
  -e NEWRELIC_API_KEY=your_key \
  -e NEWRELIC_ACCOUNT_ID=your_account \
  newrelic-mcp-server
```

## Usage Examples

### Execute NRQL Query

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "nrql_query",
    "arguments": {
      "query": "SELECT average(duration) FROM Transaction WHERE appName = 'MyApp' SINCE 1 hour ago"
    }
  }
}
```

### Create Alert Policy

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "create_alert_policy",
    "arguments": {
      "name": "High Error Rate",
      "incident_preference": "PER_CONDITION"
    }
  }
}
```

### Analyze Incident

```json
{
  "jsonrpc": "2.0",
  "id": 3,
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
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ MCP Client  │◄┼────┼►│ Protocol    │ │    │ │ REST API    │ │
│ └─────────────┘ │    │ │ Handler     │ │    │ └─────────────┘ │
│                 │    │ └─────────────┘ │    │                 │
│                 │    │        │        │    │ ┌─────────────┐ │
│                 │    │ ┌─────────────┐ │    │ │ GraphQL     │ │
│                 │    │ │ Service     │◄┼────┼►│ NerdGraph   │ │
│                 │    │ │ Layer       │ │    │ └─────────────┘ │
│                 │    │ └─────────────┘ │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- NewRelic account and API key
- Optional: Redis for caching

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/newrelic-mcp-server.git
cd newrelic-mcp-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your NewRelic credentials
# Start development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test -- tests/unit/
```

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Configuration

See [Configuration Guide](./docs/configuration.md) for detailed configuration options.

## API Reference

See [API Documentation](./docs/api.md) for complete API reference.

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes

See [Kubernetes deployment examples](./docs/deployment/) for production deployment.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/your-org/newrelic-mcp-server/issues)
- 💬 [Discussions](https://github.com/your-org/newrelic-mcp-server/discussions)
- 📧 [Email Support](mailto:support@example.com)
