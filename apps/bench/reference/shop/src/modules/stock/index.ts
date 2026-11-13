// Stock: warehouses, movements (R1: on hand is only ever the sum of movements),
// reservations and backorders (R2: reserved never exceeds on hand, per warehouse).
// A receipt that has a cost is passed on to the costing module (R6).
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { ApiError, invalid, isObject, notFound } from '../../errors';
import { findProduct } from '../catalogue';
import * as costing from '../costing';

db.exec(`
CREATE TABLE IF NOT EXISTS stock_warehouses (code TEXT PRIMARY KEY, name TEXT NOT NULL);
INSERT OR IGNORE INTO stock_warehouses (code, name) VALUES ('MAIN', 'Main warehouse');
CREATE TABLE IF NOT EXISTS stock_movements (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, sku TEXT NOT NULL, warehouse TEXT NOT NULL,
  quantity INTEGER NOT NULL, reason TEXT NOT NULL, reference TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_reservations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sku TEXT NOT NULL, warehouse TEXT NOT NULL,
  quantity INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'held');
CREATE TABLE IF NOT EXISTS stock_backorders (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sku TEXT NOT NULL, warehouse TEXT NOT NULL,
  quantity INTEGER NOT NULL);
`);

export interface Warehouse { code: string; name: string }
export interface Movement { id: string; sku: string; quantity: number; reason: string; reference: string | null; warehouse: string; createdAt: string }
export interface WarehouseLevel { warehouse: string; onHand: number; reserved: number; available: number; backordered: number }
export interface StockLevel { sku: string; onHand: number; reserved: number; available: number; backordered: number; warehouses: WarehouseLevel[] }
export interface Allocation { warehouse: string; quantity: number }
export interface LineStock { allocations: Allocation[]; backorderedQuantity: number }

const insufficient = (message: string) => new ApiError(409, 'insufficient_stock', message);

// ---- warehouses

export function listWarehouses(): Warehouse[] {
  return db.prepare('SELECT code, name FROM stock_warehouses ORDER BY code').all() as Warehouse[];
}
export function createWarehouse(body: unknown): Warehouse {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.code !== 'string' || !/^[A-Z0-9]{2,10}$/.test(body.code)) throw invalid('code must be 2 to 10 of A-Z and 0-9');
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 200) throw invalid('name must be 1 to 200 characters');
  if (db.prepare('SELECT 1 FROM stock_warehouses WHERE code = ?').get(body.code)) throw new ApiError(409, 'duplicate_warehouse', `warehouse ${body.code} exists`);
  db.prepare('INSERT INTO stock_warehouses (code, name) VALUES (?, ?)').run(body.code, body.name.trim());
  return { code: body.code, name: body.name.trim() };
}
/** The warehouse code of a request: MAIN when left out, 422 when unknown. */
export function warehouseOf(v: unknown): string {
  if (v === undefined || v === null) return 'MAIN';
  if (typeof v !== 'string') throw invalid('warehouse must be a code');
  if (!db.prepare('SELECT 1 FROM stock_warehouses WHERE code = ?').get(v)) throw new ApiError(422, 'unknown_warehouse', `no warehouse ${v}`);
  return v;
}

// ---- levels

const num = (sql: string, ...args: unknown[]): number => (db.prepare(sql).get(...args) as { n: number }).n;
const onHandIn = (sku: string, wh: string) => num('SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_movements WHERE sku = ? AND warehouse = ?', sku, wh);
const reservedIn = (sku: string, wh: string) => num(`SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_reservations WHERE sku = ? AND warehouse = ? AND state = 'held'`, sku, wh);
const availableIn = (sku: string, wh: string) => onHandIn(sku, wh) - reservedIn(sku, wh);

function levelOf(sku: string): StockLevel {
  const codes = db.prepare(`SELECT warehouse FROM stock_movements WHERE sku = ?
    UNION SELECT warehouse FROM stock_backorders WHERE sku = ? ORDER BY 1`).all(sku, sku) as { warehouse: string }[];
  const warehouses = codes.map(({ warehouse }) => {
    const onHand = onHandIn(sku, warehouse);
    const reserved = reservedIn(sku, warehouse);
    const backordered = num('SELECT COALESCE(SUM(quantity), 0) AS n FROM stock_backorders WHERE sku = ? AND warehouse = ?', sku, warehouse);
    return { warehouse, onHand, reserved, available: onHand - reserved, backordered };
  });
  const sum = (f: (w: WarehouseLevel) => number) => warehouses.reduce((a, w) => a + f(w), 0);
  return { sku, onHand: sum((w) => w.onHand), reserved: sum((w) => w.reserved), available: sum((w) => w.available), backordered: sum((w) => w.backordered), warehouses };
}
export function getStockLevel(sku: string): StockLevel {
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  return levelOf(sku);
}

// ---- movements

type MovementRow = { id: string; sku: string; warehouse: string; quantity: number; reason: string; reference: string | null; created_at: string };
const movementOut = (r: MovementRow): Movement => ({ id: r.id, sku: r.sku, quantity: r.quantity, reason: r.reason, reference: r.reference, warehouse: r.warehouse, createdAt: r.created_at });

/** The only place that changes the quantity on hand (R1). */
function append(sku: string, warehouse: string, quantity: number, reason: string, reference: string | null, unitCostCents: number | null = null): Movement {
  const id = randomUUID();
  if (unitCostCents !== null) costing.recordReceipt(sku, levelOf(sku).onHand, quantity, unitCostCents, reference);
  db.prepare('INSERT INTO stock_movements (id, sku, warehouse, quantity, reason, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, sku, warehouse, quantity, reason, reference, now());
  if (quantity > 0) fillBackorders(sku, warehouse);
  return movementOut(db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(id) as MovementRow);
}
function adjust(sku: string, warehouse: string, quantity: number, reference: string | null): Movement {
  if (quantity < 0 && onHandIn(sku, warehouse) + quantity < reservedIn(sku, warehouse)) {
    throw insufficient(`on hand of ${sku} in ${warehouse} cannot go below what is reserved there`);
  }
  return append(sku, warehouse, quantity, 'adjustment', reference);
}

export function recordMovement(body: unknown): Movement {
  if (!isObject(body)) throw invalid('body must be an object');
  const { sku, quantity, reason, reference, unitCostCents } = body;
  if (typeof sku !== 'string') throw invalid('sku is required');
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) throw invalid('quantity must be an integer');
  if (reason !== 'receipt' && reason !== 'adjustment') throw invalid('reason must be receipt or adjustment');
  if (reference !== undefined && reference !== null && typeof reference !== 'string') throw invalid('reference must be a string');
  if (reason === 'receipt' && quantity <= 0) throw invalid('a receipt must have a quantity above 0');
  if (reason === 'adjustment' && quantity === 0) throw invalid('an adjustment cannot be 0');
  const hasCost = unitCostCents !== undefined && unitCostCents !== null;
  if (hasCost && reason !== 'receipt') throw invalid('only a receipt has a cost');
  if (hasCost && (typeof unitCostCents !== 'number' || !Number.isInteger(unitCostCents) || unitCostCents <= 0)) throw invalid('unitCostCents must be an integer above 0');
  if (!findProduct(sku)) throw new ApiError(422, 'unknown_product', `no product ${sku}`);
  const warehouse = warehouseOf(body.warehouse);
  const ref = (reference as string | null | undefined) ?? null;
  return reason === 'receipt' ? append(sku, warehouse, quantity, 'receipt', ref, hasCost ? (unitCostCents as number) : null) : adjust(sku, warehouse, quantity, ref);
}
export function listMovements(sku: string): Movement[] {
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  return (db.prepare('SELECT * FROM stock_movements WHERE sku = ? ORDER BY seq').all(sku) as MovementRow[]).map(movementOut);
}

/** Sets the counted quantity on hand by one adjustment for the difference. */
export function correctOnHand(sku: string, warehouse: string, counted: number, reference: string): StockLevel {
  const difference = counted - onHandIn(sku, warehouse);
  if (difference !== 0) adjust(sku, warehouse, difference, reference);
  return levelOf(sku);
}
/** Goods of a purchase order came in, at the price agreed with the supplier. */
export function receivePurchase(sku: string, warehouse: string, quantity: number, reference: string, unitCostCents: number): Movement {
  return append(sku, warehouse, quantity, 'receipt', reference, unitCostCents);
}
export function receiveReturn(sku: string, warehouse: string, quantity: number, reference: string): Movement {
  return append(sku, warehouse, quantity, 'return', reference);
}

// ---- cost

export interface ProductCost { sku: string; averageCostCents: number | null; stockValueCents: number }
export function getCost(sku: string): ProductCost {
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  const averageCostCents = costing.averageOf(sku);
  return { sku, averageCostCents, stockValueCents: levelOf(sku).onHand * (averageCostCents ?? 0) };
}
export function listCostRecords(sku: string): costing.CostRecord[] {
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  return costing.listRecords(sku);
}

// ---- reservations and backorders

function hold(orderId: string, sku: string, warehouse: string, quantity: number): void {
  // One held row per order, product and warehouse; what has gone out stays in rows of its own.
  const held = db.prepare(`UPDATE stock_reservations SET quantity = quantity + ? WHERE order_id = ? AND sku = ? AND warehouse = ? AND state = 'held'`).run(quantity, orderId, sku, warehouse);
  if (held.changes === 0) db.prepare('INSERT INTO stock_reservations (order_id, sku, warehouse, quantity) VALUES (?, ?, ?, ?)').run(orderId, sku, warehouse, quantity);
}

/** Reserves what is available for a line and backorders the rest. */
export function reserve(orderId: string, sku: string, quantity: number): void {
  const byStock = levelOf(sku).warehouses.filter((w) => w.available > 0)
    .sort((a, b) => b.available - a.available || (a.warehouse < b.warehouse ? -1 : 1));
  let left = quantity;
  let first: string | null = null;
  if (byStock.length && byStock[0].available >= quantity) {
    hold(orderId, sku, byStock[0].warehouse, quantity);
    left = 0;
  } else {
    for (const w of byStock) {
      const take = Math.min(left, w.available);
      hold(orderId, sku, w.warehouse, take);
      first ??= w.warehouse;
      left -= take;
    }
  }
  if (left > 0) {
    // The waiting units are counted where the line was first allocated, else where the product is kept, else in MAIN.
    const kept = db.prepare('SELECT warehouse FROM stock_movements WHERE sku = ? ORDER BY warehouse LIMIT 1').get(sku) as { warehouse: string } | undefined;
    db.prepare('INSERT INTO stock_backorders (order_id, sku, warehouse, quantity) VALUES (?, ?, ?, ?)').run(orderId, sku, first ?? kept?.warehouse ?? 'MAIN', left);
  }
}

/** Stock became available in a warehouse: the oldest waiting orders get it. */
function fillBackorders(sku: string, warehouse: string): void {
  let available = availableIn(sku, warehouse);
  const waiting = db.prepare('SELECT seq, order_id, quantity FROM stock_backorders WHERE sku = ? ORDER BY seq').all(sku) as { seq: number; order_id: string; quantity: number }[];
  for (const b of waiting) {
    if (available <= 0) break;
    const take = Math.min(available, b.quantity);
    hold(b.order_id, sku, warehouse, take);
    if (take === b.quantity) db.prepare('DELETE FROM stock_backorders WHERE seq = ?').run(b.seq);
    else db.prepare('UPDATE stock_backorders SET quantity = quantity - ? WHERE seq = ?').run(take, b.seq);
    available -= take;
  }
}

/** Drops the reservation and the backorder of an order; writes no movement. */
export function release(orderId: string): void {
  const held = db.prepare(`SELECT sku, warehouse FROM stock_reservations WHERE order_id = ? AND state = 'held'`).all(orderId) as { sku: string; warehouse: string }[];
  db.prepare(`UPDATE stock_reservations SET state = 'released' WHERE order_id = ? AND state = 'held'`).run(orderId);
  db.prepare('DELETE FROM stock_backorders WHERE order_id = ?').run(orderId);
  for (const r of held) fillBackorders(r.sku, r.warehouse);
}

export function hasBackorder(orderId: string): boolean {
  return num('SELECT COUNT(*) AS n FROM stock_backorders WHERE order_id = ?', orderId) > 0;
}

/** The warehouses in which goods are reserved for an order right now, by code. */
export function reservedWarehouses(orderId: string): string[] {
  return (db.prepare(`SELECT DISTINCT warehouse FROM stock_reservations WHERE order_id = ? AND state = 'held' ORDER BY warehouse`).all(orderId) as { warehouse: string }[]).map((r) => r.warehouse);
}
/**
 * Takes out what is reserved for an order in one warehouse (R10: that and nothing else): one shipment
 * movement per line, in that warehouse. Returns what went out.
 */
export function shipReserved(orderId: string, warehouse: string): { sku: string; quantity: number }[] {
  const held = db.prepare(`SELECT seq, sku, quantity FROM stock_reservations WHERE order_id = ? AND warehouse = ? AND state = 'held' ORDER BY seq`).all(orderId, warehouse) as { seq: number; sku: string; quantity: number }[];
  for (const r of held) {
    append(r.sku, warehouse, -r.quantity, 'shipment', orderId);
    db.prepare(`UPDATE stock_reservations SET state = 'shipped' WHERE seq = ?`).run(r.seq);
  }
  return held.map((r) => ({ sku: r.sku, quantity: r.quantity }));
}

/** Where the lines of an order are (or were, once shipped) reserved, and what still waits. */
export function stockOfOrder(orderId: string): Map<string, LineStock> {
  const map = new Map<string, LineStock>();
  const at = (sku: string) => { if (!map.has(sku)) map.set(sku, { allocations: [], backorderedQuantity: 0 }); return map.get(sku)!; };
  const rows = db.prepare(`SELECT sku, warehouse, quantity FROM stock_reservations WHERE order_id = ? AND state != 'released' ORDER BY seq`).all(orderId) as { sku: string; warehouse: string; quantity: number }[];
  for (const r of rows) {
    const same = at(r.sku).allocations.find((a) => a.warehouse === r.warehouse);
    if (same) same.quantity += r.quantity; else at(r.sku).allocations.push({ warehouse: r.warehouse, quantity: r.quantity });
  }
  const waiting = db.prepare('SELECT sku, quantity FROM stock_backorders WHERE order_id = ?').all(orderId) as { sku: string; quantity: number }[];
  for (const b of waiting) at(b.sku).backorderedQuantity += b.quantity;
  return map;
}
