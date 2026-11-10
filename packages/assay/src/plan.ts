// ─── Radical Assay: the agent's plan ─────────────────────────────────────────
//
// The agent does not write the model element by element: it hands the server
// a plan of what it found (ADR Radical Assay). Elements and relations are
// observed or inferred and cite the facts they rest on; requirements are
// hypotheses, each with the scenarios that verify it from the tests or drawn
// from the documents it cites, and wait for the user, as needs and decisions
// drawn from documents do. Entities are observed on the tables they are;
// processes and state machines are written as inferred, each step and
// transition on the facts or code it rests on (ADR Assay writes the domain,
// processes and lifecycles it reads). checkPlan finds every way a plan is
// not backed by the facts; the metamodel's rules are the model tools' to
// check when it is written.

import { citationProblem, pathProblem, type Citation, type PlanPath } from './cite'
import type { DependencyFact, Link, RepositoryFacts, RoutineFact, ServiceFact, StateFact, TableFact, TestFact, Unit, factIndex } from './facts'

export type FactIndex = ReturnType<typeof factIndex>

export interface PlanElement {
  /** The plan's name for it; later items, and later calls, refer to it by it. */
  key: string
  type: string
  label: string
  description?: string
  technology?: string
  external?: boolean
  /** A plan key or an id of the model. */
  parent?: string
  /** The units it is built from: their folders go into the repository's .radical/radical.json implements. */
  units?: string[]
  /** Folders it is built in that no unit is (code no extractor reads): they go there too. */
  paths?: PlanPath[]
  facts: string[]
  /** Code the agent quotes, for an inferred element. */
  citations?: Citation[]
  confidence: 'observed' | 'inferred'
}

export interface PlanRelation {
  /** Plan keys or ids of the model. */
  from: string
  to: string
  relationType?: string
  label?: string
  technology?: string
  /** The relation type's properties (a references' cardinality, …). */
  properties?: Record<string, unknown>
  facts: string[]
  citations?: Citation[]
  confidence: 'observed' | 'inferred'
}

export interface PlanScenario {
  key: string
  label: string
  given: string
  when: string
  then: string
  /** The test facts that check it: they go into its repository's .radical/radical.json verifies. */
  tests?: string[]
  /** Paths explored in the running application that show it: each is written as a Playwright
   *  test into the application's repository when the requirement is accepted. */
  paths?: string[]
  /** The code it is drawn from, when no test or path shows it: accepted, a pending test of it is
   *  written where the unit that builds its element has a test framework. */
  citations?: Citation[]
}

/** A table of the code, as an entity of the domain. */
export interface PlanEntity {
  key: string
  label: string
  description?: string
  /** aggregate-root (default) or entity: a part of an aggregate, with partOf. */
  kind?: 'aggregate-root' | 'entity'
  /** The table facts it is: the table, as its SQL and its ORM class name it. */
  tables: string[]
  /** The domain it is in: a plan key or an id of the model. */
  parent?: string
  /** The entity whose aggregate it is part of: a foreign key of its tables must reference that entity's. */
  partOf?: string
  /** The entities it refers to: a foreign key of its tables must reference each one's. */
  references?: Array<{ to: string; cardinality?: 'one' | 'many'; description?: string }>
}

/** A step of a process, in order among its siblings. */
export interface PlanStep {
  key: string
  label: string
  description?: string
  /** The person or element that does it: a plan key or an id. */
  performedBy?: string
  /** The mockups that show it: plan keys or ids. */
  mockups?: string[]
  repeat?: '1' | '0..1' | '1..n' | '0..n'
  condition?: string
  /** How its own steps run. */
  children?: 'sequence' | 'choice' | 'concurrent'
  steps?: PlanStep[]
  /** The entry points, explored paths, screens or other facts it rests on. */
  facts?: string[]
  citations?: Citation[]
}

/** A process the code shows, written as inferred. */
export interface PlanProcess {
  key: string
  label: string
  description?: string
  parent?: string
  children?: 'sequence' | 'choice' | 'concurrent'
  steps: PlanStep[]
  facts?: string[]
  citations?: Citation[]
}

export interface PlanState {
  key: string
  label: string
  /** normal (default) or final. */
  kind?: 'normal' | 'final'
  description?: string
  /** The value of the machine's state facts it is; default its label. */
  value?: string
  /** For a state no state fact holds: the code that names it. */
  citations?: Citation[]
}

export interface PlanTransition {
  /** State keys of the machine. */
  from: string
  to: string
  /** The event's name: one event of the machine per name. */
  event?: string
  guard?: string
  actions?: string
  facts?: string[]
  citations?: Citation[]
}

/** The lifecycle of an entity, written as inferred. */
export interface PlanStateMachine {
  key: string
  label: string
  description?: string
  parent?: string
  /** The entity it is the lifecycle of: a plan key or an id. */
  entity: string
  /** The state facts its states are the values of. */
  facts?: string[]
  citations?: Citation[]
  /** The state it starts in: a state key. */
  initial: string
  states: PlanState[]
  transitions: PlanTransition[]
  /** The elements that run it: plan keys or ids. Default: the elements built from the units whose code sets its values. */
  implementedBy?: string[]
}

/** A screen of the running application, as a mockup. */
export interface PlanMockup {
  key: string
  label: string
  /** The screen fact it is built from. */
  screen: string
  description?: string
  /** A plan key or an id of the model (a system, domain or group). */
  parent?: string
  /** The element that presents it (a webapp, container, component or system): a plan key or an id. */
  presentedBy?: string
}

export interface PlanRequirement {
  key: string
  label: string
  /** The requirement's properties: ears_type, action and what the EARS type needs. */
  properties: Record<string, unknown>
  /** The element whose code the tests exercise: a plan key or an id of the model. None for a
   *  requirement drawn from documents that nothing builds yet: the model shows it unsatisfied. */
  satisfiedBy?: string
  /** Where to put it: a plan key or an id of the model (a system, a domain or a group). Default: the system that holds satisfiedBy. */
  parent?: string
  /** The need it derives from: a key of the plan's needs or an id of the model. Default: the run's need Found in the code. */
  need?: string
  /** The processes that meet it: keys of the plan's processes or ids of the model; each satisfies it once it is accepted. */
  processes?: string[]
  /** None when it is drawn from documents it cites: a requirement no test checks. */
  scenarios: PlanScenario[]
  facts?: string[]
  citations?: Citation[]
}

/** A need a document states: the words of the people it quotes. */
export interface PlanNeed {
  key: string
  label: string
  /** What the document says, quoted or close to it. */
  description: string
  parent?: string
  /** kind and source, as the metamodel's need has them. */
  properties?: Record<string, unknown>
  /** The document facts it rests on. */
  facts?: string[]
  citations?: Citation[]
}

/** A decision a document records: an ADR. */
export interface PlanDecision {
  key: string
  label: string
  /** context, decision, consequences, alternatives, status, date. */
  properties: Record<string, unknown>
  /** What it constrains: keys of the plan's elements or ids of the model. */
  constrains?: string[]
  parent?: string
  facts?: string[]
  citations?: Citation[]
}

export interface Plan {
  elements: PlanElement[]
  relations: PlanRelation[]
  requirements: PlanRequirement[]
  needs: PlanNeed[]
  decisions: PlanDecision[]
  mockups: PlanMockup[]
  entities: PlanEntity[]
  processes: PlanProcess[]
  stateMachines: PlanStateMachine[]
}

/** A table's name to compare by: no schema, no quotes, any case. */
export const tableName = (name: string): string => (name.split('.').pop() ?? name).replace(/[`"[\]]/g, '').toLowerCase()
/** A state's name to compare by: letters and digits, any case (PAID, paid, Paid). */
export const stateName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** The plan in `input`, with what makes it no plan (wrong shapes); the facts are checkPlan's. */
export function parsePlan(input: unknown): { plan: Plan; problems: string[] } {
  const problems: string[] = []
  const raw = isRecord(input) ? input : {}
  if (!isRecord(input)) problems.push('the plan must be an object with elements, relations, requirements, needs, decisions, mockups, entities, processes and stateMachines')
  const list = (key: string): Record<string, unknown>[] => {
    const v = raw[key]
    if (v === undefined) return []
    if (!Array.isArray(v)) { problems.push(`${key} must be a list`); return [] }
    return v.map((x, i) => {
      if (!isRecord(x)) problems.push(`${key}[${i}] must be an object`)
      return isRecord(x) ? x : {}
    })
  }
  const plan: Plan = {
    elements: list('elements') as unknown as PlanElement[],
    relations: list('relations') as unknown as PlanRelation[],
    requirements: list('requirements') as unknown as PlanRequirement[],
    needs: list('needs') as unknown as PlanNeed[],
    decisions: list('decisions') as unknown as PlanDecision[],
    mockups: list('mockups') as unknown as PlanMockup[],
    entities: list('entities') as unknown as PlanEntity[],
    processes: list('processes') as unknown as PlanProcess[],
    stateMachines: list('stateMachines') as unknown as PlanStateMachine[],
  }
  if (!Object.values(plan).some((items) => items.length) && isRecord(input)) problems.push('the plan is empty')
  return { plan, problems }
}

export interface PlanContext {
  /** The run's sources of documents: their files may be quoted, but nothing is built in them. */
  sources?: RepositoryFacts[]
  /** The type of a node of the model, by id or tempId. */
  typeOf?: (id: string) => string | undefined
  /** Keys of needs proposed earlier and still waiting for an answer. */
  waitingNeeds?: Set<string>
}

/** Every way `plan` is not backed by `facts`, by the code of `repositories`
 *  or by the documents of `context.sources` it quotes, or names what is
 *  nowhere: `known` says whether an id is the model's. Empty when it is sound. */
export function checkPlan(plan: Plan, facts: FactIndex, known: (id: string) => boolean, repositories: RepositoryFacts[] = [], factsOf: (id: string) => string[] = () => [], context: PlanContext = {}): string[] {
  const quotable = [...repositories, ...(context.sources ?? [])]
  const problems: string[] = []
  const keys = new Set<string>()
  const key = (k: unknown, where: string): void => {
    if (!text(k)) { problems.push(`${where}: key is missing`); return }
    if (keys.has(k)) problems.push(`${where}: key "${k}" is used twice`)
    if (known(k)) problems.push(`${where}: key "${k}" is already an id of the model`)
    keys.add(k)
  }
  plan.elements.forEach((e, i) => key(e.key, `elements[${i}]`))
  plan.requirements.forEach((r, i) => {
    key(r.key, `requirements[${i}]`)
    if (Array.isArray(r.scenarios)) r.scenarios.forEach((s, j) => key(s?.key, `requirements[${i}].scenarios[${j}]`))
  })
  plan.needs.forEach((n, i) => key(n.key, `needs[${i}]`))
  plan.decisions.forEach((d, i) => key(d.key, `decisions[${i}]`))
  plan.mockups.forEach((m, i) => key(m.key, `mockups[${i}]`))
  plan.entities.forEach((e, i) => key(e.key, `entities[${i}]`))
  const stepKeys = (steps: unknown, where: string): void => {
    if (Array.isArray(steps)) steps.forEach((st, j) => { key(st?.key, `${where}.steps[${j}]`); stepKeys(st?.steps, `${where}.steps[${j}]`) })
  }
  plan.processes.forEach((p, i) => { key(p.key, `processes[${i}]`); stepKeys(p.steps, `processes[${i}]`) })
  plan.stateMachines.forEach((m, i) => {
    key(m.key, `stateMachines[${i}]`)
    if (Array.isArray(m.states)) m.states.forEach((st, j) => key(st?.key, `stateMachines[${i}].states[${j}]`))
  })
  const elementKeys = new Set([...plan.elements.map((e) => e.key), ...plan.entities.map((e) => e.key), ...plan.mockups.map((m) => m.key)])
  const needKeys = new Set(plan.needs.map((n) => n.key))
  /** What an end of a relation is built from or stands for: units, services, databases, stored routines (and the units
   *  services run, the routines a database project's unit holds, and a stored package's members). */
  const routineFacts = [...facts.entries()].filter(([, f]) => f.kind === 'routine').map(([id, f]) => ({ id, unit: (f.fact as RoutineFact).unit, name: (f.fact as RoutineFact).name }))
  const ends = (ref: unknown): Set<string> => {
    const e = plan.elements.find((x) => x.key === ref)
    const ids = e ? [...(strings(e.units) ? e.units : []), ...(strings(e.facts) ? e.facts : [])] : typeof ref === 'string' ? factsOf(ref) : []
    const out = new Set<string>()
    for (const id of ids) {
      const f = facts.get(id)
      if (!f || !['unit', 'service', 'database', 'routine'].includes(f.kind)) continue
      out.add(id)
      const unit = (f.fact as ServiceFact).unit
      if (f.kind === 'service' && unit) out.add(unit)
      if (f.kind === 'unit') for (const r of routineFacts) if (r.unit === id) out.add(r.id)
      const routine = f.fact as RoutineFact
      if (f.kind === 'routine' && routine.kind === 'package') for (const r of routineFacts) if (r.unit === routine.unit && r.name.startsWith(`${routine.name}.`)) out.add(r.id)
    }
    return out
  }
  const resolves = (ref: unknown): boolean => text(ref) && (elementKeys.has(ref) || known(ref))
  /** The fact ids an item cites, its citations checked; with `required`,
   *  it must rest on a fact or, when `quotes` allows, a citation. */
  const cited = (item: { facts?: unknown; citations?: unknown }, where: string, required: boolean, quotes: boolean): string[] => {
    const list = item.facts
    const citations = item.citations
    if (citations !== undefined) {
      if (!Array.isArray(citations)) problems.push(`${where}: citations must be a list`)
      else if (citations.length && !quotes) problems.push(`${where}: observed, so it rests on facts; a citation backs only an inferred claim: drop its citations, or mark it inferred`)
      else for (const c of citations) { const p = citationProblem(c, quotable); if (p) problems.push(`${where}: ${p}`) }
    }
    const quoted = quotes && Array.isArray(citations) && citations.length > 0
    if (list === undefined && (!required || quoted)) return []
    if (!strings(list) || (required && !list.length && !quoted)) {
      problems.push(`${where}: facts must list the ids of the facts it rests on${quotes ? ', or citations the code or documents it quotes' : ''}`)
      return []
    }
    for (const id of list) if (!facts.has(id)) problems.push(`${where}: cites ${id}, which is no fact of the run`)
    return list
  }

  plan.elements.forEach((e, i) => {
    const where = `elements[${i}] (${e.label ?? e.key})`
    if (!text(e.type)) problems.push(`${where}: type is missing`)
    if (!text(e.label)) problems.push(`${where}: label is missing`)
    if (e.confidence !== 'observed' && e.confidence !== 'inferred') problems.push(`${where}: confidence must be observed or inferred (a hypothesis goes in as a requirement for the user)`)
    // The units it is built from count as cited.
    const ids = [...cited({ ...e, facts: e.facts ?? (strings(e.units) && e.units.length ? [] : undefined) }, where, !(strings(e.units) && e.units.length), e.confidence === 'inferred'), ...(strings(e.units) ? e.units : [])]
    if (e.confidence === 'observed' && ids.some((id) => facts.get(id)?.kind === 'document')) problems.push(`${where}: observed, but cites a document; a document backs only an inferred claim`)
    if (e.confidence === 'observed' && !ids.some((id) => ['unit', 'api', 'service', 'database', 'routine'].includes(facts.get(id)?.kind ?? ''))) {
      problems.push(`${where}: observed, but cites no unit, API, service, database or stored routine fact that states it`)
    }
    if (e.units !== undefined) {
      if (!strings(e.units)) problems.push(`${where}: units must list unit facts`)
      else for (const u of e.units) if (facts.get(u)?.kind !== 'unit') problems.push(`${where}: unit ${u} is no unit of the run`)
    }
    if (e.paths !== undefined) {
      if (!Array.isArray(e.paths)) problems.push(`${where}: paths must list { repository, path }`)
      else for (const p of e.paths) {
        const problem = context.sources?.some((x) => x.repository === (p as { repository?: unknown })?.repository)
          ? `names ${String((p as { repository?: unknown }).repository)}/${String((p as { path?: unknown }).path)}, a source of documents; an element is built in the code`
          : pathProblem(p, repositories)
        if (problem) problems.push(`${where}: ${problem}`)
      }
    }
    if (e.parent !== undefined && !resolves(e.parent)) problems.push(`${where}: parent ${String(e.parent)} is neither a key of the plan nor an id of the model`)
  })

  plan.relations.forEach((r, i) => {
    const where = `relations[${i}] (${String(r.from)} → ${String(r.to)})`
    if (!resolves(r.from)) problems.push(`${where}: from ${String(r.from)} is neither a key of the plan nor an id of the model`)
    if (!resolves(r.to)) problems.push(`${where}: to ${String(r.to)} is neither a key of the plan nor an id of the model`)
    if (r.confidence !== 'observed' && r.confidence !== 'inferred') problems.push(`${where}: confidence must be observed or inferred`)
    const ids = cited(r, where, true, r.confidence === 'inferred')
    if (r.confidence === 'observed' && ids.some((id) => facts.get(id)?.kind === 'document')) problems.push(`${where}: observed, but cites a document; a document backs only an inferred claim`)
    // A link or dependency it cites must join its two ends: what each end is built from or stands for.
    const from = ends(r.from)
    const to = ends(r.to)
    // A call joins its caller to what it calls; a package or project
    // reference joins them either way, since a model may draw a library as
    // bundled into what uses it.
    const joinsWay = (id: string, a: Set<string>, b: Set<string>): boolean => {
      const f = facts.get(id)
      if (f?.kind === 'link') {
        const l = f.fact as Link
        return a.has(l.from) && (b.has(l.to) || (!!l.via && b.has(l.via)))
      }
      if (f?.kind === 'dependency') {
        const d = f.fact as DependencyFact
        return a.has(d.unit) && (d.target ? b.has(d.target) : [...b].some((u) => (facts.get(u)?.fact as Unit | undefined)?.name?.toLowerCase() === d.package.toLowerCase()))
      }
      return false
    }
    const either = (id: string): boolean => facts.get(id)?.kind === 'dependency' || (facts.get(id)?.fact as Link | undefined)?.kind === 'package'
    const joins = (id: string): boolean => joinsWay(id, from, to) || (either(id) && joinsWay(id, to, from))
    const tying = ids.filter((id) => ['link', 'dependency'].includes(facts.get(id)?.kind ?? ''))
    if (tying.length && from.size && to.size && !tying.some(joins)) problems.push(`${where}: the links and dependencies it cites join neither of its ends to the other`)
    const states = (id: string): boolean => {
      const f = facts.get(id)
      return f?.kind === 'dependency' || (f?.kind === 'link' && (f.fact as Link).confidence === 'observed')
    }
    if (r.confidence === 'observed' && !ids.some((id) => states(id) && (!from.size || !to.size || joins(id)))) problems.push(`${where}: observed, but cites no dependency or observed link that states it`)
  })

  plan.requirements.forEach((r, i) => {
    const where = `requirements[${i}] (${r.label ?? r.key})`
    if (!text(r.label)) problems.push(`${where}: label is missing`)
    if (!isRecord(r.properties) || !text(r.properties.action)) problems.push(`${where}: properties must hold the EARS action ("the system shall …") and its ears_type`)
    if (r.satisfiedBy !== undefined && !resolves(r.satisfiedBy)) problems.push(`${where}: satisfiedBy ${String(r.satisfiedBy)} is neither a key of the plan nor an id of the model`)
    // Tests exercise an element's code; a defect's scenarios drawn from the code or a screen need none that satisfies it.
    if (r.satisfiedBy === undefined && Array.isArray(r.scenarios) && r.scenarios.some((s) => strings(s?.tests) && s.tests.length)) problems.push(`${where}: satisfiedBy must name the element whose code its scenarios' tests exercise`)
    if (r.parent !== undefined && !resolves(r.parent)) problems.push(`${where}: parent ${String(r.parent)} is neither a key of the plan nor an id of the model`)
    const isNeed = (ref: string): boolean => needKeys.has(ref) || !!context.waitingNeeds?.has(ref) || (known(ref) && (!context.typeOf || context.typeOf(ref) === 'need'))
    if (r.processes !== undefined) {
      const isProcess = (ref: unknown): boolean => text(ref) && (plan.processes.some((p) => p.key === ref) || (known(ref) && (!context.typeOf || context.typeOf(ref) === 'process')))
      if (!strings(r.processes) || r.processes.some((p) => !isProcess(p))) problems.push(`${where}: processes must list processes of the plan or the model that meet it`)
    }
    if (r.need !== undefined && !(text(r.need) && isNeed(r.need))) problems.push(`${where}: need ${String(r.need)} is neither a key of the plan's needs, a need waiting for an answer, nor a need of the model`)
    const rests = cited(r, where, false, true).length > 0 || (Array.isArray(r.citations) && r.citations.length > 0)
    if (r.scenarios !== undefined && !Array.isArray(r.scenarios)) { problems.push(`${where}: scenarios must be a list`); return }
    if (!r.scenarios?.length) {
      if (!rests) problems.push(`${where}: needs the scenarios that verify it, or the documents or code it is drawn from (facts, citations)`)
      return
    }
    r.scenarios.forEach((s, j) => {
      const at = `${where}, scenario ${j + 1} (${s?.label ?? s?.key})`
      if (!isRecord(s)) return
      for (const field of ['label', 'given', 'when', 'then'] as const) if (!text(s[field])) problems.push(`${at}: ${field} is missing`)
      const paths = s.paths
      if (paths !== undefined && (!strings(paths) || paths.some((p) => facts.get(p)?.kind !== 'path'))) problems.push(`${at}: paths must list paths explored in the running application (assay_explore)`)
      const fromCode = Array.isArray(s.citations) && s.citations.length > 0
      if (s.citations !== undefined) {
        if (!Array.isArray(s.citations)) problems.push(`${at}: citations must be a list`)
        else for (const c of s.citations) { const p = citationProblem(c, repositories); if (p) problems.push(`${at}: ${p}`) }
      }
      if ((!strings(s.tests) || !s.tests.length) && !(strings(paths) && paths.length) && !fromCode) problems.push(`${at}: tests must list the test facts that check it, paths the explored paths that show it, or citations the code it is drawn from`)
      else for (const t of strings(s.tests) ? s.tests : []) {
        const f = facts.get(t)
        if (f?.kind !== 'test') problems.push(`${at}: ${t} is no test of the run`)
        // (A database's test its code declares rests a scenario before it is run: its report then says.)
        else if ((f.fact as TestFact).status !== 'passed' && (f.fact as TestFact).status !== 'not run') problems.push(`${at}: ${t} ${(f.fact as TestFact).status} in the reports; a scenario rests on tests that pass: leave the test out of it, or the scenario, and propose the requirement with the code it is drawn from (citations) and no scenarios`)
        else if ((f.fact as TestFact).checksNothing) problems.push(`${at}: ${t} checks nothing (its body is empty or asserts nothing), so it passes whatever the code does: leave it out of the scenario; rest the scenario on explored paths or on the code it is drawn from (citations), whose pending test the team then writes`)
      }
    })
  })
  plan.mockups.forEach((m, i) => {
    const where = `mockups[${i}] (${m.label ?? m.key})`
    if (!text(m.label)) problems.push(`${where}: label is missing`)
    if (!text(m.screen) || facts.get(m.screen)?.kind !== 'screen') problems.push(`${where}: screen must name a screen of the explored application (assay_explore)`)
    if (m.parent !== undefined && !resolves(m.parent)) problems.push(`${where}: parent ${String(m.parent)} is neither a key of the plan nor an id of the model`)
    if (m.presentedBy !== undefined && !resolves(m.presentedBy)) problems.push(`${where}: presentedBy ${String(m.presentedBy)} is neither a key of the plan nor an id of the model`)
  })

  // ── the domain: entities on their tables, relations on foreign keys ──
  const entityKeys = new Set(plan.entities.map((e) => e.key))
  /** The table facts an entity is: this plan's, or those an earlier plan wrote it on. */
  const tablesOf = (ref: string): TableFact[] => {
    const e = plan.entities.find((x) => x.key === ref)
    const ids = e ? (strings(e.tables) ? e.tables : []) : factsOf(ref)
    return ids.map((id) => facts.get(id)).filter((f) => f?.kind === 'table').map((f) => f!.fact as TableFact)
  }
  const isEntity = (ref: unknown): boolean => text(ref) && (entityKeys.has(ref) || (known(ref) && (!context.typeOf || context.typeOf(ref) === 'entity')))
  /** A foreign key of `from`'s tables that references one of `to`'s. */
  const foreignKey = (from: string, to: string): boolean => {
    const targets = new Set(tablesOf(to).map((t) => tableName(t.table)))
    return tablesOf(from).some((t) => (t.references ?? []).some((r) => targets.has(tableName(r.table))))
  }
  const claimed = new Map<string, string>()
  plan.entities.forEach((e, i) => {
    const where = `entities[${i}] (${e.label ?? e.key})`
    if (!text(e.label)) problems.push(`${where}: label is missing`)
    if (!strings(e.tables) || !e.tables.length) problems.push(`${where}: tables must list the table facts it is (assay_facts with kind tables); an entity no table backs is no entity of the code`)
    else for (const t of e.tables) {
      if (facts.get(t)?.kind !== 'table') problems.push(`${where}: ${t} is no table of the run`)
      const name = facts.get(t) ? `${facts.get(t)!.repository}:${tableName((facts.get(t)!.fact as TableFact).table)}` : t
      if (claimed.has(name) && claimed.get(name) !== e.key) problems.push(`${where}: its table ${t} is entity "${claimed.get(name)}" already`)
      claimed.set(name, e.key)
    }
    if (e.kind !== undefined && e.kind !== 'aggregate-root' && e.kind !== 'entity') problems.push(`${where}: kind must be aggregate-root or entity`)
    if (e.parent !== undefined && !resolves(e.parent)) problems.push(`${where}: parent ${String(e.parent)} is neither a key of the plan nor an id of the model`)
    if (e.partOf !== undefined) {
      if (!isEntity(e.partOf)) problems.push(`${where}: partOf ${String(e.partOf)} is no entity of the plan or the model`)
      else if (!foreignKey(e.key, e.partOf)) problems.push(`${where}: part of ${String(e.partOf)}, but no foreign key of its tables references that entity's`)
    }
    if (e.references !== undefined) {
      if (!Array.isArray(e.references)) problems.push(`${where}: references must list { to, cardinality }`)
      else for (const r of e.references) {
        if (!isRecord(r) || !isEntity(r.to)) problems.push(`${where}: references ${String((r as { to?: unknown })?.to)}, which is no entity of the plan or the model`)
        else if (!foreignKey(e.key, r.to as string)) problems.push(`${where}: references ${String(r.to)}, but no foreign key of its tables references that entity's (a reference the code makes otherwise goes in relations, inferred, citing it)`)
      }
    }
  })

  // ── processes: every step on what it rests on ──
  const mockupOrModel = (ref: unknown): boolean => text(ref) && (plan.mockups.some((m) => m.key === ref) || known(ref))
  const checkSteps = (steps: unknown, where: string): void => {
    if (!Array.isArray(steps)) { problems.push(`${where}: steps must be a list`); return }
    steps.forEach((st, j) => {
      const at = `${where}.steps[${j}] (${st?.label ?? st?.key})`
      if (!isRecord(st)) return
      if (!text(st.label)) problems.push(`${at}: label is missing`)
      // A step made of steps rests on them; one of its own on what it cites.
      const parts = Array.isArray(st.steps) && st.steps.length > 0
      if (!cited(st, at, !parts, true).length && !(Array.isArray(st.citations) && st.citations.length) && !parts) return
      if (st.performedBy !== undefined && !resolves(st.performedBy)) problems.push(`${at}: performedBy ${String(st.performedBy)} is neither a key of the plan nor an id of the model`)
      if (st.mockups !== undefined && (!strings(st.mockups) || st.mockups.some((m) => !mockupOrModel(m)))) problems.push(`${at}: mockups must list mockups of the plan or the model`)
      if (st.steps !== undefined) checkSteps(st.steps, at)
    })
  }
  plan.processes.forEach((p, i) => {
    const where = `processes[${i}] (${p.label ?? p.key})`
    if (!text(p.label)) problems.push(`${where}: label is missing`)
    if (p.parent !== undefined && !resolves(p.parent)) problems.push(`${where}: parent ${String(p.parent)} is neither a key of the plan nor an id of the model`)
    if (p.facts !== undefined || p.citations !== undefined) cited(p, where, false, true)
    if (!Array.isArray(p.steps) || !p.steps.length) problems.push(`${where}: steps must list its steps in order`)
    else checkSteps(p.steps, where)
  })

  // ── state machines: states from the state facts, transitions on the code ──
  plan.stateMachines.forEach((m, i) => {
    const where = `stateMachines[${i}] (${m.label ?? m.key})`
    if (!text(m.label)) problems.push(`${where}: label is missing`)
    if (!isEntity(m.entity)) problems.push(`${where}: entity ${String(m.entity)} is no entity of the plan or the model`)
    if (m.parent !== undefined && !resolves(m.parent)) problems.push(`${where}: parent ${String(m.parent)} is neither a key of the plan nor an id of the model`)
    const ids = cited(m, where, true, true)
    const stateFacts = ids.map((id) => facts.get(id)).filter((f) => f?.kind === 'state').map((f) => f!.fact as StateFact)
    const values = new Set(stateFacts.flatMap((f) => f.values.map(stateName)))
    if (!Array.isArray(m.states) || !m.states.length) { problems.push(`${where}: states must list its states`); return }
    const keysHere = new Set<string>()
    m.states.forEach((st, j) => {
      const at = `${where}.states[${j}] (${st?.label ?? st?.key})`
      if (!isRecord(st)) return
      keysHere.add(st.key)
      if (!text(st.label)) problems.push(`${at}: label is missing`)
      if (st.kind !== undefined && st.kind !== 'normal' && st.kind !== 'final') problems.push(`${at}: kind must be normal or final`)
      const quotes = Array.isArray(st.citations) && st.citations.length > 0
      if (quotes) for (const c of st.citations!) { const p = citationProblem(c, repositories); if (p) problems.push(`${at}: ${p}`) }
      else if (!values.has(stateName(st.value ?? st.label ?? ''))) problems.push(`${at}: no state fact the machine cites holds "${st.value ?? st.label}" (${stateFacts.length ? [...new Set(stateFacts.flatMap((f) => f.values))].join(', ') : 'it cites none'}); give its value, or cite the code that names it`)
    })
    if (!keysHere.has(m.initial)) problems.push(`${where}: initial must name one of its states`)
    if (!Array.isArray(m.transitions)) { problems.push(`${where}: transitions must be a list`); return }
    const valueOf = (k: string): string => stateName(((st) => st?.value ?? st?.label ?? '')(m.states.find((x) => x.key === k)))
    m.transitions.forEach((t, j) => {
      const at = `${where}.transitions[${j}] (${String(t?.from)} → ${String(t?.to)})`
      if (!isRecord(t)) return
      if (!keysHere.has(t.from)) problems.push(`${at}: from must name one of the machine's states`)
      if (!keysHere.has(t.to)) problems.push(`${at}: to must name one of the machine's states`)
      // A line of the code that sets the state it goes to is evidence of it, as is code quoted.
      const sets = stateFacts.some((f) => f.sets.some((x) => stateName(x.value) === valueOf(t.to)))
      const own = t.facts !== undefined || t.citations !== undefined ? cited(t, at, false, true) : []
      if (!sets && !own.length && !(Array.isArray(t.citations) && t.citations.length)) problems.push(`${at}: rests on nothing: no line of the code the state facts name sets ${String(t.to)}; cite the code that makes it (citations)`)
    })
    if (m.implementedBy !== undefined && (!strings(m.implementedBy) || m.implementedBy.some((x) => !resolves(x)))) problems.push(`${where}: implementedBy must list keys of the plan or ids of the model`)
  })

  plan.needs.forEach((n, i) => {
    const where = `needs[${i}] (${n.label ?? n.key})`
    if (!text(n.label)) problems.push(`${where}: label is missing`)
    if (!text(n.description)) problems.push(`${where}: description must say what the document states`)
    if (n.parent !== undefined && !resolves(n.parent)) problems.push(`${where}: parent ${String(n.parent)} is neither a key of the plan nor an id of the model`)
    if (n.properties !== undefined && !isRecord(n.properties)) problems.push(`${where}: properties must be an object`)
    cited(n, where, true, true)
  })

  plan.decisions.forEach((d, i) => {
    const where = `decisions[${i}] (${d.label ?? d.key})`
    if (!text(d.label)) problems.push(`${where}: label is missing`)
    if (!isRecord(d.properties) || !text(d.properties.decision)) problems.push(`${where}: properties must hold the decision, with its context and consequences where the document gives them`)
    if (d.parent !== undefined && !resolves(d.parent)) problems.push(`${where}: parent ${String(d.parent)} is neither a key of the plan nor an id of the model`)
    if (d.constrains !== undefined) {
      if (!strings(d.constrains)) problems.push(`${where}: constrains must list keys of the plan or ids of the model`)
      else for (const c of d.constrains) if (!resolves(c)) problems.push(`${where}: constrains ${c}, which is neither a key of the plan nor an id of the model`)
    }
    cited(d, where, true, true)
  })
  return problems
}
