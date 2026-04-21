/**
 * Test Working NRQL Queries with Correct Syntax
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function testWorkingNRQLQueries() {
  console.log('🚀 Testing Working NRQL Queries with Correct Syntax\n');

  try {
    const apiKey = process.env.NEW_RELIC_API_KEY;
    const apiUrl = process.env.NEW_RELIC_API_URL || 'https://api.newrelic.com/graphql';

    console.log('📋 Accounts found: StoreHub (464254), Storage Account (4857544)\n');

    // Initialize server
    const server = new NewRelicMCPServer({
      newrelic: {
        apiKey: apiKey,
        baseUrl: 'https://api.newrelic.com/v2',
        graphqlUrl: apiUrl,
        defaultAccountId: '464254', // Use StoreHub account
        timeout: 30000,
      },
      logging: {
        level: 'info',
      },
    });

    await server.initializeMCPOnly();
    console.log('✅ MCP server initialized\n');

    // Test 1: Simple count query with correct syntax
    console.log('📊 Test 1: Simple transaction count');
    const query1 = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction',
          accountId: '464254',
        },
      },
    });

    console.log('  - Query: SELECT count(*) FROM Transaction');
    const response1 = await server.handleRequest(query1);
    const data1 = JSON.parse(response1);
    await displayResult('Test 1', data1);

    // Test 2: Query with SINCE clause (correct position)
    console.log('\n📊 Test 2: Transactions in last hour (corrected syntax)');
    const query2 = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago',
          accountId: '464254',
        },
      },
    });

    console.log('  - Query: SELECT count(*) FROM Transaction SINCE 1 hour ago');
    const response2 = await server.handleRequest(query2);
    const data2 = JSON.parse(response2);
    await displayResult('Test 2', data2);

    // Test 3: Application performance query
    console.log('\n📊 Test 3: Application performance metrics');
    const query3 = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query:
            'SELECT average(duration), count(*) FROM Transaction FACET appName SINCE 1 day ago LIMIT 5',
          accountId: '464254',
        },
      },
    });

    console.log(
      '  - Query: SELECT average(duration), count(*) FROM Transaction FACET appName SINCE 1 day ago LIMIT 5'
    );
    const response3 = await server.handleRequest(query3);
    const data3 = JSON.parse(response3);
    await displayResult('Test 3', data3);

    // Test 4: Infrastructure data (if available)
    console.log('\n📊 Test 4: Check for available event types');
    const query4 = JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SHOW EVENT TYPES',
          accountId: '464254',
        },
      },
    });

    console.log('  - Query: SHOW EVENT TYPES');
    const response4 = await server.handleRequest(query4);
    const data4 = JSON.parse(response4);
    await displayResult('Test 4', data4);

    // Test 5: Try the Storage Account
    console.log('\n📊 Test 5: Query Storage Account');
    const query5 = JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction',
          accountId: '4857544',
        },
      },
    });

    console.log('  - Query: SELECT count(*) FROM Transaction (Storage Account)');
    const response5 = await server.handleRequest(query5);
    const data5 = JSON.parse(response5);
    await displayResult('Test 5', data5);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function displayResult(testName, data) {
  if (data.result && !data.result.isError) {
    console.log(`✅ ${testName} SUCCESS!`);
    try {
      const resultText = data.result.content[0].text;
      const parsedResult = JSON.parse(resultText);

      console.log(`  - Results: ${parsedResult.results.length} rows`);
      if (parsedResult.results.length > 0) {
        console.log(`  - Sample: ${JSON.stringify(parsedResult.results[0])}`);
      }
      if (parsedResult.performanceStats) {
        console.log(`  - Execution: ${parsedResult.performanceStats.wallClockTime}ms`);
        console.log(`  - Data scanned: ${parsedResult.performanceStats.inspectedCount} events`);
      }
    } catch (parseError) {
      console.log(`  - Raw result: ${data.result.content[0].text}`);
    }
  } else {
    console.log(`❌ ${testName} FAILED`);
    if (data.result && data.result.isError) {
      console.log(`  - Error: ${data.result.content[0].text}`);
    } else if (data.error) {
      console.log(`  - Error: ${data.error.message}`);
    }
  }
}

// Run the test
testWorkingNRQLQueries().catch(console.error);
