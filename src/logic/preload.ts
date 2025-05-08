// Preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process through contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // For compressing files
  compressFiles: (filePaths: string[]) => {
    return ipcRenderer.invoke('compress-files', filePaths);
  },
  
  // For showing a file in the file explorer
  showItemInFolder: (path: string) => {
    ipcRenderer.send('show-item-in-folder', path);
  },
  
  // For showing a file open dialog
  openFileDialog: () => {
    return ipcRenderer.invoke('open-file-dialog');
  }
});
