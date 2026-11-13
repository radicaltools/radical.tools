// Shipments (R10): a shipment leaves one warehouse and contains what is reserved for the order in that
// warehouse, nothing else. An order goes out in as many shipments as it takes; each has its invoice.
// A parcel that comes back undelivered returns to the warehouse it left from.
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { invalidState, isObject, notFound, timeOf } from '../../errors';
import { issueInvoice, hasReturns } from '../invoicing';
import { getOrder, markShipped, returnShipment, Refund, Credit } from '../orders';
import { hasBackorder, reservedWarehouses, shipReserved, warehouseOf } from '../stock';

db.exec(`CREATE TABLE IF NOT EXISTS shipments_shipments (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL, warehouse TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', invoice_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS shipments_lines (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, shipment_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL)`);

export interface Shipment {
  id: string; orderId: string; warehouse: string; status: 'sent' | 'failed';   // failed: the parcel came back undelivered
  invoiceId: string; lines: { sku: string; quantity: number }[]; createdAt: string;
}
type Row = { id: string; order_id: string; warehouse: string; status: 'sent' | 'failed'; invoice_id: string; created_at: string };
const out = (r: Row): Shipment => ({
  id: r.id, orderId: r.order_id, warehouse: r.warehouse, status: r.status, invoiceId: r.invoice_id,
  lines: db.prepare('SELECT sku, quantity FROM shipments_lines WHERE shipment_id = ? ORDER BY seq').all(r.id) as { sku: string; quantity: number }[],
  createdAt: r.created_at,
});
function getShipment(id: string): Shipment {
  const r = db.prepare('SELECT * FROM shipments_shipments WHERE id = ?').get(id) as Row | undefined;
  if (!r) throw notFound(`no shipment ${id}`);
  return out(r);
}
export function listShipments(orderId: string): Shipment[] {
  getOrder(orderId);
  return (db.prepare('SELECT * FROM shipments_shipments WHERE order_id = ? ORDER BY seq').all(orderId) as Row[]).map(out);
}

/**
 * Sends goods of a paid order out, dated with the time the request says to assume. With a `warehouse`: what is
 * reserved for the order there, also while other units still wait. Without: the whole order, one shipment per
 * warehouse (by code); refused while units are on backorder. Every shipment gets its invoice.
 */
export function shipOrder(orderId: string, body?: unknown): Shipment[] {
  const at = timeOf(body);
  const order = getOrder(orderId);
  if (order.status !== 'paid') throw invalidState(`a ${order.status} order cannot be shipped`);
  const part = isObject(body) && body.warehouse !== undefined && body.warehouse !== null;
  if (!part && hasBackorder(orderId)) throw invalidState('the order still waits for goods');
  const reserved = reservedWarehouses(orderId);
  const warehouses = part ? [warehouseOf((body as Record<string, unknown>).warehouse)] : reserved;
  if (warehouses.length === 0 || warehouses.some((w) => !reserved.includes(w))) throw invalidState('nothing is reserved for the order there');
  return warehouses.map((warehouse) => {
    const sent = shipReserved(orderId, warehouse);
    markShipped(orderId, sent);
    const invoice = issueInvoice(order, at, sent);
    const id = randomUUID();
    db.prepare('INSERT INTO shipments_shipments (id, order_id, warehouse, invoice_id, created_at) VALUES (?, ?, ?, ?, ?)').run(id, orderId, warehouse, invoice.id, now());
    for (const l of sent) db.prepare('INSERT INTO shipments_lines (shipment_id, sku, quantity) VALUES (?, ?, ?)').run(id, l.sku, l.quantity);
    return getShipment(id);
  });
}

/**
 * The parcel of a shipment came back undelivered: its goods return to the warehouse it left from and the customer
 * gets the money for them back, as for a return, with a credit note against the shipment's invoice.
 * When the refund fails nothing happens.
 */
export async function failDelivery(id: string, body: unknown, refund: Refund, credit: Credit): Promise<Shipment> {
  const shipment = getShipment(id);
  const at = timeOf(body);
  if (shipment.status !== 'sent') throw invalidState('the shipment has come back already');
  if (hasReturns(shipment.invoiceId)) throw invalidState('goods of the shipment have been returned by the customer');
  await returnShipment(shipment.orderId, shipment.lines, shipment.warehouse, at, refund, credit, shipment.invoiceId);
  db.prepare(`UPDATE shipments_shipments SET status = 'failed' WHERE id = ?`).run(id);
  return getShipment(id);
}
