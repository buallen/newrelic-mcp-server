#!/usr/bin/env node
/**
 * Test script for NewRelic MCP Server
 */

// Load environment variables from .env file
require('dotenv').config();

const { newRelicClient } = require('./simple-server.js');

async function testNewRelicConnection() {
  console.log('🧪 Testing NewRelic MCP Server...\n');

  try {
    // Test 1: Basic connection test
    console.log('1. Testing basic incident retrieval...');
    const incidents = await newRelicClient.getIncidents({ only_open: true });
    console.log(`✅ Retrieved ${incidents.length} open incidents\n`);

    // Test 2: Search for campaign-related incidents
    console.log('2. Searching for campaign-related incidents...');
    const campaignIncidents = await newRelicClient.searchIncidents('campaign');
    console.log(`✅ Found ${campaignIncidents.length} campaign-related incidents\n`);

    // Test 3: NRQL query test
    console.log('3. Testing NRQL query...');
    const nrqlResult = await newRelicClient.executeNRQL(
      "SELECT count(*) FROM Transaction WHERE appName LIKE '%campaign%' SINCE 1 day ago"
    );
    console.log(`✅ NRQL query executed successfully`);
    console.log('Results:', JSON.stringify(nrqlResult.results, null, 2));

    console.log('\n🎉 All tests passed! NewRelic MCP Server is working.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Provide troubleshooting information
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your NEW_RELIC_API_KEY environment variable');
    console.log('2. Check your NEW_RELIC_ACCOUNT_ID environment variable');
    console.log('3. Ensure your API key has the necessary permissions');
    console.log('\nCurrent configuration:');
    const apiKey = process.env.NEWRELIC_API_KEY || process.env.NEW_RELIC_API_KEY;
    const accountId = process.env.NEWRELIC_ACCOUNT_ID || process.env.NEW_RELIC_ACCOUNT_ID;
    console.log('- API Key:', apiKey ? '✅ Set (' + apiKey.substring(0, 8) + '...)' : '❌ Not set');
    console.log('- Account ID:', accountId || 'Using default: 1234567');
    
    process.exit(1);
  }
}

async function testCampaignServiceAnalysis() {
  console.log('\n📊 Campaign Service Incident Analysis...\n');

  try {
    // Search for campaign service incidents
    const campaignIncidents = await newRelicClient.searchIncidents('campaign');
    
    if (campaignIncidents.length === 0) {
      console.log('ℹ️  No campaign-related incidents found in the last 24 hours');
      return;
    }

    // Analyze incidents
    const analysis = {
      total: campaignIncidents.length,
      byPriority: {},
      byState: {},
      recentIncidents: campaignIncidents.slice(0, 5),
      timeRange: '24 hours'
    };

    campaignIncidents.forEach(incident => {
      analysis.byPriority[incident.priority] = (analysis.byPriority[incident.priority] || 0) + 1;
      analysis.byState[incident.state] = (analysis.byState[incident.state] || 0) + 1;
    });

    console.log('📈 Campaign Service Incident Summary:');
    console.log(`- Total incidents: ${analysis.total}`);
    console.log(`- By priority:`, analysis.byPriority);
    console.log(`- By state:`, analysis.byState);
    
    if (analysis.recentIncidents.length > 0) {
      console.log('\n🔍 Recent Campaign Incidents:');
      analysis.recentIncidents.forEach((incident, index) => {
        console.log(`${index + 1}. ${incident.title || 'Untitled'}`);
        console.log(`   Priority: ${incident.priority}, State: ${incident.state}`);
        console.log(`   Updated: ${incident.updatedAt}`);
        if (incident.entity) {
          console.log(`   Entity: ${incident.entity.name} (${incident.entity.type})`);
        }
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Campaign analysis failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  (async () => {
    await testNewRelicConnection();
    await testCampaignServiceAnalysis();
  })().catch(console.error);
}