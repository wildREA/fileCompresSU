const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

// Create application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "dist/logic/preload.js"),
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

      // Different compression methods based on file type
      let outputPath;

      // Use just archiver for simplicity
      outputPath = path.join(outputDir, `${baseName}-compressed.zip`);
      const output = fs.createWriteStream(outputPath);

      // Create a zip archiver with maximum compression level
      const archive = archiver("zip", {
        zlib: { level: 9 }, // 0-9, 9 being highest compression
      });

      // Set up logging for debugging
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

      // Get compressed size
      const compressedSize = fs.statSync(outputPath).size;

      // Calculate compression ratio
      const savedBytes = originalSize - compressedSize;
      const compressionRatio =
        ((savedBytes / originalSize) * 100).toFixed(1) + "%";

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

      // We need to tell the renderer to upload the file data to a temp location
      // For now, we'll simulate this with a placeholder

      // Different compression methods based on file type
      let outputPath = path.join(outputDir, `${baseName}-compressed.zip`);
      const output = fs.createWriteStream(outputPath);

      // Create a zip archiver with maximum compression level
      const archive = archiver("zip", {
        zlib: { level: 9 }, // 0-9, 9 being highest compression
      });

      // Set up logging for debugging
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

        // Use the actual file data if available
        if (fileObj.data) {
          // Convert base64 string back to Buffer and write to temp file
          const buffer = Buffer.from(fileObj.data, "base64");
          fs.writeFileSync(tempFilePath, buffer);
        } else {
          // Fallback to placeholder if no data available
          const placeholderContent = `This is a placeholder for ${fileName}`;
          fs.writeFileSync(tempFilePath, placeholderContent);
          console.warn(
            `No file data available for ${fileName}, using placeholder`
          );
        }

        // Add the file to the archive with its original name
        archive.file(tempFilePath, { name: fileName });

        // Finalize the archive (this is important!)
        archive.finalize();
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      // Get compressed size
      const compressedSize = fs.statSync(outputPath).size;

      // Calculate compression ratio
      const savedBytes = originalSize - compressedSize;
      const compressionRatio =
        ((savedBytes / originalSize) * 100).toFixed(1) + "%";

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
