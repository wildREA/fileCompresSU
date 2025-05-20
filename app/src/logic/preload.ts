// Preload script
import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods to renderer process through contextBridge
contextBridge.exposeInMainWorld("electronAPI", {
  // For compressing files
  compressFiles: (filePaths: string[]) => {
    console.log("Preload: Compressing files with paths:", filePaths);
    return ipcRenderer.invoke("compress-files", filePaths);
  },

  // For compressing file objects directly (new method)
  compressFileObjects: async (files: any[]) => {
    console.log("Preload: Sending file objects for compression");

    // We need to read the files and convert them to a format we can send to the main process
    const fileDataArray = await Promise.all(
      files.map(async (file) => {
        // If the file has _originalFile that's a File object, read it
        if (file._originalFile instanceof File) {
          const fileObj = file._originalFile;
          // Read the file data as ArrayBuffer
          const arrayBuffer = await fileObj.arrayBuffer();
          // Convert to Buffer for IPC transmission (JSON-serializable as base64)
          const buffer = Buffer.from(arrayBuffer);

          return {
            name: file.name || fileObj.name,
            type: file.type || fileObj.type,
            size: file.size || fileObj.size,
            data: buffer.toString("base64"), // Send as base64 string
          };
        }

        return {
          name: file.name,
          type: file.type,
          size: file.size,
          // No data available
          data: null,
        };
      })
    );

    return ipcRenderer.invoke("compress-file-objects", fileDataArray);
  },

  // For showing a file in the file explorer
  showItemInFolder: (path: string) => {
    ipcRenderer.send("show-item-in-folder", path);
  },

  // For showing a file open dialog
  openFileDialog: () => {
    return ipcRenderer.invoke("open-file-dialog");
  },

  // Enhanced function to get native path from file object
  // (helps overcome browser security restrictions)
  getNativeFilePath: (fileObj: any) => {
    console.log("Preload: Getting native file path for:", fileObj);

    // Function to recursively search for path properties in an object
    const findPathInObject = (obj: any, depth = 0): string | null => {
      // Prevent infinite recursion or excessive depth
      if (!obj || typeof obj !== "object" || depth > 3) {
        return null;
      }

      // Check for common path properties
      const pathProps = ["path", "_path", "filePath", "fullPath", "nativePath"];

      for (const prop of pathProps) {
        if (obj[prop] && typeof obj[prop] === "string") {
          console.log(`Preload: Found ${prop} property:`, obj[prop]);
          return obj[prop];
        }
      }

      // Look for 'file://' URLs in any string properties
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string" && value.startsWith("file://")) {
          console.log(`Preload: Found file:// URL in ${key}:`, value);
          // Convert file:// URL to path
          try {
            const url = new URL(value);
            return decodeURIComponent(url.pathname);
          } catch (e) {
            return value.replace("file://", "");
          }
        }
      }

      // Check for special electron-specific properties or prototypes
      if (obj.constructor && obj.constructor.name === "File") {
        // For standard File objects

        // webkitRelativePath might be useful in some cases
        if (obj.webkitRelativePath) {
          console.log(
            "Preload: Found webkitRelativePath:",
            obj.webkitRelativePath
          );
          return obj.webkitRelativePath;
        }

        // In Electron, Files might have additional properties
        const electronProps = ["_path", "__path", "_filePath"];
        for (const prop of electronProps) {
          if (obj[prop]) {
            console.log(`Preload: Found ${prop}:`, obj[prop]);
            return obj[prop];
          }
        }
      }

      // Check for _originalFile property which might have been added by our app
      if (obj._originalFile) {
        return findPathInObject(obj._originalFile, depth + 1);
      }

      // Look through immediate child objects (but not arrays to avoid performance issues)
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const result = findPathInObject(value, depth + 1);
          if (result) return result;
        }
      }

      return null;
    };

    // Try to get path from various properties that Electron might expose
    if (fileObj) {
      // First check direct path property (most common in Electron)
      if (fileObj.path) {
        console.log("Preload: Found path property:", fileObj.path);
        return fileObj.path;
      }

      // Try recursive search for paths in the object
      const pathFromSearch = findPathInObject(fileObj);
      if (pathFromSearch) {
        return pathFromSearch;
      }

      // For drag and drop operations, the dataTransfer item might have the path
      if (fileObj.dataTransfer && fileObj.dataTransfer.items) {
        for (const item of fileObj.dataTransfer.items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file && file.path) {
              console.log(
                "Preload: Found path in dataTransfer item:",
                file.path
              );
              return file.path;
            }
          }
        }
      }
    }

    console.log("Preload: No path found for file object");
    return null;
  },
});
