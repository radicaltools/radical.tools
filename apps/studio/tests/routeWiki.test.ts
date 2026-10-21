/**
 * The page a wiki view is on is part of the route (`…/f/<id>`); a route of
 * the wiki without one is its Overview. Back from the first page read used
 * to leave the page on screen, and the Overview's entry was written over.
 */
import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { applyRoute } from '../src/renderer/src/route'

describe('a wiki page in the route', () => {
  it('opens the page the route names, and the Overview when it names none', () => {
    const store = useDiagramStore.getState()
    const page = Object.keys(store.c4Nodes)[0]
    const wiki = store.addView('Wiki', 'wiki')

    applyRoute({ mode: 'designer', view: wiki, focus: page })
    expect(useDiagramStore.getState().views[wiki].wikiFocusId).toBe(page)

    applyRoute({ mode: 'designer', view: wiki })
    expect(useDiagramStore.getState().views[wiki].wikiFocusId).toBeFalsy()
  })
})
