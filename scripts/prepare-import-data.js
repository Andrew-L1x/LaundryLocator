import { prepareEnrichedDataForImport } from './integration-helpers.js';

// Path to enriched data
const ENRICHED_CSV_PATH = 'data/enriched/enriched_laundromat_data.csv';

// Prepare the data for import
const result = prepareEnrichedDataForImport(ENRICHED_CSV_PATH);

// Output the result
console.log(`Data preparation ${result.success ? 'succeeded' : 'failed'}: ${result.message}`);

if (result.success) {
  console.log(`JSON sample saved to: ${result.jsonPath}`);
  console.log(`CSV sample saved to: ${result.csvPath}`);
  console.log('Import these files into your database using the admin interface.');
}