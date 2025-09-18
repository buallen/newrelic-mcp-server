/**
 * Discover Available Log Data in NewRelic Account
 * Test what log event types and data are available for the last 7 days
 */

const axios = require('axios');

async function discoverLogData() {
  console.log('🔍 Discovering Available Log Data in NewRelic Account\n');

  const apiKey = process.env.NEW_RELIC_API_KEY;
  const accountId = 464254; // StoreHub account
  
  try {
    // Test 1: Check what event types are available
    console.log('📊 Test 1: Discovering Available Event Types');
    await testQuery('SHOW EVENT TYPES', 'Event types available');
    
    // Test 2: Look for Log event type
    console.log('\n📊 Test 2: Checking for Log Event Type');
    await testQuery('SELECT count(*) FROM Log SINCE 7 days ago', 'Log events in last 7 days');
    
    // Test 3: Look for other common log event types
    console.log('\n📊 Test 3: Checking Common Log Event Types');
    const logEventTypes = [
      'SystemSample',
      'ProcessSample', 
      'NetworkSample',
      'StorageSample',
      'InfrastructureEvent',
      'LogEvent',
      'Custom',
      'Transaction',
      'TransactionError',
      'PageView',
      'JavaScriptError'
    ];
    
    for (const eventType of logEventTypes) {
      try {
        await testQuery(`SELECT count(*) FROM ${eventType} SINCE 7 days ago LIMIT 1`, `${eventType} events`);
      } catch (error) {
        // Skip if event type doesn't exist
      }
    }
    
    // Test 4: If Log events exist, get sample data
    console.log('\n📊 Test 4: Sample Log Data Structure');
    await testQuery('SELECT * FROM Log SINCE 7 days ago LIMIT 5', 'Sample log entries');
    
    // Test 5: Look for application logs in Transaction events
    console.log('\n📊 Test 5: Application Logs in Transactions');
    await testQuery(`
      SELECT message, timestamp, appName 
      FROM TransactionError 
      WHERE message IS NOT NULL 
      SINCE 7 days ago 
      LIMIT 5
    `, 'Application error logs');
    
    // Test 6: Infrastructure monitoring logs
    console.log('\n📊 Test 6: Infrastructure Event Logs');
    await testQuery(`
      SELECT * 
      FROM InfrastructureEvent 
      SINCE 7 days ago 
      LIMIT 5
    `, 'Infrastructure events');
    
    // Test 7: System logs
    console.log('\n📊 Test 7: System Sample Data');
    await testQuery(`
      SELECT hostname, timestamp, cpuPercent, memoryUsedBytes 
      FROM SystemSample 
      SINCE 7 days ago 
      LIMIT 5
    `, 'System monitoring data');
    
    console.log('\n🎯 Log Data Discovery Summary:');
    console.log('This script tested various NewRelic event types that can contain log-like data.');
    console.log('Based on the results above, we can identify which data sources are available');
    console.log('for log querying in your NewRelic account.');
    
  } catch (error) {
    console.error('❌ Error during log discovery:', error.message);
  }
}

async function testQuery(nrqlQuery, description) {
  const apiKey = process.env.NEW_RELIC_API_KEY;
  const accountId = 464254;
  
  try {
    const graphqlQuery = `
      query($accountId: Int!, $nrql: Nrql!) {
        actor {
          account(id: $accountId) {
            nrql(query: $nrql) {
              results
              metadata {
                eventTypes
                facets
                messages
              }
            }
          }
        }
      }
    `;
    
    const variables = {
      accountId: accountId,
      nrql: nrqlQuery
    };
    
    const response = await axios.post('https://api.newrelic.com/graphql', {
      query: graphqlQuery,
      variables: variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey
      },
      timeout: 15000
    });
    
    if (response.data.errors) {
      console.log(`❌ ${description}: ${response.data.errors[0].message}`);
      return;
    }
    
    const nrqlData = response.data.data?.actor?.account?.nrql;
    if (!nrqlData) {
      console.log(`❌ ${description}: No data returned`);
      return;
    }
    
    console.log(`✅ ${description}:`);
    if (nrqlQuery.includes('SHOW EVENT TYPES')) {
      console.log(`   Found ${nrqlData.results.length} event types:`);
      nrqlData.results.slice(0, 10).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.eventType || item.name || JSON.stringify(item)}`);
      });
      if (nrqlData.results.length > 10) {
        console.log(`   ... and ${nrqlData.results.length - 10} more`);
      }
    } else if (nrqlQuery.includes('count(*)')) {
      const count = nrqlData.results[0]?.count || 0;
      console.log(`   Count: ${count.toLocaleString()} events`);
    } else {
      console.log(`   Results: ${nrqlData.results.length} rows`);
      if (nrqlData.results.length > 0) {
        console.log(`   Sample: ${JSON.stringify(nrqlData.results[0], null, 2).substring(0, 300)}...`);
      }
    }
    
    if (nrqlData.metadata?.eventTypes) {
      console.log(`   Event Types: ${nrqlData.metadata.eventTypes.join(', ')}`);
    }
    
  } catch (error) {
    if (error.response?.data?.errors) {
      console.log(`❌ ${description}: ${error.response.data.errors[0].message}`);
    } else {
      console.log(`❌ ${description}: ${error.message}`);
    }
  }
}

// Run the discovery
discoverLogData().catch(console.error);