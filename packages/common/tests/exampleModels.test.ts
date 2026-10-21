/**
 * The example model the VS Code extension ships (apps/vscode/example) is
 * what its users open first: it has to be a model Studio has nothing to say
 * about. It had relations to an element "web" that was not there.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { DiagramData } from '../src/c4'
import { documentMetamodel } from '../src/model'
import { validateModel } from '../src/metamodel'

const demo = JSON.parse(readFileSync(fileURLToPath(new URL('../../../apps/vscode/example/demo.radical', import.meta.url)), 'utf8')) as DiagramData

describe('the VS Code example model', () => {
  const nodes = Object.fromEntries(demo.nodes.map((n) => [n.id, n]))
  const relations = Object.fromEntries(demo.relations.map((r) => [r.id, r]))

  it('has nothing Validation would flag', () => {
    expect(validateModel(nodes, relations, documentMetamodel(demo.metamodel, demo.nodes)).map((i) => i.message)).toEqual([])
  })

  it('names only elements, relations and sequences it has', () => {
    const missing: string[] = []
    for (const v of demo.views ?? []) {
      for (const id of [...v.nodeIds, ...Object.keys(v.positions ?? {})]) if (!nodes[id]) missing.push(`view ${v.name}: ${id}`)
      if (v.sequenceId && !demo.sequences?.some((q) => q.id === v.sequenceId)) missing.push(`view ${v.name}: ${v.sequenceId}`)
    }
    for (const q of demo.sequences ?? []) for (const id of q.relationIds) if (!relations[id]) missing.push(`sequence ${q.name}: ${id}`)
    expect(missing).toEqual([])
  })
})
