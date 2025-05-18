import { Router } from 'express';
import { db, pool } from '../db';
import { states, cities, laundromats, laundryTips } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Maximum URLs per sitemap file
const MAX_URLS_PER_FILE = 10000;

/**
 * Generate sitemap XML content for a list of URLs
 */
function generateSitemapXml(urls: Array<{loc: string, lastmod?: string, priority?: string}>) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    if (url.priority) {
      xml += `    <priority>${url.priority}</priority>\n`;
    }
    xml += '  </url>\n';
  }
  
  xml += '</urlset>';
  return xml;
}

/**
 * Generate a sitemap index file that references all individual sitemap files
 */
function generateSitemapIndex(sitemapUrls: string[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const url of sitemapUrls) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${url}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }
  
  xml += '</sitemapindex>';
  return xml;
}

/**
 * Format a date string or Date object into YYYY-MM-DD format for sitemaps
 */
function formatDate(date: Date | string | null): string | undefined {
  if (!date) return undefined;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
  } catch (e) {
    return undefined;
  }
}

/**
 * Main sitemap index that references all other sitemaps
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get counts to determine how many sitemap files we need
    const statesCount = await db.select({ count: states.id }).from(states);
    const citiesCount = await db.select({ count: cities.id }).from(cities);
    const laundromatCountQuery = `SELECT COUNT(*) FROM laundromats`;
    const laundromatCountResult = await pool.query(laundromatCountQuery);
    const tipsCountQuery = `SELECT COUNT(*) FROM laundry_tips`;
    const tipsCountResult = await pool.query(tipsCountQuery);

    const totalStates = statesCount.length > 0 ? Number(statesCount[0].count) : 0;
    const totalCities = citiesCount.length > 0 ? Number(citiesCount[0].count) : 0;
    const totalLaundromats = parseInt(laundromatCountResult.rows[0].count);
    const totalTips = parseInt(tipsCountResult.rows[0].count);

    // Calculate number of sitemap files needed (static pages + states + cities + laundromats)
    const totalUrls = 1 + totalStates + totalCities + totalLaundromats + totalTips;
    const neededSitemaps = Math.ceil(totalUrls / MAX_URLS_PER_FILE);
    
    // Build the URLs to all the sitemap files
    const baseUrl = `https://${req.headers.host || 'laundromatlocator.com'}`;
    const sitemapUrls = [];
    
    // Always include the main content sitemap
    sitemapUrls.push(`${baseUrl}/sitemap-main.xml`);
    
    // Add laundromat sitemaps (chunk them if necessary)
    const laundromatSitemaps = Math.ceil(totalLaundromats / MAX_URLS_PER_FILE);
    for (let i = 1; i <= laundromatSitemaps; i++) {
      sitemapUrls.push(`${baseUrl}/sitemap-laundromats-${i}.xml`);
    }
    
    // Generate the sitemap index
    const sitemapIndexXml = generateSitemapIndex(sitemapUrls);
    
    res.header('Content-Type', 'application/xml');
    res.send(sitemapIndexXml);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Main sitemap with homepage, states, cities, and other static pages
 */
router.get('/sitemap-main.xml', async (req, res) => {
  try {
    const baseUrl = `https://${req.headers.host || 'laundromatlocator.com'}`;
    const urls = [];
    
    // Add homepage
    urls.push({
      loc: baseUrl,
      priority: '1.0',
    });
    
    // Add static pages
    urls.push({
      loc: `${baseUrl}/tips`,
      priority: '0.8',
    });
    
    urls.push({
      loc: `${baseUrl}/states`,
      priority: '0.8',
    });
    
    // Add all states
    const statesQuery = `SELECT * FROM states`;
    const statesResult = await pool.query(statesQuery);
    const allStates = statesResult.rows;
    
    for (const state of allStates) {
      urls.push({
        loc: `${baseUrl}/state/${state.abbr.toLowerCase()}`,
        priority: '0.7',
      });
    }
    
    // Add top cities (limited to prevent overwhelming the main sitemap)
    const cityQuery = `
      SELECT city, state, COUNT(*) as count
      FROM laundromats
      GROUP BY city, state
      ORDER BY count DESC
      LIMIT 300
    `;
    
    const citiesResult = await pool.query(cityQuery);
    const topCities = citiesResult.rows;
    
    for (const city of topCities) {
      urls.push({
        loc: `${baseUrl}/city/${city.city.toLowerCase().replace(/\s+/g, '-')}/${city.state.toLowerCase()}`,
        priority: '0.6',
      });
    }
    
    // Add all tips
    const tipsQuery = `
      SELECT * FROM laundry_tips
    `;
    const tipsResult = await pool.query(tipsQuery);
    const allTips = tipsResult.rows;
    
    for (const tip of allTips) {
      urls.push({
        loc: `${baseUrl}/tips/${tip.slug}`,
        priority: '0.7',
      });
    }
    
    const xml = generateSitemapXml(urls);
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating main sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Laundromat sitemap pages (paginated)
 */
router.get('/sitemap-laundromats-:page.xml', async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const offset = (page - 1) * MAX_URLS_PER_FILE;
    
    const baseUrl = `https://${req.headers.host || 'laundromatlocator.com'}`;
    
    // Get paginated laundromats using direct SQL
    const query = `
      SELECT slug
      FROM laundromats
      ORDER BY id
      LIMIT ${MAX_URLS_PER_FILE}
      OFFSET ${offset}
    `;
    
    const result = await pool.query(query);
    const paginatedLaundromats = result.rows;
    
    const urls = [];
    
    for (const laundromat of paginatedLaundromats) {
      urls.push({
        loc: `${baseUrl}/laundromat/${laundromat.slug}`,
        priority: '0.5',
      });
    }
    
    const xml = generateSitemapXml(urls);
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error(`Error generating laundromats sitemap page ${req.params.page}:`, error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Robots.txt file to guide crawlers
 */
router.get('/robots.txt', (req, res) => {
  const baseUrl = `https://${req.headers.host || 'laundromatlocator.com'}`;
  
  let robotsTxt = 'User-agent: *\n';
  robotsTxt += 'Disallow: /admin/\n'; // Disallow admin areas
  robotsTxt += 'Disallow: /api/\n';   // Disallow API endpoints
  robotsTxt += `Sitemap: ${baseUrl}/sitemap.xml\n`; // Link to sitemap
  
  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

export default router;