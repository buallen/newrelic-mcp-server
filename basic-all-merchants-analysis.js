#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const axios = require('axios');

const API_KEY = process.env.NEWRELIC_API_KEY;
const ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID;
const GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL;

async function executeNRQL(query) {
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
    throw new Error(`NRQL errors: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data.data?.actor?.account?.nrql || { results: [], metadata: {} };
}

async function basicAllMerchantsAnalysis() {
  console.log('🔍 BASIC ALL MERCHANTS ANALYSIS FOR NON-SUBMISSION ISSUES');
  console.log('='.repeat(70));
  console.log('Dates: Aug 29,30,31 | Sep 1,3,4,5,6,7 (2025)');
  console.log('');

  try {
    // 1. Check if we have any data at all
    console.log('📊 1. CHECKING DATA AVAILABILITY');
    console.log('-'.repeat(50));

    const basicQuery = `SELECT count(*) FROM Log SINCE '2025-08-29' UNTIL '2025-09-08' LIMIT 1`;
    const basicResult = await executeNRQL(basicQuery);

    console.log('Basic log count:', basicResult.results);

    if (basicResult.results.length === 0 || basicResult.results[0].count === 0) {
      console.log('⚠️  No log data found for the specified date range');
      console.log('   This could indicate:');
      console.log('   - System was not running during these dates');
      console.log('   - Logs are stored in different format/location');
      console.log('   - Date range or query needs adjustment');
      return;
    }

    console.log(`✅ Found ${basicResult.results[0].count} total log entries`);
    console.log('');

    // 2. Get recent logs to understand structure
    console.log('🔍 2. SAMPLE LOG ENTRIES');
    console.log('-'.repeat(50));

    const sampleQuery = `SELECT timestamp, message, level FROM Log SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 10`;
    const sampleResult = await executeNRQL(sampleQuery);

    if (sampleResult.results.length > 0) {
      console.log('Sample log entries:');
      sampleResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp} [${entry.level || 'INFO'}]: ${message}`);
      });
    }
    console.log('');

    // 3. Look for mall-related keywords
    console.log('🏢 3. MALL-RELATED ACTIVITY SEARCH');
    console.log('-'.repeat(50));

    const mallSearchTerms = ['mall', 'Mall', 'paradigm', 'Paradigm', 'shopping', 'ZRPT', 'PDF'];

    for (const term of mallSearchTerms) {
      try {
        const mallQuery = `SELECT count(*) FROM Log WHERE message LIKE '%${term}%' SINCE '2025-08-29' UNTIL '2025-09-08'`;
        const mallResult = await executeNRQL(mallQuery);

        if (mallResult.results.length > 0 && mallResult.results[0].count > 0) {
          console.log(`  Found ${mallResult.results[0].count} entries containing "${term}"`);

          // Get sample entries for this term
          const sampleQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%${term}%' SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 5`;
          const sampleResult = await executeNRQL(sampleQuery);

          sampleResult.results.forEach((entry, index) => {
            const timestamp = new Date(entry.timestamp).toISOString();
            const message = entry.message?.substring(0, 80) + '...';
            console.log(`    ${index + 1}. ${timestamp}: ${message}`);
          });
          console.log('');
        } else {
          console.log(`  No entries found for "${term}"`);
        }
      } catch (error) {
        console.log(`  Error searching for "${term}": ${error.message}`);
      }
    }

    // 4. Look for upload/processing keywords
    console.log('📤 4. UPLOAD/PROCESSING ACTIVITY SEARCH');
    console.log('-'.repeat(50));

    const uploadSearchTerms = ['upload', 'ftp', 'sftp', 'transmission', 'processed', 'datafiles'];

    for (const term of uploadSearchTerms) {
      try {
        const uploadQuery = `SELECT count(*) FROM Log WHERE message LIKE '%${term}%' SINCE '2025-08-29' UNTIL '2025-09-08'`;
        const uploadResult = await executeNRQL(uploadQuery);

        if (uploadResult.results.length > 0 && uploadResult.results[0].count > 0) {
          console.log(`  Found ${uploadResult.results[0].count} entries containing "${term}"`);
        } else {
          console.log(`  No entries found for "${term}"`);
        }
      } catch (error) {
        console.log(`  Error searching for "${term}": ${error.message}`);
      }
    }
    console.log('');

    // 5. Check for errors
    console.log('❌ 5. ERROR ANALYSIS');
    console.log('-'.repeat(50));

    const errorQuery = `SELECT count(*) FROM Log WHERE level = 'ERROR' SINCE '2025-08-29' UNTIL '2025-09-08'`;
    const errorResult = await executeNRQL(errorQuery);

    if (errorResult.results.length > 0 && errorResult.results[0].count > 0) {
      console.log(`Found ${errorResult.results[0].count} ERROR entries`);

      // Get sample errors
      const errorSampleQuery = `SELECT timestamp, message FROM Log WHERE level = 'ERROR' SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 10`;
      const errorSampleResult = await executeNRQL(errorSampleQuery);

      errorSampleResult.results.forEach((error, index) => {
        const timestamp = new Date(error.timestamp).toISOString();
        const message = error.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('No ERROR level entries found');
    }
    console.log('');

    console.log('🎯 PRELIMINARY CONCLUSIONS:');
    console.log('If mall/upload related entries are minimal or zero,');
    console.log('this confirms system-wide processing failures during');
    console.log('the non-submission period affecting all merchants.');
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

basicAllMerchantsAnalysis();
