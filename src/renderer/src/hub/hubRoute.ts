// ─── Hub deep links ──────────────────────────────────────────────────────────
//
// Same key/value segment grammar as the studio router (route.ts), scoped to
// the catalogue:
//
//   #/c/<conceptId>[/v/<canvas|wiki|table>][/cat/<category>][/tag/<tag>]
//
// `c` selects the concept shown in the viewer, `v` its presentation, `cat` /
// `tag` the catalogue filters. Everything is optional; an empty hash is the
// unfiltered catalogue with nothing selected.

import type { HubViewKind } from './conceptToDiagram'

export interface HubRoute {
  concept?: string
  view?: HubViewKind
  category?: string
  tag?: string
}

const VIEW_KINDS: readonly HubViewKind[] = ['canvas', 'wiki', 'table']

export function parseHubHash(hash: string): HubRoute {
  const raw = hash.replace(/^#\/?/, '')
  if (!raw) return {}
  const parts = raw.split('/').filter(Boolean)
  const map: Record<string, string> = {}
  for (let i = 0; i + 1 < parts.length; i += 2) {
    try {
      map[parts[i]] = decodeURIComponent(parts[i + 1])
    } catch {
      map[parts[i]] = parts[i + 1]
    }
  }
  const view = (VIEW_KINDS as readonly string[]).includes(map.v) ? (map.v as HubViewKind) : undefined
  return {
    concept: map.c || undefined,
    view,
    category: map.cat || undefined,
    tag: map.tag || undefined,
  }
}

export function formatHubHash(route: HubRoute): string {
  const segs: string[] = []
  if (route.concept) segs.push('c', encodeURIComponent(route.concept))
  if (route.concept && route.view) segs.push('v', route.view)
  if (route.category) segs.push('cat', encodeURIComponent(route.category))
  if (route.tag) segs.push('tag', encodeURIComponent(route.tag))
  return segs.length ? '#/' + segs.join('/') : ''
}

/** Deep link that opens the studio with the given concepts pre-selected in
 *  its import modal (handled by Toolbar's `?hub=` detection). */
export function studioImportUrl(studioUrl: string, conceptIds: string[]): string {
  return `${studioUrl}?hub=${encodeURIComponent(conceptIds.join(','))}`
}
