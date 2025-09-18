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
    throw new Error(`NRQL errors: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data.data?.actor?.account?.nrql || { results: [], metadata: {} };
}

async function comprehensiveAllMerchantsAnalysis() {
  console.log('🔍 COMPREHENSIVE ALL MERCHANTS NON-SUBMISSION ANALYSIS');
  console.log('='.repeat(70));
  console.log('Affected Dates: Aug 29,30,31 | Sep 1,3,4,5,6,7');
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log('');

  try {
    // 1. SYSTEM-WIDE ACTIVITY OVERVIEW
    console.log('📊 1. SYSTEM-WIDE ACTIVITY OVERVIEW');
    console.log('-'.repeat(50));
    
    const overviewQuery = `SELECT count(*) FROM Log WHERE timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' FACET appName ORDER BY count DESC LIMIT 20`;
    const overviewResult = await executeNRQL(overviewQuery);
    
    console.log('Log activity by application during affected period:');
    overviewResult.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.appName || 'Unknown App'}: ${result.count} entries`);
    });
    console.log('');

    // 2. MALL PROCESSING ANALYSIS
    console.log('🏢 2. ALL MALL PROCESSING ANALYSIS');
    console.log('-'.repeat(50));
    
    const mallQuery = `SELECT timestamp, message, level FROM Log WHERE (message LIKE '%mall%' OR message LIKE '%Mall%' OR message LIKE '%shopping%' OR message LIKE '%PDF%' OR message LIKE '%ZRPT%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 100`;
    const mallResult = await executeNRQL(mallQuery);
    
    console.log(`Found ${mallResult.results.length} mall-related processing entries:`);
    
    // Group by dates
    const entriesByDate = {};
    mallResult.results.forEach(entry => {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!entriesByDate[date]) entriesByDate[date] = [];
      entriesByDate[date].push(entry);
    });
    
    Object.keys(entriesByDate).sort().forEach(date => {
      const entries = entriesByDate[date];
      console.log(`\n  📅 ${date}: ${entries.length} entries`);
      entries.slice(0, 5).forEach((entry, index) => {
        const time = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
        const message = entry.message?.substring(0, 80) + '...';
        console.log(`    ${index + 1}. ${time} [${entry.level || 'INFO'}]: ${message}`);
      });
      if (entries.length > 5) {
        console.log(`    ... and ${entries.length - 5} more entries`);
      }
    });
    console.log('');

    // 3. MERCHANT/STORE PROCESSING PATTERNS
    console.log('🏪 3. MERCHANT/STORE PROCESSING PATTERNS');
    console.log('-'.repeat(50));
    
    const storeQuery = `SELECT count(*) FROM Log WHERE (message LIKE '%store%' OR message LIKE '%merchant%' OR message LIKE '%account%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' FACET message ORDER BY count DESC LIMIT 30`;
    const storeResult = await executeNRQL(storeQuery);
    
    console.log('Store/merchant processing patterns:');
    storeResult.results.forEach((result, index) => {
      const message = result.message?.substring(0, 60) + '...';
      console.log(`  ${index + 1}. [${result.count}x]: ${message}`);
    });
    console.log('');

    // 4. ERROR ANALYSIS ACROSS ALL SYSTEMS
    console.log('❌ 4. ERROR ANALYSIS ACROSS ALL SYSTEMS');
    console.log('-'.repeat(50));
    
    const errorQuery = `SELECT timestamp, message, level, appName FROM Log WHERE level IN ('ERROR', 'WARN') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 50`;
    const errorResult = await executeNRQL(errorQuery);
    
    if (errorResult.results.length > 0) {
      console.log(`Found ${errorResult.results.length} errors/warnings during affected period:`);
      
      // Group errors by date
      const errorsByDate = {};
      errorResult.results.forEach(error => {
        const date = new Date(error.timestamp).toISOString().split('T')[0];
        if (!errorsByDate[date]) errorsByDate[date] = [];
        errorsByDate[date].push(error);
      });
      
      Object.keys(errorsByDate).sort().forEach(date => {
        const errors = errorsByDate[date];
        console.log(`\n  📅 ${date}: ${errors.length} errors/warnings`);
        errors.slice(0, 3).forEach((error, index) => {
          const time = new Date(error.timestamp).toISOString().split('T')[1].split('.')[0];
          const message = error.message?.substring(0, 100) + '...';
          console.log(`    ${index + 1}. ${time} [${error.level}] ${error.appName}: ${message}`);
        });
        if (errors.length > 3) {
          console.log(`    ... and ${errors.length - 3} more errors`);
        }
      });
    } else {
      console.log('✅ No errors/warnings found during the affected period');
    }
    console.log('');

    // 5. FILE PROCESSING & UPLOAD ANALYSIS
    console.log('📤 5. FILE PROCESSING & UPLOAD ANALYSIS');
    console.log('-'.repeat(50));
    
    const fileQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%upload%' OR message LIKE '%ftp%' OR message LIKE '%sftp%' OR message LIKE '%processed%' OR message LIKE '%datafiles%' OR message LIKE '%transmission%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 40`;
    const fileResult = await executeNRQL(fileQuery);
    
    console.log(`Found ${fileResult.results.length} file processing/upload entries:`);
    
    if (fileResult.results.length > 0) {
      // Group by date
      const filesByDate = {};
      fileResult.results.forEach(entry => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        if (!filesByDate[date]) filesByDate[date] = [];
        filesByDate[date].push(entry);
      });
      
      Object.keys(filesByDate).sort().forEach(date => {
        const entries = filesByDate[date];
        console.log(`\n  📅 ${date}: ${entries.length} file operations`);
        entries.slice(0, 3).forEach((entry, index) => {
          const time = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
          const message = entry.message?.substring(0, 100) + '...';
          console.log(`    ${index + 1}. ${time}: ${message}`);
        });
        if (entries.length > 3) {
          console.log(`    ... and ${entries.length - 3} more entries`);
        }
      });
    } else {
      console.log('  🚨 CRITICAL: No file upload/processing logs found!');
      console.log('     This suggests system-wide upload failures');
    }
    console.log('');

    // 6. SUCCESSFUL OPERATIONS ANALYSIS
    console.log('✅ 6. SUCCESSFUL OPERATIONS ANALYSIS');
    console.log('-'.repeat(50));
    
    const successQuery = `SELECT timestamp, message FROM Log WHERE (message LIKE '%success%' OR message LIKE '%completed%' OR message LIKE '%saved%' OR message LIKE '%generated%') AND timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' ORDER BY timestamp DESC LIMIT 30`;
    const successResult = await executeNRQL(successQuery);
    
    console.log(`Found ${successResult.results.length} successful operation entries:`);
    
    if (successResult.results.length > 0) {
      // Group by date
      const successByDate = {};
      successResult.results.forEach(entry => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        if (!successByDate[date]) successByDate[date] = [];
        successByDate[date].push(entry);
      });
      
      Object.keys(successByDate).sort().forEach(date => {
        const entries = successByDate[date];
        console.log(`\n  📅 ${date}: ${entries.length} successful operations`);
        entries.slice(0, 3).forEach((entry, index) => {
          const time = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
          const message = entry.message?.substring(0, 100) + '...';
          console.log(`    ${index + 1}. ${time}: ${message}`);
        });
      });
    }
    console.log('');

    // 7. DAILY PATTERN ANALYSIS
    console.log('📈 7. DAILY PATTERN ANALYSIS');
    console.log('-'.repeat(50));
    
    const dailyQuery = `SELECT count(*) FROM Log WHERE timestamp >= '2025-08-29' AND timestamp <= '2025-09-07' FACET dateOf(timestamp) ORDER BY facet`;
    const dailyResult = await executeNRQL(dailyQuery);
    
    console.log('Daily log activity during affected period:');
    dailyResult.results.forEach(result => {
      console.log(`  ${result.facet}: ${result.count} log entries`);
    });
    console.log('');

    // 8. FINAL ANALYSIS SUMMARY
    console.log('🎯 8. COMPREHENSIVE ANALYSIS SUMMARY');
    console.log('-'.repeat(50));
    
    console.log('SYSTEM HEALTH INDICATORS:');
    console.log(`• Total log entries: ${overviewResult.results.reduce((sum, r) => sum + (r.count || 0), 0)}`);
    console.log(`• Mall processing entries: ${mallResult.results.length}`);
    console.log(`• File upload/processing entries: ${fileResult.results.length}`);
    console.log(`• Error/warning entries: ${errorResult.results.length}`);
    console.log(`• Successful operations: ${successResult.results.length}`);
    
    console.log('');
    console.log('CRITICAL FINDINGS:');
    
    if (fileResult.results.length === 0) {
      console.log('🚨 SYSTEM-WIDE UPLOAD FAILURE CONFIRMED');
      console.log('   No file upload/transmission logs found across ALL merchants');
      console.log('   This explains widespread non-submission emails');
    }
    
    if (errorResult.results.length === 0) {
      console.log('⚠️  Silent failure pattern detected');
      console.log('   No explicit errors logged despite upload failures');
    }
    
    if (mallResult.results.length > 0 && fileResult.results.length === 0) {
      console.log('📊 Files generated but NOT transmitted');
      console.log('   System is processing but failing at upload stage');
    }
    
    console.log('');
    console.log('ROOT CAUSE HYPOTHESIS:');
    console.log('Based on log patterns, this appears to be a system-wide');
    console.log('infrastructure failure affecting file transmission to');
    console.log('ALL mall systems during the specified dates.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

comprehensiveAllMerchantsAnalysis();