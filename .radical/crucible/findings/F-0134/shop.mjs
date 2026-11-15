// Builds the "Shop" repository on disk: its model through the MCP server (as an agent would),
// tests bound with set_verification, a JUnit report, and `radical check --report` to keep the results.
import { join } from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { mcp, cli, junit, workDir } from './lib.mjs'

export async function buildShop({ results = true, failing = true, extra } = {}) {
  const repo = await workDir('shop-')
  const model = join(repo, '.radical', 'model')
  const a = await mcp(model)
  const ids = {}
  const add = async (tempId, type, label, properties = {}, parentId) => {
    const t = await a.call('add_node', { tempId, type, label, properties, ...(parentId ? { parentId } : {}) })
    ids[tempId] = /\b([0-9a-f]{8}-[0-9a-f-]{27})\b/.exec(t)?.[1] ?? /id[:=]\s*"?([\w-]+)/.exec(t)?.[1]
    return t
  }
  const rel = (s, t, relationType, properties) => a.call('add_relation', { sourceId: s, targetId: t, relationType, ...(properties ? { properties } : {}) })
  await add('shop', 'system', 'Shop')
  await add('api', 'container', 'Checkout API', { }, 'shop')
  await add('n-sell', 'need', 'Sell online')
  await add('n-pay', 'need', 'Pay online')
  await add('r-card', 'requirement', 'Take card payments', { ears_type: 'ubiquitous', action: 'take card payments' })
  await add('r-3ds', 'requirement', 'Check 3-D Secure', { ears_type: 'ubiquitous', action: 'check 3-D Secure on each card payment' })
  await add('r-wallet', 'requirement', 'Take wallet payments', { ears_type: 'ubiquitous', action: 'take wallet payments' })
  await add('s-pay', 'scenario', 'Paying by card', { given: 'a cart', when: 'paying by card', then: 'the order is paid' })
  await add('s-refund', 'scenario', 'Refunding a card', { given: 'a paid order', when: 'refunding', then: 'it is refunded' })
  await add('s-3ds', 'scenario', 'Challenged by 3-D Secure', { given: 'a card that needs 3DS', when: 'paying', then: 'the bank asks' })
  await add('adr', 'adr', 'Fast checkout', { status: 'accepted', date: '2026-11-01', context: 'Slow checkouts lose sales.', decision: 'Keep the checkout under 300 ms.', consequences: 'We measure it.' })
  await add('ff', 'fitness-fn', 'Checkout latency', { metrics: 'checkout.latency.p95 <= 300 ms' })
  await rel('n-pay', 'n-sell', 'derives')
  await rel('r-card', 'n-pay', 'derives')
  await rel('r-3ds', 'r-card', 'derives')
  await rel('r-wallet', 'n-pay', 'derives')
  for (const r of ['r-card', 'r-3ds', 'r-wallet']) await rel('api', r, 'satisfies')
  await rel('s-pay', 'r-card', 'verifies')
  await rel('s-refund', 'r-card', 'verifies')
  await rel('s-3ds', 'r-3ds', 'verifies')
  await rel('ff', 'adr', 'implements')
  await rel('adr', 'api', 'constrains')
  await a.call('set_verification', { id: 's-pay', tests: ['tests/pay.test.ts › pays by card'] })
  await a.call('set_verification', { id: 's-refund', tests: ['tests/pay.test.ts › refunds'] })
  await a.call('set_verification', { id: 's-3ds', tests: ['tests/pay.test.ts › asks for 3DS'] })
  if (extra) await extra(a, ids)
  await a.call('create_view', { tempId: 'v-spec', name: 'Specification', nodeIds: Object.keys(ids).filter((k) => !['shop', 'api'].includes(k)).map((k) => ids[k]) }).catch((e) => console.log('view:', e.message.slice(0, 200)))
  await a.close()
  if (results) {
    await mkdir(join(repo, 'reports'), { recursive: true })
    await writeFile(join(repo, 'reports', 'unit.xml'), junit([
      { file: 'tests/pay.test.ts', name: 'pays by card' },
      { file: 'tests/pay.test.ts', name: 'refunds', failure: failing ? 'AssertionError: expected "pending" to be "refunded"' : undefined },
      { file: 'tests/pay.test.ts', name: 'asks for 3DS' },
    ]))
    cli(['check', model, '--report', join(repo, 'reports')], repo)
  }
  return { repo, model, ids }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { repo, model, ids } = await buildShop()
  console.log(repo); console.log(ids)
  console.log(cli(['check', model, '--trace', ids['n-sell']], repo))
  console.log(cli(['check', model, '--trace', ids['r-card']], repo))
}
