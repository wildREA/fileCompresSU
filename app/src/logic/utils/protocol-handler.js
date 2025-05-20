// This file contains the implementation of the electron: protocol handler

import { protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Registers the electron: protocol handler
 */
export function registerElectronProtocol() {
  // Register the protocol handler using the modern handle API
  protocol.handle('electron', async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname);
      console.log(`Protocol handler request for: ${filePath}`);

      if (filePath === '/preload.js') {
        // Map to preload.js
        const preloadPath = path.join(__dirname, '..', '..', '..', 'dist', 'logic', 'preload.js');
        console.log(`Mapping to: ${preloadPath}`);
        
        // Check if the file exists
        if (fs.existsSync(preloadPath)) {
          // Return a proper response with the file content
          const content = fs.readFileSync(preloadPath);
          return new Response(content, {
            headers: {
              'Content-Type': 'application/javascript'
            }
          });
        } else {
          console.error(`Preload file not found at: ${preloadPath}`);
          return new Response('File not found', { status: 404 });
        }
      } else {
        console.error(`Unknown protocol path: ${filePath}`);
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error(`Protocol handler error: ${error.message}`);
      return new Response('Error', { status: 500 });
    }
  });

  console.log('Electron protocol handler registered successfully');
}
