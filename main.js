const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { createGzip } = require('zlib');
const { createReadStream, createWriteStream } = require('fs');
const { basename, join } = require('path');

// Main process
function createWindow() {
// 1) Remove the entire application menu
Menu.setApplicationMenu(null);

  // 2) Create a new BrowserWindow instance
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'File CompresSU',
    icon: path.join(__dirname, 'src', 'images', 'appIcon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,  // This should be true for security best practices (active preload.js)
      preload: __dirname + '/preload.js' // Preload script for security
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ╔═══════════════════════════════════════════════════════════════════╗
// ║                       ██╗██████╗  ██████╗                         ║
// ║                       ██║██╔══██╗██╔════╝                         ║
// ║                       ██║██████╔╝██║                              ║
// ║                       ██║██╔═══╝ ██║                              ║
// ║                       ██║██║     ╚██████╗                         ║
// ║                       ╚═╝╚═╝      ╚═════╝                         ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ipcMain event to handle file compression
ipcMain.handle('compress-file', async (_event, filePaths) => {
  const outputPaths = []; // Initialize array to store output paths
  for (const inputPath of filePaths) {
    const name = basename(inputPath);
    const outPath = join(app.getPath('desktop'), `${name}.gz`);
    await new Promise((resolve, reject) => {
      const input = createReadStream(inputPath);
      const gzip = createGzip();
      const output = createWriteStream(outPath);
      input.pipe(gzip).pipe(output)
        .on('finish', () => resolve())
        .on('error', reject);
    });
    outputPaths.push(outPath);
  }
  _event.sender.send('compressed-files', outputPaths);
  return outputPaths;
});
