// Smart Layout run on a layout it has just made says that layout already
// scores best. On the sample's All elements it never did: the winner (the
// physics' relaxation of an engine's layout) was scored with the container
// frames the physics gave it, and applying it refits them; what was saved
// scored 202 crossings, not the 201 reported, and every rerun "improved" it
// again, moving nothing and leaving an undo step that did nothing.
import { it, expect } from 'vitest'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { viewLayoutInput, applyLayoutPositions, resizeParentsBottomUp } from '@radical/layout/viewInput'
import { runSmartLayoutCore } from '@radical/layout/smartLayout'
import { buildFintechSample } from '../src/renderer/src/store/fintechSample'

it('a second Smart Layout on the sample\'s All elements keeps the layout the first one made', async () => {
  const doc = await buildFintechSample()
  const nodes: Record<string, C4Node> = Object.fromEntries(doc.nodes.map((n) => [n.id, { ...n }]))
  const relations: Record<string, C4Relation> = Object.fromEntries(doc.relations.map((r) => [r.id, r]))
  const layOut = async (): Promise<boolean> => {
    const input = viewLayoutInput(undefined, nodes, relations, doc.defaultLayoutConstraints)
    const result = await runSmartLayoutCore(input.nodes, input.relations, doc.metamodel, undefined, { alignments: input.alignments })
    if (result.keptCurrent) return true
    // What the store does with the winner.
    applyLayoutPositions(nodes, result.winner.positions, input)
    resizeParentsBottomUp(nodes, input)
    return false
  }
  const warn = console.warn
  console.warn = () => {}
  try {
    await layOut()
    expect(await layOut()).toBe(true)
  } finally {
    console.warn = warn
  }
}, 120_000)
