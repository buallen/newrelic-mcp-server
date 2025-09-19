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

async function debugQueryAnalysis() {
  console.log('🔍 DEBUG QUERY ANALYSIS FOR NON-SUBMISSION INVESTIGATION');
  console.log('='.repeat(70));
  console.log('');

  try {
    // 1. Test if we have any data at all during this period
    console.log('🧪 1. BASIC CONNECTIVITY AND DATE RANGE TEST');
    console.log('-'.repeat(50));

    const basicCountQuery = `SELECT count(*) FROM Log WHERE timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
    const basicCountResult = await executeNRQL(basicCountQuery);

    console.log(`Total log entries in period: ${basicCountResult.results[0]?.count || 0}`);

    if ((basicCountResult.results[0]?.count || 0) === 0) {
      console.log('❌ NO DATA found for specified date range - query may be incorrect');
      return;
    }
    console.log('');

    // 2. Check what we actually have for "processed"
    console.log('🔍 2. PROCESSED FOLDER SEARCH (BROAD)');
    console.log('-'.repeat(50));

    // Try different variations
    const processedVariations = ['processed', 'Processed', 'PROCESSED', 'storage/processed'];

    for (const variation of processedVariations) {
      const query = `SELECT count(*) FROM Log WHERE message LIKE '%${variation}%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
      const result = await executeNRQL(query);
      console.log(`  "${variation}": ${result.results[0]?.count || 0} entries`);

      if ((result.results[0]?.count || 0) > 0) {
        // Show sample
        const sampleQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%${variation}%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 3`;
        const sampleResult = await executeNRQL(sampleQuery);

        sampleResult.results.forEach((entry, index) => {
          const timestamp = new Date(entry.timestamp).toISOString();
          const message = entry.message?.substring(0, 100) + '...';
          console.log(`    ${index + 1}. ${timestamp}: ${message}`);
        });
      }
    }
    console.log('');

    // 3. Check datafiles patterns
    console.log('📁 3. DATAFILES GENERATION ANALYSIS');
    console.log('-'.repeat(50));

    const datafilesQuery = `SELECT count(*) FROM Log WHERE message LIKE '%datafiles%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
    const datafilesResult = await executeNRQL(datafilesQuery);

    console.log(`Files generated (datafiles): ${datafilesResult.results[0]?.count || 0}`);

    if ((datafilesResult.results[0]?.count || 0) > 0) {
      // Show samples
      const sampleDatafilesQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%datafiles%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 5`;
      const sampleDatafilesResult = await executeNRQL(sampleDatafilesQuery);

      console.log('Sample datafiles entries:');
      sampleDatafilesResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    }
    console.log('');

    // 4. Check mall patterns more broadly
    console.log('🏢 4. MALL PROCESSING PATTERNS ANALYSIS');
    console.log('-'.repeat(50));

    const mallPatterns = ['ParadigmMall', 'Paradigm', 'anihonbu', 'mall', 'Mall'];

    for (const pattern of mallPatterns) {
      const query = `SELECT count(*) FROM Log WHERE message LIKE '%${pattern}%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
      const result = await executeNRQL(query);

      console.log(`  "${pattern}": ${(result.results[0]?.count || 0).toLocaleString()} entries`);
    }
    console.log('');

    // 5. Look for any upload/transmission indicators
    console.log('📤 5. UPLOAD/TRANSMISSION INDICATORS');
    console.log('-'.repeat(50));

    const uploadPatterns = [
      'upload',
      'ftp',
      'sftp',
      'transmission',
      'move',
      'moved',
      'sent',
      'transfer',
    ];

    for (const pattern of uploadPatterns) {
      const query = `SELECT count(*) FROM Log WHERE message LIKE '%${pattern}%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
      const result = await executeNRQL(query);

      const count = result.results[0]?.count || 0;
      console.log(`  "${pattern}": ${count.toLocaleString()} entries`);

      if (count > 0 && count < 50) {
        // Show samples for smaller counts
        const sampleQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%${pattern}%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 3`;
        const sampleResult = await executeNRQL(sampleQuery);

        sampleResult.results.forEach((entry, index) => {
          const timestamp = new Date(entry.timestamp).toISOString();
          const message = entry.message?.substring(0, 100) + '...';
          console.log(`    ${index + 1}. ${timestamp}: ${message}`);
        });
      }
    }
    console.log('');

    // 6. Check what's happening on Sep 7 specifically
    console.log('📅 6. SEPTEMBER 7TH SPECIFIC ANALYSIS');
    console.log('-'.repeat(50));

    const sep7Query = `SELECT count(*) FROM Log WHERE timestamp >= '2025-09-07' AND timestamp < '2025-09-08'`;
    const sep7Result = await executeNRQL(sep7Query);

    console.log(`Sep 7 total entries: ${(sep7Result.results[0]?.count || 0).toLocaleString()}`);

    // Check for mall activity on Sep 7
    const sep7MallQuery = `SELECT count(*) FROM Log WHERE message LIKE '%mall%' AND timestamp >= '2025-09-07' AND timestamp < '2025-09-08'`;
    const sep7MallResult = await executeNRQL(sep7MallQuery);

    console.log(`Sep 7 mall entries: ${(sep7MallResult.results[0]?.count || 0).toLocaleString()}`);

    if ((sep7MallResult.results[0]?.count || 0) > 0) {
      console.log('Sample Sep 7 mall activities:');
      const sampleSep7Query = `SELECT timestamp, message FROM Log WHERE message LIKE '%mall%' AND timestamp >= '2025-09-07' AND timestamp < '2025-09-08' ORDER BY timestamp DESC LIMIT 5`;
      const sampleSep7Result = await executeNRQL(sampleSep7Query);

      sampleSep7Result.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    }
  } catch (error) {
    console.error('❌ Debug analysis failed:', error.message);
  }
}

debugQueryAnalysis();
