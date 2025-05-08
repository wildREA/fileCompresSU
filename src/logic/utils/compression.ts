// This file contains utility functions for file compression and download handling.
// renderer.ts will use these functions to manage file compression and downloads.
import * as path from 'path';

// Add type definitions to access electronAPI from preload script
declare global {
  interface Window {
    electronAPI: {
      compressFiles: (filePaths: string[]) => Promise<CompressedFile[]>;
      showItemInFolder: (path: string) => void;
      openFileDialog: () => Promise<string[]>;
    };
  }
}

// Types for better type safety
export interface FileInfo {
  name: string;
  path?: string;
  size: number;
  type: string;
}

export interface CompressedFile {
  originalName: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

/**
 * Sets up the dropzone for file uploads, handling both drag and drop and file input events
 */
export function setupDropzone(
  dropzoneElement: HTMLElement, 
  fileInputElement: HTMLInputElement,
  onFilesSelected: (files: FileInfo[]) => void
): void {
  // Handle file selection via file input
  fileInputElement.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const fileInfos = Array.from(target.files).map(file => ({
        name: file.name,
        path: (file as any).path, // Electron specific property
        size: file.size,
        type: file.type
      }));
      
      onFilesSelected(fileInfos);
      updateDropzoneUI(dropzoneElement, fileInfos);
    }
  });

  // Handle drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzoneElement.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  // Add visual feedback for drag events
  dropzoneElement.addEventListener('dragenter', () => {
    dropzoneElement.classList.add('border-blue-500');
  });

  dropzoneElement.addEventListener('dragover', () => {
    dropzoneElement.classList.add('border-blue-500');
  });

  dropzoneElement.addEventListener('dragleave', () => {
    dropzoneElement.classList.remove('border-blue-500');
  });

  // Handle file drop
  dropzoneElement.addEventListener('drop', (e: DragEvent) => {
    dropzoneElement.classList.remove('border-blue-500');
    
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const fileInfos = Array.from(e.dataTransfer.files).map(file => ({
        name: file.name,
        path: (file as any).path, // Electron specific property
        size: file.size,
        type: file.type
      }));
      
      // Manually update the file input to reflect the dropped files
      // Note: This is a simplification - in a real app you'd need to handle
      // the FileList transfer differently as it's generally read-only
      onFilesSelected(fileInfos);
      updateDropzoneUI(dropzoneElement, fileInfos);
    }
  });
}

/**
 * Update the dropzone UI to show selected files
 */
function updateDropzoneUI(dropzoneElement: HTMLElement, files: FileInfo[]): void {
  // Find the container for file info display
  const container = dropzoneElement.querySelector('div');
  if (!container) {
    console.error('Container div not found in dropzone');
    return;
  }

  container.innerHTML = '';

  if (files.length === 0) {
    // No files selected, show default upload UI
    container.innerHTML = `
      <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
      </svg>
      <p class="mb-2 text-sm"><span class="font-semibold">Click to upload</span> or drag and drop</p>
      <p class="text-xs">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
    `;
  } else {
    // Files selected, show success UI with file list
    container.innerHTML = `
      <svg class="w-8 h-8 mb-4 text-green-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <p class="mb-2 text-sm font-semibold text-green-500">${files.length} file(s) selected</p>
      <div class="max-h-32 overflow-y-auto text-xs text-left w-full px-4 text-gray-400"></div>
    `;

    // Add file list
    const fileList = container.querySelector('div');
    if (fileList) {
      files.forEach(file => {
        const fileElement = document.createElement('p');
        fileElement.className = 'truncate'; // Truncate long filenames
        fileElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
        fileList.appendChild(fileElement);
      });
    }
  }
}

/**
 * Format file size for display (converts bytes to KB, MB, etc.)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Set up the compress button functionality
 */
export function setupCompressButton(
  buttonElement: HTMLButtonElement,
  selectedFiles: FileInfo[],
  onCompressionStart: () => void,
  onCompressionComplete: (files: CompressedFile[]) => void,
  onCompressionError: (error: any) => void
): void {
  buttonElement.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
      console.warn('No files selected for compression');
      return;
    }

    try {
      // Indicate compression has started
      onCompressionStart();
      buttonElement.disabled = true;
      buttonElement.textContent = 'Compressing...';
      buttonElement.classList.add('opacity-70');

      // Extract paths from file info objects
      const filePaths = selectedFiles
        .filter(file => file.path)
        .map(file => file.path as string);

      if (filePaths.length === 0) {
        throw new Error('No valid file paths found for compression');
      }

      // Send to main process for compression via IPC
      const result = await compressFiles(filePaths);
      
      // Process and handle the compressed files
      onCompressionComplete(result);
    } catch (error) {
      console.error('Compression error:', error);
      onCompressionError(error);
    } finally {
      // Reset button state
      buttonElement.disabled = false;
      buttonElement.textContent = 'Compress';
      buttonElement.classList.remove('opacity-70');
    }
  });
}

/**
 * Compress files using the main process
 */
export function compressFiles(filePaths: string[]): Promise<CompressedFile[]> {
  return window.electronAPI.compressFiles(filePaths);
}

/**
 * Update the download section with compressed file information
 */
export function updateDownloadSection(
  downloadSection: HTMLElement,
  compressedFiles: CompressedFile[]
): void {
  // Show the download section
  downloadSection.classList.remove('hidden');

  // Get the results container
  const resultsContainer = downloadSection.querySelector('#compression-results');
  if (!resultsContainer) {
    console.error('Results container not found');
    return;
  }

  // Clear previous results
  resultsContainer.innerHTML = '';

  // Add each compressed file to the results
  compressedFiles.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'bg-gray-700 p-3 rounded flex justify-between items-center mb-2';

    // File info (name and compression ratio)
    const fileInfo = document.createElement('div');
    fileInfo.className = 'flex-1';
    
    const fileName = document.createElement('p');
    fileName.className = 'font-medium text-white truncate';
    fileName.textContent = file.originalName;
    
    const compressionInfo = document.createElement('p');
    compressionInfo.className = 'text-xs text-gray-400';
    compressionInfo.textContent = `${formatFileSize(file.originalSize)} → ${formatFileSize(file.compressedSize)} (${file.compressionRatio})`;
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(compressionInfo);

    // Download button
    const downloadButton = document.createElement('a');
    downloadButton.href = `file://${file.compressedPath}`;
    downloadButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm ml-4';
    downloadButton.textContent = 'Download';
    downloadButton.setAttribute('download', ''); // Ensure browser treats as download

    // Download button click handler (for Electron)
    downloadButton.addEventListener('click', (e) => {
      e.preventDefault();
      // Show the file in explorer instead of navigating
      window.electronAPI.showItemInFolder(file.compressedPath);
    });

    // Assemble the file item
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(downloadButton);
    resultsContainer.appendChild(fileItem);
  });
}
