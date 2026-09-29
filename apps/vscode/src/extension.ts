import * as vscode from 'vscode'
import * as path from 'path'
import * as cp from 'child_process'
import * as fs from 'fs'
import { vscodeBootScript, type ExtensionMessage, type WebviewMessage } from '@radical/host-bridge/vscode'

// ── State ─────────────────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem
let outputChannel: vscode.OutputChannel

interface PanelEntry {
  panel: vscode.WebviewPanel
  filePath: string | null
  lastWrittenAt: number
}

const panels = new Map<string, PanelEntry>()
let panelSeq = 0
let extensionPath = ''

// ── Activation ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionPath
  outputChannel = vscode.window.createOutputChannel('Radical.Tools')

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = 'radical.openFile'

  context.subscriptions.push(
    statusBarItem,
    outputChannel,
    // .radical files are handled by CustomTextEditorProvider below — no auto-open needed
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
    vscode.commands.registerCommand('radical.openFile', cmdOpenFile),
    vscode.commands.registerCommand('radical.openApp', cmdOpenApp),
    vscode.commands.registerCommand('radical.stop', cmdStop),
    vscode.commands.registerCommand('radical.showOutput', () => outputChannel.show()),
    // Register custom editor for .radical files — opens the webview directly, no text editor
    vscode.window.registerCustomEditorProvider(
      'radical.editor',
      new RadicalEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: false },
    ),
  )

  updateStatusBar()
}

export function deactivate(): void {
  for (const entry of panels.values()) {
    entry.panel.dispose()
  }
  panels.clear()
}

// ── CustomTextEditorProvider (.radical files) ─────────────────────────────────

class RadicalEditorProvider implements vscode.CustomTextEditorProvider {
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const projectRoot = getProjectRoot()
    const outDir = getOutDir(projectRoot)
    const filePath = document.uri.fsPath

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(outDir)],
    }

    const panelId = String(++panelSeq)
    const entry: PanelEntry = { panel: webviewPanel, filePath, lastWrittenAt: 0 }
    panels.set(panelId, entry)

    // Push changes made externally (e.g. git, another editor) into the webview
    const docChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return
      if (Date.now() - entry.lastWrittenAt < 2000) return
      webviewPanel.webview.postMessage({
        type: 'file:external-change',
        filePath,
        content: e.document.getText(),
      } satisfies ExtensionMessage)
    })

    // File I/O bridge: messages from the webview
    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.type === 'writeFile') {
        const content = msg.content
        entry.lastWrittenAt = Date.now()
        const edit = new vscode.WorkspaceEdit()
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length),
        )
        edit.replace(document.uri, fullRange, content)
        await vscode.workspace.applyEdit(edit)
      } else if (msg.type === 'readFile') {
        webviewPanel.webview.postMessage({
          type: 'readFile:response',
          id: msg.id,
          success: true,
          content: document.getText(),
        } satisfies ExtensionMessage)
      }
    })

    webviewPanel.onDidDispose(() => {
      docChangeListener.dispose()
      panels.delete(panelId)
      updateStatusBar()
    })

    if (!fs.existsSync(path.join(outDir, 'index.html'))) {
      const choice = await vscode.window.showInformationMessage(
        'Radical.Tools: web build not found. Build it now? (~20 s)',
        'Build', 'Cancel',
      )
      if (choice !== 'Build') return
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Building Radical.Tools…', cancellable: false },
          () => buildWebApp(projectRoot),
        )
      } catch (err) {
        vscode.window.showErrorMessage(`Radical.Tools build failed: ${(err as Error).message}`)
        return
      }
    }

    try {
      webviewPanel.webview.html = buildWebviewHtml(webviewPanel.webview, outDir, filePath)
    } catch (err) {
      vscode.window.showErrorMessage(`Radical.Tools: failed to load panel: ${err}`)
    }

    updateStatusBar()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeC4File(): string | null {
  const editor = vscode.window.activeTextEditor
  if (!editor) return null
  const p = editor.document.fileName
  return p.endsWith('.c4.json') ? p : null
}

function getProjectRoot(): string {
  const cfg = vscode.workspace.getConfiguration('radical')
  const configured = cfg.get<string>('projectRoot')
  if (configured && configured.trim()) return configured.trim()
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
}

function getNpmPath(): string {
  const cfg = vscode.workspace.getConfiguration('radical')
  return cfg.get<string>('npmPath') || 'npm'
}

function getOutDir(projectRoot: string): string {
  // Bundled webview (marketplace install) takes priority
  if (extensionPath) {
    const bundled = path.join(extensionPath, 'webview')
    if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled
  }
  // Fall back to local source build (developer install): the monorepo keeps
  // the Studio build in apps/studio/out, older checkouts at the root
  const monorepoOut = path.join(projectRoot, 'apps', 'studio', 'out', 'renderer')
  if (fs.existsSync(path.join(projectRoot, 'apps', 'studio'))) return monorepoOut
  return path.join(projectRoot, 'out', 'renderer')
}

function findPanelForFile(filePath: string): [string, PanelEntry] | undefined {
  for (const [id, entry] of panels) {
    if (entry.filePath === filePath) return [id, entry]
  }
  return undefined
}

// ── Status bar ────────────────────────────────────────────────────────────────

function updateStatusBar(): void {
  const file = activeC4File()

  if (file) {
    const open = findPanelForFile(file)
    if (open) {
      statusBarItem.text = '$(circuit-board) Radical.Tools $(check)'
      statusBarItem.tooltip = 'Diagram open — click to reveal panel'
    } else {
      statusBarItem.text = '$(circuit-board) Radical.Tools'
      statusBarItem.tooltip = `Open ${path.basename(file)} in Radical.Tools`
    }
    statusBarItem.show()
  } else if (panels.size > 0) {
    statusBarItem.text = `$(circuit-board) Radical.Tools (${panels.size})`
    statusBarItem.tooltip = 'Radical.Tools panels are open'
    statusBarItem.show()
  } else {
    statusBarItem.hide()
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdOpenFile(): Promise<void> {
  const file = activeC4File()
  if (!file) {
    vscode.window.showWarningMessage('Radical.Tools: open a .c4.json file first.')
    return
  }

  const existing = findPanelForFile(file)
  if (existing) {
    existing[1].panel.reveal(vscode.ViewColumn.Beside, false)
    return
  }

  await openInWebview(file)
}

async function cmdOpenApp(): Promise<void> {
  await openInWebview(null)
}

function cmdStop(): void {
  if (panels.size === 0) {
    vscode.window.showInformationMessage('Radical.Tools: no open panels.')
    return
  }
  for (const entry of panels.values()) {
    entry.panel.dispose()
  }
  panels.clear()
  updateStatusBar()
}

// ── Build web app ─────────────────────────────────────────────────────────────

function buildWebApp(projectRoot: string): Promise<void> {
  const npm = getNpmPath()
  return new Promise((resolve, reject) => {
    outputChannel.clear()
    outputChannel.appendLine('[Radical.Tools] Building web app…')
    outputChannel.show(true)

    const env: NodeJS.ProcessEnv = { ...process.env }
    delete env['ELECTRON_RUN_AS_NODE']

    const proc = cp.spawn(npm, ['run', 'build:web'], {
      cwd: projectRoot,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.on('data', (d: Buffer) => outputChannel.append(d.toString()))
    proc.stderr?.on('data', (d: Buffer) => outputChannel.append(d.toString()))

    proc.on('exit', (code) => {
      if (code === 0) {
        outputChannel.appendLine('[Radical.Tools] Build complete.')
        resolve()
      } else {
        reject(new Error(`build:web exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}

// ── Webview panel (for .c4.json via status bar button) ────────────────────────

async function openInWebview(filePath: string | null): Promise<void> {
  const projectRoot = getProjectRoot()
  const outDir = getOutDir(projectRoot)

  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    const choice = await vscode.window.showInformationMessage(
      'Radical.Tools: web build not found. Build it now? (~20 s)',
      'Build', 'Cancel',
    )
    if (choice !== 'Build') return

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Building Radical.Tools…',
          cancellable: false,
        },
        () => buildWebApp(projectRoot),
      )
    } catch (err) {
      vscode.window.showErrorMessage(`Radical.Tools build failed: ${(err as Error).message}`)
      return
    }
  }

  const title = filePath ? path.basename(filePath) : 'Radical.Tools'
  const panelId = String(++panelSeq)

  const panel = vscode.window.createWebviewPanel(
    'radical-diagram',
    title,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(outDir)],
    },
  )

  const entry: PanelEntry = { panel, filePath, lastWrittenAt: 0 }
  panels.set(panelId, entry)

  let unwatchFn: (() => void) | null = null
  if (filePath) {
    const fp = filePath
    fs.watchFile(fp, { interval: 500 }, (curr, prev) => {
      if (curr.mtime <= prev.mtime) return
      if (Date.now() - entry.lastWrittenAt < 2000) return
      try {
        const content = fs.readFileSync(fp, 'utf-8')
        panel.webview.postMessage({ type: 'file:external-change', filePath: fp, content } satisfies ExtensionMessage)
      } catch { /* ignore */ }
    })
    unwatchFn = () => fs.unwatchFile(fp)
  }

  panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
    if (msg.type === 'writeFile') {
      const fp = msg.filePath
      const content = msg.content
      try {
        entry.lastWrittenAt = Date.now()
        fs.writeFileSync(fp, content, 'utf-8')
      } catch (err) {
        outputChannel.appendLine(`[Radical.Tools] writeFile error: ${err}`)
      }
    } else if (msg.type === 'readFile') {
      const fp = msg.filePath
      try {
        const content = fs.readFileSync(fp, 'utf-8')
        panel.webview.postMessage({ type: 'readFile:response', id: msg.id, success: true, content } satisfies ExtensionMessage)
      } catch (err) {
        panel.webview.postMessage({ type: 'readFile:response', id: msg.id, success: false, error: String(err) } satisfies ExtensionMessage)
      }
    }
  })

  panel.onDidDispose(() => {
    unwatchFn?.()
    panels.delete(panelId)
    updateStatusBar()
  })

  try {
    panel.webview.html = buildWebviewHtml(panel.webview, outDir, filePath)
  } catch (err) {
    vscode.window.showErrorMessage(`Radical.Tools: failed to load panel: ${err}`)
    panel.dispose()
    return
  }

  updateStatusBar()
}

// ── HTML generation ───────────────────────────────────────────────────────────

function buildWebviewHtml(
  webview: vscode.Webview,
  outDir: string,
  filePath: string | null,
): string {
  let html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')

  html = html.replace(/(src|href)="(\.\/[^"]*)"/g, (_, attr: string, rel: string) => {
    const abs = path.join(outDir, rel.replace(/^\.\//, ''))
    return `${attr}="${webview.asWebviewUri(vscode.Uri.file(abs))}"`
  })
  html = html.replace(/(src|href)="(\/assets\/[^"]*)"/g, (_, attr: string, p: string) => {
    const abs = path.join(outDir, p)
    return `${attr}="${webview.asWebviewUri(vscode.Uri.file(abs))}"`
  })

  // Studio's renderer builds its host bridge itself (createVsCodeWebviewHost in
  // @radical/host-bridge/vscode); the page only needs the boot data.
  const head = `
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
    script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
    style-src  ${webview.cspSource} 'unsafe-inline';
    img-src    ${webview.cspSource} data: blob:;
    font-src   ${webview.cspSource} data:;
    worker-src ${webview.cspSource} blob:;">
${vscodeBootScript({ filePath })}`
  return html.replace('<head>', '<head>\n' + head)
}
