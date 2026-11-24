import { describe, expect, it } from 'vitest'
import { ADOPT_RULE, CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE, adoptBaselines, checkModel, existingCodeCheckConfig, parseCheckConfig, serializeCheckConfig, strictCheckConfig } from '../src/check'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** Two requirements, neither verified by a scenario: gaps existing code has. */
const model = (): DiagramData => ({
  metamodel: builtInGovernanceMetamodel(),
  nodes: [
    node('r1', 'requirement', 'Sign in', { ears_type: 'ubiquitous', action: 'let a user sign in' }),
    node('r2', 'requirement', 'Sign out', { ears_type: 'ubiquitous', action: 'let a user sign out' }),
  ],
  relations: [],
})

describe('check.json profiles', () => {
  it('the strict profile sets every rule to error and every goal to 100%', () => {
    const config = strictCheckConfig()
    const ids = [...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE].map((r) => r.id)
    expect(Object.keys(config.rules!).sort()).toEqual([...ids].sort())
    expect(Object.values(config.rules!).every((s) => s === 'error')).toBe(true)
    expect(config.goals).toEqual(Object.fromEntries(CHECK_METRICS.map((m) => [m.id, { min: 100 }])))
    expect(config.adopt).toBeUndefined()
    expect(parseCheckConfig(serializeCheckConfig(config))).toEqual(config)
  })

  it('fails a new model on a gap the defaults only warn about', () => {
    expect(checkModel(model()).ok).toBe(true)
    const strict = checkModel(model(), strictCheckConfig())
    expect(strict.ok).toBe(false)
    expect(strict.findings.some((f) => f.rule === 'requirement-without-scenario' && f.severity === 'error')).toBe(true)
  })

  it('the profile for existing code reports one error until the first run\'s baselines are taken', () => {
    const config = existingCodeCheckConfig()
    expect(config.adopt).toBe(true)
    const pending = checkModel(model(), config)
    expect(pending.findings.filter((f) => f.rule === ADOPT_RULE.id).map((f) => f.message)).toEqual(['check.json waits for the baselines of its first run ("adopt": true): run radical check --adopt and commit check.json.'])
    expect(pending.ok).toBe(false)
  })

  it('--adopt sets each rule\'s max to its count and each goal to its share, once', () => {
    const config = existingCodeCheckConfig()
    const adopted = adoptBaselines(config, checkModel(model(), config))
    expect(adopted.config.adopt).toBeUndefined()
    expect(adopted.config.rules!['requirement-without-scenario']).toEqual({ severity: 'error', max: 2 })
    expect(adopted.baselines).toContainEqual({ id: 'requirement-without-scenario', max: 2 })
    expect(adopted.config.goals!['requirements-with-scenario']).toEqual({ min: 0 })
    expect(checkModel(model(), adopted.config).ok).toBe(true)
    // One more gap is an error now.
    const worse = model()
    worse.nodes.push(node('r3', 'requirement', 'Reset password', { ears_type: 'ubiquitous', action: 'let a user reset the password' }))
    expect(checkModel(worse, adopted.config).ok).toBe(false)
    // Baselines are taken once: only --ratchet lowers them after.
    expect(() => adoptBaselines(adopted.config, checkModel(model(), adopted.config))).toThrow(/only radical check --ratchet lowers them/)
  })

  it('reads "adopt" only as true or false', () => {
    expect(() => parseCheckConfig('{ "adopt": "yes" }')).toThrow(/"adopt" is true/)
  })
})
