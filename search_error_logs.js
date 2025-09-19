const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.NEW_RELIC_API_KEY;
const ACCOUNT_ID = process.env.NEW_RELIC_ACCOUNT_ID;

if (!API_KEY || !ACCOUNT_ID) {
  console.error('Please set NEW_RELIC_API_KEY and NEW_RELIC_ACCOUNT_ID environment variables');
  process.exit(1);
}

async function searchErrorLogs() {
  const nrql = `SELECT level, message FROM Log WHERE allColumnSearch('[error]', insensitive: true) SINCE 1756918719894 UNTIL 1756919142347`;

  const graphqlQuery = {
    query: `{
            actor {
                account(id: ${ACCOUNT_ID}) {
                    nrql(query: "${nrql}") {
                        results
                    }
                }
            }
        }`,
  };

  try {
    console.log('Executing NRQL:', nrql);

    const response = await axios.post('https://api.newrelic.com/graphql', graphqlQuery, {
      headers: {
        'Api-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    if (response.data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      return;
    }

    const results = response.data.data?.actor?.account?.nrql?.results;

    if (!results || results.length === 0) {
      console.log('No error logs found for the specified time range');
      return;
    }

    console.log(`Found ${results.length} error log entries:`);
    console.log('=====================================');

    results.forEach((log, index) => {
      console.log(`\n[${index + 1}] Level: ${log.level}`);
      console.log(`Message: ${log.message}`);
      console.log('---');
    });

    // Save to file
    const outputFile = 'error_logs_analysis.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outputFile}`);
  } catch (error) {
    console.error('Error executing query:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

searchErrorLogs();
