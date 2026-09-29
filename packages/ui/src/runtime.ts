// ─── Runtime profile ─────────────────────────────────────────────────────────
//
// The same renderer bundle is shipped as two products:
//
//   'studio' — the full editor (Electron + studio.radical.tools). Documents,
//              autosave, designer/viewer/presenter/metamodel modes.
//   'viewer' — an embedded, read-only instance (hub.radical.tools). The model
//              is injected by the host page, nothing is ever persisted, and
//              the app mode is pinned to 'viewer' (the explore sandbox).
//
// The profile is declared by the HTML entry *before* any module executes
// (`<script>window.__RADICAL_PROFILE = 'viewer'</script>`), because the
// diagram store wires its persistence at import time.

export type RuntimeProfile = 'studio' | 'viewer'

export function runtimeProfile(): RuntimeProfile {
  const g = globalThis as { __RADICAL_PROFILE?: unknown }
  return g.__RADICAL_PROFILE === 'viewer' ? 'viewer' : 'studio'
}

export function isViewerProfile(): boolean {
  return runtimeProfile() === 'viewer'
}
