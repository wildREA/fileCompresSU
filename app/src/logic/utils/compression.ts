// This file contains utility functions for file compression and download handling.

// Simple path utility functions for browser environment
const pathUtils = {
  basename: (pathString: string): string => {
    // Simple implementation to extract filename from a path
    return pathString.split("/").pop()?.split("\\").pop() || "";
  },
};

// Types for better type safety - now exported explicitly
export interface CompressedFile {
  originalName: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

// Define global interfaces
declare global {
  interface Window {
    electronAPI: {
      compressFiles: (filePaths: string[]) => Promise<CompressedFile[]>;
      compressFileObjects: (files: any[]) => Promise<CompressedFile[]>;
      showItemInFolder: (path: string) => void;
      openFileDialog: () => Promise<string[]>;
      getNativeFilePath: (fileObj: any) => string | null;
    };
  }
}

// Types for better type safety
export interface FileInfo {
  name: string;
  path?: string;
  size: number;
  type: string;
  id?: string; // Adding ID to help with deduplication
  // We'll allow additional properties to be attached to the object
  [key: string]: any;
}

// Module level variable to store selected files
let selectedFiles: FileInfo[] = [];

// Helper to generate unique ID for files
function generateFileId(file: FileInfo): string {
  return `${file.name}-${file.size}-${file.path || ""}`;
}

/**
 * Format file size for display (converts bytes to KB, MB, etc.)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Calculate total size of all files
 */
function calculateTotalSize(files: FileInfo[]): number {
  return files.reduce((total, file) => total + file.size, 0);
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
  fileInputElement.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const currentFileIds = new Set(
        selectedFiles.map((f) => f.id || generateFileId(f))
      );

      const fileInfos = Array.from(target.files).map((file) => {
        // Store the original File object for later access
        const originalFile = file;

        // Use our enhanced getNativeFilePath API to get the file path
        // In Electron, the File object might have a path property or other internal properties
        const nativePath = window.electronAPI.getNativeFilePath(originalFile);
        console.log(`Getting native path for ${file.name}:`, nativePath);

        const fileInfo: FileInfo = {
          name: file.name,
          path: nativePath || (file as any).path, // Try both approaches
          size: file.size,
          type: file.type,
          // Store a reference to the original file for potential later use
          _originalFile: originalFile,
        } as FileInfo & { _originalFile: File };

        const id = generateFileId(fileInfo);

        return {
          ...fileInfo,
          id: id,
        };
      });

      console.log("File info objects after processing:", fileInfos);

      // Filter out duplicate files
      const newFiles = fileInfos.filter(
        (file) => !currentFileIds.has(file.id!)
      );

      // Update selected files
      selectedFiles = [...selectedFiles, ...newFiles];

      console.log("Updated selected files:", selectedFiles);

      onFilesSelected(selectedFiles);
      updateDropzoneUI(dropzoneElement, selectedFiles);

      // Reset input to allow selecting the same file again
      target.value = "";
    }
  });

  // Handle drag and drop events
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropzoneElement.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      false
    );
  });

  // Visual feedback for drag events
  dropzoneElement.addEventListener("dragenter", () => {
    dropzoneElement.classList.add("border-blue-500");
  });

  dropzoneElement.addEventListener("dragover", () => {
    dropzoneElement.classList.add("border-blue-500");
  });

  dropzoneElement.addEventListener("dragleave", () => {
    dropzoneElement.classList.remove("border-blue-500");
  });

  // Handle file drop
  dropzoneElement.addEventListener("drop", (e: DragEvent) => {
    dropzoneElement.classList.remove("border-blue-500");

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const currentFileIds = new Set(
        selectedFiles.map((f) => f.id || generateFileId(f))
      );

      const fileInfos = Array.from(e.dataTransfer.files).map((file) => {
        // Store the original File object
        const originalFile = file;

        // Try to get native path from the dropped file
        const nativePath = window.electronAPI.getNativeFilePath(originalFile);
        console.log(
          `Getting native path for dropped file ${file.name}:`,
          nativePath
        );

        // For drag and drop on Electron, we need to check all possible properties
        // where the path might be stored
        let possiblePath = nativePath;
        if (!possiblePath && (file as any).path) {
          possiblePath = (file as any).path;
        }

        // On macOS/Linux, files dropped into Electron might have a different property
        if (!possiblePath && (e as any).dataTransfer.items) {
          const item = Array.from((e as any).dataTransfer.items).find(
            (i) =>
              (i as any).getAsFile && (i as any).getAsFile().name === file.name
          );
          if (
            item &&
            (item as any).getAsFile &&
            (item as any).getAsFile().path
          ) {
            possiblePath = (item as any).getAsFile().path;
          }
        }

        const fileInfo: FileInfo = {
          name: file.name,
          path: possiblePath, // Use the path we found or null
          size: file.size,
          type: file.type,
          // Store a reference to the original file
          _originalFile: originalFile,
        } as FileInfo & { _originalFile: File };

        const id = generateFileId(fileInfo);

        return {
          ...fileInfo,
          id: id,
        };
      });

      console.log("File info objects after drop processing:", fileInfos);

      // Filter out duplicate files
      const newFiles = fileInfos.filter(
        (file) => !currentFileIds.has(file.id!)
      );

      // Update selected files
      selectedFiles = [...selectedFiles, ...newFiles];

      console.log("Updated selected files after drop:", selectedFiles);

      onFilesSelected(selectedFiles);
      updateDropzoneUI(dropzoneElement, selectedFiles);
    }
  });

  // Add a clear button to the UI
  dropzoneElement.addEventListener("click", (e) => {
    const clearButton = (e.target as HTMLElement).closest("#clear-files");
    if (clearButton) {
      e.preventDefault();
      e.stopPropagation();
      selectedFiles = [];
      onFilesSelected(selectedFiles);
      updateDropzoneUI(dropzoneElement, selectedFiles);
    }
  });
}

/**
 * Update the dropzone UI to show selected files
 */
export function updateDropzoneUI(
  dropzoneElement: HTMLElement,
  files: FileInfo[]
): void {
  // Find the container for file info display
  const container = dropzoneElement.querySelector("div");
  if (!container) {
    console.error("Container div not found in dropzone");
    return;
  }

  // Clear container
  container.innerHTML = "";

  if (files.length === 0) {
    // No files selected, show default upload UI
    container.innerHTML = `
      <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
      </svg>
      <p class="mb-2 text-sm">
        <span class="font-semibold">Click to upload</span> or drag and drop
      </p>
      <p class="text-xs">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
    `;
  } else {
    // Files selected, show success UI with file count and total size in light green
    const totalSize = calculateTotalSize(files);
    const formattedTotalSize = formatFileSize(totalSize);

    // Success UI with light green text for confirmation
    container.innerHTML = `
      <svg class="w-8 h-8 mb-4 text-green-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      
      <!-- File count in light green -->
      <p class="mb-2 text-lg font-bold text-green-400">
        ${files.length} file${files.length !== 1 ? "s" : ""} uploaded!
      </p>
      
      <!-- Total size in light green -->
      <p class="text-sm text-green-400 mb-3">
        Total size: ${formattedTotalSize}
      </p>
      
      <!-- File list with clear button -->
      <div class="flex items-center mt-2">
        <button id="clear-files" class="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">
          Clear
        </button>
      </div>
    `;
  }
}

/**
 * Set up the compress button functionality
 */
export function setupCompressButton(
  buttonElement: HTMLButtonElement,
  onCompressionStart: () => void,
  onCompressionComplete: (files: CompressedFile[]) => void,
  onCompressionError: (error: any) => void
): void {
  buttonElement.addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      console.warn("No files selected for compression");
      return;
    }

    try {
      // Indicate compression has started
      onCompressionStart();
      buttonElement.disabled = true;
      buttonElement.textContent = "Compressing...";
      buttonElement.classList.add("opacity-70");

      console.log("Selected files before compression:", selectedFiles);

      // If we don't have paths for the files, try to get them one more time
      const filesToProcess = await Promise.all(
        selectedFiles.map(async (file) => {
          // If we already have a path, use it
          if (file.path) {
            return file;
          }

          // For files that don't have paths, try to get the native path
          // This applies the getNativeFilePath function to any potential internal properties
          const fileObj = selectedFiles.find((f) => f.id === file.id);
          if (fileObj && window.electronAPI.getNativeFilePath) {
            const nativePath = window.electronAPI.getNativeFilePath(fileObj);
            if (nativePath) {
              console.log(
                `Retrieved native path for ${file.name}:`,
                nativePath
              );
              return { ...file, path: nativePath };
            }
          }

          return file;
        })
      );

      // Update the selectedFiles with any retrieved paths
      selectedFiles = filesToProcess;

      // First try to get file paths
      const filePaths = selectedFiles
        .map((file) => file.path)
        .filter(Boolean) as string[];

      // Log for debugging
      console.log("File paths extracted for compression:", filePaths);

      let result;

      // If we have paths, use the traditional method
      if (filePaths.length > 0) {
        console.log("Starting compression with paths:", filePaths);
        result = await compressFiles(filePaths);
      }
      // Otherwise use the new method that sends file objects directly
      else {
        console.log(
          "No valid paths found, using direct file object compression"
        );

        // Use files that have the original File object
        const fileObjects = selectedFiles.filter(
          (file) => file._originalFile instanceof File
        );

        if (fileObjects.length === 0) {
          console.warn("No valid file objects found");
          onCompressionError(new Error("Could not access file data."));
          return;
        }

        console.log("Starting compression with file objects:", fileObjects);
        result = await compressFileObjects(fileObjects);
      }

      // Process and handle the compressed files
      onCompressionComplete(result);
    } catch (error) {
      console.error("Compression error:", error);
      onCompressionError(error);
    } finally {
      // Reset button state
      buttonElement.disabled = false;
      buttonElement.textContent = "Compress";
      buttonElement.classList.remove("opacity-70");
    }
  });
}

/**
 * Compress files using the main process
 */
export function compressFiles(filePaths: string[]): Promise<CompressedFile[]> {
  // Using "as any" to avoid TypeScript error since we've declared the type globally
  return (window as any).electronAPI.compressFiles(filePaths);
}

/**
 * Compress file objects directly using the main process
 */
export function compressFileObjects(
  fileObjects: any[]
): Promise<CompressedFile[]> {
  return (window as any).electronAPI.compressFileObjects(fileObjects);
}

/**
 * Update the download section with compressed file information
 */
export function updateDownloadSection(
  downloadSection: HTMLElement,
  compressedFiles: CompressedFile[]
): void {
  // Show the download section
  downloadSection.classList.remove("hidden");

  // Get the results container
  const resultsContainer = downloadSection.querySelector(
    "#compression-results"
  );
  if (!resultsContainer) {
    console.error("Results container not found");
    return;
  }

  // Clear previous results
  resultsContainer.innerHTML = "";

  // Add each compressed file to the results
  compressedFiles.forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className =
      "bg-gray-700 p-3 rounded flex justify-between items-center mb-2";

    // File info (name and compression ratio)
    const fileInfo = document.createElement("div");
    fileInfo.className = "flex-1";

    // Get the actual compressed file name from the path
    const compressedName = pathUtils.basename(file.compressedPath);

    const fileName = document.createElement("p");
    fileName.className = "font-medium text-white truncate";
    fileName.textContent = compressedName;

    const compressionInfo = document.createElement("p");
    compressionInfo.className = "text-xs text-gray-400";
    compressionInfo.textContent = `${formatFileSize(
      file.originalSize
    )} → ${formatFileSize(file.compressedSize)} (${file.compressionRatio})`;

    fileInfo.appendChild(fileName);
    fileInfo.appendChild(compressionInfo);

    // Download button
    const downloadButton = document.createElement("a");
    downloadButton.href = `file://${file.compressedPath}`;
    downloadButton.className =
      "bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm ml-4 transition-colors duration-150";
    downloadButton.textContent = "View";
    downloadButton.setAttribute("download", ""); // Ensure browser treats as download

    // Download button click handler (for Electron)
    downloadButton.addEventListener("click", (e) => {
      e.preventDefault();
      // Show the file in explorer instead of navigating
      (window as any).electronAPI.showItemInFolder(file.compressedPath);
    });

    // Assemble the file item
    fileItem.appendChild(fileInfo);
    fileItem.appendChild(downloadButton);
    resultsContainer.appendChild(fileItem);
  });
}
