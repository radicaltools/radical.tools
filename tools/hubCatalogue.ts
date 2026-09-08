// ─── Hub catalogue build plugin ──────────────────────────────────────────────
//
// The catalogue is a folder of Radical Studio documents (top-level
// hub/<category>/<id>.radical, see hubFormat.ts) — content curated by
// contributors, kept at the repo root alongside website/ and docs/ rather
// than inside src/renderer, since it isn't app source. This plugin serves
// and bundles it under the same /hub/ URL prefix the app already expects:
//
//   hub/<category>/<id>.radical — the concept documents themselves
//   hub/index.json  — summaries for browsing (built from the `hub` blocks)
//   hub-data.json   — legacy single-file catalogue for older desktop builds
//
// In dev these are served from memory by a middleware; at build time this
// plugin explicitly emits every file (the source directory sits outside
// Vite's publicDir, so nothing copies it there implicitly). `.radical`
// files get an explicit JSON content type (the store rejects non-JSON
// responses).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import {
  HUB_INDEX_FILE,
  summarize,
  toLegacyCatalogue,
  type HubConceptSummary,
  type HubRadicalDoc,
} from '../src/renderer/src/hub/hubFormat'

export const HUB_DIR = 'hub'
export const LEGACY_FILE = 'hub-data.json'

export interface CatalogueEntry {
  file: string
  doc: HubRadicalDoc
}

export function readCatalogue(dir: string): CatalogueEntry[] {
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

export function hubCataloguePlugin(opts: { hubDir: string }): Plugin {
  const dir = resolve(opts.hubDir)
  const load = (): CatalogueEntry[] => {
    const entries = readCatalogue(dir)
    const errors = validateCatalogue(entries)
    if (errors.length) throw new Error(`Hub catalogue invalid:\n  ${errors.join('\n  ')}`)
    return entries
  }
  const indexJson = (e: CatalogueEntry[]): string => JSON.stringify(buildIndex(e))
  const legacyJson = (e: CatalogueEntry[]): string => JSON.stringify(toLegacyCatalogue(e.map((x) => x.doc)))

  return {
    name: 'radical:hub-catalogue',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0])
        const send = (body: string): void => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(body)
        }
        try {
          if (url === `/${HUB_DIR}/${HUB_INDEX_FILE}`) return send(indexJson(load()))
          if (url === `/${LEGACY_FILE}`) return send(legacyJson(load()))
          if (url.startsWith(`/${HUB_DIR}/`) && url.endsWith('.radical')) {
            const p = resolve(dir, '.' + url.slice(HUB_DIR.length + 1))
            if (!p.startsWith(dir + '/')) { res.statusCode = 403; return res.end() }
            if (existsSync(p)) return send(readFileSync(p, 'utf8'))
          }
        } catch (err) {
          res.statusCode = 500
          return res.end(err instanceof Error ? err.message : String(err))
        }
        next()
      })
    },
    generateBundle() {
      const entries = load()
      this.emitFile({ type: 'asset', fileName: `${HUB_DIR}/${HUB_INDEX_FILE}`, source: indexJson(entries) })
      this.emitFile({ type: 'asset', fileName: LEGACY_FILE, source: legacyJson(entries) })
      // The concept documents themselves — Vite's publicDir copy doesn't
      // reach them since hubDir now lives outside publicDir, so emit each
      // one explicitly, verbatim (raw bytes, not the parsed-then-restringified doc).
      for (const { file } of entries) {
        this.emitFile({ type: 'asset', fileName: `${HUB_DIR}/${file}`, source: readFileSync(join(dir, file), 'utf8') })
      }
    },
  }
}
