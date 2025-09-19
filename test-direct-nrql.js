/**
 * Test NRQL Query Directly with GraphQL API
 * Bypasses REST API authentication and uses GraphQL directly
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function testDirectNRQLQuery() {
  console.log('🔑 Testing Direct NRQL Query via GraphQL\n');

  try {
    const apiKey = process.env.NEW_RELIC_API_KEY;
    const apiUrl = process.env.NEW_RELIC_API_URL || 'https://api.newrelic.com/graphql';

    if (!apiKey) {
      throw new Error('NEW_RELIC_API_KEY environment variable not found');
    }

    console.log('📋 Configuration:');
    console.log(`  - API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`  - GraphQL URL: ${apiUrl}`);
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
        level: 'info',
      },
    });

    console.log('🚀 Initializing MCP-only (skip REST API auth)...');
    // Use initializeMCPOnly to bypass REST API authentication
    await server.initializeMCPOnly();
    console.log('✅ MCP server initialized\n');

    // Test direct NRQL query via the MCP tool
    console.log('📊 Test: Executing NRQL query via GraphQL');
    const nrqlQuery = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago LIMIT 1',
        },
      },
    });

    console.log('  - Executing query: SELECT count(*) FROM Transaction SINCE 1 hour ago LIMIT 1');
    const response = await server.handleRequest(nrqlQuery);
    const data = JSON.parse(response);

    console.log('\n📋 Response Analysis:');
    if (data.result) {
      if (data.result.isError) {
        console.log('❌ Query returned error:');
        console.log(`  - Error: ${data.result.content[0].text}`);

        // Check if it's an authentication error
        if (
          data.result.content[0].text.includes('401') ||
          data.result.content[0].text.includes('403')
        ) {
          console.log('\n🔍 This appears to be an authentication issue.');
          console.log('  - The API key might not have the correct permissions');
          console.log('  - Or the API key format might be incorrect');
        } else if (data.result.content[0].text.includes('404')) {
          console.log('\n🔍 This appears to be an endpoint issue.');
          console.log('  - The GraphQL endpoint might be incorrect');
          console.log('  - Or the account might not have data');
        }
      } else {
        console.log('✅ Query executed successfully!');
        const resultText = data.result.content[0].text;
        const parsedResult = JSON.parse(resultText);

        console.log('📊 Query Results:');
        console.log(`  - Query: ${parsedResult.query}`);
        console.log(`  - Results: ${JSON.stringify(parsedResult.results, null, 2)}`);
        console.log(`  - Execution time: ${parsedResult.performanceStats?.wallClockTime}ms`);
        console.log(`  - Data scanned: ${parsedResult.performanceStats?.inspectedCount} events`);

        console.log('\n🎉 SUCCESS! Your NewRelic MCP server can execute real NRQL queries!');
      }
    } else if (data.error) {
      console.log('❌ MCP Protocol Error:');
      console.log(`  - Code: ${data.error.code}`);
      console.log(`  - Message: ${data.error.message}`);
    }

    // Let's also test the raw GraphQL call to understand what's happening
    console.log('\n🔍 Testing raw GraphQL authentication...');

    try {
      const axios = require('axios');
      const graphqlResponse = await axios.post(
        apiUrl,
        {
          query: `
          query {
            actor {
              accounts {
                id
                name
              }
            }
          }
        `,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
          },
          timeout: 10000,
        }
      );

      console.log('✅ Raw GraphQL authentication successful!');
      console.log(`  - Found ${graphqlResponse.data.data?.actor?.accounts?.length || 0} accounts`);

      if (graphqlResponse.data.data?.actor?.accounts?.length > 0) {
        console.log('  - Account info:');
        graphqlResponse.data.data.actor.accounts.forEach((account, index) => {
          console.log(`    ${index + 1}. ${account.name} (ID: ${account.id})`);
        });
      }
    } catch (graphqlError) {
      console.log('❌ Raw GraphQL authentication failed:');
      console.log(`  - Status: ${graphqlError.response?.status}`);
      console.log(
        `  - Error: ${graphqlError.response?.data?.errors?.[0]?.message || graphqlError.message}`
      );
    }
  } catch (error) {
    console.error('❌ Error during direct query test:', error.message);
    console.error('\nFull error:', error);
  }
}

// Run the test
testDirectNRQLQuery().catch(console.error);
