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

async function comprehensiveMallAnalysis() {
  console.log('🔍 COMPREHENSIVE MALL INTEGRATION NON-SUBMISSION ANALYSIS');
  console.log('='.repeat(70));
  console.log(`Period: August 29 - September 7, 2025`);
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log('');

  try {
    // 1. GENERAL MALL PROCESSING ACTIVITY
    console.log('📊 1. GENERAL MALL PROCESSING ACTIVITY ANALYSIS');
    console.log('-'.repeat(50));

    const generalQuery = `SELECT count(*) FROM Log WHERE message LIKE '%mall%' OR message LIKE '%Paradigm%' OR message LIKE '%shopping%' FACET appName SINCE '2025-08-29' UNTIL '2025-09-08' LIMIT 20`;
    const generalResult = await executeNRQL(generalQuery);

    console.log('Mall-related log entries by application:');
    generalResult.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.appName || 'Unknown App'}: ${result.count} entries`);
    });
    console.log('');

    // 2. SPECIFIC PARADIGM MALL ANALYSIS
    console.log('🏢 2. PARADIGM MALL SPECIFIC ANALYSIS');
    console.log('-'.repeat(50));

    const paradigmQuery = `SELECT timestamp, message, level FROM Log WHERE message LIKE '%Paradigm%' OR message LIKE '%anihonbu%' SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 50`;
    const paradigmResult = await executeNRQL(paradigmQuery);

    console.log(`Found ${paradigmResult.results.length} Paradigm Mall related entries:`);
    paradigmResult.results.slice(0, 10).forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const message = entry.message?.substring(0, 80) + '...';
      console.log(`  ${index + 1}. ${timestamp} [${entry.level || 'INFO'}]: ${message}`);
    });
    console.log('');

    // 3. ERROR ANALYSIS
    console.log('❌ 3. ERROR PATTERN ANALYSIS');
    console.log('-'.repeat(50));

    const errorQuery = `SELECT timestamp, message, level FROM Log WHERE level = 'ERROR' AND (message LIKE '%submission%' OR message LIKE '%upload%' OR message LIKE '%mall%' OR message LIKE '%failed%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 30`;
    const errorResult = await executeNRQL(errorQuery);

    if (errorResult.results.length > 0) {
      console.log(`Found ${errorResult.results.length} error entries:`);
      errorResult.results.forEach((error, index) => {
        const timestamp = new Date(error.timestamp).toISOString();
        const message = error.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('✅ No errors found related to mall submission/upload during the period');
    }
    console.log('');

    // 4. SUCCESSFUL SUBMISSION PATTERN
    console.log('✅ 4. SUCCESSFUL SUBMISSION PATTERNS');
    console.log('-'.repeat(50));

    const successQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%successfully%' OR message LIKE '%saved%' OR message LIKE '%PDF saved%') AND (message LIKE '%mall%' OR message LIKE '%Paradigm%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 20`;
    const successResult = await executeNRQL(successQuery);

    console.log(`Found ${successResult.results.length} successful operations:`);
    successResult.results.forEach((success, index) => {
      const timestamp = new Date(success.timestamp).toISOString();
      const message = success.message?.substring(0, 100) + '...';
      console.log(`  ${index + 1}. ${timestamp}: ${message}`);
    });
    console.log('');

    // 5. ANIHONBU SPECIFIC ANALYSIS
    console.log('🏪 5. ANIHONBU STORE SPECIFIC ANALYSIS');
    console.log('-'.repeat(50));

    const anihonbuQuery = `SELECT timestamp, message, level FROM Log WHERE message LIKE '%anihonbu%' OR message LIKE '%2F36A04%' SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 20`;
    const anihonbuResult = await executeNRQL(anihonbuQuery);

    if (anihonbuResult.results.length > 0) {
      console.log(`Found ${anihonbuResult.results.length} anihonbu-related entries:`);
      anihonbuResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp} [${entry.level || 'INFO'}]: ${message}`);
      });
    } else {
      console.log('⚠️  NO anihonbu-related log entries found during the period!');
      console.log('    This suggests the store may not be processing at all.');
    }
    console.log('');

    // 6. UPLOAD/FILE PROCESSING ANALYSIS
    console.log('📤 6. UPLOAD/FILE PROCESSING ANALYSIS');
    console.log('-'.repeat(50));

    const uploadQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%upload%' OR message LIKE '%PDF%' OR message LIKE '%ZRPT%' OR message LIKE '%datafiles%') AND (message LIKE '%Paradigm%' OR message LIKE '%mall%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 15`;
    const uploadResult = await executeNRQL(uploadQuery);

    console.log(`Found ${uploadResult.results.length} file/upload related entries:`);
    uploadResult.results.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const message = entry.message?.substring(0, 120) + '...';
      console.log(`  ${index + 1}. ${timestamp}: ${message}`);
    });
    console.log('');

    // 7. CONFIGURATION ISSUE INDICATORS
    console.log('⚙️  7. CONFIGURATION ISSUE INDICATORS');
    console.log('-'.repeat(50));

    const configQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%start%' OR message LIKE '%date%' OR message LIKE '%config%' OR message LIKE '%future%') AND message LIKE '%mall%' SINCE '2025-08-29' UNTIL '2025-09-08' LIMIT 10`;
    const configResult = await executeNRQL(configQuery);

    if (configResult.results.length > 0) {
      console.log(`Found ${configResult.results.length} configuration-related entries:`);
      configResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('No specific configuration error messages found in logs');
    }
    console.log('');

    // 8. SUMMARY ANALYSIS
    console.log('📋 8. ANALYSIS SUMMARY');
    console.log('-'.repeat(50));

    console.log('KEY FINDINGS:');
    console.log(
      `• Total mall-related log entries: ${generalResult.results.reduce((sum, r) => sum + (r.count || 0), 0)}`
    );
    console.log(`• Paradigm Mall specific entries: ${paradigmResult.results.length}`);
    console.log(`• Error entries: ${errorResult.results.length}`);
    console.log(`• Successful operations: ${successResult.results.length}`);
    console.log(`• Anihonbu-specific entries: ${anihonbuResult.results.length}`);
    console.log(`• File processing entries: ${uploadResult.results.length}`);

    console.log('');
    console.log('PRELIMINARY CONCLUSIONS:');

    if (anihonbuResult.results.length === 0) {
      console.log(
        '🚨 CRITICAL: No anihonbu store processing detected during non-submission period'
      );
      console.log('   This strongly suggests configuration prevents the store from processing');
    }

    if (errorResult.results.length === 0) {
      console.log('✅ No explicit errors found - suggests silent failure due to configuration');
    }

    if (paradigmResult.results.filter(r => r.message?.includes('ParadigmMallJB')).length > 0) {
      console.log('ℹ️  ParadigmMallJB (Johor Bahru) is processing normally');
      console.log('   Issue appears specific to ParadigmMallKelanaJaya configuration');
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

comprehensiveMallAnalysis();
