// ─── Hub deep links ──────────────────────────────────────────────────────────
//
// Same key/value segment grammar as the studio router (route.ts), scoped to
// the catalogue:
//
//   #/browse
//   #/c/<conceptId>[/v/<canvas|wiki|table>][/cat/<category>][/tag/<tag>]
//
// `c` selects the concept shown in the viewer, `v` its presentation, `cat` /
// `tag` the catalogue filters. An empty hash is the landing page; `browse` is
// the unfiltered catalogue with nothing selected (any concept / filter implies
// the catalogue too).

import type { HubViewKind } from './conceptToDiagram'

export interface HubRoute {
  /** Catalogue is open (implied when concept / category / tag is set). */
  browse?: boolean
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
  const browseFlag = parts[0] === 'browse'
  if (browseFlag) parts.shift()
  const map: Record<string, string> = {}
  for (let i = 0; i + 1 < parts.length; i += 2) {
    try {
      map[parts[i]] = decodeURIComponent(parts[i + 1])
    } catch {
      map[parts[i]] = parts[i + 1]
    }
  }
  const view = (VIEW_KINDS as readonly string[]).includes(map.v) ? (map.v as HubViewKind) : undefined
  const concept = map.c || undefined
  const category = map.cat || undefined
  const tag = map.tag || undefined
  const browse = browseFlag || !!(concept || category || tag)
  return {
    ...(browse ? { browse: true } : {}),
    concept,
    view,
    category,
    tag,
  }
}

export function formatHubHash(route: HubRoute): string {
  const segs: string[] = []
  if (route.concept) segs.push('c', encodeURIComponent(route.concept))
  if (route.concept && route.view) segs.push('v', route.view)
  if (route.category) segs.push('cat', encodeURIComponent(route.category))
  if (route.tag) segs.push('tag', encodeURIComponent(route.tag))
  if (segs.length === 0) return route.browse ? '#/browse' : ''
  return '#/' + segs.join('/')
}

/** Deep link that opens the studio with the given concepts pre-selected in
 *  its import modal (handled by Toolbar's `?hub=` detection). */
export function studioImportUrl(studioUrl: string, conceptIds: string[]): string {
  return `${studioUrl}?hub=${encodeURIComponent(conceptIds.join(','))}`
}
