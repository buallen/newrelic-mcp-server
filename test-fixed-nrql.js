/**
 * Test NRQL with Fixed GraphQL Endpoint
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function testFixedNRQLQuery() {
  console.log('🔧 Testing NRQL with Fixed GraphQL Endpoint\n');

  try {
    const apiKey = process.env.NEW_RELIC_API_KEY;
    const apiUrl = process.env.NEW_RELIC_API_URL || 'https://api.newrelic.com/graphql';
    
    console.log('🔍 Issue identified:');
    console.log('  - GraphQL endpoint was being constructed incorrectly');
    console.log('  - Base URL: https://api.newrelic.com/v2');
    console.log('  - Relative path: /graphql');
    console.log('  - Result: https://api.newrelic.com/v2/graphql (❌ WRONG!)');
    console.log('  - Should be: https://api.newrelic.com/graphql (✅ CORRECT)');
    console.log('');

    // Initialize server with corrected base URL for GraphQL
    const server = new NewRelicMCPServer({
      newrelic: {
        apiKey: apiKey,
        baseUrl: 'https://api.newrelic.com', // Fixed: removed /v2 for GraphQL
        graphqlUrl: apiUrl,
        defaultAccountId: '464254', // StoreHub account
        timeout: 30000,
      },
      logging: {
        level: 'info'
      }
    });

    await server.initializeMCPOnly();
    console.log('✅ MCP server initialized with fixed configuration\n');

    // Test simple NRQL query
    console.log('📊 Test: Simple NRQL query with fixed endpoint');
    const query = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction',
          accountId: '464254'
        }
      }
    });

    console.log('  - Query: SELECT count(*) FROM Transaction');
    console.log('  - Account: 464254 (StoreHub)');
    const response = await server.handleRequest(query);
    const data = JSON.parse(response);
    
    if (data.result && !data.result.isError) {
      console.log('🎉 SUCCESS! NRQL query executed successfully!');
      try {
        const resultText = data.result.content[0].text;
        const parsedResult = JSON.parse(resultText);
        
        console.log('📊 Query Results:');
        console.log(`  - Query executed: ${parsedResult.query}`);
        console.log(`  - Results count: ${parsedResult.results.length}`);
        if (parsedResult.results.length > 0) {
          console.log(`  - Data: ${JSON.stringify(parsedResult.results[0])}`);
        }
        if (parsedResult.performanceStats) {
          console.log(`  - Execution time: ${parsedResult.performanceStats.wallClockTime}ms`);
          console.log(`  - Events inspected: ${parsedResult.performanceStats.inspectedCount}`);
        }
        
        // Test another query if first one worked
        console.log('\n📊 Test 2: Query with time range');
        const query2 = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'nrql_query',
            arguments: {
              query: 'SELECT count(*) FROM Transaction SINCE 1 day ago',
              accountId: '464254'
            }
          }
        });

        const response2 = await server.handleRequest(query2);
        const data2 = JSON.parse(response2);
        
        if (data2.result && !data2.result.isError) {
          console.log('✅ Time range query also successful!');
          const resultText2 = data2.result.content[0].text;
          const parsedResult2 = JSON.parse(resultText2);
          console.log(`  - Transactions in last day: ${JSON.stringify(parsedResult2.results[0])}`);
        } else {
          console.log('⚠️  Time range query failed:');
          console.log(`  - Error: ${data2.result?.content[0]?.text || data2.error?.message}`);
        }
        
      } catch (parseError) {
        console.log('✅ Query successful but result parsing failed:');
        console.log(`  - Raw result: ${data.result.content[0].text}`);
      }
    } else {
      console.log('❌ Query still failing:');
      if (data.result && data.result.isError) {
        console.log(`  - Error: ${data.result.content[0].text}`);
      } else if (data.error) {
        console.log(`  - MCP Error: ${data.error.message}`);
      }
    }

    // Test direct GraphQL call with corrected endpoint
    console.log('\n🔍 Testing direct GraphQL call with corrected endpoint...');
    try {
      const axios = require('axios');
      
      const graphqlQuery = `
        query($accountId: Int!, $nrql: Nrql!) {
          actor {
            account(id: $accountId) {
              nrql(query: $nrql) {
                results
              }
            }
          }
        }
      `;
      
      const variables = {
        accountId: 464254,
        nrql: 'SELECT count(*) FROM Transaction'
      };
      
      const directResponse = await axios.post('https://api.newrelic.com/graphql', {
        query: graphqlQuery,
        variables: variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': apiKey
        },
        timeout: 10000
      });
      
      console.log('✅ Direct GraphQL call successful!');
      console.log(`  - Results: ${JSON.stringify(directResponse.data.data?.actor?.account?.nrql?.results)}`);
      
    } catch (directError) {
      console.log('❌ Direct GraphQL call failed:');
      console.log(`  - Status: ${directError.response?.status}`);
      console.log(`  - Error: ${directError.response?.data?.errors?.[0]?.message || directError.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testFixedNRQLQuery().catch(console.error);