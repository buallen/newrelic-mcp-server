#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const axios = require('axios');

const API_KEY = process.env.NEWRELIC_API_KEY;
const ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID;
const GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL;

async function testMallIntegrationLogs2025() {
  try {
    console.log('Testing mall integration logs for August-September 2025...');

    // Query for mall integration or submission-related transactions in August-September 2025  
    console.log('1. Querying transactions for submission/upload patterns in Aug-Sep 2025...');
    const submissionQuery = `SELECT timestamp, appName, name, error.message FROM Transaction WHERE (name LIKE '%submission%' OR name LIKE '%upload%' OR name LIKE '%mall%' OR error.message LIKE '%submission%' OR error.message LIKE '%upload%') SINCE '2025-08-29' UNTIL '2025-09-08' LIMIT 100`;
    
    let graphqlQuery = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${submissionQuery.replace(/"/g, '\\"')}") {
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

    console.log('Executing NRQL:', submissionQuery);

    let response = await axios.post(GRAPHQL_URL, {
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
    console.log('Query metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('Number of results:', result.results.length);
    
    if (result.results.length > 0) {
      console.log('\nSubmission/upload related transactions in Aug-Sep 2025:');
      result.results.slice(0, 10).forEach((tx, index) => {
        console.log(`${index + 1}. App: ${tx.appName}, Transaction: ${tx.name}, Time: ${tx.timestamp}, Error: ${tx['error.message'] || 'None'}`);
      });
    } else {
      console.log('\nNo submission/upload related transactions found in Aug-Sep 2025.');
    }

    // Query for any errors in applications during Aug-Sep 2025
    console.log('\n2. Querying for errors during Aug-Sep 2025...');
    const errorQuery = `SELECT timestamp, appName, \`error.message\`, \`error.class\` FROM TransactionError WHERE timestamp >= '2025-08-29' AND timestamp <= '2025-09-08' LIMIT 50`;
    
    graphqlQuery = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${errorQuery.replace(/"/g, '\\"')}") {
              results
              metadata {
                messages
              }
            }
          }
        }
      }`;

    response = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response.data.data?.actor?.account?.nrql) {
      const errorResult = response.data.data.actor.account.nrql;
      console.log('Number of errors:', errorResult.results.length);
      
      if (errorResult.results.length > 0) {
        console.log('\nErrors during Aug-Sep 2025:');
        errorResult.results.slice(0, 5).forEach((error, index) => {
          console.log(`${index + 1}. Time: ${error.timestamp}, App: ${error.appName}, Error: ${error['error.message']?.substring(0, 100)}...`);
        });
      } else {
        console.log('No errors found during Aug-Sep 2025.');
      }
    }

    // Query for Log events during Aug-Sep 2025 (might be the right event type)
    console.log('\n3. Querying Log events for Aug-Sep 2025...');
    const logQuery = `SELECT timestamp, message, level FROM Log WHERE (message LIKE '%submission%' OR message LIKE '%upload%' OR message LIKE '%mall%' OR level = 'ERROR') SINCE '2025-08-29' UNTIL '2025-09-08' LIMIT 50`;
    
    graphqlQuery = `
      {
        actor {
          account(id: ${ACCOUNT_ID}) {
            nrql(query: "${logQuery.replace(/"/g, '\\"')}") {
              results
              metadata {
                messages
              }
            }
          }
        }
      }`;

    response = await axios.post(GRAPHQL_URL, {
      query: graphqlQuery
    }, {
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY
      },
      timeout: 30000
    });

    if (response.data.data?.actor?.account?.nrql) {
      const logResult = response.data.data.actor.account.nrql;
      console.log('Number of log entries:', logResult.results.length);
      
      if (logResult.results.length > 0) {
        console.log('\nRelevant log entries during Aug-Sep 2025:');
        logResult.results.slice(0, 10).forEach((log, index) => {
          console.log(`${index + 1}. Time: ${log.timestamp}, Level: ${log.level}, Message: ${log.message?.substring(0, 100)}...`);
        });
      } else {
        console.log('No relevant log entries found during Aug-Sep 2025.');
        if (logResult.metadata.messages) {
          console.log('Messages:', logResult.metadata.messages);
        }
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

testMallIntegrationLogs2025();