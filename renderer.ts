// File upload handling with Electron API integration
declare global {
  interface Window {
    electronAPI: {
      receiveFiles: (files: File[]) => any[];
      compressFiles: (filePaths: string[]) => Promise<{
        success: boolean;
        compressedFiles: Array<{
          originalPath: string;
          compressedPath: string;
          compressionRatio: string;
        }>;
      }>;
      send: (channel: string, data: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dropzoneInput = document.getElementById('dropzone-file') as HTMLInputElement;
  
  // Add null check for dropzoneInput
  if (!dropzoneInput) {
    console.error('Could not find dropzone-file input element');
    return;
  }
  
  const dropzoneLabel = dropzoneInput.parentElement as HTMLLabelElement;
  const compressButton = document.getElementById('compress') as HTMLButtonElement;
  
  // Add null check for dropzoneLabel and compressButton
  if (!dropzoneLabel || !compressButton) {
    console.error('Could not find required DOM elements');
    return;
  }
  
  let selectedFiles: File[] = [];

  // Handle file selection with proper typing
  dropzoneInput.addEventListener('change', (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target && target.files) {
      selectedFiles = Array.from(target.files);
      updateDropzoneUI(selectedFiles);
    }
  });

  // Handle drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzoneLabel.addEventListener(eventName, preventDefaults, false);
  });

  // Add proper event type
  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  // Visual feedback for drag events
  dropzoneLabel.addEventListener('dragenter', () => {
    dropzoneLabel.classList.add('border-blue-500');
  });

  dropzoneLabel.addEventListener('dragover', () => {
    dropzoneLabel.classList.add('border-blue-500');
  });

  dropzoneLabel.addEventListener('dragleave', () => {
    dropzoneLabel.classList.remove('border-blue-500');
  });

  dropzoneLabel.addEventListener('drop', (e: DragEvent) => {
    dropzoneLabel.classList.remove('border-blue-500');
    
    // Add null check for dataTransfer
    if (e.dataTransfer && e.dataTransfer.files) {
      const files = e.dataTransfer.files;
      selectedFiles = Array.from(files);
      
      // Trigger change event for compatibility
      const changeEvent = new Event('change');
      dropzoneInput.dispatchEvent(changeEvent);
    }
  });

  // Update the UI to show selected files with proper typing
  function updateDropzoneUI(files: File[]): void {
    // Clear previous content
    const container = dropzoneLabel.querySelector('div');
    
    // Add null check for container
    if (!container) {
      console.error('Container div not found within dropzone');
      return;
    }
    
    container.innerHTML = '';

    if (files.length === 0) {
      // No files selected, restore default view
      container.innerHTML = `
        <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
        </svg>
        <p class="mb-2 text-sm"><span class="font-semibold">Click to upload</span> or drag and drop</p>
        <p class="text-xs">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
      `;
    } else {
      // Files selected, show file list with success indicator
      container.innerHTML = `
        <svg class="w-8 h-8 mb-4 text-green-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <p class="mb-2 text-sm font-semibold text-green-500">${files.length} file(s) selected</p>
        <div class="max-h-32 overflow-y-auto text-xs text-left w-full px-4 text-gray-400"></div>
      `;

      // Add file list with null check
      const fileList = container.querySelector('div');
      if (fileList) {
        files.forEach((file: File) => {
          const fileElement = document.createElement('p');
          fileElement.className = 'truncate'; // Add truncate for long filenames
          fileElement.textContent = `${file.name} (${formatFileSize(file.size)})`;
          fileList.appendChild(fileElement);
        });
      }
      
      // Update compress button to indicate it's ready
      compressButton.classList.add('bg-green-500', 'hover:bg-green-700');
      compressButton.classList.remove('bg-blue-500', 'hover:bg-blue-700');
    }
  }

  // Format file size for display with proper typing
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Handle compress button click with Electron API integration
  compressButton.addEventListener('click', async () => {
    if (selectedFiles.length > 0) {
      try {
        // Update UI to show processing state
        compressButton.textContent = 'Compressing...';
        compressButton.disabled = true;
        
        // Notify main process about files via our preload bridge
        window.electronAPI.send('file-upload', selectedFiles);
        
        // Process the selected files using the Electron bridge
        const filePaths = selectedFiles.map(file => file.name);
        
        // Use the exposed API to compress files
        const result = await window.electronAPI.compressFiles(filePaths);
        
        // Handle compression result
        if (result.success) {
          // Update UI to show success
          updateResultsUI(result.compressedFiles);
          compressButton.textContent = 'Compress';
          compressButton.disabled = false;
        } else {
          throw new Error('Compression failed');
        }
      } catch (error) {
        console.error('Error during compression:', error);
        compressButton.textContent = 'Compression Failed';
        setTimeout(() => {
          compressButton.textContent = 'Compress';
          compressButton.disabled = false;
        }, 3000);
      }
    }
  });
  
  // Function to update UI with compression results
  function updateResultsUI(compressedFiles: Array<{
    originalPath: string;
    compressedPath: string;
    compressionRatio: string;
  }>) {
    // Create a results container if it doesn't exist
    let resultsContainer = document.getElementById('compression-results');
    if (!resultsContainer) {
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'compression-results';
      resultsContainer.className = 'mt-8 w-full bg-gray-800 p-4 rounded-lg';
      document.querySelector('.flex.flex-col.items-center')?.appendChild(resultsContainer);
    }
    
    // Clear previous results
    resultsContainer.innerHTML = `
      <h3 class="text-lg font-bold mb-4">Compression Results</h3>
      <div class="space-y-2"></div>
    `;
    
    const listContainer = resultsContainer.querySelector('.space-y-2');
    if (listContainer) {
      compressedFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'bg-gray-700 p-3 rounded flex justify-between items-center';
        fileItem.innerHTML = `
          <div class="truncate flex-1">
            <span class="font-medium">${path.basename(file.originalPath)}</span>
          </div>
          <div class="text-green-400 ml-4 font-mono">
            ${file.compressionRatio} smaller
          </div>
        `;
        listContainer.appendChild(fileItem);
      });
    }
  }
  
  // Listen for compression events from main process
  window.electronAPI.on('compression-complete', (result) => {
    console.log('Compression completed:', result);
    // Additional UI updates can be done here
  });
  
  window.electronAPI.on('compression-error', (error) => {
    console.error('Compression error from main process:', error);
    // Error handling UI updates can be done here
  });
});

// Path module for handling file paths
const path = {
  basename: (filePath: string): string => {
    return filePath.split(/[\\/]/).pop() || filePath;
  }
};
