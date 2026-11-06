// The fixture of three repositories (a library, a service that describes its
// API in OpenAPI, a storefront that uses both) and a folder that is no
// repository, copied to a temporary directory with a git repository each.

import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SHOP = fileURLToPath(new URL('./fixtures/shop', import.meta.url))
export const REPOSITORIES = ['orders-service', 'shop-lib', 'storefront']

/** A fresh copy of the fixture; its folder holds the three repositories and notes/. */
export function shop(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-')), 'shop')
  cpSync(SHOP, dir, { recursive: true })
  for (const repo of REPOSITORIES) execFileSync('git', ['init', '-q'], { cwd: join(dir, repo) })
  // The report names the test file absolutely, as Vitest does.
  const report = join(dir, 'storefront', 'reports', 'unit.json')
  writeFileSync(report, readFileSync(report, 'utf8').replace('/ABSOLUTE/storefront', join(dir, 'storefront')))
  return dir
}

export const LEGACY = fileURLToPath(new URL('./fixtures/legacy', import.meta.url))

/** A fresh copy of a VB6 project (billing-vb6), a git repository Assay reads no units of; its folder holds it. */
export function legacy(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-')), 'legacy')
  cpSync(LEGACY, dir, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: join(dir, 'billing-vb6') })
  return dir
}

export const POLYGLOT = fileURLToPath(new URL('./fixtures/polyglot', import.meta.url))

/** A fresh copy of a repository of many stacks: Maven, Go, Python, .NET with Aspire, a VB6 group, a Dockerfile, compose, Kubernetes, a .proto. */
export function polyglot(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-')), 'polyglot')
  cpSync(POLYGLOT, dir, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}
