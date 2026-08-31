import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve, dirname as pathDirname, relative, sep } from 'path'
import { watchFile, unwatchFile } from 'fs'
import {
  readFile as readFileAsync,
  writeFile as writeFileAsync,
  mkdir,
  readdir,
  rm,
} from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

/** Recursively collect the `.md` / `.json` files under `root` as a map of
 *  POSIX-relative path → UTF-8 content. Ignores hidden files/dirs. */
async function readFolderFiles(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(abs)
      } else if (entry.isFile() && /\.(md|json)$/i.test(entry.name)) {
        const rel = relative(root, abs).split(sep).join('/')
        files[rel] = await readFileAsync(abs, 'utf-8')
      }
    }
  }
  await walk(root)
  return files
}

/** Write a file map into `root`, then prune our own stale files (`.md` under
 *  `nodes/` and known sidecars) that are no longer present, so removals /
 *  renames in the model are reflected on disk. Never touches unrelated files. */
async function writeFolderFiles(root: string, files: Record<string, string>): Promise<void> {
  await mkdir(root, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    await mkdir(pathDirname(abs), { recursive: true })
    await writeFileAsync(abs, content, 'utf-8')
  }
  // Prune stale managed files.
  const existing = await readFolderFiles(root)
  for (const rel of Object.keys(existing)) {
    if (rel in files) continue
    const managed = rel.startsWith('nodes/') || /^[^/]+\.json$/.test(rel) || rel === 'radical.md'
    if (!managed) continue
    await rm(join(root, rel), { force: true })
  }
}

// ── CLI-specified model file (--file /path/to/model.c4.json or RADICAL_FILE env) ──
function getWatchedFilePath(): string | null {
  const idx = process.argv.indexOf('--file')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return process.env['RADICAL_FILE'] || null
}
const _watchedFilePath = getWatchedFilePath()

// Track when we last wrote to a path ourselves so we can suppress the
// "echo" watcher event that would otherwise reload the same content.
const _lastWrittenAt = new Map<string, number>()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: 'default',
    title: 'Radical.Tools',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) mainWindow.webContents.openDevTools()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    // Apply CSP only in production (dev HMR needs inline scripts and eval)
    mainWindow.webContents.session.webRequest.onHeadersReceived((_details, callback) => {
      callback({
        responseHeaders: {
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; font-src 'self' data:"
          ]
        }
      })
    })
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.radical.diagram')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── IPC: native file dialogs ─────────────────────────────────────────────

  ipcMain.handle('dialog:save', async (_event, json: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save Diagram',
      defaultPath: 'diagram.c4.json',
      filters: [
        { name: 'C4 Diagram', extensions: ['c4.json'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    })
    if (result.canceled || !result.filePath) return { success: false }
    await writeFileAsync(result.filePath, json, 'utf-8')
    _lastWrittenAt.set(result.filePath, Date.now())
    return { success: true, filePath: result.filePath }
  })

  ipcMain.handle('dialog:open', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open Diagram',
      filters: [
        { name: 'C4 Diagram', extensions: ['c4.json', 'json'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    const filePath = result.filePaths[0]
    const content = await readFileAsync(filePath, 'utf-8')
    return { success: true, filePath, content }
  })

  // ── IPC: silent file read/write (path already known) ─────────────────────

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const content = await readFileAsync(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('file:write', async (_event, filePath: string, json: string) => {
    try {
      await writeFileAsync(filePath, json, 'utf-8')
      _lastWrittenAt.set(filePath, Date.now())
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ── IPC: CLI-specified watched file ────────────────────────────────────────

  ipcMain.handle('file:getWatchedPath', () => _watchedFilePath)

  // ── IPC: markdown-folder persistence ─────────────────────────────────────

  ipcMain.handle('folder:open', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open Model Folder',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    const folderPath = result.filePaths[0]
    try {
      const files = await readFolderFiles(folderPath)
      return { success: true, folderPath, files }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('folder:pick', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Choose Folder for Model',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    return { success: true, folderPath: result.filePaths[0] }
  })

  ipcMain.handle('folder:read', async (_event, folderPath: string) => {
    try {
      const files = await readFolderFiles(folderPath)
      return { success: true, files }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'folder:write',
    async (_event, folderPath: string, files: Record<string, string>) => {
      try {
        await writeFolderFiles(folderPath, files)
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  // ── DEV: sample model source file helpers ─────────────────────────────────
  // Path is resolved once in the main process — no Vite define needed.
  if (is.dev) {
    const SAMPLE_JSON = resolve(__dirname, '../../src/renderer/src/store/fintechSampleData.json')

    ipcMain.handle('dev:saveSample', async (_event, json: string) => {
      try {
        await writeFileAsync(SAMPLE_JSON, json, 'utf-8')
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    })

    ipcMain.handle('dev:loadSample', async () => {
      try {
        const content = await readFileAsync(SAMPLE_JSON, 'utf-8')
        return { success: true, content }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    })
  }

  // ── File watcher: push external changes to renderer ───────────────────────
  // When launched with --file or RADICAL_FILE, watch the file with polling
  // (reliable on all mounts including /Volumes) and push its new content to
  // the renderer whenever it changes outside the app.
  if (_watchedFilePath) {
    watchFile(_watchedFilePath, { interval: 500 }, () => {
      // Suppress the echo caused by our own write (auto-persist → file:write IPC).
      const lastWrite = _lastWrittenAt.get(_watchedFilePath!) ?? 0
      if (Date.now() - lastWrite < 2000) return
      readFileAsync(_watchedFilePath!, 'utf-8')
        .then((content) => {
          const win = BrowserWindow.getAllWindows()[0]
          win?.webContents.send('file:external-change', { filePath: _watchedFilePath, content })
        })
        .catch((e) => console.warn('[main] watchFile read error:', e))
    })
    app.on('will-quit', () => unwatchFile(_watchedFilePath!))
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
