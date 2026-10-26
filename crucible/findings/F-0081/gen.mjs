// A generated C4 model of about `n` elements: systems holding containers and
// databases, people, ADRs, a chain of relations. `start` is 'pile' (all of it
// on a few spots, as an agent's bulk add leaves it) or 'grid' (spread out).
export function generate(n, start = 'pile', { collapsedEvery = 0 } = {}) {
  const S = { system: [360, 260], container: [300, 200], database: [190, 130], person: [150, 170], adr: [180, 100] }
  const nodes = [], relations = []
  const node = (id, type, parentId, x, y, extra = {}) => ({ id, type, label: id.replace(/-/g, ' '), x, y, width: S[type][0], height: S[type][1], collapsed: false, ...(parentId ? { parentId } : {}), ...extra })
  const rel = (a, b, relationType = 'interacts') => relations.push({ id: `r-${a}-${b}`, sourceId: a, targetId: b, label: 'uses', relationType })
  const at = (k) => (start === 'pile' ? [(k % 6) * 15, Math.floor(k / 6) * 15] : [(k % 8) * 900, Math.floor(k / 8) * 700])
  let i = 0
  while (nodes.length < n) {
    const [sx, sy] = at(i)
    const sys = `sys${i}`
    nodes.push(node(sys, 'system', undefined, sx, sy, collapsedEvery && i % collapsedEvery === 1 ? { collapsed: true } : {}))
    let prev
    for (let k = 0; k < 4 && nodes.length < n; k++) {
      const c = `${sys}-c${k}`
      nodes.push(node(c, 'container', sys, start === 'pile' ? 40 + k * 10 : 20 + (k % 2) * 220, start === 'pile' ? 120 + k * 10 : 60 + Math.floor(k / 2) * 140))
      if (prev) rel(prev, c)
      prev = c
      if (k % 2 === 0 && nodes.length < n) { const db = `${sys}-db${k}`; nodes.push(node(db, 'database', sys, 40 + k * 12, 120 + k * 12)); rel(c, db) }
    }
    if (i % 3 === 0 && nodes.length < n) { const p = `person${i}`; nodes.push(node(p, 'person', undefined, sx + 10, sy + 10)); rel(p, `${sys}-c0`) }
    if (i % 2 === 0 && nodes.length < n) { const a = `adr${i}`; nodes.push(node(a, 'adr', undefined, sx + 20, sy + 20)); rel(a, sys, 'constrains') }
    if (i > 0) rel(`sys${i - 1}-c0`, `${sys}-c0`)
    i++
  }
  // In grid mode, the children of a system are laid out inside it already.
  if (start === 'grid') {
    for (const n of nodes) if (n.parentId && n.type === 'database') { const k = Number(n.id.slice(-1)); n.x = 20 + (k / 2) * 0; n.y = 200; n.x = k === 0 ? 20 : 240; n.y = 200 + 0; }
  }
  const positions = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]))
  return {
    nodes,
    relations,
    views: [
      { id: 'v-all', name: 'Everything', kind: 'static', nodeIds: [], positions: structuredClone(positions), hiddenRelationIds: [] },
      { id: 'v-small', name: 'First systems', kind: 'static', nodeIds: nodes.filter((x) => /^sys[0-2](-|$)/.test(x.id)).map((x) => x.id), positions: Object.fromEntries(Object.entries(positions).filter(([id]) => /^sys[0-2](-|$)/.test(id))), hiddenRelationIds: [] },
    ],
    snapshots: [],
    presentations: [],
  }
}
