// Custom loader for electron: protocol
import { builtinModules, createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// Create a require function
const require = createRequire(import.meta.url);

export function resolve(specifier, context, nextResolve) {
  // Check if it's electron or one of its modules
  if (specifier === "electron" || specifier.startsWith("electron/")) {
    return {
      shortCircuit: true,
      url: `node:electron${
        specifier === "electron" ? "" : specifier.slice("electron".length)
      }`,
    };
  }

  // Handle electron: protocol URLs by converting to file: URLs
  if (specifier.startsWith("electron:")) {
    const submodule = specifier.slice("electron:".length);
    // Import from the actual electron module instead
    return {
      shortCircuit: true,
      url: "node:electron",
      importAttributes: { submodule },
    };
  }

  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  // Handle electron modules specially
  if (url.startsWith("node:electron")) {
    try {
      // Load the electron module directly from the loader file
      const electronModule = require("electron");

      // For the main electron module, we need to explicitly create exports
      // for all commonly used electron components
      return {
        shortCircuit: true,
        format: "module",
        source: `
          // Use pre-loaded electron module from loader
          const electron = ${JSON.stringify(electronModule)};
          
          export default electron;
          
          // Export main process modules
          export const app = electron.app;
          export const autoUpdater = electron.autoUpdater;
          export const BrowserWindow = electron.BrowserWindow;
          export const clipboard = electron.clipboard;
          export const contentTracing = electron.contentTracing;
          export const crashReporter = electron.crashReporter;
          export const dialog = electron.dialog;
          export const globalShortcut = electron.globalShortcut;
          export const ipcMain = electron.ipcMain;
          export const Menu = electron.Menu;
          export const MenuItem = electron.MenuItem;
          export const nativeImage = electron.nativeImage;
          export const net = electron.net;
          export const netLog = electron.netLog;
          export const Notification = electron.Notification;
          export const powerMonitor = electron.powerMonitor;
          export const powerSaveBlocker = electron.powerSaveBlocker;
          export const protocol = electron.protocol;
          export const screen = electron.screen;
          export const session = electron.session;
          export const shell = electron.shell;
          export const systemPreferences = electron.systemPreferences;
          export const Tray = electron.Tray;
          export const webContents = electron.webContents;
          export const webFrameMain = electron.webFrameMain;
          
          // Export renderer process modules
          export const contextBridge = electron.contextBridge;
          export const ipcRenderer = electron.ipcRenderer;
          export const webFrame = electron.webFrame;
          
          // Export shared modules
          export const desktopCapturer = electron.desktopCapturer;
          export const safeStorage = electron.safeStorage;
        `,
      };
    } catch (error) {
      console.error(`Error loading electron module: ${url}`, error);
      throw error;
    }
  }

  // Let Node.js handle other modules
  return nextLoad(url, context);
}
