import { db } from '../../db';
import { ApiError, invalid, isObject, notFound } from '../../errors';

// Catalogue: products and the categories they fall into. A category carries the VAT rate of its products.
db.exec(`CREATE TABLE IF NOT EXISTS catalogue_products (
  sku TEXT PRIMARY KEY, name TEXT NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, category TEXT, weight_grams INTEGER);
CREATE TABLE IF NOT EXISTS catalogue_categories (code TEXT PRIMARY KEY, name TEXT NOT NULL, vat_percent INTEGER NOT NULL)`);

export interface Product { sku: string; name: string; priceCents: number; active: boolean; category: string | null; weightGrams: number | null }
export interface Category { code: string; name: string; vatPercent: number }
type Row = { sku: string; name: string; price_cents: number; active: number; category: string | null; weight_grams: number | null };
const out = (r: Row): Product => ({ sku: r.sku, name: r.name, priceCents: r.price_cents, active: r.active === 1, category: r.category, weightGrams: r.weight_grams });

// ---- categories

type CategoryRow = { code: string; name: string; vat_percent: number };
const categoryOut = (r: CategoryRow): Category => ({ code: r.code, name: r.name, vatPercent: r.vat_percent });
function vatOf(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50) throw invalid('vatPercent must be a whole number from 0 to 50');
  return v;
}
export function findCategory(code: string): Category | null {
  const r = db.prepare('SELECT * FROM catalogue_categories WHERE code = ?').get(code) as CategoryRow | undefined;
  return r ? categoryOut(r) : null;
}
export function listCategories(): Category[] {
  return (db.prepare('SELECT * FROM catalogue_categories ORDER BY code').all() as CategoryRow[]).map(categoryOut);
}
export function createCategory(body: unknown): Category {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.code !== 'string' || !/^[A-Z0-9-]{2,20}$/.test(body.code)) throw invalid('code must be 2 to 20 of A-Z, 0-9 and dashes');
  const name = nameOf(body.name);
  const vat = vatOf(body.vatPercent);
  if (findCategory(body.code)) throw new ApiError(409, 'duplicate_category', `category ${body.code} exists`);
  db.prepare('INSERT INTO catalogue_categories (code, name, vat_percent) VALUES (?, ?, ?)').run(body.code, name, vat);
  return findCategory(body.code)!;
}
export function updateCategory(code: string, body: unknown): Category {
  const c = findCategory(code);
  if (!c) throw notFound(`no category ${code}`);
  if (!isObject(body)) throw invalid('body must be an object');
  const name = body.name === undefined ? c.name : nameOf(body.name);
  const vat = body.vatPercent === undefined ? c.vatPercent : vatOf(body.vatPercent);
  db.prepare('UPDATE catalogue_categories SET name = ?, vat_percent = ? WHERE code = ?').run(name, vat, code);
  return findCategory(code)!;
}
/** The VAT rate of a product today: the rate of its category, 0 without one. */
export function vatPercentOf(product: Product): number {
  return product.category === null ? 0 : findCategory(product.category)?.vatPercent ?? 0;
}
/** The category named in a request: null takes the product out of its category. */
function categoryOf(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== 'string' || !findCategory(v)) throw new ApiError(422, 'unknown_category', `no category ${String(v)}`);
  return v;
}

// ---- products

function nameOf(v: unknown): string {
  if (typeof v !== 'string') throw invalid('name must be a string');
  const name = v.trim();
  if (name.length < 1 || name.length > 200) throw invalid('name must be 1 to 200 characters');
  return name;
}
function priceOf(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw invalid('priceCents must be an integer above 0');
  return v;
}

/** The weight of one unit in grams: a whole number, zero or more; null when not known. */
function weightOf(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw invalid('weightGrams must be a whole number of at least 0');
  return v;
}

export function findProduct(sku: string): Product | null {
  const r = db.prepare('SELECT * FROM catalogue_products WHERE sku = ?').get(sku) as Row | undefined;
  return r ? out(r) : null;
}
export function getProduct(sku: string): Product {
  const p = findProduct(sku);
  if (!p) throw notFound(`no product ${sku}`);
  return p;
}
export function createProduct(body: unknown): Product {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.sku !== 'string' || !/^[A-Z0-9-]{3,32}$/.test(body.sku)) throw invalid('sku must be 3 to 32 of A-Z, 0-9 and dashes');
  const name = nameOf(body.name);
  const price = priceOf(body.priceCents);
  const category = body.category === undefined ? null : categoryOf(body.category);
  const weight = body.weightGrams === undefined ? null : weightOf(body.weightGrams);
  if (findProduct(body.sku)) throw new ApiError(409, 'duplicate_sku', `product ${body.sku} exists`);
  db.prepare('INSERT INTO catalogue_products (sku, name, price_cents, active, category, weight_grams) VALUES (?, ?, ?, 1, ?, ?)').run(body.sku, name, price, category, weight);
  return getProduct(body.sku);
}
export function updateProduct(sku: string, body: unknown): Product {
  const p = getProduct(sku);
  if (!isObject(body)) throw invalid('body must be an object');
  const name = body.name === undefined ? p.name : nameOf(body.name);
  const price = body.priceCents === undefined ? p.priceCents : priceOf(body.priceCents);
  if (body.active !== undefined && typeof body.active !== 'boolean') throw invalid('active must be a boolean');
  const active = body.active === undefined ? p.active : body.active;
  const category = body.category === undefined ? p.category : categoryOf(body.category);
  const weight = body.weightGrams === undefined ? p.weightGrams : weightOf(body.weightGrams);
  db.prepare('UPDATE catalogue_products SET name = ?, price_cents = ?, active = ?, category = ?, weight_grams = ? WHERE sku = ?').run(name, price, active ? 1 : 0, category, weight, sku);
  return getProduct(sku);
}
export function listProducts(includeInactive: boolean): Product[] {
  const rows = db.prepare(`SELECT * FROM catalogue_products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sku ASC`).all() as Row[];
  return rows.map(out);
}
