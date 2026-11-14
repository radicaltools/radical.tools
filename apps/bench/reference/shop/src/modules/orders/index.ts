// Orders: placing (also on a customer account, also partly with loyalty points), cancelling, expiry,
// discount codes, stock corrections from an order, returns. What the goods of an order cost is worked out by the
// pricing module, what sending it costs by the carriers module.
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { ApiError, invalid, invalidState, isObject, notFound, timeOf } from '../../errors';
import { findProduct } from '../catalogue';
import * as stock from '../stock';
import * as customers from '../customers';
import * as loyalty from '../loyalty';
import { averageOf } from '../costing';
import { priceOrder, vatIn } from '../pricing';
import * as carriers from '../carriers';

db.exec(`
CREATE TABLE IF NOT EXISTS orders_orders (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, customer_email TEXT, status TEXT NOT NULL,
  customer_id TEXT, ship_street TEXT, ship_city TEXT, ship_postal_code TEXT, ship_country TEXT,
  points_spent INTEGER NOT NULL DEFAULT 0, points_discount_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL, discount_code TEXT, total_cents INTEGER NOT NULL,
  promotion_discount_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0,
  carrier TEXT, shipping_cents INTEGER NOT NULL DEFAULT 0, shipping_tax_cents INTEGER NOT NULL DEFAULT 0, corrected_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders_lines (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER, tax_percent INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0,
  shipped_quantity INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders_discount_codes (code TEXT PRIMARY KEY, percent INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders_returns (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, order_id TEXT NOT NULL, refund_cents INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders_return_lines (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, return_id TEXT NOT NULL, order_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL);
`);

const HOLD_MS = 15 * 60 * 1000;

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled' | 'expired' | 'returned';
export interface OrderLine {
  sku: string; quantity: number; unitPriceCents: number; unitCostCents: number | null;
  taxPercent: number; taxCents: number; totalCents: number;   // totalCents: what the customer pays for the line, VAT included
  allocations: stock.Allocation[]; backorderedQuantity: number;
  shippedQuantity: number;   // units of the line that have gone out
}
export interface Order {
  id: string; customerEmail: string | null; customerId: string | null; shippingAddress: customers.AddressFields | null;
  status: OrderStatus; lines: OrderLine[];
  pointsSpent: number; pointsDiscountCents: number;
  subtotalCents: number; promotionDiscountCents: number; discountCents: number; discountCode: string | null; taxCents: number; totalCents: number;
  // The carrier the customer chose and what sending costs (VAT included, and the VAT in it); both are in taxCents and totalCents.
  carrier: string | null; shippingCents: number; shippingTaxCents: number;
  correctedCents: number;   // what was given back by corrections of the order's invoices
  createdAt: string; expiresAt: string | null;
}
export interface DiscountCode { code: string; percent: number }
export interface ReturnLine { sku: string; quantity: number }
export interface OrderReturn { id: string; orderId: string; lines: ReturnLine[]; refundCents: number; createdAt: string }

type OrderRow = { id: string; customer_email: string | null; customer_id: string | null; ship_street: string | null; ship_city: string | null; ship_postal_code: string | null; ship_country: string | null;
  points_spent: number; points_discount_cents: number; status: OrderStatus; subtotal_cents: number; discount_cents: number; discount_code: string | null; total_cents: number; promotion_discount_cents: number; tax_cents: number;
  carrier: string | null; shipping_cents: number; shipping_tax_cents: number; corrected_cents: number; created_at: string; expires_at: string };
type LineRow = { sku: string; quantity: number; unit_price_cents: number; unit_cost_cents: number | null; tax_percent: number; tax_cents: number; total_cents: number; shipped_quantity: number };

function out(r: OrderRow): Order {
  const lines = db.prepare('SELECT sku, quantity, unit_price_cents, unit_cost_cents, tax_percent, tax_cents, total_cents, shipped_quantity FROM orders_lines WHERE order_id = ? ORDER BY seq').all(r.id) as LineRow[];
  const inStock = stock.stockOfOrder(r.id);
  return {
    id: r.id, customerEmail: r.customer_email, customerId: r.customer_id,
    shippingAddress: r.ship_street === null ? null : { street: r.ship_street, city: r.ship_city!, postalCode: r.ship_postal_code!, country: r.ship_country! },
    status: r.status,
    lines: lines.map((l) => ({
      sku: l.sku, quantity: l.quantity, unitPriceCents: l.unit_price_cents, unitCostCents: l.unit_cost_cents,
      taxPercent: l.tax_percent, taxCents: l.tax_cents, totalCents: l.total_cents,
      allocations: inStock.get(l.sku)?.allocations ?? [], backorderedQuantity: inStock.get(l.sku)?.backorderedQuantity ?? 0,
      shippedQuantity: l.shipped_quantity,
    })),
    subtotalCents: r.subtotal_cents, promotionDiscountCents: r.promotion_discount_cents, discountCents: r.discount_cents, discountCode: r.discount_code,
    pointsSpent: r.points_spent, pointsDiscountCents: r.points_discount_cents, taxCents: r.tax_cents, totalCents: r.total_cents,
    carrier: r.carrier, shippingCents: r.shipping_cents, shippingTaxCents: r.shipping_tax_cents, correctedCents: r.corrected_cents,
    createdAt: r.created_at, expiresAt: r.status === 'pending' ? r.expires_at : null,
  };
}
const row = (id: string) => db.prepare('SELECT * FROM orders_orders WHERE id = ?').get(id) as OrderRow | undefined;
const setStatus = (id: string, status: OrderStatus) => db.prepare('UPDATE orders_orders SET status = ? WHERE id = ?').run(status, id);

export function getOrder(id: string): Order {
  const r = row(id);
  if (!r) throw notFound(`no order ${id}`);
  return out(r);
}

/** `{ sku, quantity }` lines of a request, same SKUs merged, in the order the SKUs first appear. */
function mergedLines(v: unknown): Map<string, number> {
  if (!Array.isArray(v) || v.length === 0) throw invalid('at least one line is required');
  const merged = new Map<string, number>();
  for (const l of v) {
    if (!isObject(l) || typeof l.sku !== 'string') throw invalid('a line needs a sku');
    if (typeof l.quantity !== 'number' || !Number.isInteger(l.quantity) || l.quantity < 1) throw invalid('a line quantity must be an integer of at least 1');
    merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.quantity);
  }
  return merged;
}

// ---- discount codes

export function createDiscountCode(body: unknown): DiscountCode {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.code !== 'string' || !/^[A-Za-z0-9]{3,20}$/.test(body.code)) throw invalid('code must be 3 to 20 letters and digits');
  const { percent } = body;
  if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 1 || percent > 90) throw invalid('percent must be an integer from 1 to 90');
  const code = body.code.toUpperCase();
  if (db.prepare('SELECT 1 FROM orders_discount_codes WHERE code = ?').get(code)) throw new ApiError(409, 'duplicate_discount_code', `code ${code} exists`);
  db.prepare('INSERT INTO orders_discount_codes (code, percent) VALUES (?, ?)').run(code, percent);
  return { code, percent };
}

// ---- placing and reading

export function placeOrder(body: unknown): Order {
  if (!isObject(body)) throw invalid('body must be an object');
  const named = body.customerId !== undefined && body.customerId !== null;
  if (named && typeof body.customerId !== 'string') throw invalid('customerId must be an id');
  if (!named && (typeof body.customerEmail !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(body.customerEmail))) throw invalid('customerEmail must be an email address');
  // An order on an account carries the account's address; one without an account still belongs to the account that has its address.
  const customer = named ? customers.buyer(body.customerId as string) : customers.findByEmail(body.customerEmail as string);
  if (customer?.blocked) throw new ApiError(409, 'customer_blocked', 'the customer is blocked');
  const email = named ? customer!.email : (body.customerEmail as string);
  let address: customers.AddressFields | null = null;
  if (body.shippingAddressId !== undefined && body.shippingAddressId !== null) {
    if (!named) throw invalid('an address can only be named on an order of an account');
    address = customers.addressOf(customer!.id, body.shippingAddressId);
  }
  const merged = mergedLines(body.lines);
  for (const quantity of merged.values()) if (quantity > 1000) throw invalid('a line quantity is at most 1000');
  const lines = [...merged].map(([sku, quantity]) => {
    const product = findProduct(sku);
    if (!product) throw new ApiError(422, 'unknown_product', `no product ${sku}`);
    return { sku, quantity, product };
  });
  for (const l of lines) if (!l.product.active) throw new ApiError(422, 'product_inactive', `product ${l.sku} is off sale`);
  let discount: DiscountCode | null = null;
  if (body.discountCode !== undefined && body.discountCode !== null) {
    if (typeof body.discountCode !== 'string') throw invalid('discountCode must be a string');
    discount = (db.prepare('SELECT code, percent FROM orders_discount_codes WHERE code = ?').get(body.discountCode.toUpperCase()) as DiscountCode | undefined) ?? null;
    if (!discount) throw new ApiError(422, 'unknown_discount_code', `no discount code ${body.discountCode}`);
  }
  let points = 0;
  if (body.pointsToSpend !== undefined && body.pointsToSpend !== null) {
    if (typeof body.pointsToSpend !== 'number' || !Number.isInteger(body.pointsToSpend) || body.pointsToSpend < 0) throw invalid('pointsToSpend must be an integer of at least 0');
    points = body.pointsToSpend;
  }
  if (points > 0 && !named) throw invalid('points can only be used on an order of an account');
  // Prices of a group, promotions and the floor count for an order placed on the account, not for one that only carries its e-mail address.
  const priced = priceOrder(lines, named ? customer : null, discount?.percent ?? null, points * loyalty.CENTS_PER_POINT);
  if (points > loyalty.balanceOf(customer?.id ?? '')) throw new ApiError(409, 'insufficient_points', 'the customer does not have that many points');
  // Shipping: only when the order names a carrier. The parcel is everything on the order; it goes to the order's address, or to the home country without one.
  // The cost is outside discounts, points and the floor; it carries VAT at the standard rate (R7: worked out on its own, rounded half up).
  const shipping = body.carrier === undefined || body.carrier === null ? { carrier: null, cents: 0 }
    : carriers.quote(body.carrier, address?.country ?? carriers.HOME_COUNTRY, lines.reduce((a, l) => a + l.quantity * (l.product.weightGrams ?? 0), 0));
  const shippingTax = vatIn(shipping.cents, carriers.SHIPPING_VAT_PERCENT);
  const id = randomUUID();
  const createdAt = now();
  const expiresAt = new Date(new Date(createdAt).getTime() + HOLD_MS).toISOString();
  db.prepare(`INSERT INTO orders_orders (id, customer_email, customer_id, ship_street, ship_city, ship_postal_code, ship_country, status,
      subtotal_cents, promotion_discount_cents, discount_cents, discount_code, points_spent, points_discount_cents, tax_cents, total_cents,
      carrier, shipping_cents, shipping_tax_cents, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, email, customer?.id ?? null,
    address?.street ?? null, address?.city ?? null, address?.postalCode ?? null, address?.country ?? null,
    priced.subtotalCents, priced.promotionDiscountCents, priced.discountCents, discount?.code ?? null, points, priced.pointsDiscountCents, priced.taxCents + shippingTax, priced.totalCents + shipping.cents,
    shipping.carrier, shipping.cents, shippingTax, createdAt, expiresAt);
  if (points > 0) loyalty.spend(customer!.id, id, points);
  for (const l of priced.lines) {
    db.prepare('INSERT INTO orders_lines (order_id, sku, quantity, unit_price_cents, tax_percent, tax_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, l.sku, l.quantity, l.unitPriceCents, l.taxPercent, l.taxCents, l.totalCents);
    stock.reserve(id, l.sku, l.quantity);
  }
  return getOrder(id);
}

export function listOrders(customerEmail: unknown): Order[] {
  if (typeof customerEmail !== 'string' || customerEmail === '') throw invalid('customerEmail is required');
  const rows = db.prepare('SELECT * FROM orders_orders WHERE lower(customer_email) = lower(?) ORDER BY created_at DESC, seq DESC').all(customerEmail) as OrderRow[];
  return rows.map(out);
}

/** The orders of an account, newest first. */
export function listCustomerOrders(customerId: string): Order[] {
  customers.getCustomer(customerId);
  return (db.prepare('SELECT * FROM orders_orders WHERE customer_id = ? ORDER BY created_at DESC, seq DESC').all(customerId) as OrderRow[]).map(out);
}
/** A new account takes the orders placed earlier with its e-mail address and no account. */
export function adoptOrders(customer: customers.Customer): customers.Customer {
  db.prepare('UPDATE orders_orders SET customer_id = ? WHERE customer_id IS NULL AND lower(customer_email) = lower(?)').run(customer.id, customer.email);
  return customer;
}
/** Orders that still need the person: waiting for payment, or paid and not (completely) sent. */
export function hasOpenOrders(customerId: string): boolean {
  return db.prepare(`SELECT 1 FROM orders_orders WHERE customer_id = ? AND status IN ('pending', 'paid')`).get(customerId) !== undefined;
}
/** The same orders, oldest first. */
export function openOrders(customerId: string): Order[] {
  return (db.prepare(`SELECT * FROM orders_orders WHERE customer_id = ? AND status IN ('pending', 'paid') ORDER BY seq`).all(customerId) as OrderRow[]).map(out);
}
/** A paid order of which nothing has gone out is called off, once its money has been given back: stock and points as for a cancelled order. */
export function callOff(id: string): void {
  const order = getOrder(id);
  if (order.status !== 'paid' || order.lines.some((l) => l.shippedQuantity > 0)) throw invalidState('only a paid order of which nothing was sent can be called off');
  drop(order, 'cancelled');
  const account = pointsAccount(order);
  if (account) loyalty.revokeDownTo(account, id, 0);
}
/** R4: takes the person out of their orders. The orders, their lines and amounts stay. */
export function anonymise(customerId: string): void {
  db.prepare(`UPDATE orders_orders SET customer_email = NULL, ship_street = NULL, ship_city = NULL, ship_postal_code = NULL, ship_country = NULL
    WHERE customer_id = ?`).run(customerId);
}
/** The account that still collects and gets back points for an order: none once erased. */
function pointsAccount(order: Order): string | null {
  if (!order.customerId) return null;
  return customers.findCustomer(order.customerId)?.erased === false ? order.customerId : null;
}
/** The order is off: the points it used come back. */
function drop(order: Order, status: OrderStatus): void {
  setStatus(order.id, status);
  stock.release(order.id);
  const account = pointsAccount(order);
  if (account && order.pointsSpent > 0) loyalty.restore(account, order.id);
}

// ---- status changes

export function cancelOrder(id: string): Order {
  const order = getOrder(id);
  if (order.status === 'cancelled') return order;
  if (order.status !== 'pending') throw invalidState(`a ${order.status} order cannot be cancelled`);
  drop(order, 'cancelled');
  return getOrder(id);
}

export function expireOrders(body: unknown): { expired: string[] } {
  let at = now();
  if (body !== undefined && body !== null) {
    if (!isObject(body)) throw invalid('body must be an object');
    if (body.now !== undefined) {
      if (typeof body.now !== 'string' || Number.isNaN(new Date(body.now).getTime())) throw invalid('now must be a date-time');
      at = new Date(body.now).toISOString();
    }
  }
  const due = db.prepare(`SELECT id FROM orders_orders WHERE status = 'pending' AND expires_at <= ? ORDER BY seq`).all(at) as { id: string }[];
  for (const { id } of due) drop(getOrder(id), 'expired');
  return { expired: due.map((d) => d.id) };
}

/** Used by the payments module after a succeeded charge. */
export function markPaid(id: string): void {
  const order = getOrder(id);
  if (order.status !== 'pending') throw invalidState('only a pending order can be paid');
  setStatus(id, 'paid');
  const account = pointsAccount(order);
  // Points are for the goods, not for the postage.
  if (account) loyalty.earn(account, id, order.totalCents - order.shippingCents);
}
/** Used by the shipments module once goods have left: the order is shipped when everything on it has gone out. */
export function markShipped(id: string, sent: { sku: string; quantity: number }[]): void {
  const order = getOrder(id);
  if (order.status !== 'paid') throw invalidState('only a paid order can be shipped');
  for (const s of sent) {
    // What the goods cost is fixed when the first units of the line go out (R6): later receipts do not change it.
    db.prepare('UPDATE orders_lines SET unit_cost_cents = ? WHERE order_id = ? AND sku = ? AND shipped_quantity = 0').run(averageOf(s.sku), id, s.sku);
    db.prepare('UPDATE orders_lines SET shipped_quantity = shipped_quantity + ? WHERE order_id = ? AND sku = ?').run(s.quantity, id, s.sku);
  }
  if (getOrder(id).lines.every((l) => l.shippedQuantity === l.quantity)) setStatus(id, 'shipped');
}
/** Used by the invoicing module: money given back by a correction of an invoice. Points follow the money. */
export function recordCorrection(id: string, cents: number): void {
  db.prepare('UPDATE orders_orders SET corrected_cents = corrected_cents + ? WHERE id = ?').run(cents, id);
  const order = getOrder(id);
  const account = pointsAccount(order);
  if (account) loyalty.revokeDownTo(account, id, order.totalCents - order.shippingCents - order.correctedCents - refundedOf(id));
}

// ---- stock correction from an order

export function correctStock(id: string, body: unknown): stock.StockLevel {
  const order = getOrder(id);
  if (!isObject(body)) throw invalid('body must be an object');
  const { sku, onHand } = body;
  if (typeof sku !== 'string') throw invalid('sku is required');
  if (typeof onHand !== 'number' || !Number.isInteger(onHand) || onHand < 0) throw invalid('onHand must be an integer of at least 0');
  if (!order.lines.some((l) => l.sku === sku)) throw invalid(`product ${sku} is not on the order`);
  return stock.correctOnHand(sku, stock.warehouseOf(body.warehouse), onHand, id);
}

// ---- returns

const returnOut = (r: { id: string; order_id: string; refund_cents: number; created_at: string }): OrderReturn => ({
  id: r.id, orderId: r.order_id,
  lines: db.prepare('SELECT sku, quantity FROM orders_return_lines WHERE return_id = ? ORDER BY seq').all(r.id) as ReturnLine[],
  refundCents: r.refund_cents, createdAt: r.created_at,
});

export function listReturns(id: string): OrderReturn[] {
  getOrder(id);
  return (db.prepare('SELECT * FROM orders_returns WHERE order_id = ? ORDER BY seq').all(id) as Parameters<typeof returnOut>[0][]).map(returnOut);
}

const refundedOf = (id: string): number => (db.prepare('SELECT COALESCE(SUM(refund_cents), 0) AS n FROM orders_returns WHERE order_id = ?').get(id) as { n: number }).n;

export type Refund = (orderId: string, amountCents: number) => Promise<void>;
/** Writes the credit notes of a return (the invoicing module); `invoiceId` when the goods are those of one invoice. */
export type Credit = (order: Order, made: OrderReturn, complete: boolean, at: string, invoiceId?: string) => void;

/**
 * `refund` gives the money back through the payments module; when it throws, nothing is recorded.
 * `credit` writes the credit notes of the return, at the time the request says to assume.
 */
export async function returnGoods(id: string, body: unknown, refund: Refund, credit: Credit): Promise<OrderReturn> {
  const order = getOrder(id);
  if (order.status !== 'shipped') throw invalidState(`a ${order.status} order takes no returns`);
  if (!isObject(body)) throw invalid('body must be an object');
  const at = timeOf(body);
  return bookReturn(order, mergedLines(body.lines), () => stock.warehouseOf(body.warehouse), at, refund, credit);
}
/** A parcel that came back undelivered (the shipments module): its goods return to the warehouse it left from, also while the rest of the order has not gone out. */
export async function returnShipment(orderId: string, sent: ReturnLine[], warehouse: string, at: string, refund: Refund, credit: Credit, invoiceId: string): Promise<OrderReturn> {
  const order = getOrder(orderId);
  if (order.status !== 'shipped' && order.status !== 'paid') throw invalidState(`a ${order.status} order takes no returns`);
  return bookReturn(order, new Map(sent.map((l) => [l.sku, l.quantity])), () => warehouse, at, refund, credit, invoiceId);
}

async function bookReturn(order: Order, lines: Map<string, number>, warehouseOf: () => string, at: string, refund: Refund, credit: Credit, invoiceId?: string): Promise<OrderReturn> {
  const id = order.id;
  const returnedBefore = (sku: string) => (db.prepare('SELECT COALESCE(SUM(quantity), 0) AS n FROM orders_return_lines WHERE order_id = ? AND sku = ?').get(id, sku) as { n: number }).n;
  let value = 0;
  for (const [sku, quantity] of lines) {
    const line = order.lines.find((l) => l.sku === sku);
    if (!line) throw invalid(`product ${sku} is not on the order`);
    if (returnedBefore(sku) + quantity > line.quantity) throw invalid(`more of ${sku} returned than ordered`);
    value += quantity * line.unitPriceCents;
  }
  const warehouse = warehouseOf();
  const complete = order.lines.every((l) => returnedBefore(l.sku) + (lines.get(l.sku) ?? 0) === l.quantity);
  // What the customer has paid for the goods: the shipping cost is not given back, and what corrections gave back is gone already.
  const goodsPaid = order.totalCents - order.shippingCents - order.correctedCents;
  const refundedBefore = refundedOf(id);
  const refundCents = complete ? goodsPaid - refundedBefore : Math.min(Math.floor((value * goodsPaid) / order.subtotalCents), goodsPaid - refundedBefore);

  if (refundCents > 0) await refund(id, refundCents);

  const returnId = randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO orders_returns (id, order_id, refund_cents, created_at) VALUES (?, ?, ?, ?)').run(returnId, id, refundCents, now());
    for (const [sku, quantity] of lines) {
      db.prepare('INSERT INTO orders_return_lines (return_id, order_id, sku, quantity) VALUES (?, ?, ?, ?)').run(returnId, id, sku, quantity);
      stock.receiveReturn(sku, warehouse, quantity, id);
    }
    if (complete) setStatus(id, 'returned');
    credit(order, listReturns(id).find((r) => r.id === returnId)!, complete, at, invoiceId);
    const account = pointsAccount(order);
    if (account) {
      // Points the order used come back like the money does; points it earned go as far as the money went back.
      if (order.pointsSpent > 0) loyalty.restore(account, id, complete ? undefined : Math.floor((order.pointsSpent * value) / order.subtotalCents));
      loyalty.revokeDownTo(account, id, goodsPaid - refundedBefore - refundCents);
    }
  })();
  return listReturns(id).find((r) => r.id === returnId)!;
}
