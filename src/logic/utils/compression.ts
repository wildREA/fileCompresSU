const { ipcRenderer } = require("electron");
const path = require("path");

// Types
interface CompressionHandlers {
  onCompressionComplete: (paths: string[]) => void;
  onCompressionError?: (error: any) => void;
}

/**
 * Sets up drag and drop event handlers for file compression
 */
export function setupDropzoneHandlers(dropzoneElement: HTMLElement): void {
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropzoneElement.addEventListener(eventName, (e) => e.preventDefault());
  });

  dropzoneElement.addEventListener("dragover", () => {
    dropzoneElement.classList.add("dragover");
  });

  dropzoneElement.addEventListener("dragleave", () => {
    dropzoneElement.classList.remove("dragover");
  });

  // Handle drop event
  dropzoneElement.addEventListener("drop", (e: DragEvent) => {
    dropzoneElement.classList.remove("dragover");
    if (!e.dataTransfer) return;

    const files: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      // Use path property if available, otherwise use webkitRelativePath
      const filePath = (file as any).path || file.webkitRelativePath;
      if (filePath) {
        files.push(filePath);
      }
    }

    if (files.length > 0) {
      compressFiles(files);
    }
  });
}

/**
 * Send files to the main process for compression
 */
export function compressFiles(filePaths: string[]): Promise<string[]> {
  return ipcRenderer.invoke("compress-file", filePaths);
}

/**
 * Set up listeners for compression events
 */
export function setupCompressionListeners({
  onCompressionComplete,
  onCompressionError,
}: CompressionHandlers): void {
  // Listen for compressed files path replies
  ipcRenderer.on(
    "compressed-files",
    (_e: Electron.IpcRendererEvent, compressedPaths: string[]) => {
      onCompressionComplete(compressedPaths);
    }
  );

  if (onCompressionError) {
    ipcRenderer.on(
      "compression-error",
      (_e: Electron.IpcRendererEvent, error: unknown) => {
        onCompressionError(error);
      }
    );
  }
}

/**
 * Generate download link elements for compressed files
 */
export function createDownloadElements(
  compressedPaths: string[]
): HTMLLIElement[] {
  return compressedPaths.map((compressedPath) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `file://${compressedPath}`;
    a.textContent = path.basename(compressedPath);
    a.setAttribute("download", "");
    li.appendChild(a);
    return li;
  });
}
