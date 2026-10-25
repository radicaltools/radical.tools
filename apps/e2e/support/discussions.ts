import type { Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskDiscussions } from '@radical/node-files/discussions'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { MdFolderSession, mergeMdFolderFiles } from '@radical/common/formats/mdFolderSync'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { DiscussionConflict, type DiscussionAction } from '@radical/common/discussions'
import type { DiagramData } from '@radical/common/c4'
import { fixture } from './fixtures'

/** The production UI and disk adapter, joined through the desktop bridge contract.
 * Native file dialogs and Electron window management are outside these tests. */
export class DesktopDiscussionModel {
  readonly discussions: DiskDiscussions
  readonly model: MdFolderSession
  modelReads = 0
  modelWrites = 0
  writeError = ''
  gate: Promise<void> | null = null
  constructor(readonly folder: string) {
    this.discussions = new DiskDiscussions(folder)
    this.model = new MdFolderSession(diskFolderStorage(folder))
  }
  static async create(json = fixture('bookstore')): Promise<DesktopDiscussionModel> {
    const model = new DesktopDiscussionModel(await mkdtemp(join(tmpdir(), 'radical-discussion-ui-')))
    await model.model.write(serializeToMdFolder(JSON.parse(json) as DiagramData, 'Bookstore'))
    return model
  }
  async dispose(): Promise<void> { await rm(this.folder, { recursive: true, force: true }) }
  async install(page: Page): Promise<void> {
    await page.exposeFunction('__discussions_readFolder', async () => {
      this.modelReads++
      return { success: true, files: await this.model.readAll() }
    })
    await page.exposeFunction('__discussions_writeFolder', async (_folder: string, files: Record<string, string>) => {
      this.modelWrites++
      const result = await this.model.write(files, mergeMdFolderFiles)
      return result.ok ? { success: true, merged: result.merged } : { success: false, conflict: result.conflict }
    })
    await page.exposeFunction('__discussions_loadDiscussions', async () => {
      try { return { success: true, discussions: await this.discussions.load() } }
      catch (error) { return { success: false, error: (error as Error).message } }
    })
    await page.exposeFunction('__discussions_actOnDiscussion', async (_folder: string, action: DiscussionAction) => {
      if (this.gate) await this.gate
      if (this.writeError) return { success: false, error: this.writeError }
      try { return { success: true, discussions: await this.discussions.act(action) } }
      catch (error) { return { success: false, conflict: error instanceof DiscussionConflict, error: (error as Error).message } }
    })
    await page.addInitScript(() => {
      const g = window as unknown as Record<string, unknown>
      const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
      for (const name of ['readFolder', 'writeFolder', 'loadDiscussions', 'actOnDiscussion']) {
        api[name] = (...args: unknown[]) => (g[`__discussions_${name}`] as (...values: unknown[]) => Promise<unknown>)(...args)
      }
      g.electronAPI = api
    })
  }
  async open(page: Page, view = 'v-context'): Promise<void> {
    await page.goto(`/#/d/${encodeURIComponent('md:' + this.folder)}/m/designer/v/${view}`)
  }
}
