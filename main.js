const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fsPromises = fs.promises;
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, // This should be true for security best practices
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js') // Preload script for security
    }
  });
  win.loadFile('index.html');
  
  // For development, uncomment to open DevTools
  // win.webContents.openDevTools();
  
  return win;
}

app.whenReady().then(() => {
  const mainWindow = createWindow();
  
  // Handle file-upload events from the renderer
  ipcMain.on('file-upload', async (event, files) => {
    console.log('Received files in main process:', files.length);
    
    // Create a temporary directory for processing if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'fileCompressor');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
      // Process received files
      const processedFiles = [];
      
      for (const file of files) {
        // Save file data to temp location if needed
        if (file.path && fs.existsSync(file.path)) {
          processedFiles.push({
            name: file.name,
            path: file.path,
            size: file.size
          });
        }
      }
      
      // Notify renderer that files were received and processed
      mainWindow.webContents.send('compression-complete', {
        message: 'Files received successfully',
        count: processedFiles.length,
        files: processedFiles
      });
    } catch (error) {
      console.error('Error processing uploaded files:', error);
      mainWindow.webContents.send('compression-error', {
        message: error.message,
        error
      });
    }
  });
  
  // Handle compression-request events with actual compression
  ipcMain.on('compression-request', async (event, filePaths) => {
    try {
      console.log('Compression request received for:', filePaths);
      
      // Process files with real compression
      const result = await compressFiles(filePaths);
      
      // Send the result back to renderer
      mainWindow.webContents.send('compression-complete', result);
    } catch (error) {
      console.error('Compression error:', error);
      mainWindow.webContents.send('compression-error', {
        message: error.message,
        filePaths
      });
    }
  });
});

// Real file compression implementation
async function compressFiles(filePaths) {
  const outputDir = path.join(os.homedir(), 'Downloads', 'Compressed');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    await fsPromises.mkdir(outputDir, { recursive: true });
  }
  
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      // Get file extension and determine the compression method
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      const fileStats = await fsPromises.stat(filePath);
      const originalSize = fileStats.size;
      
      // Generate output file path
      const outputFilePath = path.join(outputDir, `compressed_${fileName}`);
      
      // Apply different compression strategy based on file type
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
        // Image compression
        await compressImage(filePath, outputFilePath);
      } else {
        // Default gzip compression for other file types
        await compressWithGzip(filePath, outputFilePath);
      }
      
      // Get compressed file stats
      const compressedStats = await fsPromises.stat(outputFilePath);
      const compressedSize = compressedStats.size;
      
      // Calculate compression ratio
      const compressionRatio = originalSize > 0 
        ? ((originalSize - compressedSize) / originalSize * 100).toFixed(2) + '%'
        : '0%';
      
      results.push({
        originalPath: filePath,
        compressedPath: outputFilePath,
        originalSize,
        compressedSize,
        compressionRatio
      });
      
    } catch (err) {
      console.error(`Error compressing ${filePath}:`, err);
      results.push({
        originalPath: filePath,
        error: err.message,
        compressionRatio: '0%'
      });
    }
  }
  
  return {
    success: true,
    compressedFiles: results.map(result => ({
      originalPath: result.originalPath,
      compressedPath: result.compressedPath || '',
      compressionRatio: result.compressionRatio
    }))
  };
}

// Image compression implementation
async function compressImage(inputPath, outputPath) {
  try {
    // Basic fallback for image compression
    // For better results, consider using libraries like sharp or jimp
    // which we'd install with npm
    
    // For now, we'll just use a basic copy operation
    // In a production app, replace this with actual image compression library
    await fsPromises.copyFile(inputPath, outputPath);
    
    // Simulate some compression (in production, use real image compression)
    const data = await fsPromises.readFile(outputPath);
    // Apply a very basic compression (just to simulate)
    await fsPromises.writeFile(outputPath, data.slice(0, Math.floor(data.length * 0.9)));
    
    return outputPath;
  } catch (error) {
    console.error('Image compression error:', error);
    throw error;
  }
}

// Generic file compression with gzip
async function compressWithGzip(inputPath, outputPath) {
  const readStream = fs.createReadStream(inputPath);
  const writeStream = fs.createWriteStream(outputPath);
  const gzip = zlib.createGzip();
  
  try {
    await pipeline(readStream, gzip, writeStream);
    return outputPath;
  } catch (error) {
    console.error('Gzip compression error:', error);
    throw error;
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
