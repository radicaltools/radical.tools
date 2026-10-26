// ─── Each view's camera, kept by this viewer ─────────────────────────────────
//
// A camera moved on its own (a wheel, a pan, the framing of a click) is no
// edit: the model is saved only after one (D15), and the view opened again
// at the camera of its last edit. The camera of each view (All elements'
// under '') is kept here instead, in this browser, per document, outside
// the model: a load puts it into the views, so a reload opens each view
// where it was, and the model files do not change with a camera move.

type Camera = { x: number; y: number; zoom: number }

const PREFIX = 'radical-view-cameras:'
const WRITE_MS = 400

/** The document whose model the store holds: the cameras noted go to it. */
let shownDoc: string | null = null
let pending: Record<string, Camera> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function read(docId: string): Record<string, Camera> {
  try {
    const raw = localStorage.getItem(PREFIX + docId)
    const parsed = raw ? JSON.parse(raw) as unknown : null
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, Camera> = {}
    for (const [id, c] of Object.entries(parsed as Record<string, Partial<Camera>>)) {
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.zoom) && c.zoom! > 0) out[id] = { x: c.x!, y: c.y!, zoom: c.zoom! }
    }
    return out
  } catch { return {} }
}

function flush(): void {
  if (timer) clearTimeout(timer)
  timer = null
  if (!pending || !shownDoc) { pending = null; return }
  const cameras = { ...read(shownDoc), ...pending }
  pending = null
  try { localStorage.setItem(PREFIX + shownDoc, JSON.stringify(cameras)) } catch { /* private window, quota */ }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // A reload right after a move keeps it.
  window.addEventListener('pagehide', flush)
}

/** The cameras kept for document `docId` (null: none, as in the Hub's
 *  viewer), by view id, All elements' under ''. A load calls it: the
 *  cameras noted from then on are this document's. */
export function viewCameras(docId: string | null): Record<string, Camera> {
  if (shownDoc !== docId) flush()
  shownDoc = docId
  return docId ? read(docId) : {}
}

/** Keeps `camera` as the one of view `viewId` (null: All elements) of the
 *  document shown, written a moment later. */
export function noteViewCamera(viewId: string | null, camera: Camera): void {
  if (!shownDoc || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !(camera.zoom > 0)) return
  pending ??= {}
  pending[viewId ?? ''] = { x: camera.x, y: camera.y, zoom: camera.zoom }
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, WRITE_MS)
}

/** Forgets the cameras of a document removed from the list. */
export function forgetViewCameras(docId: string): void {
  if (shownDoc === docId) pending = null
  try { localStorage.removeItem(PREFIX + docId) } catch { /* noop */ }
}
