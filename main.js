const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

// Create application window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'dist/logic/preload.js')
    }
  });

  mainWindow.loadFile('index.html');
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
ipcMain.handle('compress-files', async (event, filePaths) => {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(app.getPath('downloads'), 'Compressed');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];

    // Process each file
    for (const filePath of filePaths) {
      const originalSize = fs.statSync(filePath).size;
      const fileName = path.basename(filePath);
      const outputPath = path.join(outputDir, `${fileName}.zip`);
      
      // Create a file to write the archive data to
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression level
      });

      // Wait for the archive to finalize
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        
        // Add the file to the archive
        archive.file(filePath, { name: fileName });
        archive.finalize();
      });

      // Get compressed size
      const compressedSize = fs.statSync(outputPath).size;
      
      // Calculate compression ratio
      const savedBytes = originalSize - compressedSize;
      const compressionRatio = (savedBytes / originalSize * 100).toFixed(1) + '%';
      
      // Add result
      results.push({
        originalName: fileName,
        compressedPath: outputPath,
        originalSize,
        compressedSize,
        compressionRatio
      });
    }

    return results;
  } catch (error) {
    console.error('Error during compression:', error);
    throw error;
  }
});

// Handle showing a file in folder
ipcMain.on('show-item-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// Handle file open dialog
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  
  if (!canceled) {
    return filePaths;
  }
  return [];
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
