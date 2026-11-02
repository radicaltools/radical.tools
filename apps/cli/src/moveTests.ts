// radical setup's move of the tests a model names in its Metrics
// (test(<file> › <title>) passed) into the repository's .radical/radical.json
// (ADR Tests are bound outside the model): the metric conditions stay.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { TESTED_TYPES, parseCondition } from '@radical/common/check'
import { deserializeFromMdFolder, keepMdFolderPaths, serializeToMdFolderWithPaths } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { originOf } from '@radical/common/model'
import { REPOSITORY_FILE, parseRepositoryFile, serializeRepositoryFile } from '@radical/common/repositoryMapping'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

/** A node's Metrics split into the tests it names and the other lines. */
function splitMetrics(node: C4Node): { tests: string[]; rest: string } {
  const text = (node as unknown as Record<string, unknown>).metrics
  if (typeof text !== 'string') return { tests: [], rest: '' }
  const tests: string[] = []
  const kept: string[] = []
  for (const line of text.split('\n')) {
    const condition = line.trim() ? parseCondition(line.trim()) : null
    if (condition?.kind === 'test') tests.push(condition.id.raw)
    else kept.push(line)
  }
  return { tests, rest: kept.join('\n').trim() }
}

const naming = (data: DiagramData): C4Node[] => data.nodes
  .filter((n) => (TESTED_TYPES as readonly string[]).includes(n.type) && !originOf(n) && splitMetrics(n).tests.length > 0)

/** How many scenarios and fitness functions of the model in `folder` name
 *  tests in their Metrics. */
export async function testsNamedIn(folder: string): Promise<number> {
  const files = await new MdFolderSession(diskFolderStorage(folder), { writeCache: false }).readAll()
  return naming(deserializeFromMdFolder(files).data).length
}

/** Moves them into `root`'s .radical/radical.json, an entry for each, and
 *  leaves their other Metrics lines in the model; a line for each change. */
export async function moveTestsOut(folder: string, root: string): Promise<string[]> {
  const session = new MdFolderSession(diskFolderStorage(folder))
  const before = await session.readAll()
  const { data } = deserializeFromMdFolder(before)
  const moving = new Set(naming(data).map((n) => n.id))
  if (!moving.size) return []
  const file = join(root, REPOSITORY_FILE)
  const repository = existsSync(file) ? parseRepositoryFile(await readFile(file, 'utf8'), file) : { implements: [], verifies: [] }
  let tests = 0
  const nodes = data.nodes.map((n) => {
    if (!moving.has(n.id)) return n
    const split = splitMetrics(n)
    tests += split.tests.length
    const entry = repository.verifies.find((v) => v.element === n.id)
    if (entry) entry.tests = [...entry.tests, ...split.tests.filter((t) => !entry.tests.includes(t))]
    else repository.verifies.push({ element: n.id, name: n.label, tests: split.tests })
    const { metrics: _metrics, ...rest } = n as unknown as Record<string, unknown>
    return (split.rest ? { ...rest, metrics: split.rest } : rest) as unknown as C4Node
  })
  // Each element's file where the folder has it, and the manifest as it is.
  const next = keepMdFolderPaths(before, serializeToMdFolderWithPaths({ ...data, nodes }).files)
  next['radical.md'] = before['radical.md']
  const written = await session.write(next)
  if (!written.ok) throw new Error(`the model folder changed while its tests were moved (${written.conflict.join(', ')}); nothing was moved`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, serializeRepositoryFile(repository))
  return [`moved ${tests} test${tests === 1 ? '' : 's'} of ${moving.size} scenario${moving.size === 1 ? '' : 's'} and fitness function${moving.size === 1 ? '' : 's'} from the model into ${REPOSITORY_FILE}`]
}
