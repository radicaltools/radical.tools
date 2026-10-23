/**
 * F-0033, F-0044: Add or link (the table's + under a row, the wiki's Add or
 * link…) offered what the model then refused (a system to the container it
 * holds) or let through what Validation then flagged (an aggregate root part
 * of another, an entity part of two aggregates): 53 of 10,524 candidates on
 * the sample were flagged, 37 refused. It offers what checkAddRelation
 * accepts, by the same check, and Validation flags none of it.
 */
import { describe, it, expect } from 'vitest'
import data from './fixtures/fintechSampleData.json'
import { builtInGovernanceMetamodel, validateModel } from '@radical/common/metamodel'
import { viewpointsOf } from '@radical/common/viewpoints'
import { addChoices, linkCandidates, pipelineOf, structureRows } from '@radical/common/viewPipeline'
import { checkAddRelation } from '@radical/common/model'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'

describe('Add or link on the sample model', () => {
  it('offers, over every view and viewpoint, only links the model accepts and Validation does not flag', () => {
    const metamodel = builtInGovernanceMetamodel()
    const nodes = Object.fromEntries((data.nodes as unknown as C4Node[]).map((n) => [n.id, n]))
    const relations = Object.fromEntries((data.relations as unknown as C4Relation[]).map((r) => [r.id, r]))
    const ctx = { nodes, relations, metamodel }
    const state = { c4Nodes: nodes, c4Relations: relations, views: {}, activeViewId: null, metamodel }
    const before = new Set(validateModel(nodes, relations, metamodel).map((i) => i.id))
    const views: DiagramView[] = [
      ...(data.views as unknown as DiagramView[]),
      ...viewpointsOf(metamodel).map((v) => ({ id: v.id, name: v.label, nodeIds: [], positions: {}, kind: v.kind, pipeline: v.pipeline }) as unknown as DiagramView),
    ]
    const seen = new Set<string>()
    const wrong: string[] = []
    for (const view of views) {
      const unders = [undefined, ...structureRows(view, ctx).map((r) => ({ node: r.node, depth: r.depth }))]
      for (const under of unders) {
        // Those the level's filters let through, as the table's + offers them.
        const filters = pipelineOf(view)?.levels?.[under ? under.depth + 1 : 0]?.filters
        for (const choice of addChoices(view, ctx, under)) {
          if (!choice.link) continue
          for (const n of linkCandidates(choice.type, choice.link, ctx, filters)) {
            const rel = choice.link.direction === 'out'
              ? { sourceId: n.id, targetId: choice.link.otherId, relationType: choice.link.relationType }
              : { sourceId: choice.link.otherId, targetId: n.id, relationType: choice.link.relationType }
            const key = `${rel.sourceId} ${rel.relationType} ${rel.targetId}`
            if (seen.has(key)) continue
            seen.add(key)
            const refused = checkAddRelation(state, rel)
            if (refused) { wrong.push(`${key}: ${refused}`); continue }
            const flagged = validateModel(nodes, { ...relations, probe: { id: 'probe', ...rel } }, metamodel).filter((i) => !before.has(i.id))
            if (flagged.length) wrong.push(`${key}: ${flagged.map((i) => i.message).join('; ')}`)
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThan(5000)
    expect(wrong).toEqual([])
  }, 60_000)
})
