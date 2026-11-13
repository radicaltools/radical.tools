import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { invalid, invalidState } from '../../errors';
import { getOrder, markPaid } from '../orders';
import { configuredProvider } from './providers';

db.exec(`CREATE TABLE IF NOT EXISTS payments_payments (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, order_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL, provider_charge_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments_refunds (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, provider_charge_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, created_at TEXT NOT NULL)`);

const provider = configuredProvider();

export interface Payment { id: string; orderId: string; amountCents: number; status: 'succeeded' | 'declined'; providerChargeId: string; createdAt: string }
type Row = { id: string; order_id: string; amount_cents: number; status: 'succeeded' | 'declined'; provider_charge_id: string; created_at: string };
const out = (r: Row): Payment => ({ id: r.id, orderId: r.order_id, amountCents: r.amount_cents, status: r.status, providerChargeId: r.provider_charge_id, createdAt: r.created_at });

export function listPayments(orderId: string): Payment[] {
  getOrder(orderId);
  return (db.prepare('SELECT * FROM payments_payments WHERE order_id = ? ORDER BY seq').all(orderId) as Row[]).map(out);
}

export async function payOrder(orderId: string): Promise<Payment> {
  const order = getOrder(orderId);
  if (order.status !== 'pending') throw invalidState(`a ${order.status} order cannot be paid`);
  const charge = await provider.charge(order.totalCents, order.id);
  const id = randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO payments_payments (id, order_id, amount_cents, status, provider_charge_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, order.id, order.totalCents, charge.status, charge.chargeId, now());
    if (charge.status === 'succeeded') markPaid(order.id);
  })();
  return listPayments(orderId).find((p) => p.id === id)!;
}

/** Gives money back against the charge of the order's succeeded payment. */
export async function refundOrder(orderId: string, amountCents: number): Promise<void> {
  const paid = listPayments(orderId).find((p) => p.status === 'succeeded');
  if (!paid) throw invalidState('the order has no succeeded payment');
  await provider.refund(paid.providerChargeId, amountCents);
  db.prepare('INSERT INTO payments_refunds (order_id, provider_charge_id, amount_cents, created_at) VALUES (?, ?, ?, ?)').run(orderId, paid.providerChargeId, amountCents, now());
}

// ---- reconciliation with the provider's statement

export interface Difference {
  kind: 'charge' | 'refund'; problem: 'unknown_to_shop' | 'unknown_to_provider' | 'amount_differs';
  providerChargeId: string; orderId: string | null; shopCents: number | null; providerCents: number | null;
}
export interface Reconciliation {
  from: string; to: string;
  shopChargedCents: number; providerChargedCents: number; shopRefundedCents: number; providerRefundedCents: number;
  differences: Difference[];
}
const instant = (v: string | null, what: string): string => {
  if (v === null || Number.isNaN(new Date(v).getTime())) throw invalid(`${what} must be a date-time`);
  return new Date(v).toISOString();
};
const orderNamed = (reference: string | null): string | null => {
  if (!reference) return null;
  try { return getOrder(reference).id; } catch { return null; }
};

/**
 * Compares the money the provider says moved in a period with what the shop has on record
 * for it. A report: it changes nothing on either side.
 */
export async function reconcile(fromText: string | null, toText: string | null): Promise<Reconciliation> {
  const from = instant(fromText, 'from');
  const to = instant(toText, 'to');
  if (from >= to) throw invalid('from must be before to');
  const statement = await provider.statement(from, to);
  const differences: Difference[] = [];
  const sum = (xs: { amountCents: number }[]) => xs.reduce((a, x) => a + x.amountCents, 0);

  // Charges, matched by the provider's charge id.
  const known = (chargeId: string) => (db.prepare(`SELECT * FROM payments_payments WHERE status = 'succeeded' AND provider_charge_id = ?`).get(chargeId) as Row | undefined);
  const ours = (db.prepare(`SELECT * FROM payments_payments WHERE status = 'succeeded' AND created_at >= ? AND created_at < ? ORDER BY seq`).all(from, to) as Row[]).map(out);
  for (const c of statement.charges) {
    const p = known(c.chargeId);
    if (!p) differences.push({ kind: 'charge', problem: 'unknown_to_shop', providerChargeId: c.chargeId, orderId: orderNamed(c.reference), shopCents: null, providerCents: c.amountCents });
    else if (p.amount_cents !== c.amountCents) differences.push({ kind: 'charge', problem: 'amount_differs', providerChargeId: c.chargeId, orderId: p.order_id, shopCents: p.amount_cents, providerCents: c.amountCents });
  }
  for (const p of ours) {
    if (!statement.charges.some((c) => c.chargeId === p.providerChargeId)) {
      differences.push({ kind: 'charge', problem: 'unknown_to_provider', providerChargeId: p.providerChargeId, orderId: p.orderId, shopCents: p.amountCents, providerCents: null });
    }
  }

  // Refunds, compared per charge: what was given back against it in the period.
  const refunded = db.prepare('SELECT provider_charge_id AS chargeId, order_id AS orderId, amount_cents AS amountCents FROM payments_refunds WHERE created_at >= ? AND created_at < ? ORDER BY seq')
    .all(from, to) as { chargeId: string; orderId: string; amountCents: number }[];
  const charges = [...new Set([...refunded.map((r) => r.chargeId), ...statement.refunds.map((r) => r.chargeId)])];
  for (const chargeId of charges) {
    const here = refunded.filter((r) => r.chargeId === chargeId);
    const there = statement.refunds.filter((r) => r.chargeId === chargeId);
    const orderId = here[0]?.orderId ?? known(chargeId)?.order_id ?? null;
    if (here.length === 0) differences.push({ kind: 'refund', problem: 'unknown_to_shop', providerChargeId: chargeId, orderId, shopCents: null, providerCents: sum(there) });
    else if (there.length === 0) differences.push({ kind: 'refund', problem: 'unknown_to_provider', providerChargeId: chargeId, orderId, shopCents: sum(here), providerCents: null });
    else if (sum(here) !== sum(there)) differences.push({ kind: 'refund', problem: 'amount_differs', providerChargeId: chargeId, orderId, shopCents: sum(here), providerCents: sum(there) });
  }
  return {
    from, to,
    shopChargedCents: sum(ours), providerChargedCents: sum(statement.charges),
    shopRefundedCents: sum(refunded), providerRefundedCents: sum(statement.refunds),
    differences,
  };
}
