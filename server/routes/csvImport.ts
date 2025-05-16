import { Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { importLaundromatData } from '../utils/csvImport';
import { log } from '../vite';

// Create data directory if it doesn't exist
const DATA_DIR = path.join(process.cwd(), 'data');
fs.ensureDirSync(DATA_DIR);

/**
 * Import a CSV file of laundromat data
 */
export async function importCSV(req: Request, res: Response) {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }
    
    // Check if file exists
    const absolutePath = path.join(DATA_DIR, filePath);
    if (!await fs.pathExists(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${filePath}`
      });
    }
    
    log(`Starting CSV import from: ${filePath}`, 'csvImport');
    
    // Process the CSV
    const result = await importLaundromatData(absolutePath);
    
    // Return results
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error importing CSV:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * List available CSV files in the data directory
 */
export async function listCSVFiles(req: Request, res: Response) {
  try {
    const files = await fs.readdir(DATA_DIR);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    return res.status(200).json({
      success: true,
      files: csvFiles
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Upload a CSV file
 * Note: In a production app, this would use multipart/form-data
 * For simplicity, we're accepting a base64 string
 */
export async function uploadCSV(req: Request, res: Response) {
  try {
    const { fileName, fileContent } = req.body;
    
    if (!fileName || !fileContent) {
      return res.status(400).json({
        success: false,
        message: 'fileName and fileContent are required'
      });
    }
    
    if (!fileName.endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        message: 'Only CSV files are allowed'
      });
    }
    
    // Save the file
    const filePath = path.join(DATA_DIR, fileName);
    
    // Decode base64 content if it's base64 encoded
    let content = fileContent;
    if (fileContent.startsWith('data:')) {
      // Extract base64 content from data URL
      const base64Data = fileContent.split(',')[1];
      content = Buffer.from(base64Data, 'base64').toString('utf-8');
    }
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    return res.status(200).json({
      success: true,
      fileName,
      path: fileName
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}