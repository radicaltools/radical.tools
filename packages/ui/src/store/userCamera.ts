// ─── The user's own camera moves ─────────────────────────────────────────────
//
// The canvas tells whoever moves the camera on the user's behalf (Studio
// following an agent) that the user has just taken it: a wheel, a pinch or a
// drag of the pane. Fits, focus and slides move it without telling.

const listeners = new Set<() => void>()

/** The user moved the camera themselves. */
export function noteUserCamera(): void {
  for (const listener of listeners) listener()
}

/** Calls `listener` each time the user moves the camera themselves. Returns
 *  the unsubscribe function. */
export function onUserCamera(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
