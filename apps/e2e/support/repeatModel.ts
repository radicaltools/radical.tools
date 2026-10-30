import { createHash } from 'node:crypto'
import { deserializeFromMdFolder, serializeToMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'

/** A model folder's files with its elements and relations repeated `copies`
 *  times under fresh ids, each copy beside the last, its labels numbered;
 *  views as they were (those whose filter is by type grow with the copies).
 *  For the large-model benchmark: radical.tools' own model ×14 is 21,000
 *  elements and 40,000 relations. */
export function repeatModel(files: FolderFiles, copies: number): FolderFiles {
  if (copies <= 1) return files
  const { data, name } = deserializeFromMdFolder(files)
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
  const known = new Set<string>([...data.nodes.map((n) => n.id), ...data.relations.map((r) => r.id)])
  const remap = (k: number) => (id: string): string => {
    if (!known.has(id)) return id
    const h = createHash('sha1').update(`${k}:${id}`).digest('hex')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
  }
  const roots = data.nodes.filter((n) => !n.parentId)
  const span = Math.max(...roots.map((n) => n.x + n.width)) - Math.min(...roots.map((n) => n.x)) + 400
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const nodes = [...data.nodes]
  const relations = [...data.relations]
  const defaultPositions = { ...(data.defaultPositions ?? {}) }
  for (let k = 1; k < copies; k++) {
    const map = remap(k)
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v).replace(UUID, map)) as T
    for (const n of copy(data.nodes)) {
      n.label = `${n.label} ${k + 1}`
      if (!n.parentId) n.x += span * k
      nodes.push(n)
    }
    relations.push(...copy(data.relations))
    for (const [id, p] of Object.entries(data.defaultPositions ?? {})) {
      defaultPositions[map(id)] = byId.get(id)?.parentId ? { ...p } : { ...p, x: p.x + span * k }
    }
  }
  return serializeToMdFolder({ ...data, nodes, relations, defaultPositions, snapshots: [] }, `${name ?? 'Model'} ×${copies}`)
}
