# API Reference

This document provides detailed information about the NewRelic MCP Server API.

## MCP Protocol Implementation

The server implements the Model Context Protocol (MCP) 1.0 specification.

### Initialization

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {}
    },
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

### Available Tools

#### NRQL Query Tool

Execute NRQL queries against NewRelic data.

**Method**: `nrql_query`

**Parameters**:
- `query` (string, required): The NRQL query to execute
- `accountId` (string, optional): NewRelic account ID
- `timeout` (number, optional): Query timeout in milliseconds
- `limit` (number, optional): Maximum number of results

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "nrql_query",
    "arguments": {
      "query": "SELECT average(duration) FROM Transaction WHERE appName = 'MyApp' SINCE 1 hour ago",
      "limit": 100
    }
  }
}
```

#### Alert Policy Management

Create and manage alert policies.

**Method**: `create_alert_policy`

**Parameters**:
- `name` (string, required): Policy name
- `incident_preference` (string, required): How incidents are created

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_alert_policy",
    "arguments": {
      "name": "High Error Rate Policy",
      "incident_preference": "PER_CONDITION"
    }
  }
}
```

#### Incident Analysis

Analyze incidents for root cause and recommendations.

**Method**: `analyze_incident`

**Parameters**:
- `incidentId` (string, required): The incident ID to analyze

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "analyze_incident",
    "arguments": {
      "incidentId": "12345"
    }
  }
}
```

### Resources

The server provides access to NewRelic data through MCP resources.

#### Application Metrics

**URI**: `newrelic://applications/{appId}/metrics`

Provides real-time metrics for a specific application.

#### Alert Policies

**URI**: `newrelic://alerts/policies`

Lists all alert policies in the account.

#### Incidents

**URI**: `newrelic://incidents/{incidentId}`

Provides detailed information about a specific incident.

## Error Handling

The server returns standard MCP error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Authentication failed",
    "data": {
      "type": "AUTHENTICATION_ERROR",
      "details": "Invalid API key provided",
      "retryable": false
    }
  }
}
```

### Error Codes

- `-32000`: Server error (authentication, authorization, etc.)
- `-32001`: Rate limit exceeded
- `-32002`: Invalid query syntax
- `-32003`: Resource not found
- `-32004`: Network error
- `-32005`: Validation error

## Rate Limiting

The server implements rate limiting to respect NewRelic API limits:

- Default: 60 requests per minute
- Configurable via `RATE_LIMIT_PER_MINUTE` environment variable
- Rate limit headers included in responses

## Authentication

All requests require a valid NewRelic API key:

```bash
NEWRELIC_API_KEY=your_api_key_here
```

The server validates the API key on startup and periodically checks permissions.

## Caching

Query results are cached to improve performance:

- Default TTL: 5 minutes
- Configurable cache backend (memory or Redis)
- Cache keys include query hash and account ID

## Monitoring

The server exposes metrics for monitoring:

- Request count and duration
- Error rates by type
- Cache hit rates
- NewRelic API latency

Metrics are available at `/metrics` endpoint in Prometheus format.