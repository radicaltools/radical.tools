// Builds a small shop model (Customer → Storefront → Orders API → Orders DB, Payment Provider)
// through the repository's MCP server, in `folder` (emptied first).
import { connect } from './mcp.mjs'
import { rmSync, mkdirSync } from 'node:fs'
export async function buildShop(folder) {
  rmSync(folder, { recursive: true, force: true }); mkdirSync(folder, { recursive: true })
  const m = await connect(folder)
  try {
    const add = async (a) => { const r = await m.call('add_node', a); if (r.error) throw new Error(r.text) }
    await add({ tempId: 'cust', type: 'person', label: 'Customer' })
    await add({ tempId: 'shop', type: 'system', label: 'Shop' })
    await add({ tempId: 'web', type: 'webapp', label: 'Storefront', parentId: 'shop' })
    await add({ tempId: 'api', type: 'container', label: 'Orders API', parentId: 'shop', technology: 'Node.js' })
    await add({ tempId: 'db', type: 'database', label: 'Orders DB', parentId: 'shop', technology: 'PostgreSQL' })
    await add({ tempId: 'pay', type: 'system', label: 'Payment Provider', external: true })
    for (const [s, t, l] of [['cust', 'web', 'shops'], ['web', 'api', 'calls'], ['api', 'db', 'reads'], ['api', 'pay', 'charges']]) {
      const r = await m.call('add_relation', { sourceId: s, targetId: t, label: l }); if (r.error) throw new Error(r.text)
    }
    const v = await m.call('create_view', { tempId: 'vshop', name: 'Shop', kind: 'static', nodeIds: ['cust', 'shop', 'web', 'api', 'db', 'pay'] })
    if (v.error) throw new Error(v.text)
    const v2 = await m.call('create_view', { tempId: 'vpay', name: 'Payments', kind: 'static', nodeIds: ['pay'] })
    if (v2.error) throw new Error(v2.text)
  } finally { await m.close() }
}
