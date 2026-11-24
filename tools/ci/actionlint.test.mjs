// Fitness function "Workflows pass actionlint": actionlint, pinned, finds
// nothing in this repository's workflows and refuses a broken one. It runs
// actionlint's Docker image where Docker runs (CI), else its release binary.
import { describe, expect, it } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { runActionlint } from './actionlint.mjs'

const ROOT = join(import.meta.dirname, '../..')

describe('Workflows pass actionlint', () => {
  it('finds nothing in the repository\'s workflows', async () => {
    const { code, output } = await runActionlint({ root: ROOT })
    expect(code, output).toBe(0)
  }, 180_000)

  it('Broken workflow refused: a job whose needs names a job that does not exist fails, naming the file and line', async () => {
    const root = mkdtempSync(join(tmpdir(), 'radical-actionlint-'))
    // mkdtemp makes it 0700: actionlint's image, not run as this user, could
    // not read it (a fatal error, exit code 3, not findings).
    chmodSync(root, 0o755)
    mkdirSync(join(root, '.github/workflows'), { recursive: true, mode: 0o755 })
    writeFileSync(join(root, '.github/workflows/ci.yml'), `name: CI
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
  deploy:
    needs: [tests]
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy
`)
    const { code, output } = await runActionlint({ root, args: ['.github/workflows/ci.yml'] })
    expect(code).toBe(1)
    expect(output).toMatch(/\.github\/workflows\/ci\.yml:8:\d+: job "deploy" needs job "tests" which does not exist/)
  }, 180_000)

  it('runs in ci.yml as a job the gate job ci needs', () => {
    const ci = yaml.load(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'))
    expect(ci.jobs.workflows.steps.map((s) => s.run).filter(Boolean)).toContain('npm run lint:workflows')
    expect(ci.jobs.ci.needs).toContain('workflows')
  })
})
