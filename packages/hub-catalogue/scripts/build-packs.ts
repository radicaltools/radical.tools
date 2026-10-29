// Builds catalogue/concern/<id>.radical from the concern pack specs
// (packs/<group>/<id>.ts), and reports what each pack lacks of the standard.
//
//   npx tsx scripts/build-packs.ts                    build every spec
//   npx tsx scripts/build-packs.ts packs/data/x.ts    build only these specs
//   npx tsx scripts/build-packs.ts --check            fail when a file is not what its spec builds
//
// A spec that does not load, falls below the standard or, imported and bound
// with some answers, leaves radical check something to report is named with
// what is wrong and its file is left as it is; the exit status is then 1.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { concernPackProblems } from '@radical/common/concerns'
import { buildPackDoc, packFile, packFileText, specProblems, type PackSpec } from '../src/packSpec'
import { CATALOGUE_DIR } from '../src/catalogue'
import { boundImportProblems } from '../src/packCheck'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const check = args.includes('--check')
const only = args.filter((a) => !a.startsWith('--')).map((a) => resolve(a))

function specFiles(dir: string): string[] {
  return readdirSync(dir).sort().flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? specFiles(p) : name.endsWith('.ts') ? [p] : []
  })
}

let failed = false
for (const file of only.length ? only : specFiles(join(root, 'packs'))) {
  const name = relative(root, file)
  let spec: PackSpec
  try {
    spec = (await import(pathToFileURL(file).href)).default as PackSpec
  } catch (error) {
    console.error(`✖ ${name}: does not load: ${(error as Error).message}`)
    failed = true
    continue
  }
  const doc = buildPackDoc(spec)
  const problems = [...concernPackProblems(doc), ...specProblems(spec)]
  if (!problems.length) problems.push(...boundImportProblems(doc))
  if (problems.length) {
    console.error(`✖ ${name} (${spec.id}):\n${problems.map((p) => `    - ${p}`).join('\n')}`)
    failed = true
    continue
  }
  const target = join(CATALOGUE_DIR, packFile(spec))
  const text = packFileText(spec)
  let current = ''
  try { current = readFileSync(target, 'utf8') } catch { /* new pack */ }
  if (check) {
    if (current !== text) { console.error(`✖ ${packFile(spec)} is not what ${name} builds; run scripts/build-packs.ts`); failed = true }
    continue
  }
  if (current !== text) writeFileSync(target, text)
  console.log(`✓ ${name} → ${packFile(spec)}`)
}
process.exit(failed ? 1 : 0)
