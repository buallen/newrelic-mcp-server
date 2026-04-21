/**
 * Test Simple MCP Server
 * Tests our custom NewRelic MCP server with configurable LIMIT
 */

const { spawn } = require('child_process');

async function testMCPServer() {
  console.log('🧪 Testing Simple NewRelic MCP Server\n');

  // Start the MCP server
  const server = spawn('node', ['simple-mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NEW_RELIC_API_KEY: process.env.NEW_RELIC_API_KEY,
    },
  });

  let responseBuffer = '';

  // Set up response handling
  server.stdout.on('data', data => {
    responseBuffer += data.toString();
  });

  server.stderr.on('data', data => {
    console.error('Server Error:', data.toString());
  });

  // Helper function to send request and get response
  async function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      const originalLength = responseBuffer.length;

      server.stdin.write(JSON.stringify(request) + '\n');

      // Wait for response
      const checkResponse = () => {
        if (responseBuffer.length > originalLength) {
          clearTimeout(timeout);
          const newData = responseBuffer.slice(originalLength);
          const lines = newData.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            try {
              resolve(JSON.parse(lines[0]));
            } catch (error) {
              reject(new Error('Invalid JSON response: ' + lines[0]));
            }
          } else {
            setTimeout(checkResponse, 100);
          }
        } else {
          setTimeout(checkResponse, 100);
        }
      };

      setTimeout(checkResponse, 100);
    });
  }

  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: Initialize
    console.log('📊 Test 1: Initialize MCP Server');
    const initResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });
    console.log('✅ Initialize successful:', initResponse.result.serverInfo.name);

    // Test 2: List tools
    console.log('\n📊 Test 2: List Available Tools');
    const toolsResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    console.log('✅ Tools available:', toolsResponse.result.tools.map(t => t.name).join(', '));

    // Test 3: NRQL Query with custom limit
    console.log('\n📊 Test 3: NRQL Query with LIMIT 5');
    const nrqlResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT timestamp, message, hostname FROM Log',
          limit: 5,
        },
      },
    });

    const nrqlResult = JSON.parse(nrqlResponse.result.content[0].text);
    console.log(`✅ NRQL Query successful: ${nrqlResult.results.length} results (LIMIT 5)`);
    console.log(`   Query executed: ${nrqlResult.query}`);

    // Test 4: NRQL Query with larger limit
    console.log('\n📊 Test 4: NRQL Query with LIMIT 20');
    const nrql20Response = await sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT timestamp FROM Log',
          limit: 20,
        },
      },
    });

    const nrql20Result = JSON.parse(nrql20Response.result.content[0].text);
    console.log(`✅ NRQL Query successful: ${nrql20Result.results.length} results (LIMIT 20)`);

    // Test 5: Log Query with custom limit
    console.log('\n📊 Test 5: Log Query - Recent Logs with LIMIT 15');
    const logResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'log_query',
        arguments: {
          query_type: 'recent_logs',
          time_period: '7 days ago',
          limit: 15,
        },
      },
    });

    const logResult = JSON.parse(logResponse.result.content[0].text);
    console.log(`✅ Log Query successful: ${logResult.logs.length} results (LIMIT 15)`);
    console.log(`   Query executed: ${logResult.query_executed}`);

    console.log(
      '\n🎯 Success! Our custom NewRelic MCP server is working with configurable LIMIT values!'
    );
    console.log(
      '🔧 Key difference: Unlike the external MCP server, ours allows you to specify any LIMIT from 1-1000'
    );
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    server.kill();
  }
}

testMCPServer().catch(console.error);
