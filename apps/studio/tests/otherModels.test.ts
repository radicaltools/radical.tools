// The other models of a federation, as the toolbar lists them: the versions
// deps.json pins, those fetched, and what is wrong.
import { describe, it, expect } from 'vitest'
import { otherModelsSummary } from '../src/renderer/src/persistence/otherModels'
import type { OtherModels } from '../src/renderer/src/store/documentStore'
import type { Dependency, FederationFile } from '@radical/common/federation'

const pin = (name: string, ref: string, repo = `../${name}`): Dependency => ({ name, repo, path: 'architecture', ref })

const deps = (...dependencies: Dependency[]): OtherModels['deps'] => ({ name: 'payments', dependencies })

const fetched = (dependencies: FederationFile['dependencies']): FederationFile => ({
  version: 2, name: 'payments', fetchedAt: '2026-11-01T10:00:00.000Z', dependencies, notes: [], nodes: [], relations: [],
})

const others = (o: Partial<OtherModels>): OtherModels => ({ deps: null, depsError: null, fetched: null, fetchedUnreadable: false, ...o })

describe('otherModelsSummary', () => {
  it('is null for a model with no deps.json', () => {
    expect(otherModelsSummary(others({}))).toBeNull()
  })

  it('lists the models fetched at their pins as ok', () => {
    const summary = otherModelsSummary(others({
      deps: deps(pin('orders', 'main'), pin('billing', 'v2.0.0')),
      fetched: fetched([{ ...pin('orders', 'main'), commit: 'abc1234def' }, { ...pin('billing', 'v2.0.0'), commit: 'fed9876abc' }]),
    }))
    expect(summary).toEqual({
      rows: [
        { name: 'orders', pinned: 'main', fetched: 'abc1234', status: 'ok' },
        { name: 'billing', pinned: 'v2.0.0', fetched: 'fed9876', status: 'ok' },
      ],
      problems: [],
      fetchedAt: '2026-11-01T10:00:00.000Z',
    })
  })

  it('says which model is not fetched', () => {
    const summary = otherModelsSummary(others({
      deps: deps(pin('orders', 'main'), pin('billing', 'v2.0.0')),
      fetched: fetched([{ ...pin('orders', 'main'), commit: 'abc1234def' }]),
    }))
    expect(summary?.rows[1]).toEqual({ name: 'billing', pinned: 'v2.0.0', fetched: null, status: 'not-fetched' })
    expect(summary?.problems).toEqual(['billing is not fetched.'])
  })

  it('says which model was pinned anew since the fetch', () => {
    const summary = otherModelsSummary(others({
      deps: deps(pin('billing', 'v2.0.0')),
      fetched: fetched([{ ...pin('billing', 'v1.0.0'), commit: 'fed9876abc' }]),
    }))
    expect(summary?.rows).toEqual([{ name: 'billing', pinned: 'v2.0.0', fetched: 'v1.0.0', status: 'pinned-anew' }])
    expect(summary?.problems).toEqual(['billing is pinned at v2.0.0 but v1.0.0 is fetched.'])
  })

  it('says when nothing is fetched yet', () => {
    const summary = otherModelsSummary(others({ deps: deps(pin('orders', 'main'), pin('billing', 'v2.0.0')) }))
    expect(summary?.rows.map((r) => r.status)).toEqual(['not-fetched', 'not-fetched'])
    expect(summary?.problems).toEqual(['Nothing is fetched yet.'])
    expect(summary?.fetchedAt).toBeUndefined()
  })

  it('puts a model fetched through another after it, with the model that names it', () => {
    const summary = otherModelsSummary(others({
      deps: deps(pin('orders', 'main'), pin('billing', 'v2.0.0')),
      fetched: fetched([
        { ...pin('orders', 'main'), commit: 'abc1234def' },
        { ...pin('billing', 'v2.0.0'), commit: 'fed9876abc' },
        { ...pin('stock', 'v3.0.0'), commit: '77ab1200aa', via: 'orders' },
      ]),
    }))
    expect(summary?.rows.map((r) => r.name)).toEqual(['orders', 'stock', 'billing'])
    expect(summary?.rows[1]).toEqual({ name: 'stock', pinned: 'v3.0.0', fetched: '77ab120', via: 'orders', status: 'ok' })
    expect(summary?.problems).toEqual([])
  })

  it('says why deps.json does not read', () => {
    const summary = otherModelsSummary(others({ depsError: 'deps.json does not parse: Unexpected token' }))
    expect(summary).toEqual({ rows: [], problems: ['deps.json does not parse: Unexpected token'] })
  })
})
