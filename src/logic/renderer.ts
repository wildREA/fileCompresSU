// This file is used to render the logic of the app
// Importing immigrants
import { a, b, add } from "./utils/test.js";

add(a, b);

// Importing the logic
import { ipcRenderer } from "electron";
import * as path from "path";
const dropzone = document.getElementById("dropzone-file") as HTMLDivElement;
const downloads = document.getElementById("download-section") as HTMLDivElement;
const compressed = document.getElementById("compression-results") as HTMLDivElement;

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => e.preventDefault());
});

dropzone.addEventListener("dragover", () => {
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

// Handle drop event
dropzone.addEventListener("drop", (e) => {
  dropzone.classList.remove("dragover");
  if (!e.dataTransfer) return;
  const files: string[] = [];
  for (const file of Array.from(e.dataTransfer.files)) {
    files.push(file.webkitRelativePath);
  }
  ipcRenderer.invoke("compress-files", files);
});

// Listen for compressed files path replies
ipcRenderer.on('compressed-files', (_e, compressedPaths: string[]) => {
  // Unhide the download section
  downloads.classList.remove("hidden");
  // Populate list
  compressed.innerHTML = "";
  compressedPaths.forEach((compressedPaths) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `file://${compressedPaths}`;
    a.textContent = path.basename(compressedPaths);
    a.setAttribute("download", '');
    li.appendChild(a);
    compressed.appendChild(li);
  });
});