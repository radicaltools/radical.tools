import { createHash, randomUUID } from 'node:crypto'
import { open, readFile, rename, rm, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { validateDiscussions, type DiscussionAction } from '@radical/common/discussions'

export const hash = (s: string) => createHash('sha256').update(s).digest('hex')
export interface Connection { site: string; landingId: string; viewId: string; marker: string }
export interface SyncEntry {
  localId: string; threadId: string; nodeId: string; pageId: string; parentRemoteId: string | null
  remoteId?: string; remoteHash?: string; remoteVersion?: number; localHash: string
  state: 'importing' | 'linked' | 'uncertain'; action?: DiscussionAction; payload?: unknown
}
export interface SyncJournal { version: 1; connection: Connection; entries: SyncEntry[]; excluded: string[]; lastResult?: { at: string; imported: number; sent: number; review: number } }
const FILE = 'discussions-confluence-sync.json', RECEIPT = 'discussions-confluence-connection.json'
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT'
async function text(path: string): Promise<string | null> {
  try { if (!(await lstat(path)).isFile()) throw new Error('Sync state must be a regular file.'); return await readFile(path, 'utf8') } catch (e) { if (missing(e)) return null; throw e }
}
export function validateJournal(value: unknown): asserts value is SyncJournal {
  const j = value as SyncJournal
  if (!j || j.version !== 1 || !j.connection || typeof j.connection.site !== 'string' || !/^https:\/\/[^/]+\/wiki$/.test(j.connection.site) || !/^\d+$/.test(j.connection.landingId) || !j.connection.viewId || !j.connection.marker || !Array.isArray(j.entries) || !Array.isArray(j.excluded) || j.excluded.some((s) => typeof s !== 'string')) throw new Error('Unsupported or corrupt sync journal. Restore it with discussions.json; do not regenerate it.')
  const locals = new Set<string>(), remotes = new Set<string>()
  for (const e of j.entries) {
    if (!e || typeof e.localId !== 'string' || !/^[0-9a-f-]{36}$/i.test(e.localId) || locals.has(e.localId) || !e.threadId || !e.nodeId || !/^\d+$/.test(e.pageId) || !['importing', 'linked', 'uncertain'].includes(e.state) || !/^[0-9a-f]{64}$/.test(e.localHash) || (e.parentRemoteId !== null && !/^\d+$/.test(e.parentRemoteId)) || (e.state === 'linked' && (!e.remoteId || !e.remoteHash || !Number.isInteger(e.remoteVersion)))) throw new Error('Corrupt sync operation; review the journal.')
    locals.add(e.localId)
    if (e.remoteId) { if (!/^\d+$/.test(e.remoteId) || remotes.has(e.remoteId)) throw new Error('Duplicate or invalid remote mapping.'); remotes.add(e.remoteId) }
    if (e.state === 'importing') {
      const a = e.action
      if (!a || (a.kind !== 'createThread' && a.kind !== 'importReply')) throw new Error('Invalid pending import.')
      const c = a.kind === 'createThread' ? a.thread.comments[0] : a.comment
      if (!c || c.id !== e.localId || hash(JSON.stringify(c)) !== e.localHash) throw new Error('Pending import content changed.')
      if (a.kind === 'createThread') validateDiscussions({ version: 2, threads: [a.thread] })
    }
    if (e.state === 'uncertain' && (!e.payload || typeof e.payload !== 'object')) throw new Error('Uncertain operation has no payload.')
  }
}
/** Separate process lock; never held by a discussion-file writer or automatically stolen. */
export async function lockSync(folder: string): Promise<() => Promise<void>> {
  const path = join(folder, '.discussions-confluence-sync.lock')
  let handle
  try { handle = await open(path, 'wx', 0o600) } catch { throw new Error('Sync lock exists or cannot be created. Stop the owning runner before removing a stale lock.') }
  try { await handle.writeFile(`${process.pid}\n`); await handle.sync() } finally { await handle.close() }
  return () => rm(path)
}
export class JournalFile {
  private original: string | null = null
  private receipt: string | null = null
  constructor(private folder: string) {}
  async load(): Promise<SyncJournal | null> {
    this.original = await text(join(this.folder, FILE)); this.receipt = await text(join(this.folder, RECEIPT))
    if (this.original === null) {
      if (this.receipt !== null) throw new Error('Sync journal is missing. Restore the journal and discussions together; do not reconnect.')
      return null
    }
    const envelope = JSON.parse(this.original)
    if (!envelope || !envelope.data || envelope.checksum !== hash(JSON.stringify(envelope.data))) throw new Error('Sync journal is corrupt or conflicted. Restore a consistent backup.')
    validateJournal(envelope.data)
    if (this.receipt !== JSON.stringify(envelope.data.connection) + '\n') throw new Error('Connection receipt is missing or belongs to another journal. Restore both files together.')
    return envelope.data
  }
  async save(journal: SyncJournal): Promise<void> {
    validateJournal(journal)
    if (await text(join(this.folder, FILE)) !== this.original) throw new Error('Sync state changed outside the runner. Stop and review.')
    const receipt = JSON.stringify(journal.connection) + '\n'
    if (this.receipt === null) {
      await this.replace(RECEIPT, receipt); this.receipt = receipt
    } else if (await text(join(this.folder, RECEIPT)) !== this.receipt || this.receipt !== receipt) throw new Error('Connection changed outside the runner.')
    const next = JSON.stringify({ checksum: hash(JSON.stringify(journal)), data: journal }, null, 2) + '\n'
    await this.replace(FILE, next); this.original = next
  }
  private async replace(name: string, value: string): Promise<void> {
    const temporary = join(this.folder, `${name}.${randomUUID()}.tmp`)
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try { await handle.writeFile(value, 'utf8'); await handle.sync() } finally { await handle.close() }
      await rename(temporary, join(this.folder, name))
    } finally { await rm(temporary, { force: true }) }
  }
}
