// Load the electron loader first to handle electron: protocol imports
import "./.electron-loader.mjs";

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import archiver from "archiver";

// Only import electron-updater when running in Electron (not during direct Node.js execution)
let autoUpdater;
try {
  if (app) {
    const pkg = await import("electron-updater");
    autoUpdater = pkg.autoUpdater;
  }
} catch (error) {
  console.log("Not running in Electron context, skipping autoUpdater");
}

// Import compression libraries
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminGifsicle from "imagemin-gifsicle";
import imageminSvgo from "imagemin-svgo";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

// Import notifications module - only if we're actually using autoUpdater
let setupAutoUpdaterListeners;
if (app) {
  try {
    const notifier = await import("./au-notifications.mjs");
    setupAutoUpdaterListeners = notifier.setupAutoUpdaterListeners;
  } catch (error) {
    console.log("Could not load auto-updater notifications");
  }
}

// Get current file URL for ES modules (replacement for __dirname)
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "dist/logic/preload.js"), // No need to change to .mjs as TypeScript compiler generates .js files
      webSecurity: false, // Allow access to local files (for development only)
    },
  });

  mainWindow.loadFile("index.html");
  return mainWindow;
}

// ╔═══════════════════════════════════════════════════════════════════╗
// ║                       ██╗██████╗  ██████╗                         ║
// ║                       ██║██╔══██╗██╔════╝                         ║
// ║                       ██║██████╔╝██║                              ║
// ║                       ██║██╔═══╝ ██║                              ║
// ║                       ██║██║     ╚██████╗                         ║
// ║                       ╚═╝╚═╝      ╚═════╝                         ║
// ╚═══════════════════════════════════════════════════════════════════╝

// Helper function to detect file type from extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {
    return "image";
  } else if ([".pdf"].includes(ext)) {
    return "pdf";
  } else if ([".txt", ".md", ".html", ".css", ".js", ".json"].includes(ext)) {
    return "text";
  } else {
    return "binary";
  }
}

// Helper function to compress an image
async function compressImage(inputPath, outputPath, options = {}) {
  const extension = path.extname(inputPath).toLowerCase();

  // For most image types, use sharp
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    try {
      let sharpInstance = sharp(inputPath);

      // Apply different compression settings based on file type
      if ([".jpg", ".jpeg"].includes(extension)) {
        await sharpInstance
          .jpeg({ quality: 70, progressive: true })
          .toFile(outputPath);
      } else if (extension === ".png") {
        await sharpInstance
          .png({ compressionLevel: 9, palette: true })
          .toFile(outputPath);
      } else if (extension === ".webp") {
        await sharpInstance.webp({ quality: 70 }).toFile(outputPath);
      }

      return fs.statSync(outputPath).size;
    } catch (err) {
      console.error("Error compressing with sharp:", err);
      throw err;
    }
  } else {
    // For other image types (GIF, SVG), use imagemin
    try {
      let plugins = [];

      if (extension === ".gif") {
        plugins.push(imageminGifsicle({ optimizationLevel: 3 }));
      } else if (extension === ".svg") {
        plugins.push(imageminSvgo());
      } else if ([".jpg", ".jpeg"].includes(extension)) {
        plugins.push(imageminMozjpeg({ quality: 70 }));
      } else if (extension === ".png") {
        plugins.push(imageminPngquant({ quality: [0.6, 0.8] }));
      }

      const files = await imagemin([inputPath], {
        destination: path.dirname(outputPath),
        plugins: plugins,
      });

      // Rename the output file to match our expected output path
      if (files.length > 0 && files[0].destinationPath !== outputPath) {
        fs.renameSync(files[0].destinationPath, outputPath);
      }

      return fs.statSync(outputPath).size;
    } catch (err) {
      console.error("Error compressing with imagemin:", err);
      throw err;
    }
  }
}

// Helper function to compress PDF
async function compressPdf(inputPath, outputPath) {
  try {
    // Read the PDF file
    const pdfBytes = fs.readFileSync(inputPath);

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });

    // Compress PDF - remove metadata, compress images
    pdfDoc.setTitle("");
    pdfDoc.setAuthor("");
    pdfDoc.setSubject("");
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer("");
    pdfDoc.setCreator("");

    // Save the PDF with compression
    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addCompressXref: true,
    });

    // Write the compressed PDF to the output path
    fs.writeFileSync(outputPath, compressedPdfBytes);

    return fs.statSync(outputPath).size;
  } catch (err) {
    console.error("Error compressing PDF:", err);
    throw err;
  }
}

// Handle IPC for file compression - update name to match preload.ts
ipcMain.handle("compress-files", async (event, filePaths) => {
  try {
    console.log("Main process: compressing files with paths:", filePaths);

    // Validate input
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error("No valid file paths provided");
    }

    // Validate each path exists
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        console.error(`File does not exist: ${filePath}`);
        throw new Error(`File not found: ${path.basename(filePath)}`);
      }
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(app.getPath("downloads"), "Compressed");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = []; // Process each file
    for (const filePath of filePaths) {
      const originalSize = fs.statSync(filePath).size;
      const fileName = path.basename(filePath);
      console.log(`Processing file: ${fileName} (${filePath})`);

      // Create a compressed file name with the -compressed suffix
      const fileNameParts = fileName.split(".");
      const extension = fileNameParts.pop() || "";
      const baseName = fileNameParts.join(".");

      // Determine the file type and compression method
      const fileType = getFileType(fileName);
      let outputPath;
      let compressedSize;

      try {
        console.log(`Detected file type: ${fileType} for ${fileName}`);

        // Apply different compression strategies based on file type
        if (fileType === "image") {
          // For images, use our image compression helper
          outputPath = path.join(
            outputDir,
            `${baseName}-compressed.${extension}`
          );
          compressedSize = await compressImage(filePath, outputPath);
        } else if (fileType === "pdf") {
          // For PDFs, use our PDF compression helper
          outputPath = path.join(outputDir, `${baseName}-compressed.pdf`);
          compressedSize = await compressPdf(filePath, outputPath);
        } else {
          // For other file types, use standard zip compression
          outputPath = path.join(outputDir, `${baseName}-compressed.zip`);

          const output = fs.createWriteStream(outputPath);
          const archive = archiver("zip", {
            zlib: { level: 9 }, // 0-9, 9 being highest compression
          });

          archive.on("warning", function (err) {
            if (err.code !== "ENOENT") {
              console.warn("Warning during compression:", err);
            }
          });

          archive.on("error", function (err) {
            console.error("Error during compression:", err);
            throw err;
          });

          // Pipe archive data to the file
          archive.pipe(output);

          // Wait for the archive to finalize
          await new Promise((resolve, reject) => {
            output.on("close", () => {
              console.log(
                `${fileName} has been compressed - ${archive.pointer()} total bytes`
              );
              resolve();
            });
            output.on("error", reject);

            // Add the file to the archive with its original name
            archive.file(filePath, { name: fileName });

            // Finalize the archive (this is important!)
            archive.finalize();
          });

          compressedSize = fs.statSync(outputPath).size;
        }
      } catch (compressionError) {
        console.error(`Error compressing ${fileName}:`, compressionError);

        // If compression fails, fall back to zip compression
        console.log(`Falling back to zip compression for ${fileName}`);
        outputPath = path.join(outputDir, `${baseName}-compressed.zip`);

        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", {
          zlib: { level: 9 }, // 0-9, 9 being highest compression
        });

        archive.on("warning", (err) => {
          if (err.code !== "ENOENT") {
            console.warn("Warning during fallback compression:", err);
          }
        });

        archive.on("error", (err) => {
          console.error("Error during fallback compression:", err);
          throw err;
        });

        archive.pipe(output);

        // Wait for the archive to finalize
        await new Promise((resolve, reject) => {
          output.on("close", resolve);
          output.on("error", reject);
          archive.file(filePath, { name: fileName });
          archive.finalize();
        });

        // Get the size after fallback compression
        compressedSize = fs.statSync(outputPath).size;
      }

      // Calculate compression ratio
      const savedBytes = originalSize - compressedSize;
      const compressionRatio =
        ((savedBytes / originalSize) * 100).toFixed(1) + "%";

      console.log(`Compression results for ${fileName}:`);
      console.log(`  Original size: ${originalSize} bytes`);
      console.log(`  Compressed size: ${compressedSize} bytes`);
      console.log(`  Saved: ${savedBytes} bytes (${compressionRatio})`);

      // Add result
      results.push({
        originalName: fileName,
        compressedPath: outputPath,
        originalSize,
        compressedSize,
        compressionRatio,
      });
    }

    return results;
  } catch (error) {
    console.error("Error during compression:", error);
    throw error;
  }
});

// Handle showing a file in folder
ipcMain.on("show-item-in-folder", (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// Handle file open dialog
ipcMain.handle("open-file-dialog", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
  });

  if (!canceled) {
    return filePaths;
  }
  return [];
});

// New handler for compressing file objects directly
ipcMain.handle("compress-file-objects", async (event, fileObjects) => {
  try {
    console.log("Main process: compressing file objects:", fileObjects);

    // Validate input
    if (!Array.isArray(fileObjects) || fileObjects.length === 0) {
      throw new Error("No valid file objects provided");
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(app.getPath("downloads"), "Compressed");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = []; // Process each file
    for (const fileObj of fileObjects) {
      const originalSize = fileObj.size;
      const fileName = fileObj.name;
      console.log(`Processing file object: ${fileName}`);

      // Create a compressed file name with the -compressed suffix
      const fileNameParts = fileName.split(".");
      const extension = fileNameParts.pop() || "";
      const baseName = fileNameParts.join(".");

      // Create temp file to save file data from renderer
      const tempFilePath = path.join(app.getPath("temp"), fileName);

      // Write data to temp file
      if (fileObj.data) {
        // Convert base64 string back to Buffer and write to temp file
        const buffer = Buffer.from(fileObj.data, "base64");
        fs.writeFileSync(tempFilePath, buffer);
      } else {
        console.warn(`No file data available for ${fileName}`);
        throw new Error(`No file data for ${fileName}`);
      }

      // Determine the file type and compression method
      const fileType = getFileType(fileName);
      let outputPath;
      let compressedSize;

      try {
        console.log(`Detected file type: ${fileType} for ${fileName}`);

        // Apply different compression strategies based on file type
        if (fileType === "image") {
          // For images, use our image compression helper
          outputPath = path.join(
            outputDir,
            `${baseName}-compressed.${extension}`
          );
          compressedSize = await compressImage(tempFilePath, outputPath);
        } else if (fileType === "pdf") {
          // For PDFs, use our PDF compression helper
          outputPath = path.join(outputDir, `${baseName}-compressed.pdf`);
          compressedSize = await compressPdf(tempFilePath, outputPath);
        } else {
          // For other file types, use standard zip compression
          outputPath = path.join(outputDir, `${baseName}-compressed.zip`);

          const output = fs.createWriteStream(outputPath);
          const archive = archiver("zip", {
            zlib: { level: 9 }, // 0-9, 9 being highest compression
          });

          archive.on("warning", function (err) {
            if (err.code !== "ENOENT") {
              console.warn("Warning during compression:", err);
            }
          });

          archive.on("error", function (err) {
            console.error("Error during compression:", err);
            throw err;
          });

          // Pipe archive data to the file
          archive.pipe(output);

          // Wait for the archive to finalize
          await new Promise((resolve, reject) => {
            output.on("close", () => {
              console.log(
                `${fileName} has been compressed - ${archive.pointer()} total bytes`
              );
              resolve();
            });
            output.on("error", reject);

            // Add the file to the archive with its original name
            archive.file(tempFilePath, { name: fileName });

            // Finalize the archive (this is important!)
            archive.finalize();
          });

          compressedSize = fs.statSync(outputPath).size;
        }
      } catch (compressionError) {
        console.error(`Error compressing ${fileName}:`, compressionError);

        // If compression fails, fall back to zip compression
        console.log(`Falling back to zip compression for ${fileName}`);
        outputPath = path.join(outputDir, `${baseName}-compressed.zip`);

        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", {
          zlib: { level: 9 }, // 0-9, 9 being highest compression
        });

        archive.on("warning", (err) => {
          if (err.code !== "ENOENT") {
            console.warn("Warning during fallback compression:", err);
          }
        });

        archive.on("error", (err) => {
          console.error("Error during fallback compression:", err);
          throw err;
        });

        archive.pipe(output);

        // Wait for the archive to finalize
        await new Promise((resolve, reject) => {
          output.on("close", resolve);
          output.on("error", reject);
          archive.file(tempFilePath, { name: fileName });
          archive.finalize();
        });

        compressedSize = fs.statSync(outputPath).size;
      }

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      // Calculate compression ratio
      const savedBytes = originalSize - compressedSize;
      const compressionRatio =
        ((savedBytes / originalSize) * 100).toFixed(1) + "%";

      console.log(`Compression results for ${fileName}:`);
      console.log(`  Original size: ${originalSize} bytes`);
      console.log(`  Compressed size: ${compressedSize} bytes`);
      console.log(`  Saved: ${savedBytes} bytes (${compressionRatio})`);

      // Add result
      results.push({
        originalName: fileName,
        compressedPath: outputPath,
        originalSize,
        compressedSize,
        compressionRatio,
      });
    }

    return results;
  } catch (error) {
    console.error("Error during compression:", error);
    throw error;
  }
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  // Setup auto-updater listeners if available
  if (autoUpdater) {
    setupAutoUpdaterListeners(autoUpdater, dialog);

    // Automation: Check for updates
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
