// ─── The views a new model starts with ──────────────────────────────────────
// Studio's New model step offers the metamodel's views: a Structure view of
// all elements at the top of the list, then the Radical structure of a Forge
// run (radicalViewpoints, in forge/views.ts), a view of each chosen
// viewpoint in its folder. Unlike a run's, they are made at once,
// before the first element: a view shows nothing until its chain gives an
// element, and a group of views per element gets a view of each element as
// it is added (model.syncViewGroups).

import { WIKI_DEPTH_MAX, type DiagramView } from './c4'
import type { Metamodel } from './metamodel'
import { applyViewpoint, insertView, setViewFolder, setWikiPages, type ModelState } from './model'
import { radicalViewpoints } from './ai/forge/views'

/** The Structure view of all elements a new model's views start with,
 *  under the All elements table: it lists none, so it shows every one. */
export const ALL_ELEMENTS_VIEW_ID = 'view-all-elements'

/** The views of a new model: All elements as a Structure view, then a view
 *  of each of `viewpoints` the metamodel has, in the order of
 *  radicalViewpoints and in its folder there, with the id view-<viewpoint>:
 *  for a viewpoint that draws one element a group of views per element, for
 *  a wiki one article of every level of its chain. */
export function metamodelViews(metamodel: Metamodel, viewpoints: string[]): DiagramView[] {
  const chosen = new Set(viewpoints)
  const defs = new Map((metamodel.viewpoints ?? []).map((v) => [v.id, v]))
  const state: ModelState = { c4Nodes: {}, c4Relations: {}, views: {}, activeViewId: null, metamodel }
  insertView(state, ALL_ELEMENTS_VIEW_ID, 'All elements')
  for (const choice of radicalViewpoints(metamodel)) {
    const def = defs.get(choice.id)
    if (!def || !chosen.has(def.id)) continue
    const id = `view-${def.id}`
    insertView(state, id, def.label)
    applyViewpoint(state, id, def.id, null)
    setViewFolder(state, id, choice.folder)
    if (def.kind === 'wiki') setWikiPages(state, id, 'multi', WIKI_DEPTH_MAX)
  }
  return Object.values(state.views)
}
