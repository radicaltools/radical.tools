// Makes a document from a .radical file with an extra view "big" holding every node (or the first N).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO } from './lib.mjs'
export function bigDoc(rel, { limit = Infinity, types } = {}) {
  const d = JSON.parse(readFileSync(join(REPO, rel), 'utf8'))
  let nodes = d.nodes.filter((n) => !types || types.includes(n.type))
  const ids = new Set(nodes.slice(0, limit).map((n) => n.id))
  // keep parents of kept nodes
  for (const n of d.nodes) if (ids.has(n.id)) for (let p = n.parentId; p; p = d.nodes.find((m) => m.id === p)?.parentId) ids.add(p)
  d.views.push({ id: 'big', name: 'Big', nodeIds: [...ids], positions: {} })
  return d
}
