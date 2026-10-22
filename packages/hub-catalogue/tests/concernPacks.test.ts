/**
 * Concern packs — the Hub's packs of one concern each (catalogue/concern),
 * built from their specs (packs/<group>/<id>.ts).
 *
 *   - every pack's trigger runs, it asks questions, and its slice is connected
 *   - every pack meets the standard, and every group has packs
 *   - imported with every combination of answers and bound to an element its
 *     trigger finds, it settles its concern and brings in nothing the check
 *     flags but the tests the team still has to name
 *   - every file is what its spec builds
 */
import { describe, it, expect } from 'vitest'
import { readCatalogue, validateCatalogue, concernPacksOf } from '../src/catalogue'
import { concernPackProblems, CONCERN_GROUPS } from '@radical/common/concerns'
import { buildPackDoc, packFile, packFileText, type PackSpec } from '../src/packSpec'
import { boundImportProblems } from '../src/packCheck'

const entries = readCatalogue()
const packs = entries.filter(({ doc }) => doc.hub.category === 'concern')
const specs = Object.values(import.meta.glob<{ default: PackSpec }>('../packs/**/*.ts', { eager: true })).map((m) => m.default)

describe('concern packs', () => {
  it('every pack has a trigger that parses, questions and a connected slice', () => {
    expect(packs.length).toBeGreaterThan(0)
    expect(validateCatalogue(entries)).toEqual([])
    expect(concernPacksOf(entries).map((p) => p.id)).toEqual(packs.map(({ doc }) => doc.hub.id))
  })

  it('every pack meets the standard, and every group has packs', () => {
    for (const { file, doc } of packs) expect(concernPackProblems(doc), file).toEqual([])
    const groups = new Set(packs.map(({ doc }) => doc.hub.concern?.group))
    for (const g of CONCERN_GROUPS) expect(groups.has(g.id), `group ${g.id} has no pack`).toBe(true)
  })

  it('every pack imported and bound passes radical check', () => {
    for (const { file, doc } of packs) expect(boundImportProblems(doc), file).toEqual([])
  })

  it('every pack is what its spec builds', () => {
    expect(specs.map((s) => packFile(s)).sort()).toEqual(packs.map((p) => p.file).sort())
    for (const spec of specs) {
      expect(JSON.stringify(packs.find((p) => p.file === packFile(spec))?.doc), `${packFile(spec)}: run npm run build:packs -w @radical/hub-catalogue`)
        .toBe(JSON.stringify(JSON.parse(packFileText(spec))))
      expect(buildPackDoc(spec).hub.concern?.group, spec.id).toBe(spec.group)
    }
  })
})
