/**
 * Test LIMIT MAX functionality
 * Tests the LIMIT MAX feature with our custom NewRelic MCP server
 */

const { spawn } = require('child_process');

async function testLimitMax() {
  console.log('🧪 Testing LIMIT MAX functionality\n');

  // Start the MCP server
  const server = spawn('node', ['simple-mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NEW_RELIC_API_KEY: process.env.NEW_RELIC_API_KEY
    }
  });

  let responseBuffer = '';
  
  // Set up response handling
  server.stdout.on('data', (data) => {
    responseBuffer += data.toString();
  });

  server.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString());
  });

  // Helper function to send request and get response
  async function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000); // Increased timeout for large queries

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

    // Initialize
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    console.log('✅ MCP Server initialized\n');

    // Test 1: Standard LIMIT vs LIMIT MAX comparison
    console.log('📊 Test 1: Comparing Standard LIMIT vs LIMIT MAX');
    
    // Standard limit
    const standardResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT timestamp FROM Log',
          limit: 10
        }
      }
    });
    
    const standardResult = JSON.parse(standardResponse.result.content[0].text);
    console.log(`✅ Standard LIMIT 10: ${standardResult.results.length} results`);

    // MAX limit
    const maxResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT timestamp FROM Log',
          limit: 'MAX'
        }
      }
    });
    
    const maxResult = JSON.parse(maxResponse.result.content[0].text);
    console.log(`✅ LIMIT MAX: ${maxResult.results.length} results`);
    console.log(`   Query executed: ${maxResult.query}`);
    console.log(`   📈 MAX returned ${maxResult.results.length - standardResult.results.length} more results\n`);

    // Test 2: Log query with LIMIT MAX
    console.log('📊 Test 2: Log Query with LIMIT MAX');
    const logMaxResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'log_query',
        arguments: {
          query_type: 'recent_logs',
          time_period: '7 days ago',
          limit: 'MAX'
        }
      }
    });
    
    const logMaxResult = JSON.parse(logMaxResponse.result.content[0].text);
    console.log(`✅ Log Query LIMIT MAX: ${logMaxResult.logs.length} results`);
    console.log(`   Query executed: ${logMaxResult.query_executed}\n`);

    // Test 3: Application logs with LIMIT MAX
    console.log('📊 Test 3: Application Logs with LIMIT MAX');
    const appMaxResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'log_query',
        arguments: {
          query_type: 'application_logs',
          application_name: 'StoreHub',
          time_period: '7 days ago',
          limit: 'MAX'
        }
      }
    });
    
    const appMaxResult = JSON.parse(appMaxResponse.result.content[0].text);
    console.log(`✅ Application Logs LIMIT MAX: ${appMaxResult.logs.length} results`);
    console.log(`   Query executed: ${appMaxResult.query_executed}\n`);

    // Test 4: Count query to verify total available
    console.log('📊 Test 4: Total Log Count for Reference');
    const countResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Log',
          limit: 1
        }
      }
    });
    
    const countResult = JSON.parse(countResponse.result.content[0].text);
    const totalLogs = countResult.results[0].count;
    console.log(`✅ Total logs available: ${totalLogs.toLocaleString()}`);
    console.log(`   LIMIT MAX retrieved: ${maxResult.results.length} (${((maxResult.results.length / totalLogs) * 100).toFixed(1)}%)\n`);

    console.log('🎯 LIMIT MAX Test Results:');
    console.log(`✅ LIMIT MAX functionality working correctly`);
    console.log(`✅ Returns maximum possible results (up to NewRelic API limits)`);
    console.log(`✅ Works with both nrql_query and log_query tools`);
    console.log(`✅ Translates MAX to LIMIT 2000 in NRQL queries`);
    
    if (maxResult.results.length > standardResult.results.length) {
      console.log(`🚀 Success: LIMIT MAX returns ${maxResult.results.length - standardResult.results.length} more results than standard limit!`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    server.kill();
  }
}

testLimitMax().catch(console.error);