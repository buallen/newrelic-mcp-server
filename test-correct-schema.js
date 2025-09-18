/**
 * Test with Correct GraphQL Schema
 */

const axios = require('axios');

async function testCorrectSchema() {
  console.log('🔧 Testing with Correct GraphQL Schema\n');

  const apiKey = process.env.NEW_RELIC_API_KEY;
  const accountId = 464254;
  
  try {
    // Test minimal working query first
    console.log('📊 Test 1: Minimal Working Query');
    
    const minimalQuery = `
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
      accountId: accountId,
      nrql: 'SELECT count(*) FROM Transaction'
    };
    
    const response1 = await axios.post('https://api.newrelic.com/graphql', {
      query: minimalQuery,
      variables: variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey
      },
      timeout: 10000
    });
    
    console.log('✅ Minimal Query Response:');
    console.log(JSON.stringify(response1.data, null, 2));
    
    // Test with metadata
    console.log('\n📊 Test 2: Query with Metadata');
    
    const metadataQuery = `
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
              totalResult
            }
          }
        }
      }
    `;
    
    const response2 = await axios.post('https://api.newrelic.com/graphql', {
      query: metadataQuery,
      variables: variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey
      },
      timeout: 10000
    });
    
    console.log('✅ Metadata Query Response:');
    console.log(JSON.stringify(response2.data, null, 2));
    
    // Test complex query
    console.log('\n📊 Test 3: Complex Query');
    
    const complexVariables = {
      accountId: accountId,
      nrql: 'SELECT count(*), average(duration) FROM Transaction SINCE 1 day ago FACET appName LIMIT 3'
    };
    
    const response3 = await axios.post('https://api.newrelic.com/graphql', {
      query: metadataQuery,
      variables: complexVariables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': apiKey
      },
      timeout: 10000
    });
    
    console.log('✅ Complex Query Response:');
    console.log(JSON.stringify(response3.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCorrectSchema().catch(console.error);