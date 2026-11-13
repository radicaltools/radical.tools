// Loyalty points (R5): every change of a balance is an entry; the balance is
// only ever the sum of the entries; it never goes below zero; no entry is
// changed or deleted.
import { db, now } from '../../db';
import { invalid, invalidState, isObject } from '../../errors';
import { getCustomer } from '../customers';

db.exec(`CREATE TABLE IF NOT EXISTS loyalty_entries (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL, points INTEGER NOT NULL, kind TEXT NOT NULL,
  order_id TEXT, created_at TEXT NOT NULL)`);

export type EntryKind = 'earned' | 'spent' | 'restored' | 'revoked' | 'written_off' | 'adjusted';
export interface PointsEntry { points: number; kind: EntryKind; reference: string | null; createdAt: string }

export const CENTS_PER_POINT = 5;
const CENTS_PER_POINT_EARNED = 100;

const num = (sql: string, ...args: unknown[]): number => (db.prepare(sql).get(...args) as { n: number }).n;
export const balanceOf = (customerId: string): number => num('SELECT COALESCE(SUM(points), 0) AS n FROM loyalty_entries WHERE customer_id = ?', customerId);
const ofOrder = (orderId: string, ...kinds: EntryKind[]): number =>
  num(`SELECT COALESCE(SUM(points), 0) AS n FROM loyalty_entries WHERE order_id = ? AND kind IN (${kinds.map(() => '?').join(', ')})`, orderId, ...kinds);

/** The only place that changes a balance. Refuses to take it below zero. */
function append(customerId: string, points: number, kind: EntryKind, orderId: string | null): void {
  if (points === 0) return;
  if (balanceOf(customerId) + points < 0) throw new Error('a points balance cannot go below zero');
  db.prepare('INSERT INTO loyalty_entries (customer_id, points, kind, order_id, created_at) VALUES (?, ?, ?, ?, ?)').run(customerId, points, kind, orderId, now());
}

export function getBalance(customerId: string): { balance: number } {
  getCustomer(customerId);
  return { balance: balanceOf(customerId) };
}
export function listEntries(customerId: string): PointsEntry[] {
  getCustomer(customerId);
  const rows = db.prepare('SELECT points, kind, order_id, created_at FROM loyalty_entries WHERE customer_id = ? ORDER BY seq').all(customerId) as { points: number; kind: EntryKind; order_id: string | null; created_at: string }[];
  return rows.map((r) => ({ points: r.points, kind: r.kind, reference: r.order_id, createdAt: r.created_at }));
}

/** One point for every full euro paid. */
export function earn(customerId: string, orderId: string, paidCents: number): void {
  append(customerId, Math.floor(paidCents / CENTS_PER_POINT_EARNED), 'earned', orderId);
}
export function spend(customerId: string, orderId: string, points: number): void {
  append(customerId, -points, 'spent', orderId);
}
/** Gives back the points an order used that have not been given back yet (all of them, or at most `points`). */
export function restore(customerId: string, orderId: string, points?: number): void {
  const open = -ofOrder(orderId, 'spent', 'restored');
  append(customerId, Math.min(open, points ?? open), 'restored', orderId);
}
/** How many of the points an order used have been given back. */
export const restoredOf = (orderId: string): number => ofOrder(orderId, 'restored');
/** After a return: the order keeps only the points its remaining payment earns; never more is taken than the customer has. */
export function revokeDownTo(customerId: string, orderId: string, stillPaidCents: number): void {
  const excess = ofOrder(orderId, 'earned', 'revoked') - Math.floor(stillPaidCents / CENTS_PER_POINT_EARNED);
  append(customerId, -Math.min(Math.max(excess, 0), balanceOf(customerId)), 'revoked', orderId);
}
/** Erasure: what is left of the balance is written off by an entry; the history stays. */
export function writeOff(customerId: string): void {
  append(customerId, -balanceOf(customerId), 'written_off', null);
}
/**
 * Service sets a balance by hand (R5): the system works out the difference and records it as one
 * adjustment, for no order. The same number records nothing. An erased account gets no points.
 */
export function setBalance(customerId: string, body: unknown): { balance: number } {
  const customer = getCustomer(customerId);
  if (!isObject(body) || typeof body.balance !== 'number' || !Number.isInteger(body.balance) || body.balance < 0) throw invalid('balance must be a whole number of at least 0');
  if (customer.erased) throw invalidState('the customer has been erased');
  append(customerId, body.balance - balanceOf(customerId), 'adjusted', null);
  return { balance: balanceOf(customerId) };
}
