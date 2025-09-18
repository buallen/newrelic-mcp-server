# NewRelic MCP Server - Log Query Examples

This document provides examples of using the `log_query` tool to retrieve log data from NewRelic for the recent 7 days.

## Available Query Types

### 1. Recent Logs (`recent_logs`)
Retrieve the most recent log entries.

```json
{
  "query_type": "recent_logs",
  "time_period": "7 days ago",
  "limit": 100,
  "include_fields": ["timestamp", "message", "hostname", "level"]
}
```

**Generated NRQL:**
```sql
SELECT timestamp, message, hostname, level 
FROM Log 
SINCE 7 days ago 
ORDER BY timestamp DESC 
LIMIT 100
```

### 2. Error Logs (`error_logs`)
Filter logs by error levels (ERROR, CRITICAL, FATAL).

```json
{
  "query_type": "error_logs",
  "time_period": "3 days ago",
  "limit": 50,
  "log_level": "ERROR",
  "hostname": "specific-hostname"
}
```

**Generated NRQL:**
```sql
SELECT timestamp, message, hostname, level, apmApplicationNames 
FROM Log 
WHERE level = 'ERROR' AND hostname = 'specific-hostname'
SINCE 3 days ago 
ORDER BY timestamp DESC 
LIMIT 50
```

### 3. Application Logs (`application_logs`)
Retrieve logs from specific applications.

```json
{
  "query_type": "application_logs",
  "time_period": "1 day ago",
  "application_name": "StoreHub",
  "limit": 100
}
```

**Generated NRQL:**
```sql
SELECT timestamp, message, hostname, apmApplicationNames 
FROM Log 
WHERE apmApplicationNames IS NOT NULL 
AND apmApplicationNames LIKE '%StoreHub%'
SINCE 1 day ago 
ORDER BY timestamp DESC 
LIMIT 100
```

### 4. Infrastructure Logs (`infrastructure_logs`)
Retrieve infrastructure monitoring logs.

```json
{
  "query_type": "infrastructure_logs",
  "time_period": "6 hours ago",
  "hostname": "ip-10-2-0-198.ap-southeast-1.compute.internal",
  "limit": 50
}
```

**Generated NRQL:**
```sql
SELECT timestamp, message, hostname, agentName 
FROM Log 
WHERE agentName = 'Infrastructure' 
AND hostname = 'ip-10-2-0-198.ap-southeast-1.compute.internal'
SINCE 6 hours ago 
ORDER BY timestamp DESC 
LIMIT 50
```

### 5. Custom Query (`custom_query`)
Execute custom NRQL queries for advanced log analysis.

```json
{
  "query_type": "custom_query",
  "custom_nrql": "SELECT count(*) FROM Log FACET level SINCE 7 days ago"
}
```

## Common Log Analysis Patterns

### Log Volume by Level
```sql
SELECT count(*) FROM Log FACET level SINCE 7 days ago
```

### Log Volume by Hostname
```sql
SELECT count(*) FROM Log FACET hostname SINCE 7 days ago LIMIT 10
```

### Log Volume by Application
```sql
SELECT count(*) FROM Log 
WHERE apmApplicationNames IS NOT NULL 
FACET apmApplicationNames 
SINCE 7 days ago
```

### Recent Errors with Context
```sql
SELECT timestamp, message, hostname, apmApplicationNames, level
FROM Log 
WHERE level IN ('ERROR', 'CRITICAL', 'FATAL')
SINCE 24 hours ago 
ORDER BY timestamp DESC 
LIMIT 20
```

### Infrastructure Events Timeline
```sql
SELECT timestamp, message, hostname
FROM Log 
WHERE agentName = 'Infrastructure'
SINCE 1 day ago 
ORDER BY timestamp DESC 
LIMIT 50
```

### Application Performance Issues
```sql
SELECT timestamp, message, apmApplicationNames
FROM Log 
WHERE message LIKE '%performance%' 
OR message LIKE '%slow%'
OR message LIKE '%timeout%'
SINCE 7 days ago 
ORDER BY timestamp DESC 
LIMIT 30
```

## Available Event Data from Discovery

Based on the log discovery results, your NewRelic account contains:

- **663,474 Log events** in the last 7 days
- **240,579,728 Transaction events** 
- **507,711 TransactionError events**
- **1,037,264 PageView events**
- **17,839 JavaScriptError events**
- **167 SystemSample events**
- **38,433 ProcessSample events**
- **358 InfrastructureEvent events**

## Sample Log Entry Structure

```json
{
  "agentName": "Infrastructure",
  "agentVersion": "1.57.0",
  "apmApplicationIds": "|1054683071|",
  "apmApplicationNames": "|StoreHub SH Connector Service|",
  "awsAccountId": "860545148515",
  "awsAvailabilityZone": "ap-southeast-1a",
  "awsRegion": "ap-southeast-1",
  "hostname": "ip-10-2-0-198.ap-southeast-1.compute.internal",
  "timestamp": 1757574000000,
  "message": "Log message content...",
  "level": "INFO"
}
```

## Time Period Options

- `1 hour ago` - Recent logs from the last hour
- `6 hours ago` - Logs from the last 6 hours  
- `1 day ago` - Yesterday's logs
- `3 days ago` - Logs from the last 3 days
- `7 days ago` - Full week of log data (maximum retention shown)

## Field Options

Common fields you can include in `include_fields`:
- `timestamp` - Log timestamp
- `message` - Log message content
- `hostname` - Server hostname
- `level` - Log level (INFO, WARN, ERROR, etc.)
- `apmApplicationNames` - Associated application names
- `agentName` - Monitoring agent name
- `awsAccountId` - AWS account ID
- `awsRegion` - AWS region
- `awsAvailabilityZone` - AWS availability zone

## Usage with MCP Protocol

When using the NewRelic MCP server, call the `log_query` tool with your desired parameters:

```json
{
  "method": "tools/call",
  "params": {
    "name": "log_query",
    "arguments": {
      "query_type": "recent_logs",
      "time_period": "7 days ago",
      "limit": 100
    }
  }
}
```

The response will include:
- `query_executed` - The actual NRQL query that was run
- `result_count` - Number of log entries returned
- `logs` - Array of log entry objects
- `metadata` - Query metadata including event types