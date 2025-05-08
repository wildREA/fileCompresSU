// This file will use the Electron API to handle file compression and downloads.
// It imports functions from compression.ts to handle the file operations.

import { 
  FileInfo, 
  CompressedFile, 
  setupDropzone, 
  setupCompressButton, 
  updateDownloadSection 
} from './utils/compression.js'; // Add .js extension for browser compatibility

// Store selected files
let selectedFiles: FileInfo[] = [];

document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const dropzoneInput = document.getElementById('dropzone-file') as HTMLInputElement;
  const dropzoneLabel = dropzoneInput?.parentElement as HTMLLabelElement;
  const compressButton = document.getElementById('compress') as HTMLButtonElement;
  const downloadSection = document.getElementById('download-section') as HTMLDivElement;

  // Verify that we have all required elements
  if (!dropzoneInput || !dropzoneLabel || !compressButton || !downloadSection) {
    console.error('Missing required DOM elements');
    return;
  }

  // Setup the dropzone for file uploads
  setupDropzone(dropzoneLabel, dropzoneInput, (files) => {
    // Store the selected files for later use
    selectedFiles = files;
    
    // Update the compress button appearance to indicate files are ready
    if (files.length > 0) {
      compressButton.classList.add('bg-green-500', 'hover:bg-green-700');
      compressButton.classList.remove('bg-blue-500', 'hover:bg-blue-700');
    } else {
      compressButton.classList.add('bg-blue-500', 'hover:bg-blue-700');
      compressButton.classList.remove('bg-green-500', 'hover:bg-green-700');
    }
  });

  // Set up compress button click handler
  setupCompressButton(
    compressButton, 
    selectedFiles,
    // Compression start handler
    () => {
      console.log('Compression started for', selectedFiles.length, 'files');
      // Optional: Add loading indicator or UI feedback here
    },
    // Compression complete handler
    (compressedFiles) => {
      console.log('Compression complete:', compressedFiles);
      updateDownloadSection(downloadSection, compressedFiles);
    },
    // Compression error handler
    (error) => {
      console.error('Error during compression:', error);
      // Display error message to user
      alert(`Compression failed: ${error.message || 'Unknown error'}`);
    }
  );
});
