// ─── Hub catalogue ───────────────────────────────────────────────────────────
//
// The Architecture Hub's concept catalogue: one Radical Studio document per
// concept, at catalogue/<category>/<id>.radical (see hubFormat.ts in
// @radical/common). This module reads and validates it and builds the
// summaries index; ./vite serves and bundles it for the Hub and for Studio,
// which ships it for offline Hub import.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarize, type HubConceptSummary, type HubRadicalDoc } from '@radical/common/hubFormat'

/** Absolute path of the catalogue shipped with this package. */
export const CATALOGUE_DIR = fileURLToPath(new URL('../catalogue', import.meta.url))

export const HUB_DIR = 'hub'
export const LEGACY_FILE = 'hub-data.json'

export interface CatalogueEntry {
  file: string
  doc: HubRadicalDoc
}

export function readCatalogue(dir: string = CATALOGUE_DIR): CatalogueEntry[] {
  const out: CatalogueEntry[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.radical')) {
        out.push({ file: relative(dir, p).split('\\').join('/'), doc: JSON.parse(readFileSync(p, 'utf8')) })
      }
    }
  }
  walk(dir)
  return out
}

export function validateCatalogue(entries: CatalogueEntry[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const { file, doc } of entries) {
    const meta = doc.hub
    if (!meta || typeof meta !== 'object') { errors.push(`${file}: missing "hub" block`); continue }
    if (!Array.isArray(doc.nodes) || doc.nodes.length === 0) errors.push(`${file}: "nodes" must be a non-empty array`)
    if (!meta.id || !meta.category || !meta.name) errors.push(`${file}: hub.id / hub.category / hub.name are required`)
    if (file !== `${meta.category}/${meta.id}.radical`) errors.push(`${file}: expected path ${meta.category}/${meta.id}.radical`)
    if (ids.has(meta.id)) errors.push(`${file}: duplicate id "${meta.id}"`)
    ids.add(meta.id)
    // Every {{KEY}} placeholder must be declared at concept or node level.
    const declared = new Set((meta.templateParams ?? []).map((p) => p.key))
    for (const n of doc.nodes ?? []) {
      const nodeKeys = new Set([...declared, ...((n.templateParams as Array<{ key: string }> | undefined) ?? []).map((p) => p.key)])
      for (const v of Object.values(n)) {
        if (typeof v !== 'string') continue
        for (const m of v.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) {
          if (!nodeKeys.has(m[1])) errors.push(`${file}: node "${n.id}" uses undeclared template param {{${m[1]}}}`)
        }
      }
    }
  }
  for (const { file, doc } of entries) {
    for (const ref of doc.hub?.hubRefs ?? []) if (!ids.has(ref)) errors.push(`${file}: hubRefs → unknown concept "${ref}"`)
  }
  return errors
}

export function buildIndex(entries: CatalogueEntry[]): HubConceptSummary[] {
  return entries.map(({ file, doc }) => summarize(doc, file))
}
