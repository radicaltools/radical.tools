// Run 206: an Assay "agent" — one long-lived MCP server (stdio) on a disk copy of Studio's OPFS model folder, inside a
// throw-away central repository under this run's tmp/, with two small code repositories beside it. After each call the
// files the server changed are copied into the OPFS folder, so Studio sees them as an outside edit.
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { REPO, RUN, opfsFiles, opfsWrite, opfsRemove, diskFiles } from './flib.mjs'

const clientMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs'))
const stdioMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs'))

const CODE = {
  orders: {
    'package.json': JSON.stringify({ name: 'orders', scripts: { start: 'node dist/server.js' }, dependencies: { express: '4' }, devDependencies: { typescript: '5', vitest: '4' } }),
    'db/schema.sql': [
      'CREATE TABLE customers (', '  id INTEGER PRIMARY KEY,', '  email VARCHAR(200)', ');', '',
      'CREATE TABLE orders (', '  id INTEGER PRIMARY KEY,', '  customer_id INTEGER REFERENCES customers(id),', "  status VARCHAR(20) CHECK (status IN ('new', 'paid', 'shipped'))", ');', '',
    ].join('\n'),
    'src/server.ts': [
      "import express from 'express'", "import { place, pay, ship } from './orders'", 'const app = express()',
      "app.post('/orders', place)", "app.post('/orders/:id/payment', pay)", "app.post('/orders/:id/shipment', ship)", '',
    ].join('\n'),
    'src/orders.ts': [
      "export type OrderStatus = 'new' | 'paid' | 'shipped'", '',
      'export async function place(req, res) {', "  const order = { customer: req.body.customer, status: 'new' as OrderStatus }",
      "  await db.run('INSERT INTO orders (customer_id, status) VALUES (?, ?)', order.customer, order.status)", '  res.status(201).json(order)', '}', '',
      'export async function pay(req, res) {', '  const order = await find(req.params.id)', "  order.status = 'paid'", '  await save(order)', '}', '',
      'export async function ship(req, res) {', '  const order = await find(req.params.id)', "  order.status = 'shipped'", '  await save(order)', '}', '',
    ].join('\n'),
  },
  pos: {
    'POS.vbp': 'Type=Exe\r\nForm=frmSale.frm\r\nName="POS"\r\n',
    'frmSale.frm': [
      'VERSION 5.00', 'Begin VB.Form frmSale', '   Caption         =   "Sale"', '   Begin VB.CommandButton cmdClose', '      Caption         =   "&Close the sale"', '   End', 'End',
      'Attribute VB_Name = "frmSale"', 'Private Sub cmdClose_Click()', '  db.Execute "UPDATE sales SET closed = 1 WHERE id = " & saleId', 'End Sub', '',
    ].join('\r\n'),
  },
}

export const ORDERS = 'orders:unit:.'
export const POS = 'pos:unit:.'
export const C4 = {
  elements: [
    { key: 'shop', type: 'system', label: 'Shop', facts: [ORDERS, POS], confidence: 'inferred' },
    { key: 'orders', type: 'container', label: 'Orders service', parent: 'shop', units: [ORDERS], facts: [ORDERS], confidence: 'observed' },
    { key: 'pos', type: 'container', label: 'Point of sale', parent: 'shop', units: [POS], facts: [POS], confidence: 'observed' },
  ],
}
export const DOMAIN = {
  elements: [{ key: 'sales', type: 'domain', label: 'Sales', facts: ['orders:table:.:orders', 'orders:table:.:customers'], confidence: 'inferred' }],
  entities: [
    { key: 'customer', label: 'Customer', tables: ['orders:table:.:customers'], parent: 'sales' },
    { key: 'order', label: 'Order', tables: ['orders:table:.:orders'], parent: 'sales', references: [{ to: 'customer', cardinality: 'one' }] },
  ],
}

/** Copies the OPFS model into a new central repository on disk, with the code beside it, and starts the server there. */
export async function assayAgent(page, { client = 'claude-code' } = {}) {
  await mkdir(join(RUN, 'tmp'), { recursive: true })
  const base = await mkdtemp(join(RUN, 'tmp', 'assay-'))
  for (const [repo, files] of Object.entries(CODE)) {
    for (const [p, c] of Object.entries(files)) { await mkdir(dirname(join(base, 'code', repo, p)), { recursive: true }); await writeFile(join(base, 'code', repo, p), c) }
    execFileSync('git', ['init', '-q'], { cwd: join(base, 'code', repo) })
  }
  const root = join(base, 'architecture')
  const model = join(root, '.radical', 'model')
  await mkdir(model, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: root })
  const start = await opfsFiles(page)
  for (const [p, c] of Object.entries(start)) { await mkdir(dirname(join(model, p)), { recursive: true }); await writeFile(join(model, p), c) }
  let snapshot = await diskFiles(model)
  const mcp = new clientMod.Client({ name: client, version: '1.0.0' })
  const transport = new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', model], stderr: 'pipe' })
  await mcp.connect(transport)
  /** Copies what the server changed on disk into the OPFS folder. */
  const push = async () => {
    const now = await diskFiles(model)
    const changed = []
    for (const [p, c] of Object.entries(now)) if (c !== snapshot[p]) { await opfsWrite(page, p, c); changed.push(p) }
    for (const p of Object.keys(snapshot)) if (!(p in now)) { await opfsRemove(page, p).catch(() => {}); changed.push('-' + p) }
    snapshot = now
    return changed
  }
  const call = async (name, args = {}) => {
    const res = await mcp.callTool({ name, arguments: args }, { timeout: 600_000, resetTimeoutOnProgress: true })
    const changed = await push()
    const text = res.content.map((c) => c.text).join('\n')
    return { ok: !res.isError, text, changed }
  }
  const status = async () => {
    const files = await diskFiles(model)
    return files['.state/assay-run.json'] ? JSON.parse(files['.state/assay-run.json']) : null
  }
  const close = async () => { await mcp.close().catch(() => {}); await push().catch(() => {}) }
  return { call, status, close, model, root, base, push }
}
