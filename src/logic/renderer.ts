// This file is used to render the logic of the app
// Importing immigrants
import { a, b, add } from "./utils/test.js";

add(a, b);

// Importing the logic
import { ipcRenderer } from "electron";
const dropzone = document.getElementById("dropzone-file") as HTMLDivElement;
const downloads = document.getElementById("download-section") as HTMLDivElement;
const compressed = document.getElementById(
  "compression-results"
) as HTMLDivElement;

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => e.preventDefault());
});
