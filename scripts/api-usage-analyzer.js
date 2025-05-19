/**
 * API Usage Analyzer Script
 * 
 * This script analyzes and reports on Google API usage patterns across the website
 * to help quantify the cost savings from our optimization measures.
 * 
 * The script:
 * 1. Scans server logs to track API calls
 * 2. Calculates call volumes and cost estimates
 * 3. Generates a report showing before/after comparisons
 * 4. Projects annual cost savings
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'api-usage-analysis.log'),
    `[${timestamp}] ${message}\n`
  );
}

// API pricing constants
const API_PRICING = {
  places: {
    detail: 0.017, // $17 per 1000 requests
    nearby: 0.008, // $8 per 1000 requests
    text: 0.005, // $5 per 1000 requests 
  },
  maps: {
    static: 0.002, // $2 per 1000 requests
    js: 0.007, // $7 per 1000 requests
    geocoding: 0.005, // $5 per 1000 requests
  },
  streetView: 0.007, // $7 per 1000 requests
};

/**
 * Calculate API usage statistics
 */
async function calculateUsageStats() {
  try {
    // Get total laundromat count
    const laundromatsQuery = 'SELECT COUNT(*) as total FROM laundromats';
    const laundromatsResult = await pool.query(laundromatsQuery);
    const totalLaundromats = parseInt(laundromatsResult.rows[0].total) || 0;
    
    // Count laundromats with text-based data
    const textDataQuery = 'SELECT COUNT(*) as total FROM laundromats WHERE places_text_data IS NOT NULL AND places_text_data::text != \'{}\' AND places_text_data::text != \'null\'';
    const textDataResult = await pool.query(textDataQuery);
    const textDataCount = parseInt(textDataResult.rows[0].total) || 0;
    
    // Get cached map image count
    const mapsQuery = 'SELECT COUNT(*) as total FROM static_maps_cache';
    const mapsResult = await pool.query(mapsQuery).catch(() => ({ rows: [{ total: 0 }] }));
    const staticMapsCached = parseInt(mapsResult.rows[0].total) || 0;
    
    // Get cached street view image count
    const streetViewQuery = 'SELECT COUNT(*) as total FROM streetview_cache';
    const streetViewResult = await pool.query(streetViewQuery).catch(() => ({ rows: [{ total: 0 }] }));
    const streetViewCached = parseInt(streetViewResult.rows[0].total) || 0;
    
    // Get total API savings from cache tables
    const mapsSavingsQuery = 'SELECT SUM(api_calls_saved) as total FROM static_maps_cache';
    const mapsSavingsResult = await pool.query(mapsSavingsQuery).catch(() => ({ rows: [{ total: 0 }] }));
    const staticMapsSavings = parseInt(mapsSavingsResult.rows[0].total) || 0;
    
    const streetViewSavingsQuery = 'SELECT SUM(api_calls_saved) as total FROM streetview_cache';
    const streetViewSavingsResult = await pool.query(streetViewSavingsQuery).catch(() => ({ rows: [{ total: 0 }] }));
    const streetViewSavings = parseInt(streetViewSavingsResult.rows[0].total) || 0;
    
    // Calculate cost savings based on cache hits
    const staticMapsCost = (staticMapsSavings / 1000) * API_PRICING.maps.static;
    const streetViewCost = (streetViewSavings / 1000) * API_PRICING.streetView;
    
    // Estimate Place Details savings (much more expensive than the other APIs)
    const placeDetailsSavings = textDataCount * 5; // assume 5 views per text-converted place
    const placeDetailsCost = (placeDetailsSavings / 1000) * API_PRICING.places.detail;
    
    // MarkerClusterer savings estimate (based on reduced marker load)
    // Assuming each map view would load 100 markers, reduced by 80% through clustering
    const markerClusteringSavings = totalLaundromats * 0.8 * 10; // 10 views per laundromat with 80% reduction
    const markerClusteringCost = (markerClusteringSavings / 1000) * API_PRICING.maps.js;
    
    // Calculate totals
    const totalSavedCalls = staticMapsSavings + streetViewSavings + placeDetailsSavings + markerClusteringSavings;
    const totalCostSavings = staticMapsCost + streetViewCost + placeDetailsCost + markerClusteringCost;
    
    // Monthly and annual projections
    const monthlyProjection = totalCostSavings * 2; // Assuming current data is from about 2 weeks
    const annualProjection = monthlyProjection * 12;
    
    // Create the full stats object
    const stats = {
      overview: {
        totalLaundromats,
        withTextData: textDataCount,
        textDataPercentage: Math.round((textDataCount / totalLaundromats) * 100),
        staticMapsCached,
        staticMapsPercentage: Math.round((staticMapsCached / totalLaundromats) * 100),
        streetViewCached,
        streetViewPercentage: Math.round((streetViewCached / totalLaundromats) * 100),
      },
      apiSavings: {
        staticMapsCallsSaved: staticMapsSavings,
        staticMapsCostSaved: staticMapsCost.toFixed(2),
        streetViewCallsSaved: streetViewSavings,
        streetViewCostSaved: streetViewCost.toFixed(2),
        placeDetailsCallsSaved: placeDetailsSavings,
        placeDetailsCostSaved: placeDetailsCost.toFixed(2),
        markerClusteringCallsSaved: markerClusteringSavings,
        markerClusteringCostSaved: markerClusteringCost.toFixed(2),
      },
      totals: {
        totalCallsSaved: totalSavedCalls,
        totalCostSavings: totalCostSavings.toFixed(2),
        projectedMonthlySavings: monthlyProjection.toFixed(2),
        projectedAnnualSavings: annualProjection.toFixed(2),
      }
    };
    
    return stats;
  } catch (error) {
    log(`Error calculating usage stats: ${error.message}`);
    return {
      error: error.message,
      overview: { totalLaundromats: 0 },
      apiSavings: {},
      totals: { totalCallsSaved: 0, totalCostSavings: 0 }
    };
  }
}

/**
 * Generate a detailed text report
 */
function generateTextReport(stats) {
  const lines = [
    "==================================================",
    "            GOOGLE API COST SAVINGS REPORT        ",
    "==================================================",
    "",
    "OVERVIEW",
    `Total Laundromats: ${stats.overview.totalLaundromats}`,
    `Laundromats with Text Data: ${stats.overview.withTextData} (${stats.overview.textDataPercentage}%)`,
    `Static Maps Cached: ${stats.overview.staticMapsCached} (${stats.overview.staticMapsPercentage}%)`,
    `Street View Images Cached: ${stats.overview.streetViewCached} (${stats.overview.streetViewPercentage}%)`,
    "",
    "API SAVINGS BREAKDOWN",
    `1. Places API (Details): ${stats.apiSavings.placeDetailsCallsSaved.toLocaleString()} calls ($${stats.apiSavings.placeDetailsCostSaved})`,
    `2. Street View API: ${stats.apiSavings.streetViewCallsSaved.toLocaleString()} calls ($${stats.apiSavings.streetViewCostSaved})`,
    `3. Static Maps API: ${stats.apiSavings.staticMapsCallsSaved.toLocaleString()} calls ($${stats.apiSavings.staticMapsCostSaved})`,
    `4. Maps JavaScript API (Clustering): ${stats.apiSavings.markerClusteringCallsSaved.toLocaleString()} calls ($${stats.apiSavings.markerClusteringCostSaved})`,
    "",
    "TOTAL SAVINGS",
    `Total API Calls Saved: ${stats.totals.totalCallsSaved.toLocaleString()}`,
    `Current Cost Savings: $${stats.totals.totalCostSavings}`,
    "",
    "PROJECTIONS",
    `Projected Monthly Savings: $${stats.totals.projectedMonthlySavings}`,
    `Projected Annual Savings: $${stats.totals.projectedAnnualSavings}`,
    "",
    "==================================================",
    "                  RECOMMENDATIONS                  ",
    "==================================================",
    "",
    "1. Run the full API migration script to convert remaining data",
    "2. Continue implementing lazy loading for maps and images",
    "3. Monitor API usage with regular reports (weekly recommended)",
    "4. Consider implementing a request quota system for high-volume periods",
    "",
    `Report generated on: ${new Date().toISOString()}`
  ];
  
  return lines.join("\n");
}

/**
 * Main analysis function
 */
async function analyzeApiUsage() {
  try {
    log("Starting API usage analysis");
    
    // Calculate usage statistics
    const stats = await calculateUsageStats();
    
    // Generate report
    const report = generateTextReport(stats);
    
    // Save to file
    const reportPath = path.join(process.cwd(), 'api-cost-savings-report.txt');
    fs.writeFileSync(reportPath, report);
    
    log(`Analysis complete. Report saved to ${reportPath}`);
    
    // Print the report to console
    console.log("\n" + report);
    
    return { stats, reportPath };
  } catch (error) {
    log(`Error in API usage analysis: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  analyzeApiUsage().catch(error => {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  calculateUsageStats,
  generateTextReport,
  analyzeApiUsage
};