// Tree Layout on the sample's Core Banking put Access & Security over Risk &
// Data by 150×500 px: ELK laid the groups out side by side, and the refit
// afterwards grew one to its type's least size, onto the other.
import { it, expect } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { computeViewNodeSet } from '@radical/layout/viewInput'
import { buildFintechSample } from '../src/renderer/src/store/fintechSample'

for (const viewId of ['view-core', 'view-payments']) {
  it(`Tree Layout on ${viewId} leaves no siblings on each other`, async () => {
    const s = useDiagramStore.getState
    s().setAppMode('designer')
    s().loadDiagram(await buildFintechSample())
    s().setActiveView(viewId)
    useDiagramStore.setState((st) => ({ views: { ...st.views, [viewId]: { ...st.views[viewId], layoutMode: 'tree' } } }))
    await s().runTreeLayout()
    const nodes = s().c4Nodes
    const shown = computeViewNodeSet(s().views[viewId], nodes)
    const visible = Object.values(nodes).filter((n) => !shown || shown.has(n.id))
    const overlaps: string[] = []
    for (const a of visible) for (const b of visible) {
      if (a.id >= b.id || (a.parentId ?? '') !== (b.parentId ?? '')) continue
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (ox > 1 && oy > 1 && !a.collapsed && !b.collapsed) overlaps.push(`${a.id} / ${b.id} by ${Math.round(ox)}x${Math.round(oy)}`)
    }
    expect(overlaps).toEqual([])
    s().stopLiveLayout()
  }, 60_000)
}
