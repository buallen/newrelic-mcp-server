#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const axios = require('axios');

const API_KEY = process.env.NEWRELIC_API_KEY;
const ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID;
const GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL;

async function testNRQLQuery() {
  try {
    console.log('Testing NRQL query execution...');
    console.log('API Key:', API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET');
    console.log('Account ID:', ACCOUNT_ID);
    console.log('GraphQL URL:', GRAPHQL_URL);

    // Test simple NRQL query
    const query = `SELECT count(*) FROM Log LIMIT 1 SINCE 1 day ago`;
    
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

    const response = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response.data.errors) {
      console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const result = response.data.data?.actor?.account?.nrql;
    console.log('NRQL Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNRQLQuery();