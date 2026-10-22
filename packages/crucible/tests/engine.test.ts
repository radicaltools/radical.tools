import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Fuzzer, fuzzOptionsFromEnv, knownMatches, pathShape, signatureOf, type Finding, type FuzzOptions, type SurveyRecord } from '../src/index'
import { counterSuite, type CounterAction } from './counter'

const options = (more: Partial<FuzzOptions> = {}): FuzzOptions => ({ ...fuzzOptionsFromEnv({}), ...more })

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('runWorld', () => {
  it('runs a world\'s plan and counts runs, steps and steps that found nothing to act on', async () => {
    const fuzzer = new Fuzzer(counterSuite(), options())
    const result = await fuzzer.runWorld('zero')
    expect(result).toMatchObject({ world: 'zero', seed: 7, runs: 60 })
    expect(fuzzer.brokenIn('zero').size).toBe(0)
    expect(fuzzer.stats.runs).toBe(60)
    expect(fuzzer.stats.steps).toBeGreaterThanOrEqual(60)
    expect(fuzzer.stats.noOps).toBeGreaterThan(0)
    expect(fuzzer.summary()).toMatch(/^counter: 60 runs, \d+ steps \(\d+ found nothing to act on\)\nseeds: zero 7$/)
  })

  it('shrinks a broken rule to its shortest sequence and names the rule, the steps and what differs', async () => {
    const fuzzer = new Fuzzer(counterSuite({ bound: true }), options())
    const error = await fuzzer.runWorld('zero').then(() => null, (e: Error) => e)
    expect(error?.message).toContain('zero: [bounded]')
    expect(error?.message).toMatch(/took the counter past 20:\n {6}n: \d+ → \d+/)
    expect(error?.message).toContain('steps (as resolved):\n    1. ')
    expect(fuzzer.brokenIn('zero')).toEqual(new Set(['bounded']))
    // Shrunk: no Undo, which only holds the counter back, is left in the sequence.
    expect(/Counterexample: (.*)/.exec(error!.message)![1]).not.toMatch(/undo/)
  })

  it('replays a counterexample from its seed and path', async () => {
    const first = await new Fuzzer(counterSuite({ bound: true }), options()).runWorld('zero').then(() => null, (e: Error) => e)
    const [, seed, path] = /seed: (-?\d+), path: "([^"]+)"/.exec(first!.message)!
    const replay = new Fuzzer(counterSuite({ bound: true }), options({ seed: Number(seed), path, noShrink: true }))
    const again = await replay.runWorld('zero').then(() => null, (e: Error) => e)
    const steps = (e: Error) => e.message.slice(e.message.indexOf('steps (as resolved)')).split('\n').filter((l) => /^ {4}\d+\./.test(l))
    expect(steps(again!)).toEqual(steps(first!))
    expect(replay.stats.runs).toBe(1)
  })
})

describe('known failures', () => {
  it('ends a run that breaks a known rule quietly and counts the hit', async () => {
    const known = { rule: 'bounded', note: 'K1: the counter goes past 20' }
    const fuzzer = new Fuzzer(counterSuite({ bound: true }, [known]), options())
    await fuzzer.runWorld('zero')
    expect(fuzzer.brokenIn('zero').size).toBe(0)
    expect(fuzzer.knownHits.get(known)).toBeGreaterThan(0)
    expect(fuzzer.summary()).toMatch(/known violations hit: \d+× K1: the counter goes past 20/)
  })

  it('matches by last action, earlier actions, difference paths and facts', () => {
    const actions: CounterAction[] = [{ a: 'inc', by: 1 }, { a: 'undo' }, { a: 'double' }]
    const violation = { rule: 'reloadKeeps', detail: '', differences: [{ path: 'views.v1.positions.a.x', was: 1, now: 2 }], facts: { overlap: true } }
    const matches = (k: Parameters<typeof knownMatches<CounterAction>>[0]) => knownMatches(k, { actions, violation, trace: [] })
    expect(matches({ rule: 'reloadKeeps', note: '' })).toBe(true)
    expect(matches({ rule: 'geometry', note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', last: 'double', note: '' })).toBe(true)
    expect(matches({ rule: 'reloadKeeps', last: ['inc', 'undo'], note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', after: ['inc', 'undo'], note: '' })).toBe(true)
    expect(matches({ rule: 'reloadKeeps', after: ['inc', 'reload'], note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', paths: ['views.*.positions.**'], note: '' })).toBe(true)
    expect(matches({ rule: 'reloadKeeps', paths: ['defaultPositions.**'], note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', paths: ['views.*'], note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', facts: { overlap: true }, note: '' })).toBe(true)
    expect(matches({ rule: 'reloadKeeps', facts: { overlap: true, outside: true }, note: '' })).toBe(false)
    expect(matches({ rule: 'reloadKeeps', last: 'double', after: ['undo'], paths: ['views.**'], facts: { outside: false }, match: ({ trace }) => trace.length === 0, note: '' })).toBe(true)
    expect(matches({ rule: 'reloadKeeps', match: () => false, note: '' })).toBe(false)
  })

  it('lists the known entries no run hit', async () => {
    const hit = { rule: 'bounded', note: 'K1: the counter goes past 20' }
    const never = { rule: 'undoRestores', note: 'K2: Undo of a doubling' }
    const fuzzer = new Fuzzer(counterSuite({ bound: true }, [hit, never]), options())
    await fuzzer.runWorld('zero')
    expect(fuzzer.summary()).toContain('known entries no run hit: K2: Undo of a doubling')
  })
})

describe('survey', () => {
  it('reports each new signature once and goes on', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crucible-survey-'))
    dirs.push(dir)
    const findingsFile = join(dir, 'findings.jsonl')
    const surveyFile = join(dir, 'survey.txt')
    const fuzzer = new Fuzzer(counterSuite({ bound: true, undoOfDouble: true }, [], { seed: 3, runs: 200, maxLength: 12 }), options({ survey: true, surveyFile, findingsFile }))
    await fuzzer.runWorld('zero')
    const records = readFileSync(findingsFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as SurveyRecord)
    expect(records.length).toBeGreaterThanOrEqual(2)
    expect(new Set(records.map((r) => r.signature)).size).toBe(records.length)
    expect(new Set(records.map((r) => r.rule))).toEqual(new Set(['bounded', 'undoRestores']))
    for (const r of records) {
      expect(r).toMatchObject({ suite: 'counter', file: 'tests/counter.ts', world: 'zero', seed: 3, length: 12 })
      expect(r.steps.length).toBe(r.actions.length)
      expect(r.sequence.length).toBe(r.actions.length)
      expect(r.path).toMatch(/^\d+(:\d+)*$/)
    }
    expect(readFileSync(surveyFile, 'utf8')).toContain('===== SURVEY zero #1')
    expect(fuzzer.brokenIn('zero')).toEqual(new Set(['bounded', 'undoRestores']))
  })
})

describe('replay', () => {
  const finding = (id: string, status: Finding['status'], more: Partial<Finding> = {}): Finding => ({
    id, title: 'the counter goes past 20', source: 'fuzz', status, rule: 'bounded', signature: 'bounded|inc|n', file: 'tests/counter.ts', world: 'zero',
    sequence: [{ a: 'inc', by: 3 }, { a: 'double' }, { a: 'double' }, { a: 'inc', by: 3 }, { a: 'double' }], found: '2026-10-22', steps: [], detail: '', ...more,
  })

  it('replays a finding\'s sequence without the known list', async () => {
    const known = { rule: 'bounded', note: 'K1: the counter goes past 20' }
    const fuzzer = new Fuzzer(counterSuite({ bound: true }, [known]), options())
    const [regression] = fuzzer.regressions([finding('F-0001', 'hardened')])
    const error = await fuzzer.replay(regression.world, regression.sequence).then(() => null, (e: Error) => e)
    expect(error?.message).toContain('zero: [bounded] double took the counter past 20')
    expect(error?.message).toContain('    5. double 15 → 30')
    expect(fuzzer.knownHits.size).toBe(0)
    // Fixed: the same steps pass.
    await new Fuzzer(counterSuite({}, [known]), options()).replay('zero', regression.sequence)
  })

  it('makes a case of each hardened or fixed finding of the suite\'s file', () => {
    const fuzzer = new Fuzzer(counterSuite(), options())
    const cases = fuzzer.regressions([
      finding('F-0001', 'hardened'),
      finding('F-0002', 'fixed', { title: 'Undo of a doubling' }),
      finding('F-0003', 'open'),
      finding('F-0004', 'hardened', { file: 'tests/other.ts' }),
      finding('F-0005', 'hardened', { sequence: undefined }),
      finding('F-0006', 'hardened', { world: 'one' }),
    ])
    expect(cases.map((c) => [c.name, c.world])).toEqual([['F-0001 stays fixed: the counter goes past 20', 'zero'], ['F-0002 stays fixed: Undo of a doubling', 'zero']])
  })
})

describe('signatures', () => {
  it('is the rule, the last action and the shape of what differs, without ids', () => {
    const ids = ['views', 'positions', 'defaultPositions']
    expect(pathShape('views.v1.positions.a.x', ids)).toBe('views.*.positions.*.x')
    expect(pathShape('sequences.s1.relationIds[2]', ['sequences'])).toBe('sequences.*.relationIds[*]')
    const violation = { rule: 'reloadKeeps', detail: '', differences: [
      { path: 'views.v1.positions.a.x', was: 1, now: 2 },
      { path: 'views.v2.positions.b.y', was: 1, now: 2 },
      { path: 'defaultPositions.c.x', was: 1, now: 2 },
    ] }
    expect(signatureOf(violation, 'add', ids)).toBe('reloadKeeps|add|defaultPositions.*,views.*')
    expect(signatureOf({ rule: 'geometry', detail: '', shapes: ['overlap'] }, 'drag')).toBe('geometry|drag|overlap')
    expect(signatureOf({ rule: 'noErrors', detail: '' }, undefined)).toBe('noErrors|-|')
  })
})
