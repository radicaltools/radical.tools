import { contextBridge, ipcRenderer } from 'electron'
import type { FileChange, FolderChange, HostCapabilities } from '@radical/host-bridge'

// The Electron implementation of Studio's host bridge: each capability is one
// IPC channel handled in src/main. The renderer reaches it through host()
// (src/renderer/src/platform/host.ts), never through window.electronAPI.
const api = {
  saveDiagram: (json) => ipcRenderer.invoke('dialog:save', json),
  openDiagram: () => ipcRenderer.invoke('dialog:open'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, json) => ipcRenderer.invoke('file:write', filePath, json),
  openFolder: () => ipcRenderer.invoke('folder:open'),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  readFolder: (folderPath) => ipcRenderer.invoke('folder:read', folderPath),
  writeFolder: (folderPath, files) => ipcRenderer.invoke('folder:write', folderPath, files),
  watchFolder: (folderPath) => ipcRenderer.invoke('folder:watch', folderPath),
  onFolderChanged: (listener) => {
    ipcRenderer.on('folder:external-change', (_event, data) => listener(data as FolderChange))
  },
  writeSelection: (folderPath, content) => ipcRenderer.invoke('folder:write-selection', folderPath, content),
  readForgeRun: (folderPath) => ipcRenderer.invoke('folder:read-forge-run', folderPath),
  getWatchedPath: () => ipcRenderer.invoke('file:getWatchedPath'),
  onFileChanged: (listener) => {
    ipcRenderer.on('file:external-change', (_event, data) => listener(data as FileChange))
  },
} satisfies Required<HostCapabilities>

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electronAPI = api
}
