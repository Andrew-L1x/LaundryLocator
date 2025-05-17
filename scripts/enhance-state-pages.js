/**
 * State Page Enhancement Script
 * 
 * This script adds rich, informative content to each state page
 * including service availability, climate-specific laundry tips,
 * and state-specific laundromat information.
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to log operations
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  fs.appendFileSync('state-enhancement.log', `${new Date().toISOString()} - ${message}\n`);
}

// Define state-specific climate information
const stateClimateInfo = {
  'AL': { climate: 'humid subtropical', challenges: ['high humidity', 'frequent rain', 'hot summers'] },
  'AK': { climate: 'subarctic to polar', challenges: ['extremely cold winters', 'snow', 'limited daylight'] },
  'AZ': { climate: 'desert', challenges: ['extreme heat', 'dust', 'dry conditions'] },
  'AR': { climate: 'humid subtropical', challenges: ['high humidity', 'severe storms', 'tornados'] },
  'CA': { climate: 'varied (Mediterranean to desert)', challenges: ['drought', 'wildfires', 'coastal humidity'] },
  'CO': { climate: 'highland continental', challenges: ['snow', 'dry air', 'temperature fluctuations'] },
  'CT': { climate: 'humid continental', challenges: ['cold winters', 'humid summers', 'variable weather'] },
  'DE': { climate: 'humid subtropical', challenges: ['humidity', 'coastal moisture', 'moderate winters'] },
  'FL': { climate: 'tropical to subtropical', challenges: ['extreme humidity', 'hurricanes', 'mold risk'] },
  'GA': { climate: 'humid subtropical', challenges: ['high humidity', 'hot summers', 'pollen'] },
  'HI': { climate: 'tropical', challenges: ['constant humidity', 'salt air', 'mold risk'] },
  'ID': { climate: 'varied continental', challenges: ['dry air', 'cold winters', 'dust'] },
  'IL': { climate: 'humid continental', challenges: ['harsh winters', 'humid summers', 'temperature extremes'] },
  'IN': { climate: 'humid continental', challenges: ['cold winters', 'hot summers', 'variable weather'] },
  'IA': { climate: 'humid continental', challenges: ['cold winters', 'hot summers', 'agricultural dust'] },
  'KS': { climate: 'continental', challenges: ['tornadoes', 'dust', 'temperature extremes'] },
  'KY': { climate: 'humid subtropical', challenges: ['humidity', 'seasonal allergies', 'variable weather'] },
  'LA': { climate: 'humid subtropical', challenges: ['extreme humidity', 'hurricanes', 'flooding'] },
  'ME': { climate: 'humid continental', challenges: ['harsh winters', 'coastal moisture', 'salt exposure'] },
  'MD': { climate: 'humid subtropical', challenges: ['hot summers', 'cold winters', 'coastal humidity'] },
  'MA': { climate: 'humid continental', challenges: ['harsh winters', 'coastal moisture', 'variable seasons'] },
  'MI': { climate: 'humid continental', challenges: ['lake effect snow', 'humid summers', 'variable weather'] },
  'MN': { climate: 'humid continental', challenges: ['extreme cold winters', 'snow', 'humid summers'] },
  'MS': { climate: 'humid subtropical', challenges: ['high humidity', 'hot summers', 'heavy rainfall'] },
  'MO': { climate: 'humid continental', challenges: ['temperature extremes', 'tornadoes', 'humidity'] },
  'MT': { climate: 'semi-arid continental', challenges: ['cold winters', 'dry air', 'dust'] },
  'NE': { climate: 'humid continental', challenges: ['temperature extremes', 'tornadoes', 'agricultural dust'] },
  'NV': { climate: 'desert', challenges: ['extreme heat', 'very dry air', 'dust'] },
  'NH': { climate: 'humid continental', challenges: ['harsh winters', 'variable weather', 'seasonal changes'] },
  'NJ': { climate: 'humid subtropical to continental', challenges: ['coastal humidity', 'variable seasons', 'urban pollution'] },
  'NM': { climate: 'arid to semi-arid', challenges: ['dust', 'dry conditions', 'temperature fluctuations'] },
  'NY': { climate: 'humid continental', challenges: ['harsh winters', 'urban pollution', 'variable weather'] },
  'NC': { climate: 'humid subtropical', challenges: ['humidity', 'coastal moisture', 'hurricanes'] },
  'ND': { climate: 'continental', challenges: ['extreme cold', 'windchill', 'blizzards'] },
  'OH': { climate: 'humid continental', challenges: ['variable seasons', 'lake effect weather', 'humidity'] },
  'OK': { climate: 'humid subtropical to continental', challenges: ['tornadoes', 'dust', 'temperature extremes'] },
  'OR': { climate: 'varied (Mediterranean to subarctic)', challenges: ['coastal humidity', 'rainy seasons', 'mold risk'] },
  'PA': { climate: 'humid continental', challenges: ['cold winters', 'humid summers', 'variable weather'] },
  'RI': { climate: 'humid continental', challenges: ['coastal moisture', 'winter storms', 'variable seasons'] },
  'SC': { climate: 'humid subtropical', challenges: ['high humidity', 'hurricanes', 'coastal challenges'] },
  'SD': { climate: 'continental', challenges: ['extreme temperatures', 'low humidity', 'wind'] },
  'TN': { climate: 'humid subtropical', challenges: ['humidity', 'allergens', 'variable weather'] },
  'TX': { climate: 'varied (subtropical to arid)', challenges: ['extreme heat', 'humidity along coast', 'dust in west'] },
  'UT': { climate: 'semi-arid to desert', challenges: ['dry conditions', 'dust', 'temperature fluctuations'] },
  'VT': { climate: 'humid continental', challenges: ['harsh winters', 'mud season', 'seasonal allergies'] },
  'VA': { climate: 'humid subtropical', challenges: ['high humidity', 'seasonal changes', 'coastal moisture'] },
  'WA': { climate: 'varied (oceanic to subarctic)', challenges: ['constant rain in west', 'mold risk', 'seasonal changes'] },
  'WV': { climate: 'humid continental', challenges: ['mountainous climate variations', 'seasonal changes', 'humidity'] },
  'WI': { climate: 'humid continental', challenges: ['extreme cold', 'lake effect weather', 'humid summers'] },
  'WY': { climate: 'semi-arid continental', challenges: ['extreme wind', 'dry air', 'dust'] },
  'DC': { climate: 'humid subtropical', challenges: ['urban pollution', 'humidity', 'variable weather'] }
};

// Function to generate climate-specific laundry tips
function generateClimateTips(stateAbbr, stateName) {
  const climateInfo = stateClimateInfo[stateAbbr] || { 
    climate: 'varied', 
    challenges: ['seasonal changes', 'local weather patterns', 'regional conditions'] 
  };
  
  const tips = [];
  
  // General opening
  tips.push(`<h3>Laundry Tips for ${stateName}'s ${climateInfo.climate.charAt(0).toUpperCase() + climateInfo.climate.slice(1)} Climate</h3>`);
  tips.push(`<p>${stateName}'s ${climateInfo.climate} climate presents specific laundry challenges including ${climateInfo.challenges.join(', ')}. Here are some tailored tips for keeping your clothes clean and fresh in these conditions:</p>`);
  
  // Climate-specific tips
  if (climateInfo.challenges.includes('high humidity') || climateInfo.challenges.includes('extreme humidity') || climateInfo.challenges.includes('humidity')) {
    tips.push(`<h4>Dealing with ${stateName}'s Humidity</h4>`);
    tips.push(`
      <ul>
        <li>Use anti-mildew laundry additives to prevent musty odors in clothes</li>
        <li>Avoid letting damp clothes sit in laundry baskets or machines</li>
        <li>Consider using dehumidifiers in laundry areas at home</li>
        <li>Look for laundromats with climate-controlled drying areas</li>
      </ul>
    `);
  }
  
  if (climateInfo.challenges.includes('extreme heat') || climateInfo.challenges.includes('hot summers')) {
    tips.push(`<h4>Laundry Tips for ${stateName}'s Hot Weather</h4>`);
    tips.push(`
      <ul>
        <li>Wash sweat-prone clothing promptly to prevent staining and odors</li>
        <li>Use cold water cycles to save energy and prevent heat damage to fabrics</li>
        <li>Consider line-drying clothes outdoors to take advantage of the natural heat</li>
        <li>Look for laundromats with air conditioning for a more comfortable experience</li>
      </ul>
    `);
  }
  
  if (climateInfo.challenges.includes('cold winters') || climateInfo.challenges.includes('harsh winters') || climateInfo.challenges.includes('extreme cold')) {
    tips.push(`<h4>Winter Laundry Solutions in ${stateName}</h4>`);
    tips.push(`
      <ul>
        <li>Wash heavy winter items like coats and blankets at laundromats with large-capacity machines</li>
        <li>Use fabric softener to prevent static electricity in dry winter conditions</li>
        <li>Consider drying bulky items at laundromats to avoid overloading home dryers</li>
        <li>Check care labels carefully on winter gear to prevent shrinkage or damage</li>
      </ul>
    `);
  }
  
  if (climateInfo.challenges.includes('dust') || climateInfo.challenges.includes('agricultural dust')) {
    tips.push(`<h4>Dealing with ${stateName}'s Dust and Particulates</h4>`);
    tips.push(`
      <ul>
        <li>Pre-treat heavily soiled work clothes and outdoor gear before washing</li>
        <li>Use an extra rinse cycle for items exposed to significant dust</li>
        <li>Consider high-efficiency detergents that are better at removing particulates</li>
        <li>Seek out laundromats with specialized stain-removal stations</li>
      </ul>
    `);
  }
  
  // General closing with call to action
  tips.push(`<p>Many laundromats in ${stateName} offer specialized equipment and services designed for our local climate conditions. Look for facilities with large-capacity washers for bulky items, powerful dryers for efficient drying, and professional-grade detergents formulated for our regional water conditions.</p>`);
  
  return tips.join('\n');
}

// Function to generate state-specific laundromat information
async function generateStateInfo(stateAbbr, stateName, stateId, client) {
  // Get laundromat counts by city
  const cityCountsResult = await client.query(`
    SELECT COUNT(l.id) as count, c.name, c.slug
    FROM laundromats l
    JOIN cities c ON l.city = c.name AND (l.state = c.state OR l.state = $1)
    WHERE l.state = $1 OR l.state = $2
    GROUP BY c.name, c.slug
    ORDER BY count DESC
    LIMIT 8
  `, [stateAbbr, stateName]);
  
  const topCities = cityCountsResult.rows;
  
  // Get service availability percentages
  const servicesQuery = `
    SELECT 
      ROUND(100.0 * SUM(CASE WHEN self_service = true THEN 1 ELSE 0 END) / COUNT(*)) as self_service_pct,
      ROUND(100.0 * SUM(CASE WHEN full_service = true THEN 1 ELSE 0 END) / COUNT(*)) as full_service_pct,
      ROUND(100.0 * SUM(CASE WHEN wifi = true THEN 1 ELSE 0 END) / COUNT(*)) as wifi_pct,
      ROUND(100.0 * SUM(CASE WHEN pickup = true THEN 1 ELSE 0 END) / COUNT(*)) as pickup_pct,
      ROUND(100.0 * SUM(CASE WHEN delivery = true THEN 1 ELSE 0 END) / COUNT(*)) as delivery_pct,
      ROUND(100.0 * SUM(CASE WHEN dry_cleaning = true THEN 1 ELSE 0 END) / COUNT(*)) as dry_cleaning_pct
    FROM laundromats
    WHERE state = $1 OR state = $2
  `;
  
  const servicesResult = await client.query(servicesQuery, [stateAbbr, stateName]);
  const services = servicesResult.rows[0];
  
  // Get average rating
  const ratingQuery = `
    SELECT ROUND(AVG(CAST(rating AS NUMERIC)), 1) as avg_rating
    FROM laundromats
    WHERE (state = $1 OR state = $2) AND rating IS NOT NULL AND rating != ''
  `;
  
  const ratingResult = await client.query(ratingQuery, [stateAbbr, stateName]);
  const avgRating = ratingResult.rows[0].avg_rating || 'Not available';
  
  // Generate HTML content
  const content = [];
  
  // Popular cities section
  content.push(`<h3>Popular Cities for Laundromats in ${stateName}</h3>`);
  content.push(`<p>${stateName} offers numerous laundromat options across its many cities and towns. The following areas have the highest concentration of laundry facilities:</p>`);
  
  if (topCities.length > 0) {
    content.push('<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-6">');
    topCities.forEach(city => {
      content.push(`
        <div class="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <h4 class="font-semibold text-lg">${city.name}</h4>
          <p class="text-gray-700">${city.count} laundromats available</p>
          <a href="/laundromats/${city.slug}" class="text-sm text-blue-600 hover:underline">View laundromats in ${city.name}</a>
        </div>
      `);
    });
    content.push('</div>');
  }
  
  // Services section
  content.push(`<h3>Laundromat Services in ${stateName}</h3>`);
  content.push(`<p>Laundromats across ${stateName} offer a variety of services to meet your needs. Based on our directory data:</p>`);
  
  content.push(`
    <div class="mt-4 mb-6">
      <div class="bg-white rounded-lg border overflow-hidden">
        <div class="grid grid-cols-2 md:grid-cols-3 text-center">
          <div class="p-4 border-r border-b">
            <span class="block text-2xl font-bold text-blue-600">${services.self_service_pct}%</span>
            <span class="text-gray-600">Self-Service</span>
          </div>
          <div class="p-4 border-b md:border-r">
            <span class="block text-2xl font-bold text-blue-600">${services.full_service_pct}%</span>
            <span class="text-gray-600">Full-Service</span>
          </div>
          <div class="p-4 border-r border-b">
            <span class="block text-2xl font-bold text-blue-600">${services.wifi_pct}%</span>
            <span class="text-gray-600">Free WiFi</span>
          </div>
          <div class="p-4 border-b md:border-r">
            <span class="block text-2xl font-bold text-blue-600">${services.pickup_pct}%</span>
            <span class="text-gray-600">Pickup Service</span>
          </div>
          <div class="p-4 border-r md:border-b">
            <span class="block text-2xl font-bold text-blue-600">${services.delivery_pct}%</span>
            <span class="text-gray-600">Delivery Service</span>
          </div>
          <div class="p-4">
            <span class="block text-2xl font-bold text-blue-600">${services.dry_cleaning_pct}%</span>
            <span class="text-gray-600">Dry Cleaning</span>
          </div>
        </div>
      </div>
    </div>
  `);
  
  // Climate-specific tips
  content.push(generateClimateTips(stateAbbr, stateName));
  
  // Rating and quality section
  content.push(`<h3>Laundromat Quality in ${stateName}</h3>`);
  content.push(`<p>The average customer rating for laundromats in ${stateName} is <strong>${avgRating}</strong> out of 5 stars, based on user reviews and ratings. ${stateName} laundromats are known for their ${avgRating >= 4 ? 'excellent' : avgRating >= 3.5 ? 'good' : 'varying'} service quality and cleanliness standards.</p>`);
  
  content.push(`<p>When choosing a laundromat in ${stateName}, look for facilities that offer:</p>`);
  content.push(`
    <ul class="list-disc pl-5 mb-6">
      <li>Well-maintained machines with clear operating instructions</li>
      <li>Clean and well-lit facilities with comfortable waiting areas</li>
      <li>Convenient operating hours that fit your schedule</li>
      <li>Fair pricing and multiple payment options</li>
      <li>Helpful attendants who can assist with any issues</li>
    </ul>
  `);
  
  // Final recommendations
  content.push(`<p>Our directory helps you find the best laundromats in ${stateName} based on your specific needs and location. Use our search filters to narrow down options by services, hours, and customer ratings.</p>`);
  
  return content.join('\n');
}

// Main function to enhance state pages
async function enhanceStatePages() {
  const client = await pool.connect();
  
  try {
    log('Starting state page enhancement process');
    
    // Get all states
    const statesResult = await client.query(`
      SELECT id, name, abbr, slug, laundry_count 
      FROM states 
      WHERE name != 'Unknown' AND abbr != '' 
      ORDER BY name
    `);
    
    const states = statesResult.rows;
    log(`Found ${states.length} states to enhance`);
    
    // Process each state
    for (const state of states) {
      log(`Enhancing content for ${state.name} (${state.abbr})`);
      
      try {
        // Generate rich content for this state
        const stateInfo = await generateStateInfo(state.abbr, state.name, state.id, client);
        
        // Create object to store enhanced content
        const enhancedContent = {
          stateInfo,
          services: {
            title: `Laundromat Services in ${state.name}`,
            content: `Find a variety of laundromat services across ${state.name}, including self-service facilities, full-service options with wash and fold, and specialized services like dry cleaning.`
          },
          cities: {
            title: `Cities with Laundromats in ${state.name}`,
            content: `Browse our directory of laundromats in ${state.name} cities and towns. From major urban centers to smaller communities, we've cataloged laundry facilities throughout the state.`
          },
          tips: {
            title: `${state.name} Laundry Tips`,
            content: `Get advice for dealing with ${state.name}'s specific climate conditions and regional laundry challenges. Our tips help you keep clothes clean and fresh year-round.`
          }
        };
        
        // Convert to JSON
        const contentJson = JSON.stringify(enhancedContent);
        
        // Update the state with enhanced content
        await client.query(
          'UPDATE states SET enhanced_content = $1 WHERE id = $2',
          [contentJson, state.id]
        );
        
        log(`Successfully enhanced ${state.name} page`);
      } catch (stateError) {
        log(`Error enhancing ${state.name} page: ${stateError.message}`);
        // Continue with next state
      }
    }
    
    log('State page enhancement completed');
    console.log('State pages have been enhanced with rich content. Check state-enhancement.log for details.');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error('Error enhancing state pages:', error);
  } finally {
    client.release();
  }
}

// Check if enhanced_content column exists in states table
async function ensureEnhancedContentColumn() {
  const client = await pool.connect();
  
  try {
    log('Checking for enhanced_content column in states table');
    
    // Check if column exists
    const columnCheckResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'states' AND column_name = 'enhanced_content'
    `);
    
    if (columnCheckResult.rows.length === 0) {
      log('Adding enhanced_content column to states table');
      
      // Add the column
      await client.query(`
        ALTER TABLE states 
        ADD COLUMN enhanced_content JSONB
      `);
      
      log('Successfully added enhanced_content column');
    } else {
      log('enhanced_content column already exists');
    }
    
    return true;
  } catch (error) {
    log(`ERROR checking/adding column: ${error.message}`);
    console.error('Error with database schema:', error);
    return false;
  } finally {
    client.release();
  }
}

// Run the main function
async function main() {
  try {
    // First ensure the column exists
    const columnReady = await ensureEnhancedContentColumn();
    
    if (columnReady) {
      // Then enhance the state pages
      await enhanceStatePages();
    } else {
      console.error('Could not proceed with state enhancement due to database schema issues');
    }
  } finally {
    // Close the pool
    pool.end();
  }
}

main().catch(console.error);