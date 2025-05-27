import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import path from "path";
import fs from "fs";
import archiver from "archiver";

// Import compression libraries
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminGifsicle from "imagemin-gifsicle";
import imageminSvgo from "imagemin-svgo";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

// Import notifications module
import * as notifier from "../dist/src/logic/utils/au-notifications.js";
// Import protocol handler
import { registerElectronProtocol } from "../dist/src/logic/utils/protocol-handler.js";

// Destructure the functions
const { setupAutoUpdaterListeners } = notifier;

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
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true, // Keep context isolation enabled
      preload: path.join(__dirname, "../dist/src/logic/preload.js"),
      webSecurity: true, // Enable web security in production
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

// Helper function to compress text files using direct minification
async function compressTextFile(inputPath, outputPath) {
  try {
    // Read the text file
    const text = fs.readFileSync(inputPath, 'utf8');
    
    // Basic minification for text files
    let minifiedText = text;
    
    // Remove extra whitespace, comments, etc. based on file type
    const extension = path.extname(inputPath).toLowerCase();
    if (['.js', '.json'].includes(extension)) {
      // For JavaScript and JSON
      minifiedText = minifiedText
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
        .replace(/\s+/g, ' ')                    // Collapse whitespace
        .replace(/^\s+|\s+$/gm, '');             // Trim lines
    } else if (['.css'].includes(extension)) {
      // For CSS
      minifiedText = minifiedText
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
        .replace(/\s+/g, ' ')                    // Collapse whitespace
        .replace(/:\s+/g, ':')                   // Remove space after colons
        .replace(/;\s+/g, ';')                   // Remove space after semicolons
        .replace(/{\s+/g, '{')                   // Remove space after opening braces
        .replace(/}\s+/g, '}')                   // Remove space after closing braces
        .replace(/,\s+/g, ',')                   // Remove space after commas
        .replace(/^\s+|\s+$/gm, '');             // Trim lines
    } else if (['.html'].includes(extension)) {
      // For HTML
      minifiedText = minifiedText
        .replace(/<!--[\s\S]*?-->/g, '')        // Remove HTML comments
        .replace(/>\s+</g, '><')                // Remove whitespace between tags
        .replace(/\s+/g, ' ')                   // Collapse whitespace
        .replace(/^\s+|\s+$/gm, '');            // Trim lines
    } else if (['.txt', '.md'].includes(extension)) {
      // For plain text and markdown, just remove extra whitespace
      minifiedText = minifiedText
        .replace(/\n\s*\n\s*\n/g, '\n\n')       // Collapse multiple blank lines
        .replace(/\t/g, ' ')                    // Replace tabs with spaces
        .replace(/[ ]{2,}/g, ' ')               // Collapse multiple spaces
        .replace(/^\s+|\s+$/gm, '');            // Trim each line
    }
    
    // Write the minified text to the output file
    fs.writeFileSync(outputPath, minifiedText, 'utf8');
    
    // Return the size of the compressed file
    return fs.statSync(outputPath).size;
  } catch (err) {
    console.error("Error compressing text file:", err);
    throw err;
  }
}

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
          outputPath = path.join(outputDir, `${baseName}-compressed.${extension}`);
          compressedSize = await compressImage(tempFilePath, outputPath);
        } else if (fileType === "pdf") {
          // For PDFs, use our PDF compression helper
          outputPath = path.join(outputDir, `${baseName}-compressed.pdf`);
          compressedSize = await compressPdf(tempFilePath, outputPath);
        } else if (fileType === "text" && fs.statSync(tempFilePath).size > 1024) {
          // Compression for text files larger than 1 KB
          const extension = path.extname(fileName);
          outputPath = path.join(outputDir, `${baseName}-compressed${extension}`);
          compressedSize = await compressTextFile(tempFilePath, outputPath);
        } else if (fileType === "text" && fs.statSync(tempFilePath).size <= 1024) {
          // For text files smaller than 1 KB, simply copy them
          const extension = path.extname(fileName);
          outputPath = path.join(outputDir, `${baseName}-copy${extension}`);
          fs.copyFileSync(tempFilePath, outputPath);
          compressedSize = fs.statSync(outputPath).size;
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
                `${fileName} has been compressed - ${archive.pointer()} total bytes` // REMINDER: Change archive.pointer() to fs.statSync(outputPath).size
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

        // If compression fails, handle fallback based on file type
        console.log(`Fallback compression for ${fileName}`);
        
        // Check if it's a text file for fallback
        if (fileType === "text") {
          // For text files, simply copy them as a fallback
          const extension = path.extname(fileName);
          outputPath = path.join(outputDir, `${baseName}-fallback${extension}`);
          fs.copyFileSync(tempFilePath, outputPath);
          compressedSize = fs.statSync(outputPath).size;
        } else {
          // For non-text files, use zip compression as fallback
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
  // Register electron: protocol handler before creating the window
  registerElectronProtocol();

  // Create the main application window
  createWindow();

  // Setup auto-updater listeners
  setupAutoUpdaterListeners(autoUpdater, dialog);

  // Automation: Check for updates
  autoUpdater.checkForUpdatesAndNotify();

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
