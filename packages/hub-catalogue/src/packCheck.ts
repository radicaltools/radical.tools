// ─── A concern pack, imported and bound ──────────────────────────────────────
//
// What a pack must do once in a model: its trigger finds something in a shop
// every pack's trigger fires on, and imported with every combination of the
// answers to its questions and bound to the first element its trigger
// finds, it settles its concern and brings in nothing radical check flags
// but the tests the team still has to name. Used by tests/concernPacks.test.ts
// and scripts/build-packs.ts.

import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { checkModel } from '@radical/common/check'
import { buildConcernInsert, concernTargets, isConcernPack } from '@radical/common/concerns'
import { docToConcept, type HubRadicalDoc } from '@radical/common/hubFormat'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType: 'interacts', sourceId, targetId })

/** A shop every pack's trigger fires on: a person uses its web app, a
 *  partner's system calls its API, which calls the partner back, keeps
 *  orders in a database and passes them on through a queue. */
export function shopModel(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('user', 'person', 'Customer'), node('partner', 'system', 'Partner', { external: true }),
      node('sys', 'system', 'Shop'), node('web', 'webapp', 'Storefront', { parentId: 'sys' }),
      node('api', 'container', 'Order API', { parentId: 'sys' }), node('db', 'database', 'Orders', { parentId: 'sys' }),
      node('queue', 'queue', 'Order events', { parentId: 'sys' }),
    ],
    relations: [
      rel('u', 'user', 'web'), rel('p', 'partner', 'api'), rel('w', 'web', 'api'),
      rel('a', 'api', 'db'), rel('q', 'api', 'queue'), rel('c', 'api', 'partner'),
    ],
  }
}

/** Every combination of the answers to the questions with options. */
export function answerCombinations(params: Array<{ key: string; options?: Array<{ value: string }> }>): Array<Record<string, string>> {
  return params.filter((p) => p.options?.length).reduce<Array<Record<string, string>>>(
    (all, p) => all.flatMap((answers) => p.options!.map((o) => ({ ...answers, [p.key]: o.value }))),
    [{}],
  )
}

/** Rules a bound import may bring: the tests the team has to write. */
const LEFT_TO_THE_TEAM = new Set(['scenario-without-tests', 'fitness-fn-without-tests'])

/** What goes wrong when the pack is imported and bound, for each
 *  combination of answers; [] when nothing does. */
export function boundImportProblems(doc: HubRadicalDoc): string[] {
  const meta = doc.hub
  if (!isConcernPack(meta)) return ['not a concern pack']
  const concept = docToConcept(doc)
  const before = shopModel()
  const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
  const targets = concernTargets(meta, byId(before.nodes), byId(before.relations))
  if (!targets.length) return ['its trigger finds nothing in the shop model (person → web app → API → database, queue, partner system)']
  const findings = (data: DiagramData) => checkModel(data, {}, { concerns: [meta] }).findings
  if (!findings(before).some((f) => f.rule === 'concern-unaddressed' && f.code === meta.id)) return ['the shop model does not report its concern before the import']
  const baseline = new Set(findings(before).map((f) => `${f.rule} ${f.nodeId}`))
  const problems: string[] = []
  for (const answers of answerCombinations(meta.templateParams ?? [])) {
    const data = shopModel()
    let n = 0
    let insert
    try {
      insert = buildConcernInsert(concept, {
        answers, elements: [data.nodes.find((x) => x.id === targets[0])!], metamodel: data.metamodel, today: '2026-10-22',
        newId: () => `new-${++n}`, place: () => ({ x: 0, y: 600 }),
      })
    } catch (error) {
      problems.push(`${JSON.stringify(answers)}: ${(error as Error).message}`)
      continue
    }
    data.nodes.push(...Object.values(insert.nodes))
    data.relations.push(...Object.values(insert.relations))
    const brought = findings(data).filter((f) => !baseline.has(`${f.rule} ${f.nodeId}`))
    if (!Object.values(insert.nodes).some((x) => x.type === 'adr')) problems.push(`${JSON.stringify(answers)}: brings no decision`)
    for (const f of brought) {
      if (f.rule === 'concern-unaddressed' && f.nodeId !== targets[0]) continue
      if (!LEFT_TO_THE_TEAM.has(f.rule)) problems.push(`${JSON.stringify(answers)}: ${f.rule}: ${f.message}`)
    }
    const left = JSON.stringify(insert.nodes).match(/\{\{[A-Z0-9_]+\}\}/)
    if (left) problems.push(`${JSON.stringify(answers)}: ${left[0]} left in a text`)
  }
  return problems
}
