#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// These should be set as environment variables
const API_KEY = process.env.NEW_RELIC_API_KEY || 'NRAK-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const ACCOUNT_ID = process.env.NEW_RELIC_ACCOUNT_ID || '4388596';

async function analyzeErrorLogs() {
  const queries = [
    {
      name: 'Error Logs in Specific Time Range',
      nrql: `SELECT level, message FROM Log WHERE allColumnSearch('[error]', insensitive: true) SINCE 1756918719894 UNTIL 1756919142347`,
    },
    {
      name: 'All Error Logs Today',
      nrql: `SELECT level, message FROM Log WHERE level = 'error' SINCE today`,
    },
    {
      name: 'Transaction API Errors',
      nrql: `SELECT message FROM Log WHERE message LIKE '%transactionsIncludeOnline%' OR message LIKE '%Failed to download%' SINCE 1 day ago`,
    },
    {
      name: 'Date Related Errors',
      nrql: `SELECT message FROM Log WHERE message LIKE '%2023-12-09%' OR message LIKE '%656095462daff80007eff192%' SINCE 1 day ago`,
    },
  ];

  for (const queryObj of queries) {
    console.log(`\n🔍 Executing: ${queryObj.name}`);
    console.log(`📝 NRQL: ${queryObj.nrql}`);
    console.log('=' * 80);

    try {
      const graphqlQuery = {
        query: `{
                    actor {
                        account(id: ${ACCOUNT_ID}) {
                            nrql(query: "${queryObj.nrql.replace(/"/g, '\\"')}") {
                                results
                                metadata {
                                    timeWindow {
                                        since
                                        until
                                    }
                                }
                            }
                        }
                    }
                }`,
      };

      const response = await axios.post('https://api.newrelic.com/graphql', graphqlQuery, {
        headers: {
          'Api-Key': API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      if (response.data.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
        continue;
      }

      const results = response.data.data?.actor?.account?.nrql?.results;
      const metadata = response.data.data?.actor?.account?.nrql?.metadata;

      if (!results || results.length === 0) {
        console.log('ℹ️  No results found');
        continue;
      }

      console.log(`✅ Found ${results.length} log entries`);
      if (metadata?.timeWindow) {
        console.log(`⏰ Time window: ${metadata.timeWindow.since} to ${metadata.timeWindow.until}`);
      }

      console.log('\n📋 Results:');
      results.forEach((log, index) => {
        console.log(`\n[${index + 1}]`);
        if (log.level) console.log(`   Level: ${log.level}`);
        if (log.message) {
          console.log(`   Message: ${log.message}`);

          // Highlight specific patterns we're looking for
          if (log.message.includes('2023-12-09')) {
            console.log('   🎯 FOUND: Contains 2023-12-09 date issue!');
          }
          if (log.message.includes('656095462daff80007eff192')) {
            console.log('   🎯 FOUND: Contains petitemaison store ID!');
          }
          if (log.message.includes('transactionsIncludeOnline')) {
            console.log('   🎯 FOUND: Transaction API error!');
          }
        }
        console.log('   ' + '-'.repeat(60));
      });

      // Save individual query results
      const fileName = `error_analysis_${queryObj.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      fs.writeFileSync(
        fileName,
        JSON.stringify(
          {
            query: queryObj.nrql,
            metadata: metadata,
            results: results,
            analysis: {
              totalResults: results.length,
              dateIssues: results.filter(r => r.message?.includes('2023-12-09')).length,
              storeIdMatches: results.filter(r => r.message?.includes('656095462daff80007eff192'))
                .length,
              transactionApiErrors: results.filter(r =>
                r.message?.includes('transactionsIncludeOnline')
              ).length,
            },
          },
          null,
          2
        )
      );
      console.log(`💾 Saved to: ${fileName}`);
    } catch (error) {
      console.error(`❌ Error executing ${queryObj.name}:`, error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        if (error.response.data) {
          console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
  }

  console.log('\n🎉 Analysis complete! Check the generated JSON files for detailed results.');
}

if (require.main === module) {
  if (!process.env.NEW_RELIC_API_KEY || !process.env.NEW_RELIC_ACCOUNT_ID) {
    console.log('⚠️  Please set environment variables:');
    console.log('   export NEW_RELIC_API_KEY="your_api_key_here"');
    console.log('   export NEW_RELIC_ACCOUNT_ID="your_account_id_here"');
    console.log('\n   Then run: node analyze_error_logs_specific.js');
    process.exit(1);
  }

  analyzeErrorLogs().catch(console.error);
}
