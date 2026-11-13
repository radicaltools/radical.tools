// Pricing: what an order costs. Price lists of customer groups, promotions, the
// discount code, loyalty points, VAT (R7: per line, rounded half up, totals are
// sums of the lines) and the floor (R8: nothing is sold below its cost).
// Everything is worked out per order line, in whole cents.
import { randomUUID } from 'node:crypto';
import { db } from '../../db';
import { ApiError, invalid, isObject, notFound } from '../../errors';
import { findProduct, vatPercentOf, Product } from '../catalogue';
import { Customer, getGroup } from '../customers';
import { averageOf } from '../costing';

db.exec(`
CREATE TABLE IF NOT EXISTS pricing_group_prices (
  group_id TEXT NOT NULL, sku TEXT NOT NULL, price_cents INTEGER NOT NULL, PRIMARY KEY (group_id, sku));
CREATE TABLE IF NOT EXISTS pricing_promotions (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  buy_quantity INTEGER, free_quantity INTEGER, price_cents INTEGER, percent INTEGER);
CREATE TABLE IF NOT EXISTS pricing_promotion_items (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, promotion_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL);
`);

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const whole = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

// ---- VAT and the floor

/** The VAT inside an amount that includes it, rounded half up (R7). */
export function vatIn(amountCents: number, percent: number): number {
  return Math.floor((2 * amountCents * percent + (100 + percent)) / (2 * (100 + percent)));
}
/** The smallest amount, VAT included, that leaves at least `netCents` without VAT. */
function grossFor(netCents: number, percent: number): number {
  let gross = Math.max(0, Math.ceil((netCents * (100 + percent)) / 100) - 2);
  while (gross - vatIn(gross, percent) < netCents) gross += 1;
  return gross;
}
/** Splits an amount over lines in proportion to their weights: shares rounded down, the cents left over one each from the first line down. */
export function spread(amountCents: number, weights: number[]): number[] {
  const total = sum(weights);
  if (amountCents <= 0 || total <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => Math.floor((amountCents * w) / total));
  let left = amountCents - sum(shares);
  for (let i = 0; left > 0 && i < weights.length; i++) if (weights[i] > 0) { shares[i] += 1; left -= 1; }
  return shares;
}

// ---- price lists of customer groups

export interface GroupPrice { sku: string; priceCents: number }

export function listGroupPrices(groupId: string): GroupPrice[] {
  getGroup(groupId);
  return db.prepare('SELECT sku, price_cents AS priceCents FROM pricing_group_prices WHERE group_id = ? ORDER BY sku').all(groupId) as GroupPrice[];
}
export function setGroupPrice(groupId: string, sku: string, body: unknown): GroupPrice {
  getGroup(groupId);
  if (!findProduct(sku)) throw notFound(`no product ${sku}`);
  if (!isObject(body) || !whole(body.priceCents, 1, Number.MAX_SAFE_INTEGER)) throw invalid('priceCents must be an integer above 0');
  db.prepare(`INSERT INTO pricing_group_prices (group_id, sku, price_cents) VALUES (?, ?, ?)
    ON CONFLICT (group_id, sku) DO UPDATE SET price_cents = excluded.price_cents`).run(groupId, sku, body.priceCents);
  return { sku, priceCents: body.priceCents };
}
export function removeGroupPrice(groupId: string, sku: string): void {
  getGroup(groupId);
  const done = db.prepare('DELETE FROM pricing_group_prices WHERE group_id = ? AND sku = ?').run(groupId, sku);
  if (done.changes === 0) throw notFound(`the group has no price for ${sku}`);
}
const groupPrice = (groupId: string, sku: string): number | null =>
  (db.prepare('SELECT price_cents AS p FROM pricing_group_prices WHERE group_id = ? AND sku = ?').get(groupId, sku) as { p: number } | undefined)?.p ?? null;

// ---- promotions

export interface PromotionItem { sku: string; quantity: number }
export interface Promotion {
  id: string; name: string; kind: 'multibuy' | 'bundle' | 'sale'; active: boolean;
  sku: string | null; buyQuantity: number | null; freeQuantity: number | null;   // multibuy
  items: PromotionItem[] | null; priceCents: number | null;                      // bundle
  percent: number | null;                                                        // sale: off every product
}
type PromotionRow = { id: string; name: string; kind: 'multibuy' | 'bundle' | 'sale'; active: number; buy_quantity: number | null; free_quantity: number | null; price_cents: number | null; percent: number | null };
function promotionOut(r: PromotionRow): Promotion {
  const items = db.prepare('SELECT sku, quantity FROM pricing_promotion_items WHERE promotion_id = ? ORDER BY seq').all(r.id) as PromotionItem[];
  return {
    id: r.id, name: r.name, kind: r.kind, active: r.active === 1,
    sku: r.kind === 'multibuy' ? items[0].sku : null, buyQuantity: r.buy_quantity, freeQuantity: r.free_quantity,
    items: r.kind === 'bundle' ? items : null, priceCents: r.price_cents, percent: r.percent,
  };
}
export function listPromotions(): Promotion[] {
  return (db.prepare('SELECT * FROM pricing_promotions ORDER BY seq').all() as PromotionRow[]).map(promotionOut);
}
export function getPromotion(id: string): Promotion {
  const r = db.prepare('SELECT * FROM pricing_promotions WHERE id = ?').get(id) as PromotionRow | undefined;
  if (!r) throw notFound(`no promotion ${id}`);
  return promotionOut(r);
}
export function createPromotion(body: unknown): Promotion {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 200) throw invalid('name must be 1 to 200 characters');
  let items: PromotionItem[];
  if (body.kind === 'sale') {
    // A sale is on every product at once; one sale runs at a time.
    if (!whole(body.percent, 1, 90)) throw invalid('percent must be a whole number from 1 to 90');
    if (listPromotions().some((p) => p.active && p.kind === 'sale')) throw new ApiError(409, 'sale_running', 'a sale is running already');
    items = [];
  } else if (body.kind === 'multibuy') {
    if (typeof body.sku !== 'string') throw invalid('sku is required');
    if (!whole(body.buyQuantity, 1, 100) || !whole(body.freeQuantity, 1, 100)) throw invalid('buyQuantity and freeQuantity must be whole numbers from 1 to 100');
    items = [{ sku: body.sku, quantity: body.buyQuantity + body.freeQuantity }];
  } else if (body.kind === 'bundle') {
    if (!Array.isArray(body.items) || body.items.length === 0) throw invalid('a bundle needs items');
    items = body.items.map((i) => {
      if (!isObject(i) || typeof i.sku !== 'string' || !whole(i.quantity, 1, 100)) throw invalid('an item needs a sku and a quantity from 1 to 100');
      return { sku: i.sku, quantity: i.quantity };
    });
    if (new Set(items.map((i) => i.sku)).size !== items.length) throw invalid('a product can be in a bundle once');
    if (sum(items.map((i) => i.quantity)) < 2) throw invalid('a bundle has at least two units');
    if (!whole(body.priceCents, 1, Number.MAX_SAFE_INTEGER)) throw invalid('priceCents must be an integer above 0');
  } else throw invalid('kind must be multibuy, bundle or sale');
  for (const i of items) if (!findProduct(i.sku)) throw new ApiError(422, 'unknown_product', `no product ${i.sku}`);
  if (body.kind === 'bundle' && (body.priceCents as number) >= sum(items.map((i) => i.quantity * findProduct(i.sku)!.priceCents))) {
    throw new ApiError(422, 'bundle_not_cheaper', 'the price of a bundle must be below the price of its items');
  }
  for (const i of items) {
    if (db.prepare(`SELECT 1 FROM pricing_promotion_items i JOIN pricing_promotions p ON p.id = i.promotion_id WHERE p.active = 1 AND i.sku = ?`).get(i.sku)) {
      throw new ApiError(409, 'product_in_promotion', `product ${i.sku} is in a running promotion`);
    }
  }
  const id = randomUUID();
  db.prepare('INSERT INTO pricing_promotions (id, name, kind, buy_quantity, free_quantity, price_cents, percent) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, body.name.trim(), body.kind, body.kind === 'multibuy' ? body.buyQuantity : null, body.kind === 'multibuy' ? body.freeQuantity : null, body.kind === 'bundle' ? body.priceCents : null, body.kind === 'sale' ? body.percent : null);
  for (const i of items) db.prepare('INSERT INTO pricing_promotion_items (promotion_id, sku, quantity) VALUES (?, ?, ?)').run(id, i.sku, i.quantity);
  return getPromotion(id);
}
/** An ended promotion counts for no new order; orders placed before keep what they got. */
export function endPromotion(id: string): Promotion {
  getPromotion(id);
  db.prepare('UPDATE pricing_promotions SET active = 0 WHERE id = ?').run(id);
  return getPromotion(id);
}

// ---- the price of an order

export interface PricedLine {
  sku: string; quantity: number; unitPriceCents: number;
  promotionCents: number; codeCents: number; pointsCents: number;
  totalCents: number; taxPercent: number; taxCents: number;
}
export interface PricedOrder {
  lines: PricedLine[];
  subtotalCents: number; promotionDiscountCents: number; discountCents: number; pointsDiscountCents: number;
  taxCents: number; totalCents: number;
}

/**
 * `customer` is the account the order is placed on (null for an order without an account),
 * `codePercent` the percentage of its discount code, `pointsCents` what the points it uses are worth.
 */
export function priceOrder(input: { sku: string; quantity: number; product: Product }[], customer: Customer | null, codePercent: number | null, pointsCents: number): PricedOrder {
  const groupId = customer?.groupId ?? null;
  // Wholesale prices are the best prices: no code and no promotion on top of them.
  if (groupId && codePercent !== null) throw new ApiError(422, 'code_not_allowed', 'a customer of a group cannot use a discount code');

  const lines = input.map((l) => {
    const taxPercent = vatPercentOf(l.product);
    const cost = averageOf(l.sku);
    let unit = l.product.priceCents;
    const listed = groupId ? groupPrice(groupId, l.sku) : null;
    // R8: a price-list price is not used below the cost; the normal price is Marta's own and stands.
    if (listed !== null) unit = cost === null ? listed : Math.max(listed, Math.min(l.product.priceCents, grossFor(cost, taxPercent)));
    const value = l.quantity * unit;
    // R8: the least the line may come to; none while the cost is unknown.
    const floor = cost === null ? 0 : Math.min(value, grossFor(l.quantity * cost, taxPercent));
    return { sku: l.sku, quantity: l.quantity, unitPriceCents: unit, taxPercent, value, floor, promotion: 0, code: 0, points: 0 };
  });
  const at = (sku: string) => lines.find((l) => l.sku === sku);

  // 1. Promotions (each product is in at most one running promotion).
  if (!groupId) {
    const running = listPromotions().filter((x) => x.active);
    const sale = running.find((x) => x.kind === 'sale');
    // While a sale runs the other promotions rest: every line gets the sale's percentage, rounded down.
    if (sale) for (const l of lines) l.promotion = Math.floor((l.value * sale.percent!) / 100);
    for (const p of sale ? [] : running) {
      if (p.kind === 'multibuy') {
        const line = at(p.sku!);
        if (line) line.promotion = Math.floor(line.quantity / (p.buyQuantity! + p.freeQuantity!)) * p.freeQuantity! * line.unitPriceCents;
      } else {
        const parts = p.items!.map((i) => ({ line: at(i.sku), quantity: i.quantity }));
        const sets = Math.min(...parts.map((x) => (x.line ? Math.floor(x.line.quantity / x.quantity) : 0)));
        if (sets < 1) continue;
        const values = parts.map((x) => sets * x.quantity * x.line!.unitPriceCents);
        const shares = spread(Math.max(0, sum(values) - sets * p.priceCents!), values);
        parts.forEach((x, i) => { x.line!.promotion = shares[i]; });
      }
    }
    // R8: whatever the promotion or the sale says, a line stops at its floor.
    for (const l of lines) l.promotion = Math.min(l.promotion, l.value - l.floor);
  }

  // 2. The discount code: a percentage of the lines that got no promotion.
  if (codePercent !== null) {
    const weights = lines.map((l) => (l.promotion > 0 ? 0 : l.value));
    const shares = spread(Math.floor((sum(weights) * codePercent) / 100), weights);
    lines.forEach((l, i) => { l.code = Math.min(shares[i], l.value - l.promotion - l.floor); });
  }

  // 3. Points: at most half of what is left, and no line below its floor.
  if (pointsCents > 0) {
    const left = lines.map((l) => l.value - l.promotion - l.code);
    if (pointsCents > Math.floor(sum(left) / 2)) throw new ApiError(422, 'too_many_points', 'points pay for at most half of an order');
    const room = lines.map((l, i) => left[i] - l.floor);
    if (pointsCents > sum(room)) throw new ApiError(422, 'points_below_cost', 'points cannot take goods below their cost');
    const shares = spread(pointsCents, left).map((s, i) => Math.min(s, room[i]));
    let over = pointsCents - sum(shares);
    for (let i = 0; over > 0 && i < lines.length; i++) { const more = Math.min(over, room[i] - shares[i]); shares[i] += more; over -= more; }
    lines.forEach((l, i) => { l.points = shares[i]; });
  }

  const priced: PricedLine[] = lines.map((l) => {
    const totalCents = l.value - l.promotion - l.code - l.points;
    return { sku: l.sku, quantity: l.quantity, unitPriceCents: l.unitPriceCents, promotionCents: l.promotion, codeCents: l.code, pointsCents: l.points,
      totalCents, taxPercent: l.taxPercent, taxCents: vatIn(totalCents, l.taxPercent) };
  });
  return {
    lines: priced,
    subtotalCents: sum(lines.map((l) => l.value)),
    promotionDiscountCents: sum(priced.map((l) => l.promotionCents)),
    discountCents: sum(priced.map((l) => l.codeCents)),
    pointsDiscountCents: pointsCents,
    taxCents: sum(priced.map((l) => l.taxCents)),
    totalCents: sum(priced.map((l) => l.totalCents)),
  };
}
