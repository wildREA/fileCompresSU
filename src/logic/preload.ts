import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    compressFiles: (files: string[]) => ipcRenderer.invoke('compress-files', files),
    onCompressed: (callback: (paths: string[]) => void) => ipcRenderer.on('files-compressed', (_e, compressedPaths: string[]) => callback(compressedPaths)),
});
