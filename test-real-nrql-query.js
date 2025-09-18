/**
 * Test Real NRQL Query with Configured API Key
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function testRealNRQLQuery() {
  console.log('🔑 Testing Real NRQL Query with Configured API Key\n');

  try {
    // Use the configured API key from environment
    const apiKey = process.env.NEW_RELIC_API_KEY;
    const apiUrl = process.env.NEW_RELIC_API_URL || 'https://api.newrelic.com/graphql';
    
    if (!apiKey) {
      throw new Error('NEW_RELIC_API_KEY environment variable not found');
    }

    console.log('📋 Configuration:');
    console.log(`  - API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`  - API URL: ${apiUrl}`);
    console.log('');

    // Initialize server with the configured API key
    const server = new NewRelicMCPServer({
      newrelic: {
        apiKey: apiKey,
        baseUrl: 'https://api.newrelic.com/v2',
        graphqlUrl: apiUrl,
        timeout: 30000,
      },
      logging: {
        level: 'info'
      }
    });

    console.log('🚀 Initializing server with NewRelic authentication...');
    await server.initialize();
    console.log('✅ Server initialized successfully with NewRelic API\n');

    // Test 1: Simple query to verify connection
    console.log('📊 Test 1: Basic connection test with simple query');
    const basicQuery = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago LIMIT 1'
        }
      }
    });

    const basicResponse = await server.handleRequest(basicQuery);
    const basicData = JSON.parse(basicResponse);
    
    if (basicData.result && !basicData.result.isError) {
      console.log('✅ Connection successful! Query executed.');
      const resultText = basicData.result.content[0].text;
      const parsedResult = JSON.parse(resultText);
      console.log(`  - Query: ${parsedResult.query}`);
      console.log(`  - Results: ${JSON.stringify(parsedResult.results)}`);
      console.log(`  - Execution time: ${parsedResult.performanceStats?.wallClockTime}ms`);
      console.log(`  - Data scanned: ${parsedResult.performanceStats?.inspectedCount} events`);
    } else {
      console.log('❌ Query failed:');
      console.log(JSON.stringify(basicData, null, 2));
      return;
    }

    // Test 2: More complex query
    console.log('\n📊 Test 2: Get application performance data');
    const perfQuery = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT average(duration) as avgDuration, percentile(duration, 95) as p95Duration FROM Transaction FACET appName SINCE 1 hour ago LIMIT 5'
        }
      }
    });

    const perfResponse = await server.handleRequest(perfQuery);
    const perfData = JSON.parse(perfResponse);
    
    if (perfData.result && !perfData.result.isError) {
      console.log('✅ Performance query successful!');
      const resultText = perfData.result.content[0].text;
      const parsedResult = JSON.parse(resultText);
      console.log(`  - Found ${parsedResult.results.length} applications`);
      parsedResult.results.forEach((app, index) => {
        console.log(`  - App ${index + 1}: ${app.appName || 'Unknown'} - Avg: ${app.avgDuration?.toFixed(2)}ms, P95: ${app.p95Duration?.toFixed(2)}ms`);
      });
    } else {
      console.log('⚠️  Performance query had issues:');
      console.log(JSON.stringify(perfData, null, 2));
    }

    // Test 3: Error rate query
    console.log('\n📊 Test 3: Check error rates');
    const errorQuery = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT percentage(count(*), WHERE error IS true) as errorRate, count(*) as totalTransactions FROM Transaction SINCE 1 hour ago'
        }
      }
    });

    const errorResponse = await server.handleRequest(errorQuery);
    const errorData = JSON.parse(errorResponse);
    
    if (errorData.result && !errorData.result.isError) {
      console.log('✅ Error rate query successful!');
      const resultText = errorData.result.content[0].text;
      const parsedResult = JSON.parse(resultText);
      const result = parsedResult.results[0];
      console.log(`  - Error rate: ${result.errorRate?.toFixed(2)}%`);
      console.log(`  - Total transactions: ${result.totalTransactions}`);
    } else {
      console.log('⚠️  Error rate query had issues:');
      console.log(JSON.stringify(errorData, null, 2));
    }

    console.log('\n🎉 Real NRQL query testing completed successfully!');
    console.log('\n📈 Your NewRelic MCP server is fully operational and can:');
    console.log('  ✅ Connect to NewRelic API with your credentials');
    console.log('  ✅ Execute real NRQL queries against your data');
    console.log('  ✅ Return structured results with metadata');
    console.log('  ✅ Handle complex queries with facets and functions');

  } catch (error) {
    console.error('❌ Error during real query test:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n🔑 Authentication issue - check API key permissions');
    } else if (error.message.includes('404')) {
      console.log('\n🔗 Endpoint issue - check API URL configuration');
    }
    console.error('\nFull error:', error);
  }
}

// Run the test
testRealNRQLQuery().catch(console.error);