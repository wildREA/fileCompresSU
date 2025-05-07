// This file has to refer to index.html and use the hidden download-section class and has to be uploadable, and then be compressed
// and afterwards downloadable. It has to use the electron API to compress files and download them.

// This file contains utility functions for file compression and download handling.
// renderer.ts will use these functions to manage file compression and downloads.
const { ipcRenderer } = 'electron';
