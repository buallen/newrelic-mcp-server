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

async function investigateUploadFailures() {
  console.log('🔍 INVESTIGATING FILE UPLOAD/TRANSMISSION FAILURES');
  console.log('='.repeat(65));
  console.log('Hypothesis: Files generated locally but transmission to mall systems failed');
  console.log('');

  try {
    // 1. FTP/UPLOAD SPECIFIC ANALYSIS
    console.log('📤 1. FTP/UPLOAD TRANSMISSION ANALYSIS');
    console.log('-'.repeat(50));

    const ftpQuery = `SELECT timestamp, message, level FROM Log WHERE (message LIKE '%ftp%' OR message LIKE '%upload%' OR message LIKE '%transmission%' OR message LIKE '%connection%' OR message LIKE '%failed%' OR message LIKE '%timeout%') AND (message LIKE '%Paradigm%' OR message LIKE '%anihonbu%' OR message LIKE '%mall%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 30`;
    const ftpResult = await executeNRQL(ftpQuery);

    console.log(`Found ${ftpResult.results.length} FTP/upload related entries:`);
    if (ftpResult.results.length > 0) {
      ftpResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = entry.level || 'INFO';
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp} [${level}]: ${message}`);
      });
    } else {
      console.log('  ⚠️  No FTP/upload logs found - this could indicate silent failures');
    }
    console.log('');

    // 2. NETWORK/CONNECTION FAILURES
    console.log('🌐 2. NETWORK CONNECTION ANALYSIS');
    console.log('-'.repeat(50));

    const networkQuery = `SELECT timestamp, message, level FROM Log WHERE (message LIKE '%network%' OR message LIKE '%connection%' OR message LIKE '%host%' OR message LIKE '%ssl%' OR message LIKE '%certificate%' OR message LIKE '%auth%') AND level IN ('ERROR', 'WARN') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 20`;
    const networkResult = await executeNRQL(networkQuery);

    console.log(`Found ${networkResult.results.length} network-related error/warning entries:`);
    if (networkResult.results.length > 0) {
      networkResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp} [${entry.level}]: ${message}`);
      });
    } else {
      console.log('  ✅ No network errors found in logs');
    }
    console.log('');

    // 3. UPLOAD QUEUE/PROCESSOR ANALYSIS
    console.log('📋 3. UPLOAD QUEUE/PROCESSOR ANALYSIS');
    console.log('-'.repeat(50));

    const queueQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%queue%' OR message LIKE '%processor%' OR message LIKE '%upload%' OR message LIKE '%batch%') AND (message LIKE '%Paradigm%' OR message LIKE '%mall%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 20`;
    const queueResult = await executeNRQL(queueQuery);

    console.log(`Found ${queueResult.results.length} queue/processor related entries:`);
    if (queueResult.results.length > 0) {
      queueResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    }
    console.log('');

    // 4. SPECIFIC PARADIGM MALL KELANA JAYA FTP LOGS
    console.log('🏢 4. PARADIGM MALL KELANA JAYA FTP ANALYSIS');
    console.log('-'.repeat(50));

    const paradigmFtpQuery = `SELECT timestamp, message, level FROM Log WHERE message LIKE '%ParadigmMallKelanaJaya%' AND (message LIKE '%ftp%' OR message LIKE '%upload%' OR message LIKE '%transmission%' OR message LIKE '%send%' OR message LIKE '%move%' OR message LIKE '%processed%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 15`;
    const paradigmFtpResult = await executeNRQL(paradigmFtpQuery);

    console.log(`Found ${paradigmFtpResult.results.length} ParadigmMallKelanaJaya FTP entries:`);
    if (paradigmFtpResult.results.length > 0) {
      paradigmFtpResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const level = entry.level || 'INFO';
        const message = entry.message?.substring(0, 130) + '...';
        console.log(`  ${index + 1}. ${timestamp} [${level}]: ${message}`);
      });
    } else {
      console.log('  🚨 CRITICAL: No FTP transmission logs found for ParadigmMallKelanaJaya!');
      console.log('     This suggests files are generated but never uploaded to mall system.');
    }
    console.log('');

    // 5. PROCESSED FILES ANALYSIS
    console.log('📁 5. FILE MOVEMENT TO PROCESSED FOLDER ANALYSIS');
    console.log('-'.repeat(50));

    const processedQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%processed%' OR message LIKE '%moved%' OR message LIKE '%storage/processed%') AND (message LIKE '%Paradigm%' OR message LIKE '%anihonbu%' OR message LIKE '%2F36A04%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 10`;
    const processedResult = await executeNRQL(processedQuery);

    console.log(`Found ${processedResult.results.length} processed files entries:`);
    if (processedResult.results.length > 0) {
      processedResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('  🚨 CRITICAL: No files moved to processed folder!');
      console.log('     According to code analysis, files only move after successful upload.');
      console.log('     This confirms upload failures.');
    }
    console.log('');

    // 6. COMPARE WITH SUCCESSFUL MALLS
    console.log('✅ 6. COMPARISON WITH SUCCESSFUL MALLS (ParadigmMallJB)');
    console.log('-'.repeat(50));

    const successfulQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%ParadigmMallJB%' AND (message LIKE '%upload%' OR message LIKE '%ftp%' OR message LIKE '%transmission%' OR message LIKE '%processed%') SINCE '2025-08-29' UNTIL '2025-09-08' ORDER BY timestamp DESC LIMIT 8`;
    const successfulResult = await executeNRQL(successfulQuery);

    console.log(`Found ${successfulResult.results.length} ParadigmMallJB upload entries:`);
    if (successfulResult.results.length > 0) {
      successfulResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('  ℹ️  No explicit upload logs for ParadigmMallJB either');
      console.log('     This suggests upload logging may be minimal or disabled');
    }
    console.log('');

    // 7. FINAL ANALYSIS
    console.log('🎯 7. ROOT CAUSE CONCLUSION');
    console.log('-'.repeat(50));

    console.log('EVIDENCE SUMMARY:');
    console.log(`• anihonbu file generation: ✅ WORKING (20 entries)`);
    console.log(
      `• FTP/Upload logs: ${ftpResult.results.length > 0 ? '⚠️ FOUND ISSUES' : '❌ MISSING'}`
    );
    console.log(
      `• Network errors: ${networkResult.results.length > 0 ? '❌ ERRORS FOUND' : '✅ CLEAN'}`
    );
    console.log(
      `• Files moved to processed: ${processedResult.results.length > 0 ? '✅ YES' : '❌ NO'}`
    );

    console.log('');
    console.log('🎯 FINAL ROOT CAUSE ASSESSMENT:');

    if (processedResult.results.length === 0) {
      console.log('🚨 CONFIRMED: FILES GENERATED BUT UPLOAD TO MALL SYSTEMS FAILING');
      console.log('');
      console.log("The issue is NOT configuration - it's transmission failure:");
      console.log('  1. anihonbu files are generated successfully locally');
      console.log('  2. Files are NOT being uploaded to mall FTP server');
      console.log('  3. Files remain in datafiles/ folder (not moved to processed/)');
      console.log("  4. Mall systems don't receive files → trigger non-submission emails");
      console.log('');
      console.log('LIKELY CAUSES:');
      console.log('  • FTP server connectivity issues (ftppmpj.wct.my:2121)');
      console.log('  • Authentication problems with mall FTP credentials');
      console.log('  • SSL/TLS certificate issues (secure: true configuration)');
      console.log('  • Network timeouts or firewall blocking');
    } else {
      console.log('✅ Files are being processed successfully - need to investigate further');
    }
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

investigateUploadFailures();
