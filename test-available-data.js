#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const axios = require('axios');

const API_KEY = process.env.NEWRELIC_API_KEY;
const ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID;
const GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL;

async function testAvailableData() {
  try {
    console.log('Testing what data is available...');

    // First, let's see what event types are available
    const eventTypesQuery = `SHOW EVENT TYPES SINCE 7 days ago`;
    
    const graphqlQuery1 = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${eventTypesQuery.replace(/"/g, '\\"')}") {
              results
              metadata {
                timeWindow {
                  since
                  until
                }
                messages
              }
            }
          }
        }
      }`;

    console.log('\n1. Checking available event types...');
    
    const response1 = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response1.data.data?.actor?.account?.nrql) {
      const eventTypes = response1.data.data.actor.account.nrql.results;
      console.log('Available event types:');
      eventTypes.slice(0, 10).forEach((type, index) => {
        console.log(`  ${index + 1}. ${type.eventType || type.name || JSON.stringify(type)}`);
      });
    }

    // Let's try querying Transaction events instead of Log
    console.log('\n2. Checking Transaction data...');
    const transactionQuery = `SELECT count(*) FROM Transaction SINCE 7 days ago`;
    
    const graphqlQuery2 = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${transactionQuery.replace(/"/g, '\\"')}") {
              results
              metadata {
                messages
              }
            }
          }
        }
      }`;

    const response2 = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response2.data.data?.actor?.account?.nrql) {
      const result = response2.data.data.actor.account.nrql;
      console.log('Transaction data:', JSON.stringify(result.results, null, 2));
      if (result.metadata.messages) {
        console.log('Messages:', result.metadata.messages);
      }
    }

    // Let's check if there are any applications reporting
    console.log('\n3. Checking for recent application data...');
    const appQuery = `SELECT uniques(appName) FROM Transaction SINCE 1 day ago LIMIT 10`;
    
    const graphqlQuery3 = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${appQuery.replace(/"/g, '\\"')}") {
              results
              metadata {
                messages
              }
            }
          }
        }
      }`;

    const response3 = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery3
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response3.data.data?.actor?.account?.nrql) {
      const result = response3.data.data.actor.account.nrql;
      console.log('Application names:', JSON.stringify(result.results, null, 2));
      if (result.metadata.messages) {
        console.log('Messages:', result.metadata.messages);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAvailableData();