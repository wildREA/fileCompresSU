// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Expose protected methods that allow the renderer process to use
// specific Node.js APIs safely through the contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readFile: (filePath) => {
    return fs.readFileSync(filePath);
  },
  
  // Receive files and save them to temp directory
  receiveFiles: (files) => {
    const results = [];
    const tempDir = path.join(os.tmpdir(), 'fileCompressor');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Process each file received from renderer
    files.forEach(file => {
      try {
        // Convert File object to Buffer (this would come from a DataTransfer in production)
        // In real browser context, we'd need to use FileReader API or similar
        // Here we're assuming that file.path is available from Electron's file dialog
        if (file.path) {
          // If file has a path (local file), we can use it directly
          const fileBuffer = fs.readFileSync(file.path);
          const tempFilePath = path.join(tempDir, file.name);
          
          // Save to temp directory
          fs.writeFileSync(tempFilePath, fileBuffer);
          
          // Log file information
          console.log('File received and saved:', file.name, tempFilePath);
          
          results.push({
            name: file.name,
            size: file.size,
            originalPath: file.path,
            tempPath: tempFilePath,
            status: 'received'
          });
        }
      } catch (error) {
        console.error('Error processing file:', error);
        results.push({
          name: file.name,
          status: 'error',
          error: error.message
        });
      }
    });
    return results;
  },
  
  // Compress files with actual compression logic
  compressFiles: async (filePaths) => {
    console.log('Compressing files:', filePaths);
    
    return new Promise((resolve, reject) => {
      // Send to main process where the actual compression will happen
      // We're using IPC here since compression is CPU-intensive
      ipcRenderer.send('compression-request', filePaths);
      
      // Listen for the response
      ipcRenderer.once('compression-complete', (event, result) => {
        resolve(result);
      });
      
      ipcRenderer.once('compression-error', (event, error) => {
        reject(error);
      });
    });
  },
  
  // Send a message to the main process
  send: (channel, data) => {
    // Whitelist channels for security
    const validChannels = ['file-upload', 'compression-request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Receive a message from the main process
  on: (channel, func) => {
    const validChannels = ['compression-complete', 'compression-error'];
    if (validChannels.includes(channel)) {
      // Strip event as it includes `sender` which can expose Node.js internals
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});

// Log when preload script has executed
console.log('Preload script loaded successfully');
