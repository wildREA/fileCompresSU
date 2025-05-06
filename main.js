const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true, // This should be true for security best practices
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js') // Preload script for security
    }
  });
  win.loadFile('index.html');
  
  // Optional: Open DevTools for debugging
  // win.webContents.openDevTools();
  
  return win;
}

app.whenReady().then(() => {
  const mainWindow = createWindow();
  
  // Handle file-upload events from the renderer
  ipcMain.on('file-upload', (event, files) => {
    console.log('Received files in main process:', files.length);
    // Here you can implement file processing logic
    // For example, save files to a temporary directory
    
    // Notify renderer that files were received
    mainWindow.webContents.send('compression-complete', {
      message: 'Files received successfully',
      count: files.length
    });
  });
  
  // Handle compression-request events
  ipcMain.on('compression-request', async (event, filePaths) => {
    try {
      console.log('Compression request received for:', filePaths);
      
      // Here you would implement actual file compression
      // This is just a placeholder
      const result = await simulateCompression(filePaths);
      
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

// Simulate compression process (replace with actual compression logic)
function simulateCompression(filePaths) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const results = filePaths.map(filePath => {
        return {
          originalPath: filePath,
          compressedPath: filePath + '.compressed',
          compressionRatio: '50%' // This would be calculated based on actual compression
        };
      });
      
      resolve({
        success: true,
        compressedFiles: results
      });
    }, 1500);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
