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

import type { DiscussionAction, Discussions } from '@radical/common/discussions'

export type HostKind = 'electron' | 'vscode' | 'web'

export interface DiscussionResult extends HostResult {
  discussions?: Discussions
  conflict?: boolean
}

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

export interface WriteFolderResult extends HostResult {
  /** Set when nothing was written because these files (relative paths)
   *  changed on disk since the folder was last read and could not be merged. */
  conflict?: string[]
  /** Set when the write was merged with these files changed on disk since
   *  the folder was last read; `conflicts` names the values both changed,
   *  where the disk's was kept. */
  merged?: { changed: string[]; conflicts: string[]; dropped?: Array<{ name: string; by: 'ours' | 'theirs' }>; restored?: string[] }
}

export interface FileChange {
  filePath: string
  content: string
}

export interface FolderChange {
  folderPath: string
  /** Relative paths of the model files that changed. */
  paths: string[]
}

/** What a host can do. Everything but `kind` is optional. */
export interface HostCapabilities {
  /** Independent companion-file operations, acknowledged after atomic replacement. */
  loadDiscussions?(folderPath: string): Promise<DiscussionResult>
  actOnDiscussion?(folderPath: string, action: DiscussionAction): Promise<DiscussionResult>
  /** Save dialog, then write `json` to the chosen file. */
  saveDiagram?(json: string): Promise<HostResult & { filePath?: string }>
  /** Open dialog, then read the chosen file. */
  openDiagram?(): Promise<ReadFileResult & { filePath?: string }>
  readFile?(filePath: string): Promise<ReadFileResult>
  writeFile?(filePath: string, content: string): Promise<HostResult>
  /** Folder dialog, then read the model files in the chosen folder. */
  openFolder?(): Promise<ReadFolderResult & { folderPath?: string }>
  /** Folder dialog only. */
  pickFolder?(): Promise<HostResult & { folderPath?: string }>
  /** Read the md-folder model files in a folder. */
  readFolder?(folderPath: string): Promise<ReadFolderResult>
  /** Write an md-folder model. When the folder changed on disk since it was
   *  last read, the model is merged with that change (`merged`); when it
   *  cannot be, `conflict` lists what changed and nothing is written. */
  writeFolder?(folderPath: string, files: Record<string, string>): Promise<WriteFolderResult>
  /** Watch one md-folder for edits made outside Studio (null stops). */
  watchFolder?(folderPath: string | null): Promise<void>
  /** Called when the watched folder's model files change outside Studio. */
  onFolderChanged?(listener: (change: FolderChange) => void): void
  /** Write the canvas selection file (`.radical/selection.json`) into an
   *  md-folder, for AI clients working on the same folder. */
  writeSelection?(folderPath: string, content: string): Promise<HostResult>
  /** Read the status of an agent's Forge run (`.radical/forge-run.json`) in an
   *  md-folder, written by the MCP server; content is null when there is none. */
  readForgeRun?(folderPath: string): Promise<HostResult & { content?: string | null }>
  /** Read the agent activity file (`.radical/agent-activity.json`) in an
   *  md-folder, written by the MCP server after each write; content is null
   *  when there is none. */
  readAgentActivity?(folderPath: string): Promise<HostResult & { content?: string | null }>
  /** Read the model's base (`.radical/base.json`) in an md-folder, written by
   *  the CLI or the MCP server; content is null when there is none. */
  readModelBase?(folderPath: string): Promise<HostResult & { content?: string | null }>
  /** Write the model's base (`.radical/base.json`) in an md-folder, as a
   *  Radical Forge run does where git saved none. */
  writeModelBase?(folderPath: string, content: string): Promise<HostResult>
  /** Whether an md-folder's files differed from the cache it was opened
   *  from (`.radical/cache/`): resolves once they are listed. */
  folderVerified?(folderPath: string): Promise<{ stale: boolean }>
  /** Read and write an md-folder's view index (`.radical/cache/views.json`);
   *  content is null when there is none. */
  readViewIndex?(folderPath: string): Promise<HostResult & { content?: string | null }>
  writeViewIndex?(folderPath: string, content: string): Promise<HostResult>
  /** Read what `radical check` and `radical sense` keep beside an md-folder
   *  model: the test results (`.radical/test-results.json`), the
   *  measurements (`.radical/measurements.json`) and the rule settings
   *  (`check.json`); each is null when there is none. */
  readCheckFiles?(folderPath: string): Promise<HostResult & { results?: string | null; measurements?: string | null; config?: string | null }>
  /** Write the rule settings and goals (`check.json`) of an md-folder model,
   *  as the Inspector's Settings save them. */
  writeCheckConfig?(folderPath: string, content: string): Promise<HostResult>
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
