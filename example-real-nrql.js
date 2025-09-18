/**
 * Real NRQL Query Example
 * Replace 'YOUR_API_KEY_HERE' with your actual NewRelic API key
 */

const { NewRelicMCPServer } = require('./dist/server.js');

async function executeRealNRQLQueries() {
  console.log('🚀 Executing Real NRQL Queries\n');

  // Initialize server with your API key
  const server = new NewRelicMCPServer({
    newrelic: {
      apiKey: process.env.NEWRELIC_API_KEY || 'YOUR_API_KEY_HERE', // Replace with your key
      baseUrl: 'https://api.newrelic.com/v2',
      graphqlUrl: 'https://api.newrelic.com/graphql',
      defaultAccountId: process.env.NEWRELIC_ACCOUNT_ID, // Optional: your account ID
    },
    logging: {
      level: 'info'
    }
  });

  try {
    // Initialize with full authentication
    await server.initialize();
    console.log('✅ Server initialized with NewRelic authentication\n');

    // Example 1: Get transaction count for the last hour
    console.log('📊 Query 1: Transaction count in last hour');
    const query1 = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago',
          limit: 1
        }
      }
    });

    const response1 = await server.handleRequest(query1);
    const data1 = JSON.parse(response1);
    console.log('Result:', JSON.stringify(data1.result, null, 2));

    // Example 2: Get average response time by application
    console.log('\n📊 Query 2: Average response time by application');
    const query2 = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT average(duration) FROM Transaction FACET appName SINCE 1 hour ago LIMIT 10',
          limit: 10
        }
      }
    });

    const response2 = await server.handleRequest(query2);
    const data2 = JSON.parse(response2);
    console.log('Result:', JSON.stringify(data2.result, null, 2));

    // Example 3: Get error rate
    console.log('\n📊 Query 3: Error rate in last hour');
    const query3 = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT percentage(count(*), WHERE error IS true) as errorRate FROM Transaction SINCE 1 hour ago',
          limit: 1
        }
      }
    });

    const response3 = await server.handleRequest(query3);
    const data3 = JSON.parse(response3);
    console.log('Result:', JSON.stringify(data3.result, null, 2));

    // Example 4: Time series data
    console.log('\n📊 Query 4: Response time over time');
    const query4 = JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT average(duration) FROM Transaction SINCE 1 hour ago TIMESERIES 5 minutes',
          limit: 20
        }
      }
    });

    const response4 = await server.handleRequest(query4);
    const data4 = JSON.parse(response4);
    console.log('Result:', JSON.stringify(data4.result, null, 2));

    console.log('\n🎉 All real NRQL queries executed successfully!');

  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('❌ Authentication failed. Please check your API key.');
      console.log('\n🔑 To fix this:');
      console.log('1. Get your API key from: https://one.newrelic.com/launcher/api-keys-ui.api-keys-launcher');
      console.log('2. Set environment variable: export NEWRELIC_API_KEY="your_key"');
      console.log('3. Or replace YOUR_API_KEY_HERE in this script');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Only run if API key is provided
if (process.env.NEWRELIC_API_KEY && process.env.NEWRELIC_API_KEY !== 'YOUR_API_KEY_HERE') {
  executeRealNRQLQueries().catch(console.error);
} else {
  console.log('⚠️  No API key provided. To run real queries:');
  console.log('1. Set environment variable: export NEWRELIC_API_KEY="your_actual_key"');
  console.log('2. Run: node example-real-nrql.js');
  console.log('\nOr edit this file to add your API key directly.');
}