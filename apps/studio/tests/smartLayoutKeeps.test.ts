// Smart Layout run on a layout it has just made says that layout already
// scores best. On the sample's All elements it never did: the winner (the
// physics' relaxation of an engine's layout) was scored with the container
// frames the physics gave it, and applying it refits them; what was saved
// scored 202 crossings, not the 201 reported, and every rerun "improved" it
// again, moving nothing and leaving an undo step that did nothing.
// The sample of that time (78 elements) is kept as a fixture: on today's
// sample (283) the two runs take two minutes on CI. Since later changes to
// Smart Layout the relaxed candidate no longer wins on it, so
// the test no longer fails without that fix; it still checks that a second
// run keeps the layout.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { it, expect } from 'vitest'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { viewLayoutInput, applyLayoutPositions, resizeParentsBottomUp } from '@radical/layout/viewInput'
import { runSmartLayoutCore } from '@radical/layout/smartLayout'

const doc = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/fintech-sample-78-nodes.json', import.meta.url)), 'utf8')) as {
  nodes: C4Node[]
  relations: C4Relation[]
}

it('a second Smart Layout on the sample\'s All elements keeps the layout the first one made', async () => {
  const metamodel = builtInGovernanceMetamodel()
  const nodes: Record<string, C4Node> = Object.fromEntries(doc.nodes.map((n) => [n.id, { ...n }]))
  const relations: Record<string, C4Relation> = Object.fromEntries(doc.relations.map((r) => [r.id, r]))
  const layOut = async (): Promise<boolean> => {
    const input = viewLayoutInput(undefined, nodes, relations, undefined)
    const result = await runSmartLayoutCore(input.nodes, input.relations, metamodel, undefined, { alignments: input.alignments })
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
}, 60_000)
