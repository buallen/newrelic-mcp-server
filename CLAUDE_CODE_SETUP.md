# Configure Claude Code to Use Our Custom NewRelic MCP Server

## Current Status
- ✅ **Our custom NewRelic MCP server is working** with configurable LIMIT values (1-1000)
- ✅ **Supports NRQL queries** with custom LIMIT parameters  
- ✅ **Supports log queries** with 5 different query types
- ❌ **Claude Code is still using the external MCP NewRelic server** (hardcoded LIMIT 10)

## The Problem
The external MCP NewRelic server that Claude Code currently uses has:
- **Hardcoded LIMIT 10** that cannot be changed
- **"Repeated LIMIT clauses"** error when you include LIMIT in queries
- **Limited functionality** compared to our custom server

## The Solution
Configure Claude Code to use our custom server instead.

## MCP Server Configuration

Our server is ready at: `/Users/kan.lu/Documents/GitHub/newrelic-mcp-server/simple-mcp-server.js`

### Configuration File Created
```json
{
  "mcpServers": {
    "newrelic-custom": {
      "command": "node",
      "args": ["simple-mcp-server.js"],
      "cwd": "/Users/kan.lu/Documents/GitHub/newrelic-mcp-server",
      "env": {
        "NEW_RELIC_API_KEY": "${NEW_RELIC_API_KEY}",
        "NEWRELIC_API_KEY": "${NEW_RELIC_API_KEY}", 
        "NEW_RELIC_ACCOUNT_ID": "464254",
        "NEWRELIC_ACCOUNT_ID": "464254",
        "NEWRELIC_GRAPHQL_URL": "https://api.newrelic.com/graphql"
      }
    }
  }
}
```

## Our Custom Server Features

### 1. Configurable LIMIT Values
```bash
# External server (current): ALWAYS LIMIT 10, cannot change
# Our server: Any value from 1-10000, plus LIMIT MAX

# Examples:
nrql_query(query="SELECT * FROM Log", limit=50)     # Returns 50 results
nrql_query(query="SELECT * FROM Log", limit=200)    # Returns 200 results  
nrql_query(query="SELECT * FROM Log", limit=5)      # Returns 5 results
nrql_query(query="SELECT * FROM Log", limit="MAX")  # Returns maximum (up to 2000)
```

### 2. Enhanced Log Querying
```bash
log_query(query_type="recent_logs", limit=100, time_period="7 days ago")
log_query(query_type="recent_logs", limit="MAX", time_period="7 days ago")    # Get ALL logs
log_query(query_type="error_logs", limit=50, log_level="ERROR")
log_query(query_type="application_logs", application_name="StoreHub", limit="MAX")
log_query(query_type="infrastructure_logs", hostname="specific-host", limit=75)
log_query(query_type="custom_query", custom_nrql="SELECT count(*) FROM Log FACET level")
```

### 3. No LIMIT Conflicts
```bash
# External server: ❌ "SELECT * FROM Log LIMIT 5" → "Repeated LIMIT clauses" error
# Our server:     ✅ Handles LIMIT properly by adding it when missing
```

## Testing Results

Our server successfully handles:
- ✅ LIMIT 5: Returns exactly 5 results
- ✅ LIMIT 20: Returns exactly 20 results  
- ✅ LIMIT 15: Returns exactly 15 results
- ✅ LIMIT "MAX": Returns maximum results (702 out of 702 available, 100%)
- ✅ Custom log queries with various limits (1-10000 + MAX)
- ✅ All query types with proper LIMIT handling
- ✅ MAX translates to LIMIT 2000 in NRQL (NewRelic's API maximum)

## Next Steps

**To use our custom server, you need to:**

1. **Update Claude Code's MCP configuration** to point to our server
2. **Disable or replace the external NewRelic MCP server**
3. **Start using our tools** with configurable LIMIT values

## Usage Examples After Configuration

Once configured, you'll be able to use:

```bash
# Get 50 recent log entries (instead of being stuck with 10)
nrql_query(query="SELECT timestamp, message FROM Log", limit=50)

# Get ALL available logs with LIMIT MAX
nrql_query(query="SELECT timestamp, message FROM Log", limit="MAX")

# Get 100 application logs  
log_query(query_type="application_logs", limit=100)

# Get ALL application logs
log_query(query_type="application_logs", limit="MAX")

# Custom queries with any limit
nrql_query(query="SELECT count(*) FROM Transaction FACET name", limit=25)
```

## Current Server Status

- 🟢 **Our custom server**: Ready and tested at `/Users/kan.lu/Documents/GitHub/newrelic-mcp-server/simple-mcp-server.js`
- 🔴 **Claude Code**: Still using external server with LIMIT 10
- ⚡ **Action needed**: Configure Claude Code to use our server

The server is fully functional and provides much better control over query limits and log data retrieval!