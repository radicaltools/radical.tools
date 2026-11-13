// Cost of goods (R6): a weighted average per product, changed only by a
// receipt that has a cost. Every change is a record; records are never rewritten.
import { db, now } from '../../db';

db.exec(`CREATE TABLE IF NOT EXISTS costing_records (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL, quantity INTEGER NOT NULL, unit_cost_cents INTEGER NOT NULL,
  average_cost_cents INTEGER NOT NULL, reference TEXT, created_at TEXT NOT NULL)`);

export interface CostRecord { quantity: number; unitCostCents: number; averageCostCents: number; reference: string | null; createdAt: string }

/** The current average cost of a product; null while nothing was received with a cost. */
export function averageOf(sku: string): number | null {
  const r = db.prepare('SELECT average_cost_cents AS a FROM costing_records WHERE sku = ? ORDER BY seq DESC LIMIT 1').get(sku) as { a: number } | undefined;
  return r ? r.a : null;
}
/** A receipt with a cost: the average over what was on hand before and what came in, rounded half up. */
export function recordReceipt(sku: string, onHandBefore: number, quantity: number, unitCostCents: number, reference: string | null): void {
  const before = averageOf(sku);
  const units = onHandBefore + quantity;
  const average = before === null || onHandBefore <= 0 ? unitCostCents
    : Math.floor((2 * (onHandBefore * before + quantity * unitCostCents) + units) / (2 * units));
  db.prepare('INSERT INTO costing_records (sku, quantity, unit_cost_cents, average_cost_cents, reference, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sku, quantity, unitCostCents, average, reference, now());
}
export function listRecords(sku: string): CostRecord[] {
  const rows = db.prepare('SELECT * FROM costing_records WHERE sku = ? ORDER BY seq').all(sku) as { quantity: number; unit_cost_cents: number; average_cost_cents: number; reference: string | null; created_at: string }[];
  return rows.map((r) => ({ quantity: r.quantity, unitCostCents: r.unit_cost_cents, averageCostCents: r.average_cost_cents, reference: r.reference, createdAt: r.created_at }));
}
