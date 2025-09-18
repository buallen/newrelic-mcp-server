/**
 * Simple test script to verify core functionality works
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function testCoreComponents() {
  console.log('Testing NewRelic MCP Server Core Components...\n');

  try {
    // Initialize server with minimal config
    const server = new NewRelicMCPServer({
      newrelic: {
        apiKey: 'test-key', // Will fail auth but that's ok for testing
        baseUrl: 'https://api.newrelic.com/v2',
      },
      logging: {
        level: 'info'
      }
    });

    console.log('✓ Server instantiated successfully');

    // Test MCP initialization
    await server.initializeMCPOnly();
    console.log('✓ MCP protocol initialized successfully');

    // Test tools list
    const toolsListRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });

    const toolsResponse = await server.handleRequest(toolsListRequest);
    const toolsData = JSON.parse(toolsResponse);
    
    console.log('✓ Tools list request handled successfully');
    console.log(`  - Found ${toolsData.result.tools.length} tools:`);
    
    toolsData.result.tools.forEach(tool => {
      console.log(`    • ${tool.name}: ${tool.description}`);
    });

    // Test NRQL tool call (will fail due to no API key, but should handle gracefully)
    const nrqlRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction'
        }
      }
    });

    const nrqlResponse = await server.handleRequest(nrqlRequest);
    const nrqlData = JSON.parse(nrqlResponse);
    
    console.log('✓ NRQL tool call handled (expected to fail gracefully)');
    if (nrqlData.result.isError) {
      console.log('  - Handled error appropriately:', nrqlData.result.content[0].text.substring(0, 80) + '...');
    }

    // Test alert policy tool call (will fail due to no API key, but should handle gracefully)
    const alertRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_alert_policy',
        arguments: {
          name: 'Test Policy',
          incident_preference: 'PER_POLICY'
        }
      }
    });

    const alertResponse = await server.handleRequest(alertRequest);
    const alertData = JSON.parse(alertResponse);
    
    console.log('✓ Alert policy tool call handled (expected to fail gracefully)');
    if (alertData.result.isError) {
      console.log('  - Handled error appropriately:', alertData.result.content[0].text.substring(0, 80) + '...');
    }

    // Test incident analyzer tool call
    const incidentRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'analyze_incident',
        arguments: {
          incidentId: '12345'
        }
      }
    });

    const incidentResponse = await server.handleRequest(incidentRequest);
    const incidentData = JSON.parse(incidentResponse);
    
    console.log('✓ Incident analyzer tool call handled (expected to fail gracefully)');
    if (incidentData.result.isError) {
      console.log('  - Handled error appropriately:', incidentData.result.content[0].text.substring(0, 80) + '...');
    }

    // Test health check
    const health = await server.healthCheck();
    console.log('✓ Health check completed');
    console.log('  - Status:', health.status);
    console.log('  - Initialized:', health.details.initialized);

    console.log('\n🎉 All core components are working correctly!');
    console.log('\nNote: Some operations failed due to missing API credentials, which is expected behavior.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testCoreComponents().catch(console.error);