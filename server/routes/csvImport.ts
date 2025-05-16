import { Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';
import { processCsvFile, getUploadedCsvFiles } from '../utils/csvImport';

// Directory for storing CSV uploads
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'csv_uploads');

/**
 * Upload a CSV file to the server
 */
export async function uploadCsvFile(req: Request, res: Response) {
  try {
    // Check if the directory exists, if not create it
    await fs.ensureDir(UPLOAD_DIR);
    
    const { fileName, fileContent } = req.body;
    
    if (!fileName || !fileContent) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fileName and fileContent'
      });
    }
    
    // Ensure the file has a .csv extension
    const filePath = path.join(UPLOAD_DIR, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
    
    // Write the file to disk
    await fs.writeFile(filePath, fileContent);
    
    res.json({
      success: true,
      fileName,
      path: filePath,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading CSV file:', error);
    res.status(500).json({
      success: false,
      message: `Error uploading file: ${error.message}`
    });
  }
}

/**
 * List all available CSV files
 */
export async function listCsvFiles(req: Request, res: Response) {
  try {
    const files = await getUploadedCsvFiles(UPLOAD_DIR);
    
    res.json({
      success: true,
      files
    });
  } catch (error) {
    console.error('Error listing CSV files:', error);
    res.status(500).json({
      success: false,
      message: `Error listing files: ${error.message}`
    });
  }
}

/**
 * Import data from a specified CSV file
 */
export async function importCsvFile(req: Request, res: Response) {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: filePath'
      });
    }
    
    // Process the file
    const result = await processCsvFile(filePath);
    
    res.json(result);
  } catch (error) {
    console.error('Error importing CSV file:', error);
    res.status(500).json({
      success: false,
      total: 0,
      imported: 0,
      duplicates: 0,
      errors: [error.message],
      message: `Error importing file: ${error.message}`
    });
  }
}

/**
 * Delete a CSV file
 */
export async function deleteCsvFile(req: Request, res: Response) {
  try {
    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: fileName'
      });
    }
    
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete the file
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting CSV file:', error);
    res.status(500).json({
      success: false,
      message: `Error deleting file: ${error.message}`
    });
  }
}