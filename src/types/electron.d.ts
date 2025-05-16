// Define types for Electron modules
declare module "electron" {
  // Re-export all types from the original electron module
  export * from "electron/main";
  export * from "electron/common";
  export * from "electron/renderer";
}

// The electron: protocol is deprecated - use regular imports instead
// For example: import { app } from 'electron'; instead of import app from 'electron:app'
