/**
 * The Inspector's Settings edit a draft of check.json: they keep the file as
 * it was where the user did not touch it, and show the change as a diff.
 */
import { describe, expect, it } from 'vitest'
import type { CheckConfig } from '@radical/common/check'
import { lineDiff, patchRule, setGoal } from '../src/renderer/src/components/inspector/settingsDraft'

const CONFIG: CheckConfig = {
  rules: {
    metamodel: 'error',
    'requirement-without-scenario': { severity: 'error', max: 61 },
    'test-unbound': { severity: 'warning', include: ['apps/e2e/**'] },
  },
}

describe('Inspector settings draft', () => {
  it('keeps a rule set only by its severity a string', () => {
    expect(patchRule(CONFIG, 'test-skipped', { severity: 'error' }).rules!['test-skipped']).toBe('error')
    expect(patchRule(CONFIG, 'metamodel', { severity: 'warning' }).rules!.metamodel).toBe('warning')
  })

  it('adds and removes a baseline, and drops a setting with nothing left in it', () => {
    expect(patchRule(CONFIG, 'metamodel', { max: 3 }).rules!.metamodel).toEqual({ severity: 'error', max: 3 })
    expect(patchRule(CONFIG, 'requirement-without-scenario', { max: null }).rules!['requirement-without-scenario']).toBe('error')
    const once = patchRule({}, 'adr-incomplete', { max: 2 })
    expect(once.rules).toEqual({ 'adr-incomplete': { max: 2 } })
    expect(patchRule(once, 'adr-incomplete', { max: null })).toEqual({})
  })

  it('edits the test files test-unbound looks at', () => {
    const next = patchRule(CONFIG, 'test-unbound', { exclude: ['**/bench.spec.ts'] })
    expect(next.rules!['test-unbound']).toEqual({ severity: 'warning', include: ['apps/e2e/**'], exclude: ['**/bench.spec.ts'] })
    expect(patchRule(next, 'test-unbound', { exclude: [] }).rules!['test-unbound']).toEqual({ severity: 'warning', include: ['apps/e2e/**'] })
  })

  it('sets a goal in whole percent from 0 to 100, and removes it', () => {
    expect(setGoal(CONFIG, 'requirements-verified', 80.4).goals).toEqual({ 'requirements-verified': { min: 80 } })
    expect(setGoal({}, 'requirements-verified', 140).goals).toEqual({ 'requirements-verified': { min: 100 } })
    expect(setGoal(setGoal(CONFIG, 'requirements-verified', 80), 'requirements-verified', null)).toEqual(CONFIG)
  })

  it('shows a change as the lines that differ, with a little context', () => {
    const before = ['{', '  "a": 1,', '  "b": 2,', '  "c": 3,', '  "d": 4,', '  "e": 5,', '  "f": 6', '}'].join('\n')
    const after = before.replace('"e": 5', '"e": 7')
    expect(lineDiff(before, after, 1)).toEqual([
      { kind: ' ', text: '…' },
      { kind: ' ', text: '  "d": 4,' },
      { kind: '-', text: '  "e": 5,' },
      { kind: '+', text: '  "e": 7,' },
      { kind: ' ', text: '  "f": 6' },
      { kind: ' ', text: '…' },
    ])
  })
})
