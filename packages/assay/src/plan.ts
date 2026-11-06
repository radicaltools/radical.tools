// ─── Radical Assay: the agent's plan ─────────────────────────────────────────
//
// The agent does not write the model element by element: it hands the server
// a plan of what it found (ADR Radical Assay). Elements and relations are
// observed or inferred and cite the facts they rest on; requirements are
// hypotheses, each with the scenarios that verify it from the tests or drawn
// from the documents it cites, and wait for the user, as needs and decisions
// drawn from documents do. checkPlan finds every way a plan is not backed by the facts;
// the metamodel's rules are the model tools' to check when it is written.

import { citationProblem, pathProblem, type Citation, type PlanPath } from './cite'
import type { DependencyFact, Link, RepositoryFacts, ServiceFact, TestFact, Unit, factIndex } from './facts'

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
  tests: string[]
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
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** The plan in `input`, with what makes it no plan (wrong shapes); the facts are checkPlan's. */
export function parsePlan(input: unknown): { plan: Plan; problems: string[] } {
  const problems: string[] = []
  const raw = isRecord(input) ? input : {}
  if (!isRecord(input)) problems.push('the plan must be an object with elements, relations, requirements, needs and decisions')
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
  }
  if (!plan.elements.length && !plan.relations.length && !plan.requirements.length && !plan.needs.length && !plan.decisions.length && isRecord(input)) problems.push('the plan is empty')
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
  const elementKeys = new Set(plan.elements.map((e) => e.key))
  const needKeys = new Set(plan.needs.map((n) => n.key))
  /** What an end of a relation is built from or stands for: units, services, databases (and the units services run). */
  const ends = (ref: unknown): Set<string> => {
    const e = plan.elements.find((x) => x.key === ref)
    const ids = e ? [...(strings(e.units) ? e.units : []), ...(strings(e.facts) ? e.facts : [])] : typeof ref === 'string' ? factsOf(ref) : []
    const out = new Set<string>()
    for (const id of ids) {
      const f = facts.get(id)
      if (!f || !['unit', 'service', 'database'].includes(f.kind)) continue
      out.add(id)
      const unit = (f.fact as ServiceFact).unit
      if (f.kind === 'service' && unit) out.add(unit)
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
      else if (citations.length && !quotes) problems.push(`${where}: observed, so it rests on facts; a citation backs only an inferred claim`)
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
    if (e.confidence === 'observed' && !ids.some((id) => ['unit', 'api', 'service', 'database'].includes(facts.get(id)?.kind ?? ''))) {
      problems.push(`${where}: observed, but cites no unit, API, service or database fact that states it`)
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
    if (r.satisfiedBy === undefined && Array.isArray(r.scenarios) && r.scenarios.length) problems.push(`${where}: satisfiedBy must name the element whose code its scenarios' tests exercise`)
    if (r.parent !== undefined && !resolves(r.parent)) problems.push(`${where}: parent ${String(r.parent)} is neither a key of the plan nor an id of the model`)
    const isNeed = (ref: string): boolean => needKeys.has(ref) || !!context.waitingNeeds?.has(ref) || (known(ref) && (!context.typeOf || context.typeOf(ref) === 'need'))
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
      if (!strings(s.tests) || !s.tests.length) problems.push(`${at}: tests must list the test facts that check it`)
      else for (const t of s.tests) {
        const f = facts.get(t)
        if (f?.kind !== 'test') problems.push(`${at}: ${t} is no test of the run`)
        else if ((f.fact as TestFact).status !== 'passed') problems.push(`${at}: ${t} ${(f.fact as TestFact).status} in the reports; a scenario rests on tests that pass: leave the test out of it, or the scenario, and propose the requirement with the code it is drawn from (citations) and no scenarios`)
      }
    })
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
