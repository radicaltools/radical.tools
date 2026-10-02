import type { Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from './fixtures'

/**
 * The Studio `test`, with its page in a persistent (on-disk) browser profile
 * instead of Playwright's usual off-the-record one. Chromium takes the whole
 * browser down when an off-the-record page reads a stored OPFS directory handle
 * back from IndexedDB — which the app does on every folder save and load. A
 * regular profile, like a user's, is not affected.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ playwright }, use, testInfo) => {
    const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent, headless } = testInfo.project.use
    const profile = await mkdtemp(join(tmpdir(), 'radical-e2e-'))
    const context = await playwright.chromium.launchPersistentContext(profile, {
      headless: headless ?? true, viewport, deviceScaleFactor, locale, timezoneId, colorScheme, baseURL, userAgent,
    })
    await use(context.pages()[0] ?? await context.newPage())
    await context.close()
    await rm(profile, { recursive: true, force: true })
  },
})

/**
 * A model folder for Studio's web build, which works on real directories
 * through the File System Access API. Playwright cannot drive the native
 * directory picker, so `showDirectoryPicker()` is replaced with one that hands
 * out a directory in the page's origin-private file system (OPFS): a real
 * directory handle the app reads, writes, stores in IndexedDB and polls, and
 * one the test can edit behind the app's back. Each test's profile has its
 * own, empty OPFS.
 */
export class ModelFolder {
  constructor(readonly page: Page, readonly name = 'model') {}

  /** Make the directory picker return this folder. Call before navigating. */
  async install(): Promise<void> {
    await this.page.addInitScript((name) => {
      ;(window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker = async () =>
          (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    }, this.name)
  }

  /** Every file in the folder: relative path → content. */
  async files(): Promise<Record<string, string>> {
    return this.page.evaluate(async (name) => {
      const out: Record<string, string> = {}
      const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
        try {
          for await (const [entryName, entry] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
            const rel = prefix ? `${prefix}/${entryName}` : entryName
            try {
              if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle, rel)
              else out[rel] = await (await (entry as FileSystemFileHandle).getFile()).text()
            } catch (error) {
              // Folder saves can rename an entry between iteration and read.
              if ((error as DOMException).name !== 'NotFoundError') throw error
            }
          }
        } catch (error) {
          if ((error as DOMException).name !== 'NotFoundError') throw error
        }
      }
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
      await walk(root, '')
      return out
    }, this.name)
  }

  /** Paths of the files in the folder, sorted. */
  async paths(): Promise<string[]> {
    return Object.keys(await this.files()).sort()
  }

  /** Write a file as another program would (an editor, git), outside Studio. */
  async write(path: string, content: string): Promise<void> {
    await this.page.evaluate(async ([name, rel, text]) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
      const parts = rel.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
      const writable = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
      await writable.write(text)
      await writable.close()
    }, [this.name, path, content] as const)
  }

  async remove(path: string): Promise<void> {
    await this.page.evaluate(async ([name, rel]) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
      const parts = rel.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
      await dir.removeEntry(parts[parts.length - 1])
    }, [this.name, path] as const)
  }
}
