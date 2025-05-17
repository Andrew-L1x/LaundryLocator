import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { enrichLaundryData } from '../utils/laundromat-enricher';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'csv_uploads');

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
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${filePath}`
      });
    }
    
    // Process the file - this may take time for large files
    const result = await enrichLaundryData(filePath);
    
    res.json(result);
  } catch (error) {
    console.error('Error enriching laundry data:', error);
    res.status(500).json({
      success: false,
      message: `Error enriching data: ${error.message}`
    });
  }
}

/**
 * Process CSV file in chunks (batch processing for large files)
 */
export async function startBatchEnrichment(req: Request, res: Response) {
  try {
    const { filePath, batchSize = 1000 } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: filePath'
      });
    }
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${filePath}`
      });
    }
    
    // Start the batch processing (non-blocking)
    const jobId = Date.now().toString();
    
    // Start the enrichment process in the background
    enrichLaundryData(filePath)
      .then(result => {
        // Store result for later retrieval
        fs.writeJson(path.join(UPLOAD_DIR, `${jobId}_result.json`), result);
      })
      .catch(error => {
        console.error('Batch enrichment error:', error);
        fs.writeJson(path.join(UPLOAD_DIR, `${jobId}_result.json`), {
          success: false,
          message: `Error in batch enrichment: ${error.message}`
        });
      });
    
    res.json({
      success: true,
      message: 'Batch enrichment process started',
      jobId
    });
  } catch (error) {
    console.error('Error starting batch enrichment:', error);
    res.status(500).json({
      success: false,
      message: `Error starting batch enrichment: ${error.message}`
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
    
    const resultPath = path.join(UPLOAD_DIR, `${jobId}_result.json`);
    
    // Check if result file exists
    if (await fs.pathExists(resultPath)) {
      // Job completed
      const result = await fs.readJson(resultPath);
      res.json({
        ...result,
        status: 'completed'
      });
    } else {
      // Job still in progress
      res.json({
        success: true,
        status: 'processing',
        message: 'Batch enrichment still in progress'
      });
    }
  } catch (error) {
    console.error('Error checking batch status:', error);
    res.status(500).json({
      success: false,
      message: `Error checking batch status: ${error.message}`
    });
  }
}