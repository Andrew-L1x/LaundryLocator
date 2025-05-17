import { Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { enrichLaundryData, processBatch } from '../utils/laundromat-enricher';
import { log } from '../vite';

// In-memory storage for batch job status
interface BatchJob {
  id: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  enrichedPath?: string;
  stats?: {
    totalRecords: number;
    enrichedRecords: number;
    duplicatesRemoved: number;
    errors: string[];
  };
  error?: string;
  startTime: Date;
  endTime?: Date;
}

const batchJobs = new Map<string, BatchJob>();

/**
 * Enrich a laundromat CSV file with SEO content and metadata
 */
export async function enrichLaundryFile(req: Request, res: Response) {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: filePath'
      });
    }
    
    // Ensure the file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${filePath}`
      });
    }
    
    const fileName = path.basename(filePath);
    const outputPath = path.join('data', 'enriched', `enriched_${fileName}`);
    
    try {
      // Make sure the output directory exists
      await fs.ensureDir(path.join('data', 'enriched'));
      
      // Process the CSV file
      const result = await enrichLaundryData(filePath, outputPath);
      
      return res.json({
        success: true,
        message: 'Laundromat data enriched successfully',
        enrichedPath: outputPath,
        stats: result
      });
    } catch (error) {
      log(`Error enriching data: ${error.message}`, 'laundryDataEnrichment');
      return res.status(500).json({
        success: false,
        message: `Error enriching data: ${error.message}`
      });
    }
  } catch (error) {
    log(`Server error: ${error.message}`, 'laundryDataEnrichment');
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}

/**
 * Process CSV file in chunks (batch processing for large files)
 */
export async function startBatchEnrichment(req: Request, res: Response) {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: filePath'
      });
    }
    
    // Ensure the file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${filePath}`
      });
    }
    
    const fileName = path.basename(filePath);
    const outputPath = path.join('data', 'enriched', `enriched_${fileName}`);
    
    // Create a new batch job
    const jobId = uuidv4();
    const batchJob: BatchJob = {
      id: jobId,
      filePath,
      status: 'pending',
      progress: 0,
      startTime: new Date()
    };
    
    batchJobs.set(jobId, batchJob);
    
    // Start processing in the background
    processBatch(filePath, outputPath, batchJob)
      .then((result) => {
        const job = batchJobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.progress = 100;
          job.enrichedPath = outputPath;
          job.stats = result;
          job.endTime = new Date();
          batchJobs.set(jobId, job);
        }
      })
      .catch((error) => {
        log(`Batch process error: ${error.message}`, 'laundryDataEnrichment');
        const job = batchJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.error = error.message;
          job.endTime = new Date();
          batchJobs.set(jobId, job);
        }
      });
    
    return res.json({
      success: true,
      message: 'Batch enrichment started',
      jobId
    });
  } catch (error) {
    log(`Server error: ${error.message}`, 'laundryDataEnrichment');
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}

/**
 * Check the status of a batch enrichment job
 */
export async function getBatchEnrichmentStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: jobId'
      });
    }
    
    const job = batchJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: `Job not found: ${jobId}`
      });
    }
    
    return res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      enrichedPath: job.enrichedPath,
      stats: job.stats,
      error: job.error,
      startTime: job.startTime,
      endTime: job.endTime
    });
  } catch (error) {
    log(`Server error: ${error.message}`, 'laundryDataEnrichment');
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
}