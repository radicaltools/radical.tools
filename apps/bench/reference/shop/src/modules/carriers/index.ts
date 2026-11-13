// Carriers: who takes the parcels, the shop's shipping zones (groups of countries) and what a
// carrier charges for a parcel up to a weight into a zone. Works out the shipping cost of an order.
import { db } from '../../db';
import { ApiError, invalid, isObject, notFound } from '../../errors';

db.exec(`
CREATE TABLE IF NOT EXISTS carriers_carriers (code TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS carriers_zones (code TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS carriers_zone_countries (country TEXT PRIMARY KEY, zone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS carriers_rates (
  carrier TEXT NOT NULL, zone TEXT NOT NULL, max_weight_grams INTEGER NOT NULL, price_cents INTEGER NOT NULL,
  PRIMARY KEY (carrier, zone, max_weight_grams));
`);

export interface Carrier { code: string; name: string }
export interface Zone { code: string; name: string; countries: string[] }
export interface Rate { zone: string; maxWeightGrams: number; priceCents: number }

/** Where an order without a shipping address goes: the shop's own country. */
export const HOME_COUNTRY = 'PL';
/** Shipping is a service at the standard rate, whatever is in the parcel. */
export const SHIPPING_VAT_PERCENT = 23;

const nameOf = (v: unknown): string => {
  if (typeof v !== 'string' || v.trim().length < 1 || v.trim().length > 200) throw invalid('name must be 1 to 200 characters');
  return v.trim();
};
const whole = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;

// ---- zones

const countriesOf = (zone: string): string[] =>
  (db.prepare('SELECT country FROM carriers_zone_countries WHERE zone = ? ORDER BY country').all(zone) as { country: string }[]).map((r) => r.country);
export function listZones(): Zone[] {
  return (db.prepare('SELECT code, name FROM carriers_zones ORDER BY code').all() as { code: string; name: string }[]).map((z) => ({ ...z, countries: countriesOf(z.code) }));
}
export function createZone(body: unknown): Zone {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.code !== 'string' || !/^[A-Z0-9-]{2,20}$/.test(body.code)) throw invalid('code must be 2 to 20 of A-Z, 0-9 and dashes');
  const name = nameOf(body.name);
  const countries = body.countries;
  if (!Array.isArray(countries) || countries.length === 0) throw invalid('a zone needs at least one country');
  for (const c of countries) if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c)) throw invalid('a country is a two-letter code in upper case');
  if (new Set(countries).size !== countries.length) throw invalid('a country is named once');
  if (db.prepare('SELECT 1 FROM carriers_zones WHERE code = ?').get(body.code)) throw new ApiError(409, 'duplicate_zone', `zone ${body.code} exists`);
  for (const c of countries) if (db.prepare('SELECT 1 FROM carriers_zone_countries WHERE country = ?').get(c)) throw new ApiError(409, 'country_in_zone', `${c} is in another zone`);
  db.prepare('INSERT INTO carriers_zones (code, name) VALUES (?, ?)').run(body.code, name);
  for (const c of countries) db.prepare('INSERT INTO carriers_zone_countries (country, zone) VALUES (?, ?)').run(c, body.code);
  return { code: body.code, name, countries: countriesOf(body.code) };
}

// ---- carriers and their rates

export function listCarriers(): Carrier[] {
  return db.prepare('SELECT code, name FROM carriers_carriers ORDER BY code').all() as Carrier[];
}
const findCarrier = (code: string): Carrier | null => (db.prepare('SELECT code, name FROM carriers_carriers WHERE code = ?').get(code) as Carrier | undefined) ?? null;
export function createCarrier(body: unknown): Carrier {
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.code !== 'string' || !/^[A-Z0-9]{2,10}$/.test(body.code)) throw invalid('code must be 2 to 10 of A-Z and 0-9');
  const name = nameOf(body.name);
  if (findCarrier(body.code)) throw new ApiError(409, 'duplicate_carrier', `carrier ${body.code} exists`);
  db.prepare('INSERT INTO carriers_carriers (code, name) VALUES (?, ?)').run(body.code, name);
  return { code: body.code, name };
}
export function listRates(carrier: string): Rate[] {
  if (!findCarrier(carrier)) throw notFound(`no carrier ${carrier}`);
  return db.prepare('SELECT zone, max_weight_grams AS maxWeightGrams, price_cents AS priceCents FROM carriers_rates WHERE carrier = ? ORDER BY zone, max_weight_grams').all(carrier) as Rate[];
}
/** Sets, or replaces, what the carrier charges for a parcel of up to that weight into the zone. */
export function setRate(carrier: string, body: unknown): Rate {
  if (!findCarrier(carrier)) throw notFound(`no carrier ${carrier}`);
  if (!isObject(body)) throw invalid('body must be an object');
  if (typeof body.zone !== 'string' || !db.prepare('SELECT 1 FROM carriers_zones WHERE code = ?').get(body.zone)) throw new ApiError(422, 'unknown_zone', `no zone ${String(body.zone)}`);
  if (!whole(body.maxWeightGrams, 1)) throw invalid('maxWeightGrams must be a whole number above 0');
  if (!whole(body.priceCents, 0)) throw invalid('priceCents must be a whole number of at least 0');
  db.prepare(`INSERT INTO carriers_rates (carrier, zone, max_weight_grams, price_cents) VALUES (?, ?, ?, ?)
    ON CONFLICT (carrier, zone, max_weight_grams) DO UPDATE SET price_cents = excluded.price_cents`).run(carrier, body.zone, body.maxWeightGrams, body.priceCents);
  return { zone: body.zone, maxWeightGrams: body.maxWeightGrams, priceCents: body.priceCents };
}

/**
 * What the carrier charges for a parcel of that weight to that country: the rate of the country's zone
 * with the lowest weight limit the parcel fits under. Refused when the carrier does not go there or the parcel is too heavy.
 */
export function quote(carrier: unknown, country: string, weightGrams: number): { carrier: string; cents: number } {
  if (typeof carrier !== 'string' || !findCarrier(carrier)) throw new ApiError(422, 'unknown_carrier', `no carrier ${String(carrier)}`);
  const zone = (db.prepare('SELECT zone FROM carriers_zone_countries WHERE country = ?').get(country) as { zone: string } | undefined)?.zone;
  if (!zone) throw new ApiError(422, 'no_shipping_zone', `${country} is in no shipping zone`);
  const rates = listRates(carrier).filter((r) => r.zone === zone);
  if (rates.length === 0) throw new ApiError(422, 'carrier_does_not_serve', `carrier ${carrier} has no rates for zone ${zone}`);
  const rate = rates.find((r) => weightGrams <= r.maxWeightGrams);
  if (!rate) throw new ApiError(422, 'parcel_too_heavy', `carrier ${carrier} takes no parcel of ${weightGrams} g into zone ${zone}`);
  return { carrier, cents: rate.priceCents };
}
