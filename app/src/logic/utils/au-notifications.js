// Setup autoUpdater listeners
export function setupAutoUpdaterListeners(autoUpdater, dialog) {
  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("No update available.");
  });

  autoUpdater.on("error", (err) => {
    console.error("Error in auto-updater:", err);
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`Download speed: ${progress.bytesPerSecond} B/s`);
    console.log(`Downloaded ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded. Will install on quit.");
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message:
        "An update has been downloaded. It will be installed on restart.",
    });
  });
}
