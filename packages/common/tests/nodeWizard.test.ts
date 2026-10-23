import { describe, it, expect } from 'vitest'
import {
  builtInGovernanceMetamodel,
  builtInC4Metamodel,
  isWizardStepApplicable,
  wizardFor,
  wizardLinksOf,
  wizardMissingRequired,
  wizardPrefill,
  wizardRelationCandidates,
  wizardStepFields,
  type WizardLink,
  type WizardRelationsStep,
} from '../src/metamodel/index'
import { linkRefusal, wizardLinkCandidates } from '../src/relationRules'
import type { C4Node } from '../src/c4'

const mm = builtInGovernanceMetamodel()

describe('wizardFor', () => {
  it('finds the governance types’ create-time wizards', () => {
    for (const t of ['adr', 'fitness-fn', 'requirement', 'scenario', 'mockup']) {
      expect(wizardFor(mm, t, 'create'), t).toBeDefined()
    }
  })

  it('returns undefined for types without one', () => {
    expect(wizardFor(mm, 'system')).toBeUndefined()
    expect(wizardFor(builtInC4Metamodel(), 'container')).toBeUndefined()
    expect(wizardFor(undefined, 'adr')).toBeUndefined()
  })

  it('skips a manual-only wizard when asked for create-time ones', () => {
    const custom = builtInGovernanceMetamodel()
    custom.nodeTypes.adr.wizard!.trigger = 'manual'
    expect(wizardFor(custom, 'adr', 'create')).toBeUndefined()
    expect(wizardFor(custom, 'adr')).toBeDefined()
  })
})

describe('governance wizards are consistent with their types', () => {
  it('every field and relation step refers to something that exists', () => {
    for (const [typeId, def] of Object.entries(mm.nodeTypes)) {
      for (const step of def.wizard?.steps ?? []) {
        if (step.kind === 'fields') {
          for (const key of step.fields) {
            const known = key === 'label' || key === 'description' || def.properties?.some((p) => p.key === key)
            expect(known, `${typeId}: ${key}`).toBe(true)
          }
        }
        if (step.kind === 'relations') {
          expect(mm.relationTypes[step.relationType], `${typeId}: ${step.relationType}`).toBeDefined()
          expect(isWizardStepApplicable(mm, step, typeId), `${typeId}: ${step.title}`).toBe(true)
        }
      }
    }
  })
})

describe('wizardPrefill', () => {
  it('resolves {{today}} to a local YYYY-MM-DD date', () => {
    const v = wizardPrefill(mm.nodeTypes.adr.wizard!, new Date(2026, 0, 5, 23, 30))
    expect(v).toEqual({ status: 'proposed', date: '2026-01-05' })
  })
})

describe('wizardStepFields', () => {
  const req = mm.nodeTypes.requirement
  const earsStep = req.wizard!.steps.find((s) => s.kind === 'fields' && s.fields.includes('ears_type'))!

  it('only shows the clauses the chosen EARS type uses', () => {
    const keys = (values: Record<string, unknown>): string[] =>
      wizardStepFields(earsStep, req, values).map((p) => p.key)
    expect(keys({ ears_type: 'ubiquitous' })).toEqual(['ears_type', 'action'])
    expect(keys({ ears_type: 'event-driven' })).toEqual(['ears_type', 'trigger', 'action'])
  })

  it('resolves the built-in label field', () => {
    const [label] = wizardStepFields(mm.nodeTypes.adr.wizard!.steps[0], mm.nodeTypes.adr, {})
    expect(label).toMatchObject({ key: 'label', required: true })
  })
})

describe('wizardMissingRequired', () => {
  it('requires a name', () => {
    const adr = mm.nodeTypes.adr
    expect(wizardMissingRequired(adr.wizard!, adr, { label: '  ' })).toEqual(['Name'])
    expect(wizardMissingRequired(adr.wizard!, adr, { label: 'Use Postgres' })).toEqual([])
  })
})

describe('relation steps', () => {
  const nodes = {
    sys: { id: 'sys', type: 'system', label: 'Shop' },
    db: { id: 'db', type: 'database', label: 'Orders DB' },
    old: { id: 'old', type: 'adr', label: 'ADR-1' },
    me: { id: 'me', type: 'adr', label: 'ADR-2' },
    req: { id: 'req', type: 'requirement', label: 'R1' },
  }
  const step = (relationType: string, direction: 'out' | 'in'): WizardRelationsStep =>
    ({ kind: 'relations', title: '', relationType, direction })

  it('offers only nodes the relation type allows, never the node itself', () => {
    const ids = (s: WizardRelationsStep, type: string, self?: string): string[] =>
      wizardRelationCandidates(mm, s, type, nodes, self).map((n) => n.id)
    expect(ids(step('constrains', 'out'), 'adr')).toEqual(['db', 'sys'])
    expect(ids(step('supersedes', 'out'), 'adr', 'me')).toEqual(['old'])
    // satisfies runs element → requirement, so a requirement links "in".
    expect(ids(step('satisfies', 'in'), 'requirement')).toEqual(['db', 'sys'])
  })

  it('skips a step whose relation type cannot involve the node type', () => {
    expect(isWizardStepApplicable(mm, step('supersedes', 'out'), 'scenario')).toBe(false)
    expect(isWizardStepApplicable(mm, step('missing', 'out'), 'adr')).toBe(false)
  })

  it('wizardLinksOf lists the existing relations the steps cover', () => {
    const relations = {
      r1: { id: 'r1', sourceId: 'me', targetId: 'sys', relationType: 'constrains' },
      r2: { id: 'r2', sourceId: 'me', targetId: 'old', relationType: 'supersedes' },
      r3: { id: 'r3', sourceId: 'old', targetId: 'me', relationType: 'supersedes' },
      r4: { id: 'r4', sourceId: 'me', targetId: 'db', relationType: 'uses' },
    }
    expect(wizardLinksOf(mm.nodeTypes.adr.wizard!, 'me', relations)).toEqual([
      { relationType: 'constrains', direction: 'out', otherId: 'sys', relationId: 'r1' },
      { relationType: 'supersedes', direction: 'out', otherId: 'old', relationId: 'r2' },
    ])
  })
})

// F-0033: an ADR dropped onto a system offered only that system, and Create
// was refused ("System holds ADR"). The step offers what the model accepts:
// constrains is governance, which may join an element and what holds it; a
// structural step offers no element that holds the new one.
describe('a relation step and what holds the element', () => {
  const nodes = {
    sys: { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 1, height: 1 },
    pay: { id: 'pay', type: 'system', label: 'Pay', x: 0, y: 0, width: 1, height: 1 },
    api: { id: 'api', type: 'container', label: 'API', parentId: 'sys', x: 0, y: 0, width: 1, height: 1 },
  } as unknown as Record<string, C4Node>
  const ctx = { nodes, relations: {}, metamodel: mm }
  const step = (relationType: string, direction: 'out' | 'in'): WizardRelationsStep => ({ kind: 'relations', title: '', relationType, direction })
  it('offers what the model accepts linked so, and keeps what is linked already', () => {
    const ids = (s: WizardRelationsStep, self: { id?: string; type: string; parentId?: string }, links: WizardLink[] = []) =>
      wizardLinkCandidates(ctx, s, self, links).map((n) => n.id)
    // A new ADR in the Shop constrains the Shop, too.
    expect(ids(step('constrains', 'out'), { type: 'adr', parentId: 'sys' })).toEqual(['api', 'pay', 'sys'])
    expect(linkRefusal(ctx, { type: 'adr', parentId: 'sys' }, { relationType: 'constrains', direction: 'out', otherId: 'sys' })).toBeNull()
    // A new container in the Shop uses another system, not the Shop.
    expect(ids(step('interacts', 'out'), { type: 'container', parentId: 'sys' })).toEqual(['api', 'pay'])
    expect(linkRefusal(ctx, { type: 'container', parentId: 'sys' }, { relationType: 'interacts', direction: 'out', otherId: 'sys' })).toMatch(/Shop holds/)
    // The API (in the Shop) edited: the Shop stays while it is linked so.
    expect(ids(step('interacts', 'out'), { id: 'api', type: 'container' })).toEqual(['pay'])
    expect(ids(step('interacts', 'out'), { id: 'api', type: 'container' }, [{ relationType: 'interacts', direction: 'out', otherId: 'sys' }])).toEqual(['pay', 'sys'])
  })
})
