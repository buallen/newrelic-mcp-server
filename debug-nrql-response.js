/**
 * Debug NRQL Response Structure
 */

const axios = require('axios');

async function debugNRQLResponse() {
  console.log('🔍 Debugging NRQL Response Structure\n');

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
                messages {
                  level
                  description
                }
              }
              totalResult {
                count
              }
            }
          }
        }
      }
    `;

    const variables = {
      accountId: accountId,
      nrql: 'SELECT count(*) FROM Transaction',
    };

    const response = await axios.post(
      'https://api.newrelic.com/graphql',
      {
        query: graphqlQuery,
        variables: variables,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': apiKey,
        },
        timeout: 10000,
      }
    );

    console.log('📋 Full Response Structure:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n📊 Response Analysis:');
    console.log('- Status:', response.status);
    console.log('- Has data:', !!response.data);
    console.log('- Has data.data:', !!response.data.data);
    console.log('- Has actor:', !!response.data.data?.actor);
    console.log('- Has account:', !!response.data.data?.actor?.account);
    console.log('- Has nrql:', !!response.data.data?.actor?.account?.nrql);

    if (response.data.errors) {
      console.log('❌ GraphQL Errors:');
      response.data.errors.forEach(error => {
        console.log(`  - ${error.message}`);
      });
    }
  } catch (error) {
    console.error('❌ Request Error:', error.response?.data || error.message);
  }
}

debugNRQLResponse().catch(console.error);
