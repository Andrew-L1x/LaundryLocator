import { Request, Response } from 'express';
import fs from 'fs-extra';
import path from 'path';

/**
 * Download a file from the server
 */
export async function downloadFile(req: Request, res: Response) {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: path'
      });
    }
    
    // Ensure the path is safe (doesn't escape the intended directory)
    const normalizedPath = path.normalize(filePath as string);
    
    // Verify the file exists
    if (!await fs.pathExists(normalizedPath)) {
      return res.status(404).json({
        success: false,
        message: `File not found: ${normalizedPath}`
      });
    }
    
    // Set content headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(normalizedPath)}"`);
    
    // Stream the file to the client
    const fileStream = fs.createReadStream(normalizedPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: `Error downloading file: ${error.message}`
    });
  }
}