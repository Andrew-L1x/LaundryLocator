import { Router } from 'express';
import { db } from '@server/db';
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
    const laundromatCount = await db.select({ count: laundromats.id }).from(laundromats);
    const tipsCount = await db.select({ count: laundryTips.id }).from(laundryTips);

    const totalStates = statesCount.length > 0 ? Number(statesCount[0].count) : 0;
    const totalCities = citiesCount.length > 0 ? Number(citiesCount[0].count) : 0;
    const totalLaundromats = laundromatCount.length > 0 ? Number(laundromatCount[0].count) : 0;
    const totalTips = tipsCount.length > 0 ? Number(tipsCount[0].count) : 0;

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
    const allStates = await db.select().from(states);
    for (const state of allStates) {
      urls.push({
        loc: `${baseUrl}/state/${state.abbr.toLowerCase()}`,
        priority: '0.7',
        lastmod: formatDate(state.updatedAt),
      });
    }
    
    // Add top cities (limited to prevent overwhelming the main sitemap)
    const topCities = await db.select().from(cities).orderBy(cities.laundryCount).limit(300);
    for (const city of topCities) {
      const stateResult = await db.select().from(states).where(eq(states.id, city.stateId));
      if (stateResult.length > 0) {
        const state = stateResult[0];
        urls.push({
          loc: `${baseUrl}/city/${city.name.toLowerCase().replace(/\s+/g, '-')}/${state.abbr.toLowerCase()}`,
          priority: '0.6',
          lastmod: formatDate(city.updatedAt),
        });
      }
    }
    
    // Add all tips
    const allTips = await db.select().from(laundryTips);
    for (const tip of allTips) {
      urls.push({
        loc: `${baseUrl}/tips/${tip.slug}`,
        priority: '0.7',
        lastmod: formatDate(tip.updatedAt),
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
    
    // Get paginated laundromats
    const paginatedLaundromats = await db
      .select()
      .from(laundromats)
      .limit(MAX_URLS_PER_FILE)
      .offset(offset);
    
    const urls = [];
    
    for (const laundromat of paginatedLaundromats) {
      urls.push({
        loc: `${baseUrl}/laundromat/${laundromat.slug}`,
        priority: '0.5',
        lastmod: formatDate(laundromat.updatedAt),
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