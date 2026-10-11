import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve } from 'path'
import { watchFile, unwatchFile } from 'fs'
import { readFile as readFileAsync, writeFile as writeFileAsync, mkdir } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { readEditorStateFile, writeSelectionFile } from '@radical/node-files/selectionFile'
import { FORGE_RUN_FILE } from '@radical/common/formats/forgeRunStatus'

/** One session per model folder, kept for the app's lifetime: it remembers
 *  what the renderer last read, so writes never clobber outside edits. */
const folderSessions = new Map<string, MdFolderSession>()

/** The folder of the active md document, polled for outside edits. */
let watchedFolder: string | null = null
const FOLDER_POLL_MS = 1000

function folderSession(folderPath: string): MdFolderSession {
  const key = resolve(folderPath)
  let session = folderSessions.get(key)
  if (!session) {
    session = new MdFolderSession(diskFolderStorage(key))
    session.onExternalChange = (paths) => {
      if (!watchedFolder || resolve(watchedFolder) !== key) return
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('folder:external-change', { folderPath: watchedFolder, paths })
      }
    }
    folderSessions.set(key, session)
  }
  return session
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
    title: 'radical.studio',
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
    // Keep the original headers — dropping Content-Type makes Chromium refuse
    // the renderer's module scripts and the window stays blank.
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
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
        { name: 'Radical model', extensions: ['radical'] },
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
        { name: 'Radical model', extensions: ['radical', 'c4.json', 'json'] },
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
      const files = await folderSession(folderPath).readAll()
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
      const files = await folderSession(folderPath).readAll()
      return { success: true, files }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    'folder:write',
    async (_event, folderPath: string, files: Record<string, string>) => {
      try {
        await mkdir(folderPath, { recursive: true })
        const res = await folderSession(folderPath).write(files)
        if (!res.ok) {
          return { success: false, conflict: res.conflict, error: 'The folder changed on disk since it was read.' }
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    },
  )

  // The canvas selection, for AI clients (the MCP server) on the same folder.
  // Outside the model files, so it never trips the folder session's checks.
  ipcMain.handle('folder:write-selection', async (_event, folderPath: string, content: string) => {
    try {
      await writeSelectionFile(folderPath, content)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Where an agent's Forge run on the same folder stands (the MCP server
  // writes it), for Studio to show.
  ipcMain.handle('folder:read-forge-run', async (_event, folderPath: string) => {
    try {
      return { success: true, content: await readEditorStateFile(folderPath, FORGE_RUN_FILE) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ── Folder watcher: poll the active md document's folder ─────────────────
  // Polling, like the --file watcher below: native change events are
  // unreliable on external volumes. A poll only stats the model files and
  // reads the ones whose stamp moved.
  ipcMain.handle('folder:watch', (_event, folderPath: string | null) => {
    watchedFolder = folderPath
  })
  const folderPoll = setInterval(() => {
    if (watchedFolder) {
      folderSession(watchedFolder).poll().catch((e) => console.warn('[main] folder poll failed:', e))
    }
  }, FOLDER_POLL_MS)
  app.on('will-quit', () => clearInterval(folderPoll))

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
