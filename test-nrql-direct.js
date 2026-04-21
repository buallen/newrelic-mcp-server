#!/usr/bin/env node

const axios = require('axios');

const API_KEY = 'your_newrelic_api_key_here';
const ACCOUNT_ID = '464254';

async function testNRQLDirect() {
    const testQueries = [
        {
            name: 'Simple Count Query', 
            query: 'SELECT count(*) FROM Log SINCE 1 hour ago'
        },
        {
            name: 'Your Specific Query',
            query: 'SELECT level, message FROM Log WHERE allColumnSearch(\'[error]\', insensitive: true) SINCE 1756918719894 UNTIL 1756919142347'
        }
    ];

    for (const testQuery of testQueries) {
        console.log(`\n🧪 Testing: ${testQuery.name}`);
        console.log(`📝 Query: ${testQuery.query}`);
        console.log('='.repeat(80));

        try {
            // Construct GraphQL query exactly like our MCP server does
            const graphqlQuery = `
                {
                    actor {
                        account(id: ${ACCOUNT_ID}) {
                            nrql(query: "${testQuery.query.replace(/"/g, '\\"')}") {
                                results
                                metadata {
                                    timeWindow {
                                        since
                                        until
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            console.log('🔍 GraphQL Query:', graphqlQuery.replace(/\s+/g, ' ').trim());

            const response = await axios.post('https://api.newrelic.com/graphql', {
                query: graphqlQuery
            }, {
                headers: {
                    'Api-Key': API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.errors) {
                console.error('❌ GraphQL Errors:');
                response.data.errors.forEach((error, index) => {
                    console.error(`   ${index + 1}. ${error.message}`);
                    if (error.locations) {
                        console.error(`      Locations: ${JSON.stringify(error.locations)}`);
                    }
                    if (error.extensions) {
                        console.error(`      Extensions: ${JSON.stringify(error.extensions)}`);
                    }
                });
                continue;
            }

            const nrqlResult = response.data.data?.actor?.account?.nrql;
            if (!nrqlResult) {
                console.error('❌ No NRQL result in response');
                console.error('Full response:', JSON.stringify(response.data, null, 2));
                continue;
            }

            console.log('✅ Success!');
            console.log(`📊 Results count: ${nrqlResult.results?.length || 0}`);
            
            if (nrqlResult.metadata?.timeWindow) {
                console.log(`⏰ Time window: ${nrqlResult.metadata.timeWindow.since} - ${nrqlResult.metadata.timeWindow.until}`);
            }
            
            if (nrqlResult.results && nrqlResult.results.length > 0) {
                console.log('\n📋 First 3 results:');
                nrqlResult.results.slice(0, 3).forEach((result, index) => {
                    console.log(`   ${index + 1}. ${JSON.stringify(result)}`);
                });
                
                if (nrqlResult.results.length > 3) {
                    console.log(`   ... and ${nrqlResult.results.length - 3} more`);
                }
            }

        } catch (error) {
            console.error('❌ Network/API Error:', error.message);
            
            if (error.response) {
                console.error(`   HTTP Status: ${error.response.status}`);
                console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
            } else if (error.request) {
                console.error('   No response received');
                console.error('   Request details:', error.request);
            } else {
                console.error('   Error details:', error);
            }
        }
    }
}

if (require.main === module) {
    testNRQLDirect().catch(console.error);
}

module.exports = { testNRQLDirect };