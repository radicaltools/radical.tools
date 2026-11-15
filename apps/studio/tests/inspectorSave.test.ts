/**
 * Saving the Inspector's Settings writes what Settings changed over the
 * files as they are, not over the copy Studio last polled: an agent may
 * have written radical.json or check.json since.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documents } from '../src/renderer/src/store/documentStore'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { parseRepositoryFile, serializeRepositoryFile, type RepositoryFile } from '@radical/common/repositoryMapping'
import { patchRule } from '../src/renderer/src/components/inspector/settingsDraft'
import { saveCheckConfig, setSettingsDraft, useInspectorStore } from '../src/renderer/src/persistence/inspector'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { withRepositorySettings, type CheckConfig } from '@radical/common/check'

class MemLS {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, String(v)) }
  removeItem(k: string): void { this.map.delete(k) }
  clear(): void { this.map.clear() }
  key(i: number): string | null { return [...this.map.keys()][i] ?? null }
  get length(): number { return this.map.size }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

const REPOSITORY: RepositoryFile = {
  implements: [],
  verifies: [{ element: 'pays', name: 'Pays', tests: ['tests/pay.test.ts › pays by card'] }],
  tests: { include: ['tests/**'] },
}

/** A folder model with its check.json and radical.json; `files` is the disk. */
async function openRepository(config: CheckConfig) {
  const files: { config: string | null; repository: string | null } = {
    config: JSON.stringify(config, null, 2) + '\n',
    repository: serializeRepositoryFile(REPOSITORY),
  }
  const writes = { config: 0, repository: 0 }
  ;(globalThis as any).window.electronAPI = {
    readFolder: vi.fn(async () => ({ success: true, files: serializeToMdFolder({ nodes: [], relations: [], views: [] }, 'model') })),
    readFile: vi.fn(async () => ({ success: false })),
    writeFolder: vi.fn(async () => ({ success: true })),
    watchFolder: vi.fn(async () => {}),
    onFolderChanged: vi.fn(() => {}),
    readCheckFiles: vi.fn(async () => ({ success: true, results: null, measurements: null, reviews: null, ...files })),
    writeCheckConfig: vi.fn(async (_: string, content: string) => { files.config = content; writes.config++; return { success: true } }),
    writeRepositoryFile: vi.fn(async (_: string, content: string) => { files.repository = content; writes.repository++; return { success: true } }),
  }
  documents.createMdDocument(`/tmp/repo-${Math.random().toString(36).slice(2)}`)
  await settle()
  // What the Inspector's poll read.
  useInspectorStore.setState({ config })
  useDiagramStore.setState({ repository: parseRepositoryFile(files.repository!) })
  return { files, writes }
}

/** The Settings as the tab shows them before an edit (SettingsTab). */
const shown = (): CheckConfig => {
  const { config } = useInspectorStore.getState()
  const { repository } = useDiagramStore.getState()
  return { ...config, rules: withRepositorySettings(config.rules ?? {}, repository?.tests), ...(repository?.ci ? { ci: repository.ci } : {}) }
}

describe('saving the Inspector\'s Settings', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = new MemLS()
  })

  it('keeps what an agent wrote to radical.json and check.json since the poll, and writes only what Settings changed (F-0158)', async () => {
    const { files, writes } = await openRepository({ rules: { metamodel: 'error', 'adr-incomplete': { max: 4 } } })
    // The person sets a rule's severity: a draft.
    setSettingsDraft((d) => patchRule(d ?? shown(), 'scenario-verifies-nothing', { severity: 'error' }))
    // Meanwhile the agent binds a second test, and lowers a baseline.
    const agent = parseRepositoryFile(files.repository!)
    agent.verifies[0].tests.push('tests/pay.test.ts › declines an expired card')
    files.repository = serializeRepositoryFile(agent)
    files.config = JSON.stringify({ rules: { metamodel: 'error', 'adr-incomplete': { max: 2 } } }, null, 2) + '\n'
    // The person saves, before the next poll.
    await saveCheckConfig(useInspectorStore.getState().settingsDrafts[documents.getActiveId()!])
    expect(parseRepositoryFile(files.repository!).verifies[0].tests).toEqual(['tests/pay.test.ts › pays by card', 'tests/pay.test.ts › declines an expired card'])
    // No repository setting changed: radical.json was not written.
    expect(writes.repository).toBe(0)
    expect(JSON.parse(files.config!).rules).toEqual({ metamodel: 'error', 'adr-incomplete': { max: 2 }, 'scenario-verifies-nothing': 'error' })
    expect(useDiagramStore.getState().repository?.verifies[0].tests).toHaveLength(2)
  })

  it('writes a test file list Settings changed into radical.json as it is now', async () => {
    const { files, writes } = await openRepository({ rules: {} })
    setSettingsDraft((d) => patchRule(d ?? shown(), 'test-unbound', { exclude: ['**/bench.spec.ts'] }))
    const agent = parseRepositoryFile(files.repository!)
    agent.verifies[0].tests.push('tests/pay.test.ts › declines an expired card')
    files.repository = serializeRepositoryFile(agent)
    await saveCheckConfig(useInspectorStore.getState().settingsDrafts[documents.getActiveId()!])
    const now = parseRepositoryFile(files.repository!)
    expect(writes.repository).toBe(1)
    expect(now.tests).toEqual({ include: ['tests/**'], exclude: ['**/bench.spec.ts'] })
    expect(now.verifies[0].tests).toHaveLength(2)
    expect(JSON.parse(files.config!).rules ?? {}).toEqual({})
  })
})
