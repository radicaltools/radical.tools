import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { C4Node } from '@radical/common/c4'
import { existingCodeCheckConfig, serializeCheckConfig } from '@radical/common/check'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const requirement = (id: string, label: string): C4Node =>
  ({ id, type: 'requirement', label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ears_type: 'ubiquitous', action: `let a user ${label.toLowerCase()}` }) as unknown as C4Node

/** A model folder `model/` of existing code: two requirements no scenario verifies. */
async function modelOfExistingCode(config?: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-adopt-'))
  dirs.push(cwd)
  const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [requirement('r1', 'Sign in'), requirement('r2', 'Sign out')], relations: [] }, 'Shop')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  if (config !== undefined) await writeFile(join(cwd, 'model', 'check.json'), config)
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical check --adopt', () => {
  it('fails while check.json waits for its baselines, takes them once with --adopt, and passes after', async () => {
    const cwd = await modelOfExistingCode(serializeCheckConfig(existingCodeCheckConfig()))
    const pending = await run(cwd, 'check', 'model')
    expect(pending.code).toBe(1)
    expect(pending.out).toContain('run radical check --adopt and commit check.json')

    const adopt = await run(cwd, 'check', 'model', '--adopt')
    expect(adopt.code).toBe(0)
    expect(adopt.err).toContain('requirement-without-scenario max 2')
    const config = JSON.parse(await readFile(join(cwd, 'model', 'check.json'), 'utf8'))
    expect(config.adopt).toBeUndefined()
    expect(config.rules['requirement-without-scenario']).toEqual({ severity: 'error', max: 2 })

    expect((await run(cwd, 'check', 'model')).code).toBe(0)
    const again = await run(cwd, 'check', 'model', '--adopt')
    expect(again.code).toBe(2)
    expect(again.err).toContain('only radical check --ratchet lowers them')
  })

  it('writes the profile for existing code and adopts at once where there is no check.json', async () => {
    const cwd = await modelOfExistingCode()
    expect((await run(cwd, 'check', 'model', '--adopt')).code).toBe(0)
    const config = JSON.parse(await readFile(join(cwd, 'model', 'check.json'), 'utf8'))
    expect(config.rules['requirement-without-scenario']).toEqual({ severity: 'error', max: 2 })
    expect(config.rules['adr-incomplete']).toBe('error')
  })

  it('refuses --adopt with --ratchet', async () => {
    const cwd = await modelOfExistingCode()
    expect((await run(cwd, 'check', 'model', '--adopt', '--ratchet')).code).toBe(2)
  })
})
