// ─── Product version ─────────────────────────────────────────────────────────
//
// radical.tools has one product version: the CLI, the MCP server, the Desktop
// app, the VS Code extension and Studio on the web all carry it (ADR "Product
// and format versioning"). Each build hands what it is to the bundle as
// __RADICAL_BUILD__ (buildDefine in @radical/node-files/buildInfo): the
// version, the commit and the day it was built from, and whether that commit
// is the release tagged v<version>. Code that runs without a build (a test
// without the define) gets DEV_BUILD.

export interface BuildInfo {
  /** The product version, from the app's package.json. */
  version: string
  /** The commit it was built from (short), when it was built in git. */
  commit?: string
  /** The day it was built (YYYY-MM-DD). */
  date?: string
  /** Built from the commit tagged v<version>. */
  release?: boolean
}

declare const __RADICAL_BUILD__: BuildInfo | undefined

export const DEV_BUILD: BuildInfo = { version: '0.0.0-dev' }

/** The build this code is part of. */
export function buildInfo(): BuildInfo {
  return typeof __RADICAL_BUILD__ !== 'undefined' && __RADICAL_BUILD__ ? __RADICAL_BUILD__ : DEV_BUILD
}

/** The version as a build shows it: the bare version for a release, with
 *  its commit as SemVer build metadata otherwise (0.3.0+1a2b3c4). */
export function displayVersion(info: BuildInfo = buildInfo()): string {
  return info.release || !info.commit ? info.version : `${info.version}+${info.commit}`
}

/** The version without build metadata: two builds of 0.3.0 from other
 *  commits are the same version. */
export function releaseOf(version: string): string {
  return version.split('+')[0].trim()
}

/** Compares two versions by SemVer precedence, build metadata left out:
 *  negative when `a` is older, 0 when they are the same version, positive
 *  when `a` is newer. A pre-release (0.3.0-beta.1) comes before its release. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): { core: number[]; pre: string[] } => {
    const [core, ...pre] = releaseOf(v).split('-')
    return { core: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre.join('-') ? pre.join('-').split('.') : [] }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0)
    if (d) return d
  }
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i]
    const q = y.pre[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    const pn = /^\d+$/.test(p)
    const qn = /^\d+$/.test(q)
    if (pn && qn) return Number(p) - Number(q)
    if (pn) return -1
    if (qn) return 1
    return p < q ? -1 : 1
  }
  return 0
}
