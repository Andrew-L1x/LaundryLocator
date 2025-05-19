/**
 * Utility functions for generating and managing slugs
 */

/**
 * Generates a slug from a business name, city, and state
 * 
 * @param name Business name
 * @param city City name
 * @param state State name or code
 * @returns Formatted slug string
 */
export function generateSlug(name: string, city: string, state: string): string {
  // Convert to lowercase and remove any non-alphanumeric characters except spaces
  const cleanName = name.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanCity = city.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanState = state.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Replace spaces with hyphens
  const formattedName = cleanName.replace(/\s+/g, '-');
  const formattedCity = cleanCity.replace(/\s+/g, '-');
  const formattedState = cleanState.replace(/\s+/g, '-');
  
  // Combine parts to create the final slug
  return `${formattedName}-${formattedCity}-${formattedState}`;
}

/**
 * Check if a slug already exists in the database
 * 
 * @param slug Slug to check
 * @param pool Database connection pool
 * @returns Boolean indicating if slug exists
 */
export async function slugExists(slug: string, pool: any): Promise<boolean> {
  const query = 'SELECT COUNT(*) FROM laundromats WHERE slug = $1';
  const result = await pool.query(query, [slug]);
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Create a unique slug by adding a numeric suffix if needed
 * 
 * @param baseSlug Base slug to make unique
 * @param pool Database connection pool
 * @returns Unique slug string
 */
export async function createUniqueSlug(baseSlug: string, pool: any): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  let exists = await slugExists(slug, pool);
  
  while (exists) {
    slug = `${baseSlug}-${counter}`;
    exists = await slugExists(slug, pool);
    counter++;
  }
  
  return slug;
}