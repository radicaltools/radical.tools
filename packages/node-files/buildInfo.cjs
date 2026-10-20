// ─── Build info ──────────────────────────────────────────────────────────────
//
// What a build of radical.tools is, taken when it is built: the product
// version from the app's package.json, the commit and the date. Every app's
// build config (tsup, electron-vite, Vite, Vitest) passes buildDefine() as its
// `define`, and @radical/common/version reads it at run time.
//
// Plain CommonJS, not TypeScript, so that build configs can load it before
// anything is compiled, Studio's (loaded as CommonJS) too, as
// @radical/hub-catalogue/vite does.

'use strict'

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

/** The git output of `args` run in `cwd`, or undefined outside git. */
function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

/** The build of the app whose package.json is in `packageDir`: its version,
 *  the commit checked out (short), the day, and whether the commit is the
 *  one tagged v<version>, the release. `env` and `now` are for tests. */
function buildInfo(packageDir, env = process.env, now = new Date()) {
  const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  const commit = env.RADICAL_COMMIT || git(packageDir, ['rev-parse', '--short=7', 'HEAD']) || env.GITHUB_SHA?.slice(0, 7) || undefined
  const tag = `v${version}`
  const tags = env.RADICAL_TAGS !== undefined ? env.RADICAL_TAGS : git(packageDir, ['tag', '--points-at', 'HEAD'])
  const release = env.GITHUB_REF_NAME === tag || (tags ?? '').split(/\s+/).includes(tag)
  return { version, ...(commit ? { commit } : {}), date: now.toISOString().slice(0, 10), release }
}

/** The `define` that hands buildInfo(packageDir) to the bundle. */
function buildDefine(packageDir, env = process.env, now = new Date()) {
  return { __RADICAL_BUILD__: JSON.stringify(buildInfo(packageDir, env, now)) }
}

module.exports = { buildInfo, buildDefine }
