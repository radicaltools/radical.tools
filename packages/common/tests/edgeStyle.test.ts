import { describe, it, expect } from 'vitest'
import { edgeStyleOf, setDefaultEdgeStyle, setViewEdgeStyle, type ModelState } from '../src/model'
import { serializeToMdFolder, deserializeFromMdFolder } from '../src/formats/mdFolder'

describe('edge style', () => {
  it('a view draws relations its own way, or the model\'s; the model\'s is curved when unset', () => {
    const state = { c4Nodes: {}, c4Relations: {}, activeViewId: null, views: { v: { id: 'v', name: 'v', nodeIds: [], positions: {} } } } as unknown as ModelState
    expect(edgeStyleOf(state, null)).toBe('curved')
    expect(edgeStyleOf(state, 'v')).toBe('curved')
    setDefaultEdgeStyle(state, 'orthogonal')
    expect(edgeStyleOf(state, 'v')).toBe('orthogonal')
    setViewEdgeStyle(state, 'v', 'curved')
    expect(edgeStyleOf(state, 'v')).toBe('curved')
    expect(edgeStyleOf(state, null)).toBe('orthogonal')
    setViewEdgeStyle(state, 'v', null)
    expect(state.views.v).not.toHaveProperty('edgeStyle')
    setDefaultEdgeStyle(state, 'curved')
    expect(state).not.toHaveProperty('defaultEdgeStyle')
  })

  it('is kept in a Markdown folder: the model\'s with the layout, a view\'s with the view', () => {
    const files = serializeToMdFolder({
      nodes: [], relations: [], defaultEdgeStyle: 'orthogonal',
      views: [{ id: 'v', name: 'v', nodeIds: [], positions: {}, edgeStyle: 'curved' }],
    }, 'Styles')
    expect(files['_layout.json']).toContain('"defaultEdgeStyle": "orthogonal"')
    const back = deserializeFromMdFolder(files).data
    expect(back.defaultEdgeStyle).toBe('orthogonal')
    expect(back.views?.[0].edgeStyle).toBe('curved')
    // Curved, the default, is not written.
    expect(serializeToMdFolder({ nodes: [], relations: [], defaultEdgeStyle: 'curved' }, 'Styles')['_layout.json'] ?? '').not.toContain('defaultEdgeStyle')
  })
})
