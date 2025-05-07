// Importing the compression utility functions
import {
  setupDropzoneHandlers,
  setupCompressionListeners,
  createDownloadElements,
} from "./utils/compression";

// Get DOM elements
const dropzone = document.getElementById("dropzone-file") as HTMLDivElement;
const downloads = document.getElementById("download-section") as HTMLDivElement;
const compressed = document.getElementById("compression-results") as HTMLDivElement;

// Verify that we have all required elements
if (!dropzone || !downloads || !compressed) {
  console.error("Missing required DOM elements");
} else {
  // Set up the dropzone handlers for drag and drop
  setupDropzoneHandlers(dropzone);

  // Set up compression listeners
  setupCompressionListeners({
    onCompressionComplete: (compressedPaths) => {
      // Unhide the download section
      downloads.classList.remove("hidden");

      // Clear previous content
      compressed.innerHTML = "";

      // Add download links for each compressed file
      const downloadElements = createDownloadElements(compressedPaths);
      downloadElements.forEach((element) => {
        compressed.appendChild(element);
      });
    },
    onCompressionError: (error) => {
      console.error("Compression error:", error);
      // Optional: Show an error message in the UI
      alert("Error compressing files. Please try again.");
    },
  });
}
