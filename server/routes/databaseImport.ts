import { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execPromise = promisify(exec);

// Keep track of import status
let importStatus = {
  status: "idle", // idle, processing, complete, error
  progress: 0,
  message: "",
  records: {
    total: 0,
    imported: 0,
    skipped: 0
  },
  error: null as string | null,
  startTime: null as Date | null,
  endTime: null as Date | null
};

/**
 * Start a direct database import from enriched data
 */
export async function startDatabaseImport(req: Request, res: Response) {
  try {
    // Check if there's already an import in progress
    if (importStatus.status === "processing") {
      return res.status(409).json({
        success: false,
        message: "An import is already in progress"
      });
    }

    // Reset the import status
    importStatus = {
      status: "processing",
      progress: 0,
      message: "Starting database import...",
      records: {
        total: 0,
        imported: 0,
        skipped: 0
      },
      error: null,
      startTime: new Date(),
      endTime: null
    };

    // Check if we're in development or production for the script path
    const scriptPath = path.join(process.cwd(), "scripts", "direct-database-import.js");

    // Check if the script exists
    if (!fs.existsSync(scriptPath)) {
      importStatus.status = "error";
      importStatus.error = "Import script not found";
      return res.status(404).json({
        success: false,
        message: "Import script not found"
      });
    }

    // Check if the enriched data exists
    const dataPath = path.join(process.cwd(), "data", "enriched_laundromat_data.csv");
    if (!fs.existsSync(dataPath)) {
      importStatus.status = "error";
      importStatus.error = "Enriched data file not found. Please run the data enrichment process first.";
      return res.status(404).json({
        success: false,
        message: "Enriched data file not found. Please run the data enrichment process first."
      });
    }

    // Start the import process in the background
    // Using node --experimental-modules for ES modules
    const process = exec(`node --experimental-modules ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Import process error: ${error.message}`);
        importStatus.status = "error";
        importStatus.error = error.message;
        return;
      }

      if (stderr) {
        console.error(`Import process stderr: ${stderr}`);
      }

      // Look for progress updates in stdout
      const importedMatch = stdout.match(/Successfully imported (\d+) records/);
      const skippedMatch = stdout.match(/Skipped (\d+) records/);
      
      if (importedMatch) {
        importStatus.records.imported = parseInt(importedMatch[1]);
      }
      
      if (skippedMatch) {
        importStatus.records.skipped = parseInt(skippedMatch[1]);
      }
      
      if (importedMatch && skippedMatch) {
        importStatus.records.total = importStatus.records.imported + importStatus.records.skipped;
      }

      // Check if import completed successfully
      if (stdout.includes("Database import process completed.")) {
        importStatus.status = "complete";
        importStatus.progress = 100;
        importStatus.message = "Import completed successfully";
        importStatus.endTime = new Date();
      }
    });

    // Set up a progress monitor for the UI
    let progress = 0;
    const progressInterval = setInterval(() => {
      // Increment progress for UI feedback
      // This is an approximation as we don't have real-time progress from the import script
      if (importStatus.status === "processing") {
        progress += 5; // Increment by 5% every interval until we reach 90%
        
        if (progress > 90) {
          progress = 90; // Cap at 90% until we get confirmation of completion
        }
        
        importStatus.progress = progress;
        
        // Update the message based on progress
        if (progress < 30) {
          importStatus.message = "Validating enriched data...";
        } else if (progress < 60) {
          importStatus.message = "Converting records to database format...";
        } else {
          importStatus.message = "Importing records to database...";
        }
      } else {
        // If status is no longer processing, clear the interval
        clearInterval(progressInterval);
      }
    }, 1500);

    // Return success with the job ID
    return res.json({
      success: true,
      message: "Database import started successfully"
    });
  } catch (error: any) {
    // Handle any unexpected errors
    importStatus.status = "error";
    importStatus.error = error.message;
    
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred"
    });
  }
}

/**
 * Get the current status of a database import
 */
export function getDatabaseImportStatus(_req: Request, res: Response) {
  return res.json(importStatus);
}

/**
 * Reset the import status
 */
export function resetDatabaseImportStatus(_req: Request, res: Response) {
  importStatus = {
    status: "idle",
    progress: 0,
    message: "",
    records: {
      total: 0,
      imported: 0,
      skipped: 0
    },
    error: null,
    startTime: null,
    endTime: null
  };
  
  return res.json({
    success: true,
    message: "Import status reset"
  });
}