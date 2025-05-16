// This file will use the Electron API to handle file compression and downloads.
// It imports functions from compression.ts to handle the file operations.

// Import compression module
import * as compressionModule from "./utils/compression.js";

// Destr ucture the functions
const { setupDropzone, setupCompressButton, updateDownloadSection } =
  compressionModule;

// For type safety, define interface types that match the ones in compression.ts
interface FileInfo {
  name: string;
  path?: string;
  size: number;
  type: string;
  id?: string;
}

interface CompressedFile {
  originalName: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}

// Initialize the app once the DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded - initializing file upload functionality");

  // Get DOM elements
  const dropzoneLabel = document.getElementById("dropzone") as HTMLLabelElement;
  const dropzoneInput = document.getElementById(
    "dropzone-file"
  ) as HTMLInputElement;
  const compressButton = document.getElementById(
    "compressor"
  ) as HTMLButtonElement;
  const downloadSection = document.getElementById(
    "download-section"
  ) as HTMLDivElement;

  // Verify that we have all required elements
  if (!dropzoneInput || !dropzoneLabel || !compressButton || !downloadSection) {
    console.error("Missing required DOM elements");
    return;
  }

  // Store selected files (will be updated by the setupDropzone callback)
  let selectedFiles: FileInfo[] = [];

  // Setup the dropzone for file uploads
  setupDropzone(dropzoneLabel, dropzoneInput, (files: FileInfo[]) => {
    // Store the selected files for later use
    selectedFiles = files;
    console.log(`Files selected: ${files.length} files`, files);

    // Update the compress button appearance to indicate files are ready
    if (files.length > 0) {
      compressButton.classList.add("bg-green-500", "hover:bg-green-700");
      compressButton.classList.remove("bg-blue-500", "hover:bg-blue-700");
    } else {
      compressButton.classList.add("bg-blue-500", "hover:bg-blue-700");
      compressButton.classList.remove("bg-green-500", "hover:bg-green-700");
    }
  });

  // Set up compress button click handler
  setupCompressButton(
    compressButton,
    // Compression start handler
    () => {
      console.log("Compression started for", selectedFiles.length, "files");
      // Optional: Add loading indicator or UI feedback here
    },
    // Compression complete handler
    (compressedFiles: CompressedFile[]) => {
      console.log("Compression complete:", compressedFiles);
      updateDownloadSection(downloadSection, compressedFiles);
    },
    // Compression error handler
    (error: Error) => {
      console.error("Error during compression:", error);
      // Display error message to user
      alert(`Compression failed: ${error.message || "Unknown error"}`);
    }
  );
});
