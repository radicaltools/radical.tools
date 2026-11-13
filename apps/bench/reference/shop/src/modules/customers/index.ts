// Customers: accounts, their addresses, blocking. Personal data lives only here
// and in the copies an order keeps (R4: both can be erased, see the privacy module).
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { ApiError, invalid, invalidState, isObject, notFound } from '../../errors';

db.exec(`
CREATE TABLE IF NOT EXISTS customers_customers (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT, email TEXT, phone TEXT,
  blocked INTEGER NOT NULL DEFAULT 0, erased INTEGER NOT NULL DEFAULT 0, group_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers_groups (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers_addresses (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL,
  street TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT NOT NULL, country TEXT NOT NULL);
`);

export interface Customer { id: string; name: string | null; email: string | null; phone: string | null; blocked: boolean; erased: boolean; groupId: string | null }
export interface Group { id: string; name: string }
export interface AddressFields { street: string; city: string; postalCode: string; country: string }
export interface Address extends AddressFields { id: string }

type Row = { id: string; name: string | null; email: string | null; phone: string | null; blocked: number; erased: number; group_id: string | null };
const out = (r: Row): Customer => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, blocked: r.blocked === 1, erased: r.erased === 1, groupId: r.group_id });
type AddressRow = { id: string; street: string; city: string; postal_code: string; country: string };
const addressOut = (r: AddressRow): Address => ({ id: r.id, street: r.street, city: r.city, postalCode: r.postal_code, country: r.country });

const text = (v: unknown, what: string, max = 200): string => {
  if (typeof v !== 'string' || v.trim().length < 1 || v.trim().length > max) throw invalid(`${what} must be 1 to ${max} characters`);
  return v.trim();
};
const emailOf = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(v)) throw invalid('email must be an email address');
  return v;
};
const phoneOf = (v: unknown): string | null => (v === undefined || v === null ? null : text(v, 'phone', 40));

export function findCustomer(id: string): Customer | null {
  const r = db.prepare('SELECT * FROM customers_customers WHERE id = ?').get(id) as Row | undefined;
  return r ? out(r) : null;
}
export function getCustomer(id: string): Customer {
  const c = findCustomer(id);
  if (!c) throw notFound(`no customer ${id}`);
  return c;
}
/** The account that has this e-mail address, upper and lower case ignored. */
export function findByEmail(email: string): Customer | null {
  const r = db.prepare('SELECT * FROM customers_customers WHERE erased = 0 AND lower(email) = lower(?)').get(email) as Row | undefined;
  return r ? out(r) : null;
}
/** A customer that can be worked with: exists and has not been erased. */
function live(id: string): Customer {
  const c = getCustomer(id);
  if (c.erased) throw invalidState('the customer has been erased');
  return c;
}
/** The account an order is placed on: refused when erased or blocked. */
export function buyer(id: string): Customer {
  const c = findCustomer(id);
  if (!c) throw new ApiError(422, 'unknown_customer', `no customer ${id}`);
  if (c.erased) throw invalidState('the customer has been erased');
  if (c.blocked) throw new ApiError(409, 'customer_blocked', 'the customer is blocked');
  return c;
}

export function createCustomer(body: unknown): Customer {
  if (!isObject(body)) throw invalid('body must be an object');
  const name = text(body.name, 'name');
  const email = emailOf(body.email);
  const phone = phoneOf(body.phone);
  if (findByEmail(email)) throw new ApiError(409, 'duplicate_email', 'an account with this e-mail address exists');
  const id = randomUUID();
  db.prepare('INSERT INTO customers_customers (id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)').run(id, name, email, phone, now());
  return getCustomer(id);
}
export function updateCustomer(id: string, body: unknown): Customer {
  const c = live(id);
  if (!isObject(body)) throw invalid('body must be an object');
  const name = body.name === undefined ? c.name : text(body.name, 'name');
  const email = body.email === undefined ? c.email : emailOf(body.email);
  const phone = body.phone === undefined ? c.phone : phoneOf(body.phone);
  const other = email === null ? null : findByEmail(email);
  if (other && other.id !== id) throw new ApiError(409, 'duplicate_email', 'an account with this e-mail address exists');
  db.prepare('UPDATE customers_customers SET name = ?, email = ?, phone = ? WHERE id = ?').run(name, email, phone, id);
  return getCustomer(id);
}
export function setBlocked(id: string, blocked: boolean): Customer {
  live(id);
  db.prepare('UPDATE customers_customers SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, id);
  return getCustomer(id);
}

// ---- groups

export function listGroups(): Group[] {
  return db.prepare('SELECT id, name FROM customers_groups ORDER BY seq').all() as Group[];
}
export function getGroup(id: string): Group {
  const g = db.prepare('SELECT id, name FROM customers_groups WHERE id = ?').get(id) as Group | undefined;
  if (!g) throw notFound(`no customer group ${id}`);
  return g;
}
export function createGroup(body: unknown): Group {
  if (!isObject(body)) throw invalid('body must be an object');
  const name = text(body.name, 'name');
  if (db.prepare('SELECT 1 FROM customers_groups WHERE lower(name) = lower(?)').get(name)) throw new ApiError(409, 'duplicate_group', `a group called ${name} exists`);
  const id = randomUUID();
  db.prepare('INSERT INTO customers_groups (id, name) VALUES (?, ?)').run(id, name);
  return { id, name };
}
/** Puts the customer into a group, or out of any group with `groupId: null`. */
export function setGroup(id: string, body: unknown): Customer {
  live(id);
  if (!isObject(body) || (body.groupId !== null && typeof body.groupId !== 'string')) throw invalid('groupId must be an id or null');
  if (body.groupId !== null && !db.prepare('SELECT 1 FROM customers_groups WHERE id = ?').get(body.groupId)) throw new ApiError(422, 'unknown_group', `no customer group ${body.groupId}`);
  db.prepare('UPDATE customers_customers SET group_id = ? WHERE id = ?').run(body.groupId, id);
  return getCustomer(id);
}

// ---- addresses

export function listAddresses(customerId: string): Address[] {
  getCustomer(customerId);
  return (db.prepare('SELECT * FROM customers_addresses WHERE customer_id = ? ORDER BY seq').all(customerId) as AddressRow[]).map(addressOut);
}
export function addAddress(customerId: string, body: unknown): Address {
  live(customerId);
  if (!isObject(body)) throw invalid('body must be an object');
  const street = text(body.street, 'street');
  const city = text(body.city, 'city');
  const postalCode = text(body.postalCode, 'postalCode', 20);
  if (typeof body.country !== 'string' || !/^[A-Z]{2}$/.test(body.country)) throw invalid('country must be a two-letter code in upper case');
  const id = randomUUID();
  db.prepare('INSERT INTO customers_addresses (id, customer_id, street, city, postal_code, country) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, customerId, street, city, postalCode, body.country);
  return listAddresses(customerId).find((a) => a.id === id)!;
}
export function removeAddress(customerId: string, addressId: string): void {
  if (!listAddresses(customerId).some((a) => a.id === addressId)) throw notFound(`no address ${addressId}`);
  db.prepare('DELETE FROM customers_addresses WHERE id = ?').run(addressId);
}
/** One of the customer's own addresses, for an order to copy. */
export function addressOf(customerId: string, addressId: unknown): AddressFields {
  if (typeof addressId !== 'string') throw invalid('shippingAddressId must be an id');
  const a = listAddresses(customerId).find((x) => x.id === addressId);
  if (!a) throw new ApiError(422, 'unknown_address', `the customer has no address ${addressId}`);
  return { street: a.street, city: a.city, postalCode: a.postalCode, country: a.country };
}

/** Removes the person from the account; the empty account stays (used by the privacy module). */
export function forget(id: string): void {
  db.prepare('DELETE FROM customers_addresses WHERE customer_id = ?').run(id);
  db.prepare('UPDATE customers_customers SET name = NULL, email = NULL, phone = NULL, group_id = NULL, erased = 1 WHERE id = ?').run(id);
}
