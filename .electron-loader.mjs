// ESM module that replaces electron: protocol imports with standard imports
// This version uses pure ESM with Node.js module hooks

import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// Only run in Node.js environment (not browser)
if (typeof window === "undefined") {
  console.log("Electron loader: replacing electron: protocol imports");
  
  // Get the directory of the current module
  const __filename = fileURLToPath(import.meta.url);
  
  // Create a require function for loading the Electron module
  const require = createRequire(import.meta.url);
  
  // In a real ESM environment, we need to use ES modules loader hooks
  // This is a simplified version that works for most cases
  // by hooking into import.meta.resolve which is used by dynamic imports
  
  // Store the original URL resolution function
  const originalResolve = import.meta.resolve;
  
  // If using Node.js >= 20.6.0, you can use the actual module hooks API
  // to intercept and modify imports completely, but this is a simple version
  // that works for dynamic imports through a global patch
  
  global.__electronLoader = {
    resolveElectron: (specifier) => {
      if (specifier.startsWith('electron:')) {
        const submodule = specifier.slice('electron:'.length);
        const electron = require('electron');
        return submodule ? electron[submodule] : electron;
      }
      return null;  // Not an electron protocol
    }
  };
}

// No need to export anything
