// ─── Keys kept in a panel or a field ─────────────────────────────────────────
//
// A panel or a field that keeps its keys from the canvas and Studio's
// shortcuts (stopPropagation) kept F5 and Cmd/Ctrl+P from Studio as well.
// Nothing took them, so the browser did: F5 reloaded the page (a comment
// being written in the discussion panel was lost) and Cmd/Ctrl+P opened the
// print dialog. Studio takes both on the window, everywhere, and leaves them
// to a dialog that has the focus (dialogKeys.ts in Studio).

interface Key { key: string; metaKey: boolean; ctrlKey: boolean; stopPropagation(): void }

/** F5 and Cmd/Ctrl+P: Studio's keys that the browser has as well. */
export function isStudioBrowserKey(e: Pick<Key, 'key' | 'metaKey' | 'ctrlKey'>): boolean {
  return e.key === 'F5' || ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P'))
}

/** Keeps a key pressed here from the rest of the page, except F5 and
 *  Cmd/Ctrl+P: they go on to Studio, which takes them as everywhere else. */
export function keepKeysHere(e: Key): void {
  if (!isStudioBrowserKey(e)) e.stopPropagation()
}
