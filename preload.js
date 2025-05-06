// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

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
    // Process each file received from renderer
    files.forEach(file => {
      try {
        // Log file information for debugging
        console.log('File received:', file.name, file.path);
        results.push({
          name: file.name,
          size: file.size,
          path: file.path,
          status: 'received'
        });
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
  
  // Compress files (placeholder for actual compression logic)
  compressFiles: async (filePaths) => {
    // This would be replaced with actual compression logic
    console.log('Compressing files:', filePaths);
    
    return new Promise(resolve => {
      // Simulate compression process
      setTimeout(() => {
        resolve({
          success: true,
          compressedFiles: filePaths.map(filePath => {
            return {
              originalPath: filePath,
              compressedPath: filePath + '.compressed',
              compressionRatio: '50%' // Placeholder value
            };
          })
        });
      }, 1500);
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
