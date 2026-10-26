import { useState, useCallback } from 'react'
import { toPng, toSvg } from 'html-to-image'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { isEditingControl } from '@radical/ui/components/editingControl'
import { useDocumentsStore } from '../store/documentStore'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-. ]/gi, '_').trim() || 'diagram'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Draws the canvas for an export, resolving with the undo once it is drawn.
 *  Zoomed out, the canvas hides relation labels it is too small to read
 *  (data-edge-labels, see Canvas), and does not place them. An export is
 *  read at its own size, so it shows them all, placed. And it shows the
 *  diagram, not the selection: no outline, no highlighted line, nothing
 *  dimmed by its focus. */
function drawForExport(el: HTMLElement): Promise<() => void> {
  const detail = el.dataset.edgeLabels
  el.dataset.edgeLabels = 'full'
  const store = useDiagramStore.getState()
  const placed = store.allEdgeLabelsShown
  useDiagramStore.setState({ allEdgeLabelsShown: true, drawnForExport: true })
  const restore = () => {
    if (detail === undefined) delete el.dataset.edgeLabels
    else el.dataset.edgeLabels = detail
    useDiagramStore.setState({ allEdgeLabelsShown: placed, drawnForExport: false })
  }
  // Two frames: React re-renders the edges, then the browser lays them out.
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(restore))))
}

/** What the view shown is drawn in: the canvas (also of a flow view), or
 *  the page of a wiki, table, matrix, hierarchy or Warnier view. Export
 *  looked for the canvas only, so on those views PNG and SVG did nothing,
 *  with no file and no notice (the Warnier view said "There is nothing on
 *  screen to export"). */
const EXPORT_TARGETS = '.canvas-area, .wiki-view, .tv-wrap, .mx-wrap, .treemap-wrap-outer, .warnier-view'

/** What an export leaves out: the canvas's background grid, the panels and
 *  bars around it, and every editing control (editingControl.ts: the
 *  buttons, pins, guides, menus and bars that are there to edit the view,
 *  not what it shows). */
function exportFilter(node: HTMLElement | SVGElement): boolean {
  if (!(node instanceof Element)) return true
  if (isEditingControl(node)) return false
  const cls = node.getAttribute('class') ?? ''
  if (cls.includes('react-flow__background')) return false
  if (cls.includes('toolbar') || cls.includes('left-panel') || cls.includes('right-panel')) return false
  return !(cls.includes('sel-bar') || cls.includes('edge-action') || cls.includes('quick-search'))
}

function exportTarget(): HTMLElement | null {
  const el = document.querySelector(EXPORT_TARGETS) as HTMLElement | null
  if (!el) useDiagramStore.getState().pushNotification('There is nothing on screen to export.', 'warning')
  return el
}

function exportFailed(err: unknown): void {
  console.error('[Export]', err)
  useDiagramStore.getState().pushNotification('The export failed: the view could not be drawn as an image.', 'error')
}

export function useExport(): {
  exportBusy: boolean
  exportAs: (format: 'png' | 'svg') => void
  copyToClipboard: () => void
} {
  const [exportBusy, setExportBusy] = useState(false)

  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const views = useDiagramStore((s) => s.views)
  const snapshots = useDiagramStore((s) => s.snapshots)
  const activeSnapshotId = useDiagramStore((s) => s.activeSnapshotId)

  const docs = useDocumentsStore((s) => s.docs)
  const activeDocId = useDocumentsStore((s) => s.activeId)
  const activeDoc = activeDocId ? docs.find((d) => d.id === activeDocId) ?? null : null

  const buildFilename = useCallback((): string => {
    const modelName = activeDoc?.name ?? 'model'
    const viewName = activeViewId ? (views[activeViewId]?.name ?? 'view') : 'view'
    const milestoneName = activeSnapshotId
      ? (snapshots.find((s) => s.id === activeSnapshotId)?.name ?? null)
      : null
    const parts = [modelName, viewName]
    if (milestoneName) parts.push(milestoneName)
    return sanitizeFilename(parts.join('-'))
  }, [activeDoc, activeViewId, views, activeSnapshotId, snapshots])

  const exportAs = useCallback((format: 'png' | 'svg') => {
    const el = exportTarget()
    if (!el) return
    setExportBusy(true)
    const labelsShown = drawForExport(el)
    const filename = buildFilename()
    const options = {
      cacheBust: true,
      backgroundColor: getComputedStyle(el).backgroundColor || '#1e1e2e',
      pixelRatio: window.devicePixelRatio || 2,
      filter: exportFilter,
    }
    let restoreLabels = () => {}
    labelsShown
      .then((restore) => {
        restoreLabels = restore
        return format === 'png'
          ? toPng(el, options).then((d) => fetch(d).then((r) => r.blob()).then((b) => downloadBlob(b, `${filename}.png`)))
          : toSvg(el, options).then((d) => fetch(d).then((r) => r.blob()).then((b) => downloadBlob(b, `${filename}.svg`)))
      })
      .catch(exportFailed)
      .finally(() => { restoreLabels(); setExportBusy(false) })
  }, [buildFilename])

  const copyToClipboard = useCallback(() => {
    const el = exportTarget()
    if (!el) return
    setExportBusy(true)
    const labelsShown = drawForExport(el)
    const options = {
      cacheBust: true,
      backgroundColor: getComputedStyle(el).backgroundColor || '#1e1e2e',
      pixelRatio: window.devicePixelRatio || 2,
      filter: exportFilter,
    }
    let restoreLabels = () => {}
    labelsShown
      .then((restore) => { restoreLabels = restore; return toPng(el, options) })
      .then((dataUrl) => fetch(dataUrl).then((r) => r.blob()))
      .then((blob) => {
        const item = new ClipboardItem({ 'image/png': blob })
        return navigator.clipboard.write([item])
      })
      .catch(exportFailed)
      .finally(() => { restoreLabels(); setExportBusy(false) })
  }, [])

  return { exportBusy, exportAs, copyToClipboard }
}
