// ─── Hub catalogue Vite plugin ───────────────────────────────────────────────
//
// Serves and bundles the catalogue under the /hub/ URL prefix the apps expect:
//
//   hub/<category>/<id>.radical — the concept documents themselves
//   hub/index.json  — summaries for browsing (built from the `hub` blocks)
//   hub-data.json   — legacy single-file catalogue for older desktop builds
//
// In dev these are served from memory by a middleware; at build time this
// plugin explicitly emits every file (the catalogue sits outside Vite's
// publicDir, so nothing copies it there implicitly). `.radical` files get an
// explicit JSON content type (the store rejects non-JSON responses).
//
// Configs import it through ../vite.cjs (the package's `./vite` export).

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { HUB_INDEX_FILE, toLegacyCatalogue } from '@radical/common/hubFormat'
import {
  CATALOGUE_DIR,
  HUB_DIR,
  LEGACY_FILE,
  buildIndex,
  readCatalogue,
  validateCatalogue,
  type CatalogueEntry,
} from './catalogue'

export function hubCataloguePlugin(opts: { hubDir?: string } = {}): Plugin {
  const dir = resolve(opts.hubDir ?? CATALOGUE_DIR)
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
      // reach them since the catalogue lives outside publicDir, so emit each
      // one explicitly, verbatim (raw bytes, not the parsed-then-restringified doc).
      for (const { file } of entries) {
        this.emitFile({ type: 'asset', fileName: `${HUB_DIR}/${file}`, source: readFileSync(join(dir, file), 'utf8') })
      }
    },
  }
}
