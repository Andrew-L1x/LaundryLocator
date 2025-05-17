import { Request, Response } from 'express';
import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { storage } from '../storage';
import { insertLaundrySchema } from '@shared/schema';
import crypto from 'crypto';

// Track import jobs in memory
const importJobs = new Map<string, {
  status: 'running' | 'completed' | 'failed';
  message: string;
  stats: {
    totalRecords: number;
    processedRecords: number;
    errorCount: number;
    successCount: number;
    skippedCount: number;
    errors: string[];
  };
  startTime: Date;
  completedTime?: Date;
}>();

/**
 * Start a data import job
 */
export async function importLaundromatData(req: Request, res: Response) {
  try {
    // Make sure user is an admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Admin access required.'
      });
    }

    const { importType = 'sample' } = req.body;
    const filePath = importType === 'sample' 
      ? 'data/import/sample_laundromats.csv'
      : 'data/enriched/enriched_laundromat_data.csv';

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Import file not found: ${filePath}. Please run the enrichment script first.`
      });
    }

    // Read the CSV file
    const csvData = fs.readFileSync(filePath, 'utf8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    // Generate a unique job ID
    const jobId = crypto.randomUUID();

    // Initialize the job stats
    importJobs.set(jobId, {
      status: 'running',
      message: 'Import job started',
      stats: {
        totalRecords: records.length,
        processedRecords: 0,
        errorCount: 0,
        successCount: 0,
        skippedCount: 0,
        errors: []
      },
      startTime: new Date()
    });

    // Process the data in batches in background
    processImportJob(jobId, records);

    // Return the job info to the client
    return res.status(200).json({
      success: true,
      message: `Started import of ${records.length} laundromats`,
      jobId
    });
  } catch (error: any) {
    console.error('Error starting import job:', error);
    return res.status(500).json({
      success: false,
      message: `Error starting import: ${error.message}`
    });
  }
}

/**
 * Get the status of an import job
 */
export async function getImportStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    
    if (!importJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        message: 'Import job not found'
      });
    }
    
    const job = importJobs.get(jobId)!;
    
    return res.status(200).json({
      success: job.status === 'completed',
      status: job.status,
      message: job.message,
      stats: job.stats
    });
  } catch (error: any) {
    console.error('Error getting import status:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting import status: ${error.message}`
    });
  }
}

/**
 * Process an import job in the background
 */
async function processImportJob(jobId: string, records: any[]) {
  const job = importJobs.get(jobId)!;
  const BATCH_SIZE = 50;
  
  try {
    // Process records in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      // Process each record in the batch
      for (const record of batch) {
        try {
          job.stats.processedRecords++;
          
          // Check if a laundromat with this name and address already exists
          const existingLaundromats = await storage.searchLaundromats(record.name);
          const duplicate = existingLaundromats.find(l => 
            l.name.toLowerCase() === record.name.toLowerCase() && 
            l.address && l.address.toLowerCase() === record.address.toLowerCase()
          );
          
          if (duplicate) {
            job.stats.skippedCount++;
            continue;
          }
          
          // Prepare the laundromat data
          const laundryData = {
            name: record.name,
            slug: record.slug || generateSlug(record.name, record.city, record.state),
            address: record.address,
            city: record.city,
            state: record.state,
            zip: record.zip,
            phone: record.phone,
            website: record.website,
            email: '',
            description: record.description || '',
            hours: record.hours || '',
            latitude: parseFloat(record.latitude) || 0,
            longitude: parseFloat(record.longitude) || 0,
            image_url: record.image_url || '',
            logo_url: record.logo_url || '',
            rating: parseFloat(record.rating) || 0,
            review_count: parseInt(record.review_count) || 0,
            premium: record.premium === 'true',
            featured: record.featured === 'true',
            verified: false,
            premium_score: parseInt(record.premium_score) || 50,
            status: 'active',
            user_id: null,
            seo_tags: record.seo_tags || '',
            seo_description: record.description || '',
            seo_summary: record.summary || '',
            amenities: record.amenities || ''
          };
          
          // Validate the data
          const validationResult = insertLaundrySchema.safeParse(laundryData);
          
          if (!validationResult.success) {
            job.stats.errorCount++;
            job.stats.errors.push(`Error validating record ${job.stats.processedRecords}: ${validationResult.error.message}`);
            continue;
          }
          
          // Create the laundromat
          await storage.createLaundromat(validationResult.data);
          job.stats.successCount++;
        } catch (error: any) {
          job.stats.errorCount++;
          job.stats.errors.push(`Error processing record ${job.stats.processedRecords}: ${error.message}`);
        }
      }
      
      // Update the job status
      importJobs.set(jobId, {
        ...job,
        stats: { ...job.stats }
      });
      
      // Avoid blocking the event loop for too long
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Mark job as completed
    importJobs.set(jobId, {
      ...job,
      status: 'completed',
      message: `Successfully imported ${job.stats.successCount} laundromats, skipped ${job.stats.skippedCount} duplicates, encountered ${job.stats.errorCount} errors.`,
      completedTime: new Date()
    });
  } catch (error: any) {
    // Mark job as failed
    importJobs.set(jobId, {
      ...job,
      status: 'failed',
      message: `Import failed: ${error.message}`,
      completedTime: new Date()
    });
  }
}

/**
 * Generate a slug for a laundromat
 */
function generateSlug(name: string, city: string, state: string): string {
  const baseSlug = `${name} ${city} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .trim();
    
  return baseSlug;
}