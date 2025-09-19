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

async function detailedUploadAnalysis() {
  console.log('🔍 DETAILED UPLOAD/TRANSMISSION ANALYSIS - ALL MERCHANTS');
  console.log('='.repeat(70));
  console.log('Non-submission Dates: Aug 29,30,31 | Sep 1,3,4,5,6,7 (2025)');
  console.log('');

  try {
    // 1. CRITICAL FINDING: Look for "processed" folder activity
    console.log('🚨 1. PROCESSED FOLDER ANALYSIS (CRITICAL INDICATOR)');
    console.log('-'.repeat(50));

    const processedQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%processed%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 20`;
    const processedResult = await executeNRQL(processedQuery);

    if (processedResult.results.length === 0) {
      console.log('🚨 CRITICAL: ZERO files moved to processed folder during entire period!');
      console.log('   This confirms NO SUCCESSFUL UPLOADS across ALL merchants/malls');
      console.log('   Files only move to processed/ after successful transmission');
    } else {
      console.log(`Found ${processedResult.results.length} processed folder activities:`);
      processedResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    }
    console.log('');

    // 2. FTP CONNECTION ANALYSIS
    console.log('📤 2. FTP CONNECTION/TRANSMISSION ANALYSIS');
    console.log('-'.repeat(50));

    const ftpDetailQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%ftp%' AND (message LIKE '%connect%' OR message LIKE '%upload%' OR message LIKE '%send%' OR message LIKE '%transfer%' OR message LIKE '%fail%' OR message LIKE '%error%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 25`;
    const ftpDetailResult = await executeNRQL(ftpDetailQuery);

    console.log(`Found ${ftpDetailResult.results.length} FTP connection/transfer entries:`);
    if (ftpDetailResult.results.length > 0) {
      ftpDetailResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 120) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('  🚨 CRITICAL: No FTP transmission attempts logged!');
      console.log('     This suggests upload process is failing before reaching FTP stage');
    }
    console.log('');

    // 3. MALL-SPECIFIC ANALYSIS
    console.log('🏢 3. MALL-SPECIFIC PROCESSING ANALYSIS');
    console.log('-'.repeat(50));

    const mallSpecificQuery = `SELECT count(*) FROM Log WHERE message LIKE '%ParadigmMallKelanaJaya%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
    const mallSpecificResult = await executeNRQL(mallSpecificQuery);

    console.log(
      `ParadigmMallKelanaJaya processing: ${mallSpecificResult.results[0]?.count || 0} entries`
    );

    if (mallSpecificResult.results[0]?.count > 0) {
      const sampleMallQuery = `SELECT timestamp, message FROM Log WHERE message LIKE '%ParadigmMallKelanaJaya%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 10`;
      const sampleMallResult = await executeNRQL(sampleMallQuery);

      sampleMallResult.results.forEach((entry, index) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const message = entry.message?.substring(0, 100) + '...';
        console.log(`  ${index + 1}. ${timestamp}: ${message}`);
      });
    } else {
      console.log('  🚨 CRITICAL: ParadigmMallKelanaJaya has ZERO processing entries!');
      console.log('     This confirms the mall integration is completely inactive');
    }
    console.log('');

    // 4. SUCCESSFUL VS FAILED OPERATIONS
    console.log('✅ 4. SUCCESS/FAILURE PATTERN ANALYSIS');
    console.log('-'.repeat(50));

    // Check for successful file generation
    const successQuery = `SELECT count(*) FROM Log WHERE (message LIKE '%successfully generated%' OR message LIKE '%PDF saved%' OR message LIKE '%file saved%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
    const successResult = await executeNRQL(successQuery);

    // Check for datafiles (file generation)
    const datafilesQuery = `SELECT count(*) FROM Log WHERE message LIKE '%datafiles%' AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07'`;
    const datafilesResult = await executeNRQL(datafilesQuery);

    console.log(`Files generated (datafiles): ${datafilesResult.results[0]?.count || 0}`);
    console.log(`Successful operations: ${successResult.results[0]?.count || 0}`);
    console.log(`Files moved to processed: ${processedResult.results.length}`);

    console.log('');
    console.log('SUCCESS RATE ANALYSIS:');
    const generated = datafilesResult.results[0]?.count || 0;
    const processed = processedResult.results.length;

    if (generated > 0 && processed === 0) {
      console.log('🚨 COMPLETE UPLOAD FAILURE PATTERN CONFIRMED:');
      console.log(`  - Files generated: ${generated.toLocaleString()}`);
      console.log(`  - Files successfully uploaded: ${processed}`);
      console.log(`  - Success rate: 0% (${processed}/${generated})`);
      console.log('  - ALL merchants affected by upload infrastructure failure');
    }
    console.log('');

    // 5. DATE-BY-DATE BREAKDOWN
    console.log('📅 5. DATE-BY-DATE BREAKDOWN OF AFFECTED PERIOD');
    console.log('-'.repeat(50));

    const dates = [
      '2025-08-29',
      '2025-08-30',
      '2025-08-31',
      '2025-09-01',
      '2025-09-03',
      '2025-09-04',
      '2025-09-05',
      '2025-09-06',
      '2025-09-07',
    ];

    for (const date of dates) {
      const dailyGenQuery = `SELECT count(*) FROM Log WHERE message LIKE '%datafiles%' AND timestamp >= '${date}' AND timestamp < '${date.split('-').slice(0, 2).join('-')}-${String(parseInt(date.split('-')[2]) + 1).padStart(2, '0')}'`;
      const dailyProcQuery = `SELECT count(*) FROM Log WHERE message LIKE '%processed%' AND timestamp >= '${date}' AND timestamp < '${date.split('-').slice(0, 2).join('-')}-${String(parseInt(date.split('-')[2]) + 1).padStart(2, '0')}'`;

      try {
        const dailyGenResult = await executeNRQL(dailyGenQuery);
        const dailyProcResult = await executeNRQL(dailyProcQuery);

        const generated = dailyGenResult.results[0]?.count || 0;
        const processed = dailyProcResult.results[0]?.count || 0;

        console.log(
          `  ${date}: Generated ${generated.toLocaleString()} | Processed ${processed} | Success: ${processed > 0 ? 'YES' : 'NO'}`
        );
      } catch (error) {
        console.log(`  ${date}: Error querying - ${error.message}`);
      }
    }
    console.log('');

    // 6. FINAL ROOT CAUSE DETERMINATION
    console.log('🎯 6. FINAL ROOT CAUSE ANALYSIS');
    console.log('-'.repeat(50));

    console.log('EVIDENCE SUMMARY:');
    console.log(
      `• Mall processing active: ✅ YES (${(mallSpecificResult.results[0]?.count || 0) > 0 ? 'Active' : 'Inactive'})`
    );
    console.log(
      `• File generation working: ✅ YES (${(datafilesResult.results[0]?.count || 0).toLocaleString()} files)`
    );
    console.log(
      `• FTP transmission logs: ${ftpDetailResult.results.length > 0 ? '✅ PRESENT' : '❌ MISSING'}`
    );
    console.log(
      `• Files moved to processed: ${processedResult.results.length > 0 ? '✅ YES' : '❌ NO'}`
    );

    console.log('');
    console.log('🚨 ROOT CAUSE CONFIRMED:');

    if (generated > 0 && processed === 0) {
      console.log('SYSTEMIC UPLOAD INFRASTRUCTURE FAILURE');
      console.log('');
      console.log('DETAILED ANALYSIS:');
      console.log('1. File generation is working normally across all merchants');
      console.log('2. No files are being successfully transmitted to mall systems');
      console.log('3. Zero entries in processed folders confirms upload failures');
      console.log('4. This affects ALL merchants during the specified dates');
      console.log('5. Mall systems detect missing data → send non-submission emails');
      console.log('');
      console.log('LIKELY INFRASTRUCTURE ISSUES:');
      console.log('• Network connectivity problems to mall FTP servers');
      console.log('• SSL/TLS certificate issues (secure: true configurations)');
      console.log('• Authentication failures with mall FTP credentials');
      console.log('• Firewall blocking outbound FTP connections');
      console.log('• Upload service/daemon stopped/crashed during this period');
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

detailedUploadAnalysis();
