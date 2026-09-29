// ─── Host bridge ─────────────────────────────────────────────────────────────
//
// The contract between Studio's renderer and the host it runs in: the
// Electron desktop app, a VS Code webview, or a plain browser. The renderer
// only ever talks to a HostBridge; each host implements the part it supports:
//
//   electron  apps/studio/src/preload (IPC to the main process)
//   vscode    ./vscode — createVsCodeWebviewHost, backed by apps/vscode
//   web       no methods; the browser build uses localStorage and the File
//             System Access API directly
//
// Every capability is optional. Callers check for a method before using it,
// and a failed operation resolves with `success: false` rather than throwing.

export type HostKind = 'electron' | 'vscode' | 'web'

export interface HostResult {
  success: boolean
  error?: string
}

export interface ReadFileResult extends HostResult {
  content?: string
}

export interface ReadFolderResult extends HostResult {
  files?: Record<string, string>
}

export interface FileChange {
  filePath: string
  content: string
}

/** What a host can do. Everything but `kind` is optional. */
export interface HostCapabilities {
  /** Save dialog, then write `json` to the chosen file. */
  saveDiagram?(json: string): Promise<HostResult & { filePath?: string }>
  /** Open dialog, then read the chosen file. */
  openDiagram?(): Promise<ReadFileResult & { filePath?: string }>
  readFile?(filePath: string): Promise<ReadFileResult>
  writeFile?(filePath: string, content: string): Promise<HostResult>
  /** Folder dialog, then read every file in the chosen folder. */
  openFolder?(): Promise<ReadFolderResult & { folderPath?: string }>
  /** Folder dialog only. */
  pickFolder?(): Promise<HostResult & { folderPath?: string }>
  readFolder?(folderPath: string): Promise<ReadFolderResult>
  writeFolder?(folderPath: string, files: Record<string, string>): Promise<HostResult>
  /** The file the host opened Studio with (CLI --file, VS Code editor), if any. */
  getWatchedPath?(): Promise<string | null>
  /** Called when the watched file changes outside Studio. */
  onFileChanged?(listener: (change: FileChange) => void): void
}

export interface HostBridge extends HostCapabilities {
  kind: HostKind
}

/** The browser host: no native capabilities. */
export const WEB_HOST: HostBridge = Object.freeze({ kind: 'web' as const })
