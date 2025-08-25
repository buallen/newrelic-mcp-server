#!/usr/bin/env node
/**
 * Demo test for NewRelic MCP Server functionality
 */

const { newRelicClient } = require('./demo-server.js');

async function runDemo() {
  console.log('🎭 NewRelic MCP Server Demo - Campaign Service Analysis\n');
  console.log('📊 Using mock data to demonstrate incident analysis capabilities\n');

  try {
    // Demo 1: Get all campaign incidents
    console.log('='.repeat(60));
    console.log('1. 📋 Campaign Service Incidents Overview');
    console.log('='.repeat(60));
    
    const allIncidents = await newRelicClient.getIncidents();
    console.log(`Found ${allIncidents.length} campaign-related incidents:`);
    
    allIncidents.forEach((incident, index) => {
      console.log(`\n${index + 1}. ${incident.title}`);
      console.log(`   📊 Priority: ${incident.priority} | State: ${incident.state}`);
      console.log(`   🕒 Updated: ${new Date(incident.updatedAt).toLocaleString()}`);
      console.log(`   🎯 Entity: ${incident.entity.name}`);
      console.log(`   🔍 Root Cause: ${incident.rootCause}`);
      if (incident.metrics) {
        console.log(`   📈 Metrics:`, JSON.stringify(incident.metrics, null, 6));
      }
    });

    // Demo 2: Search for open incidents only
    console.log('\n' + '='.repeat(60));
    console.log('2. 🚨 Open Campaign Incidents Only');
    console.log('='.repeat(60));
    
    const openIncidents = await newRelicClient.getIncidents({ only_open: true });
    console.log(`Found ${openIncidents.length} open incidents requiring attention\n`);

    // Demo 3: NRQL Query examples
    console.log('='.repeat(60));
    console.log('3. 📈 Campaign Service Error Analysis (NRQL)');
    console.log('='.repeat(60));
    
    const errorData = await newRelicClient.executeNRQL(
      "SELECT * FROM TransactionError WHERE appName LIKE '%campaign%' SINCE 1 day ago"
    );
    
    console.log('Top Campaign Service Errors:');
    errorData.results.forEach((error, index) => {
      console.log(`${index + 1}. ${error['error.message']}: ${error.count} occurrences`);
    });

    // Demo 4: Performance trends
    console.log('\n' + '='.repeat(60));
    console.log('4. ⚡ Campaign Service Performance Trends');
    console.log('='.repeat(60));
    
    const perfData = await newRelicClient.executeNRQL(
      "SELECT average(duration), count(*) FROM Transaction WHERE appName LIKE '%campaign%' SINCE 1 day ago TIMESERIES 1 hour"
    );
    
    console.log('Performance Timeline:');
    perfData.results.forEach((point, index) => {
      console.log(`${index + 1}. ${new Date(point.timestamp).toLocaleTimeString()}: Avg ${point.avg_duration}ms, ${point.throughput} req/min`);
    });

    // Demo 5: Analysis summary
    console.log('\n' + '='.repeat(60));
    console.log('5. 🎯 Campaign Service Health Summary');
    console.log('='.repeat(60));
    
    const criticalCount = allIncidents.filter(i => i.priority === 'CRITICAL').length;
    const openCount = allIncidents.filter(i => i.state === 'OPEN' || i.state === 'ACKNOWLEDGED').length;
    
    console.log(`📊 Incident Summary:`);
    console.log(`   • Total incidents: ${allIncidents.length}`);
    console.log(`   • Critical incidents: ${criticalCount}`);
    console.log(`   • Open/Acknowledged: ${openCount}`);
    console.log(`   • Resolution rate: ${Math.round(((allIncidents.length - openCount) / allIncidents.length) * 100)}%`);

    console.log(`\n🔧 Key Issues Identified:`);
    console.log(`   • gRPC timeout configuration needs optimization`);
    console.log(`   • Memory leak in batch SMS processing`);
    console.log(`   • Rate limiting needed for batch operations`);
    
    console.log(`\n✅ Recommended Actions:`);
    console.log(`   1. Update gRPC keep-alive from 2 hours to 30 seconds`);
    console.log(`   2. Implement batch operation rate limiting (≤100/batch)`);
    console.log(`   3. Add structured error logging and monitoring`);
    console.log(`   4. Implement circuit breaker pattern for resilience`);

    console.log('\n🎉 Demo completed! NewRelic MCP Server is working perfectly.');
    console.log('💡 Replace demo data with real NewRelic API credentials for live analysis.');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}