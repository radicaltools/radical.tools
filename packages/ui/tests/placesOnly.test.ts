import { describe, expect, it } from 'vitest'
import { notedPlacesOnly, type C4Node } from '@radical/common/c4'
import { samePlacesAside } from '@radical/common/model'
import { placedNodes } from '../src/store/diagramStore'

// The live layout and a glide move elements every frame. The store notes
// each such step, so what reads the model and not the canvas (the
// Inspector, a view's filter, the autosave) knows at once that nothing it
// reads changed, rather than going through every element of the model.

const node = (id: string, x = 0): C4Node => Object.freeze({ id, type: 'system', label: id, x, y: 0, width: 240, height: 140, collapsed: false } as C4Node)
const model = (): Record<string, C4Node> => Object.freeze({ a: node('a'), b: node('b'), c: node('c') })

describe('elements only moved', () => {
  it('gives a new frozen record with only the moved elements new, noted as places only', () => {
    const nodes = model()
    const next = placedNodes(nodes, { a: { x: 10, y: 20 }, missing: { x: 1, y: 1 } })
    expect(next).not.toBe(nodes)
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.a)).toBe(true)
    expect(next.a).toMatchObject({ x: 10, y: 20, width: 240, height: 140, label: 'a' })
    expect(next.b).toBe(nodes.b)
    expect(Object.keys(next)).toEqual(['a', 'b', 'c'])
    expect(notedPlacesOnly(nodes, next)).toBe(true)
    expect(samePlacesAside(nodes, next)).toBe(true)
  })

  it('keeps the record when every element is where it is asked to be', () => {
    const nodes = model()
    expect(placedNodes(nodes, { a: { x: 0, y: 0, width: 240 } })).toBe(nodes)
  })

  it('knows a chain of moves, frame after frame, from any record in it to a later one', () => {
    const first = model()
    let at = first
    const seen = [first]
    for (let i = 1; i <= 5; i++) { at = placedNodes(at, { b: { x: i, y: i } }); seen.push(at) }
    expect(notedPlacesOnly(first, at)).toBe(true)
    expect(notedPlacesOnly(seen[2], seen[4])).toBe(true)
  })

  it('notes nothing for a record changed otherwise', () => {
    const nodes = model()
    const renamed = Object.freeze({ ...nodes, a: node('a renamed') })
    expect(notedPlacesOnly(nodes, renamed)).toBe(false)
    // A move after the rename is a move from the renamed record only.
    const moved = placedNodes(renamed, { a: { x: 5, y: 5 } })
    expect(notedPlacesOnly(renamed, moved)).toBe(true)
    expect(notedPlacesOnly(nodes, moved)).toBe(false)
  })
})
