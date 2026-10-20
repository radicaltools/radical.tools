import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDefine, buildInfo } from '../buildInfo.cjs'

const NOW = new Date('2026-10-20T12:00:00Z')
let dir: string | undefined

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

/** A git repository holding a package.json of `version`, committed once. */
async function repo(version: string): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'radical-build-'))
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init')
  return dir
}

describe('build info', () => {
  it('names the version, the commit and the day, and a release only on the commit tagged v<version>', async () => {
    const folder = await repo('0.3.0')
    const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: folder, encoding: 'utf8' }).trim()
    expect(buildInfo(folder, {}, NOW)).toEqual({ version: '0.3.0', commit, date: '2026-10-20', release: false })

    execFileSync('git', ['tag', 'v0.3.0'], { cwd: folder })
    expect(buildInfo(folder, {}, NOW)).toMatchObject({ commit, release: true })
    // Another tag on the commit is no release of this version.
    expect(buildInfo(folder, { RADICAL_TAGS: 'v0.2.0' }, NOW).release).toBe(false)
    // A tag push in GitHub Actions.
    expect(buildInfo(folder, { RADICAL_TAGS: '', GITHUB_REF_NAME: 'v0.3.0' }, NOW).release).toBe(true)
  })

  it('outside git takes the commit from the environment, or has none', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-build-'))
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '0.3.0' }))
    const env = { RADICAL_TAGS: '' }
    expect(buildInfo(dir, env, NOW)).toEqual({ version: '0.3.0', date: '2026-10-20', release: false })
    expect(buildInfo(dir, { ...env, GITHUB_SHA: '0123456789abcdef' }, NOW).commit).toBe('0123456')
    expect(buildInfo(dir, { ...env, RADICAL_COMMIT: 'feedbee' }, NOW).commit).toBe('feedbee')
  })

  it('hands the build to the bundle as one define', async () => {
    const folder = await repo('0.3.0')
    const define = buildDefine(folder, { RADICAL_TAGS: '' }, NOW)
    expect(Object.keys(define)).toEqual(['__RADICAL_BUILD__'])
    expect(JSON.parse(define.__RADICAL_BUILD__)).toMatchObject({ version: '0.3.0', date: '2026-10-20', release: false })
  })
})
