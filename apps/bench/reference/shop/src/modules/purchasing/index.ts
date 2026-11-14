// Purchasing: suppliers, purchase orders, deliveries booked against them,
// reorder rules, the low-stock report and reorder proposals.
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { ApiError, invalid, invalidState, isObject, notFound } from '../../errors';
import { findProduct } from '../catalogue';
import * as stock from '../stock';

db.exec(`
CREATE TABLE IF NOT EXISTS purchasing_suppliers (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT);
CREATE TABLE IF NOT EXISTS purchasing_orders (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, supplier_id TEXT NOT NULL, warehouse TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS purchasing_lines (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, purchase_order_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL, received_quantity INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS purchasing_reorder_rules (
  sku TEXT PRIMARY KEY, reorder_point INTEGER NOT NULL, target_level INTEGER NOT NULL, supplier_id TEXT NOT NULL);
`);

export interface Supplier { id: string; name: string; email: string | null }
export type PurchaseOrderStatus = 'open' | 'received' | 'closed' | 'cancelled';
export interface PurchaseOrderLine { sku: string; quantity: number; unitCostCents: number; receivedQuantity: number }
export interface PurchaseOrder { id: string; supplierId: string; warehouse: string; status: PurchaseOrderStatus; lines: PurchaseOrderLine[]; totalCostCents: number; createdAt: string }
export interface ReorderRule { sku: string; reorderPoint: number; targetLevel: number; supplierId: string }
export interface LowStock { sku: string; available: number; backordered: number; onOrder: number; reorderPoint: number; targetLevel: number; supplierId: string }
export interface ReorderProposal { supplierId: string; lines: { sku: string; quantity: number }[] }

const MAX_QUANTITY = 10000;
/** A delivery may bring up to a tenth more than was ordered of a product. */
const mostAccepted = (ordered: number) => ordered + Math.floor(ordered / 10);
const whole = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;

// ---- suppliers

export function listSuppliers(): Supplier[] {
  return db.prepare('SELECT id, name, email FROM purchasing_suppliers ORDER BY seq').all() as Supplier[];
}
export function getSupplier(id: string): Supplier {
  const s = db.prepare('SELECT id, name, email FROM purchasing_suppliers WHERE id = ?').get(id) as Supplier | undefined;
  if (!s) throw notFound(`no supplier ${id}`);
  return s;
}
export function createSupplier(body: unknown): Supplier {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 200) throw invalid('name must be 1 to 200 characters');
  const name = body.name.trim();
  let email: string | null = null;
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(body.email)) throw invalid('email must be an email address');
    email = body.email;
  }
  if (db.prepare('SELECT 1 FROM purchasing_suppliers WHERE lower(name) = lower(?)').get(name)) throw new ApiError(409, 'duplicate_supplier', `supplier ${name} exists`);
  const id = randomUUID();
  db.prepare('INSERT INTO purchasing_suppliers (id, name, email) VALUES (?, ?, ?)').run(id, name, email);
  return getSupplier(id);
}
const supplierOf = (v: unknown): string => {
  if (typeof v !== 'string' || !db.prepare('SELECT 1 FROM purchasing_suppliers WHERE id = ?').get(v)) throw new ApiError(422, 'unknown_supplier', `no supplier ${String(v)}`);
  return v;
};

// ---- purchase orders

type OrderRow = { id: string; supplier_id: string; warehouse: string; status: PurchaseOrderStatus; created_at: string };
function out(r: OrderRow): PurchaseOrder {
  const lines = (db.prepare('SELECT sku, quantity, unit_cost_cents, received_quantity FROM purchasing_lines WHERE purchase_order_id = ? ORDER BY seq').all(r.id) as { sku: string; quantity: number; unit_cost_cents: number; received_quantity: number }[])
    .map((l) => ({ sku: l.sku, quantity: l.quantity, unitCostCents: l.unit_cost_cents, receivedQuantity: l.received_quantity }));
  return { id: r.id, supplierId: r.supplier_id, warehouse: r.warehouse, status: r.status, lines, totalCostCents: lines.reduce((a, l) => a + l.quantity * l.unitCostCents, 0), createdAt: r.created_at };
}
export function getPurchaseOrder(id: string): PurchaseOrder {
  const r = db.prepare('SELECT * FROM purchasing_orders WHERE id = ?').get(id) as OrderRow | undefined;
  if (!r) throw notFound(`no purchase order ${id}`);
  return out(r);
}
export function listPurchaseOrders(supplierId: string | null): PurchaseOrder[] {
  const rows = supplierId === null ? db.prepare('SELECT * FROM purchasing_orders ORDER BY seq').all()
    : db.prepare('SELECT * FROM purchasing_orders WHERE supplier_id = ? ORDER BY seq').all(supplierId);
  return (rows as OrderRow[]).map(out);
}
const setStatus = (id: string, status: PurchaseOrderStatus) => db.prepare('UPDATE purchasing_orders SET status = ? WHERE id = ?').run(status, id);

export function createPurchaseOrder(body: unknown): PurchaseOrder {
  if (!isObject(body)) throw invalid('body must be an object');
  const supplierId = supplierOf(body.supplierId);
  const warehouse = stock.warehouseOf(body.warehouse);
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw invalid('at least one line is required');
  const seen = new Set<string>();
  const lines = body.lines.map((l: unknown) => {
    if (!isObject(l) || typeof l.sku !== 'string') throw invalid('a line needs a sku');
    if (!whole(l.quantity, 1) || l.quantity > MAX_QUANTITY) throw invalid(`a line quantity must be an integer from 1 to ${MAX_QUANTITY}`);
    if (!whole(l.unitCostCents, 1)) throw invalid('unitCostCents must be an integer above 0');
    if (!findProduct(l.sku)) throw new ApiError(422, 'unknown_product', `no product ${l.sku}`);
    if (seen.has(l.sku)) throw invalid(`product ${l.sku} is on the purchase order twice`);
    seen.add(l.sku);
    return { sku: l.sku, quantity: l.quantity, unitCostCents: l.unitCostCents };
  });
  const id = randomUUID();
  db.prepare(`INSERT INTO purchasing_orders (id, supplier_id, warehouse, status, created_at) VALUES (?, ?, ?, 'open', ?)`).run(id, supplierId, warehouse, now());
  for (const l of lines) db.prepare('INSERT INTO purchasing_lines (purchase_order_id, sku, quantity, unit_cost_cents) VALUES (?, ?, ?, ?)').run(id, l.sku, l.quantity, l.unitCostCents);
  return getPurchaseOrder(id);
}

/** Only a purchase order nothing has arrived on can be cancelled; cancelling twice changes nothing. */
export function cancelPurchaseOrder(id: string): PurchaseOrder {
  const po = getPurchaseOrder(id);
  if (po.status === 'cancelled') return po;
  if (po.status !== 'open') throw invalidState(`a ${po.status} purchase order cannot be cancelled`);
  if (po.lines.some((l) => l.receivedQuantity > 0)) throw invalidState('goods have arrived on this purchase order; close it instead');
  setStatus(id, 'cancelled');
  return getPurchaseOrder(id);
}
/** The rest will not come: what has not arrived is no longer on order. */
export function closePurchaseOrder(id: string): PurchaseOrder {
  const po = getPurchaseOrder(id);
  if (po.status !== 'open') throw invalidState(`a ${po.status} purchase order cannot be closed`);
  if (!po.lines.some((l) => l.receivedQuantity > 0)) throw invalidState('nothing has arrived on this purchase order; cancel it instead');
  setStatus(id, 'closed');
  return getPurchaseOrder(id);
}

/** A delivery: all of it is booked or none of it. */
export function receiveDelivery(id: string, body: unknown): PurchaseOrder {
  const po = getPurchaseOrder(id);
  if (po.status !== 'open') throw invalidState(`a ${po.status} purchase order takes no deliveries`);
  if (!isObject(body) || !Array.isArray(body.lines) || body.lines.length === 0) throw invalid('at least one line is required');
  const delivered = new Map<string, number>();
  for (const l of body.lines as unknown[]) {
    if (!isObject(l) || typeof l.sku !== 'string') throw invalid('a line needs a sku');
    if (!whole(l.quantity, 1)) throw invalid('a line quantity must be an integer of at least 1');
    delivered.set(l.sku, (delivered.get(l.sku) ?? 0) + l.quantity);
  }
  for (const [sku, quantity] of delivered) {
    const line = po.lines.find((l) => l.sku === sku);
    if (!line) throw invalid(`product ${sku} is not on the purchase order`);
    if (line.receivedQuantity + quantity > mostAccepted(line.quantity)) throw invalid(`too many of ${sku} delivered`);
  }
  for (const [sku, quantity] of delivered) {
    const line = po.lines.find((l) => l.sku === sku)!;
    db.prepare('UPDATE purchasing_lines SET received_quantity = received_quantity + ? WHERE purchase_order_id = ? AND sku = ?').run(quantity, id, sku);
    stock.receivePurchase(sku, po.warehouse, quantity, id, line.unitCostCents);
  }
  if (getPurchaseOrder(id).lines.every((l) => l.receivedQuantity >= l.quantity)) setStatus(id, 'received');
  return getPurchaseOrder(id);
}

/** Units of a product that are ordered from suppliers and have not arrived. */
export function onOrder(sku: string): number {
  return (db.prepare(`SELECT COALESCE(SUM(MAX(l.quantity - l.received_quantity, 0)), 0) AS n FROM purchasing_lines l
    JOIN purchasing_orders o ON o.id = l.purchase_order_id WHERE o.status = 'open' AND l.sku = ?`).get(sku) as { n: number }).n;
}

// ---- reordering

export function setReorderRule(sku: string, body: unknown): ReorderRule {
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  if (!isObject(body)) throw invalid('body must be an object');
  const { reorderPoint, targetLevel } = body;
  if (!whole(reorderPoint, 0)) throw invalid('reorderPoint must be an integer of at least 0');
  if (!whole(targetLevel, 1) || targetLevel <= reorderPoint) throw invalid('targetLevel must be an integer above reorderPoint');
  const supplierId = supplierOf(body.supplierId);
  db.prepare(`INSERT INTO purchasing_reorder_rules (sku, reorder_point, target_level, supplier_id) VALUES (?, ?, ?, ?)
    ON CONFLICT (sku) DO UPDATE SET reorder_point = excluded.reorder_point, target_level = excluded.target_level, supplier_id = excluded.supplier_id`)
    .run(sku, reorderPoint, targetLevel, supplierId);
  return { sku, reorderPoint, targetLevel, supplierId };
}

/** Products on sale that have a rule and are at or below their reorder point, counting what waits for customers. */
export function listLowStock(): LowStock[] {
  const rules = db.prepare('SELECT sku, reorder_point, target_level, supplier_id FROM purchasing_reorder_rules ORDER BY sku').all() as { sku: string; reorder_point: number; target_level: number; supplier_id: string }[];
  const low: LowStock[] = [];
  for (const r of rules) {
    if (!findProduct(r.sku)?.active) continue;
    const level = stock.getStockLevel(r.sku);
    if (level.available - level.backordered > r.reorder_point) continue;
    low.push({ sku: r.sku, available: level.available, backordered: level.backordered, onOrder: onOrder(r.sku), reorderPoint: r.reorder_point, targetLevel: r.target_level, supplierId: r.supplier_id });
  }
  return low;
}
/** What to order to bring each low product up to its target, less what is already on order; one proposal per supplier. */
export function listReorderProposals(): ReorderProposal[] {
  const bySupplier = new Map<string, ReorderProposal>();
  for (const l of listLowStock()) {
    const quantity = l.targetLevel - (l.available - l.backordered) - l.onOrder;
    if (quantity <= 0) continue;
    if (!bySupplier.has(l.supplierId)) bySupplier.set(l.supplierId, { supplierId: l.supplierId, lines: [] });
    bySupplier.get(l.supplierId)!.lines.push({ sku: l.sku, quantity });
  }
  return [...bySupplier.values()];
}
