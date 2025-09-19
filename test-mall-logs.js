#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const axios = require('axios');

const API_KEY = process.env.NEWRELIC_API_KEY;
const ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID;
const GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL;

async function testMallIntegrationLogs() {
  try {
    console.log('Testing mall integration logs query...');

    // Query for non-submission patterns during affected dates
    const query = `SELECT timestamp, message, level FROM Log WHERE (message LIKE '%submission%' OR message LIKE '%upload%' OR message LIKE '%failed%' OR level = 'ERROR') LIMIT 50 SINCE '2024-08-29' UNTIL '2024-09-07'`;

    const graphqlQuery = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${query.replace(/"/g, '\\"')}") {
              results
              metadata {
                timeWindow {
                  since
                  until
                }
                messages
                facets
              }
            }
          }
        }
      }`;

    console.log('Executing NRQL:', query);

    const response = await axios.post(
      GRAPHQL_URL,
      {
        query: graphqlQuery,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': API_KEY,
        },
        timeout: 30000,
      }
    );

    if (response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const result = response.data.data?.actor?.account?.nrql;
    console.log('Query metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('Number of results:', result.results.length);

    if (result.results.length > 0) {
      console.log('\nFirst few results:');
      result.results.slice(0, 5).forEach((log, index) => {
        console.log(`${index + 1}. ${JSON.stringify(log, null, 2)}`);
      });
    } else {
      console.log('\nNo results found for the specified criteria.');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testMallIntegrationLogs();
