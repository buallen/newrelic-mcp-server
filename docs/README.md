# NewRelic MCP Server

A Model Context Protocol (MCP) server implementation for NewRelic integration, enabling AI agents to interact with NewRelic's monitoring and observability platform.

## Overview

The NewRelic MCP Server provides a standardized interface for AI agents to:

- Execute NRQL queries and retrieve performance data
- Manage alert policies and conditions
- Analyze incidents and perform root cause analysis
- Access APM data and application metrics
- Perform intelligent troubleshooting and recommendations

## Features

- **MCP Protocol Compliance**: Full implementation of MCP 1.0 specification
- **NewRelic API Integration**: Support for REST API, GraphQL, and NerdGraph
- **Intelligent Analysis**: AI-powered incident analysis and root cause detection
- **Caching**: Configurable caching for improved performance
- **Security**: API key management and secure data handling
- **Monitoring**: Built-in metrics and health checks
- **Scalability**: Docker and Kubernetes deployment support

## Quick Start

### Prerequisites

- Node.js 18+ 
- NewRelic account with API access
- NewRelic API key

### Installation

```bash
npm install newrelic-mcp-server
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure your NewRelic API key:
```bash
NEWRELIC_API_KEY=your_api_key_here
NEWRELIC_ACCOUNT_ID=your_account_id
```

### Usage

```typescript
import { NewRelicMCPServer } from 'newrelic-mcp-server';

const server = new NewRelicMCPServer();
await server.start();
```

## Architecture

The server is built with a modular architecture:

- **Protocol Layer**: MCP protocol handling and message routing
- **Service Layer**: Business logic for NewRelic operations
- **Client Layer**: NewRelic API integration
- **Data Layer**: Caching and data management
- **Utility Layer**: Logging, error handling, and metrics

## API Reference

### MCP Tools

The server provides the following MCP tools:

#### Query Tools
- `nrql_query`: Execute NRQL queries
- `validate_query`: Validate NRQL syntax
- `get_metrics`: Retrieve available metrics

#### Alert Management
- `create_alert_policy`: Create new alert policies
- `update_alert_condition`: Modify alert conditions
- `list_alerts`: Get current alerts

#### Incident Analysis
- `analyze_incident`: Perform incident analysis
- `root_cause_analysis`: Find root causes
- `get_recommendations`: Get remediation suggestions

#### APM Data
- `get_applications`: List monitored applications
- `get_app_metrics`: Retrieve application metrics
- `get_transaction_traces`: Get transaction traces

### Configuration Options

See [Configuration Guide](./configuration.md) for detailed configuration options.

## Development

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Deployment

### Docker

```bash
docker build -t newrelic-mcp-server .
docker run -p 3000:3000 --env-file .env newrelic-mcp-server
```

### Kubernetes

See [Kubernetes Deployment Guide](./deployment/kubernetes.md) for detailed instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Support

- [Documentation](./api.md)
- [Examples](./examples/)
- [Troubleshooting](./troubleshooting.md)
- [GitHub Issues](https://github.com/your-org/newrelic-mcp-server/issues)