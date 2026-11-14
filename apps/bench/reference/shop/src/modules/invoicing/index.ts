// Invoicing (R9): an invoice per shipment, credit notes for returns and for corrections, the daily sales report.
// A document is written once and never changed or deleted; its number is the next of
// its kind in the year of its date, so a year's numbers have no gaps. The one thing that
// can go from a document is the buyer's personal data (R4); number, date and amounts stay.
import { randomUUID } from 'node:crypto';
import { db, now } from '../../db';
import { invalid, isObject, notFound, timeOf } from '../../errors';
import { findProduct } from '../catalogue';
import { findCustomer, AddressFields } from '../customers';
import { Order, OrderReturn, getOrder, recordCorrection } from '../orders';
import { SHIPPING_VAT_PERCENT } from '../carriers';
import { spread, vatIn } from '../pricing';

db.exec(`
CREATE TABLE IF NOT EXISTS invoicing_documents (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, year INTEGER NOT NULL, sequence INTEGER NOT NULL,
  issued_on TEXT NOT NULL, order_id TEXT NOT NULL, customer_id TEXT, invoice_id TEXT, return_id TEXT,
  buyer_name TEXT, buyer_email TEXT, buyer_street TEXT, buyer_city TEXT, buyer_postal_code TEXT, buyer_country TEXT,
  total_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL DEFAULT 0, shipping_tax_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  UNIQUE (kind, year, sequence));
CREATE TABLE IF NOT EXISTS invoicing_lines (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL, tax_percent INTEGER NOT NULL, total_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL);
`);

type Kind = 'invoice' | 'credit_note';
export interface DocumentLine { sku: string; name: string; quantity: number; unitPriceCents: number; taxPercent: number; totalCents: number; taxCents: number }
export interface Document {
  id: string; kind: Kind; number: string; year: number; sequence: number; issuedOn: string;
  orderId: string; invoiceId: string | null;   // invoiceId: the invoice a credit note corrects
  buyer: { name: string | null; email: string | null; address: AddressFields | null };
  lines: DocumentLine[];
  shippingCents: number; shippingTaxCents: number;   // the shipping cost on an invoice (VAT included) and the VAT in it; both are in totalCents and taxCents
  totalCents: number; taxCents: number; netCents: number;
}
type Row = { id: string; kind: Kind; year: number; sequence: number; issued_on: string; order_id: string; invoice_id: string | null;
  buyer_name: string | null; buyer_email: string | null; buyer_street: string | null; buyer_city: string | null; buyer_postal_code: string | null; buyer_country: string | null;
  total_cents: number; tax_cents: number; shipping_cents: number; shipping_tax_cents: number };

function out(r: Row): Document {
  const lines = db.prepare(`SELECT sku, name, quantity, unit_price_cents AS unitPriceCents, tax_percent AS taxPercent, total_cents AS totalCents, tax_cents AS taxCents
    FROM invoicing_lines WHERE document_id = ? ORDER BY seq`).all(r.id) as DocumentLine[];
  return {
    id: r.id, kind: r.kind, number: `${r.kind === 'credit_note' ? 'K/' : ''}${r.year}/${String(r.sequence).padStart(4, '0')}`, year: r.year, sequence: r.sequence,
    issuedOn: r.issued_on, orderId: r.order_id, invoiceId: r.invoice_id,
    buyer: { name: r.buyer_name, email: r.buyer_email,
      address: r.buyer_street === null ? null : { street: r.buyer_street, city: r.buyer_city!, postalCode: r.buyer_postal_code!, country: r.buyer_country! } },
    lines, shippingCents: r.shipping_cents, shippingTaxCents: r.shipping_tax_cents,
    totalCents: r.total_cents, taxCents: r.tax_cents, netCents: r.total_cents - r.tax_cents,
  };
}

/** The only place that writes a document: it takes the next number of its kind in the year of its date. */
function write(kind: Kind, at: string, order: Order, buyer: Document['buyer'], invoiceId: string | null, returnId: string | null, lines: DocumentLine[], shippingCents = 0, shippingTaxCents = 0): Document {
  const issuedOn = at.slice(0, 10);
  const year = Number(issuedOn.slice(0, 4));
  const sequence = (db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM invoicing_documents WHERE kind = ? AND year = ?').get(kind, year) as { n: number }).n;
  const id = randomUUID();
  db.prepare(`INSERT INTO invoicing_documents (id, kind, year, sequence, issued_on, order_id, customer_id, invoice_id, return_id,
      buyer_name, buyer_email, buyer_street, buyer_city, buyer_postal_code, buyer_country, total_cents, tax_cents, shipping_cents, shipping_tax_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, kind, year, sequence, issuedOn, order.id, order.customerId, invoiceId, returnId,
    buyer.name, buyer.email, buyer.address?.street ?? null, buyer.address?.city ?? null, buyer.address?.postalCode ?? null, buyer.address?.country ?? null,
    lines.reduce((a, l) => a + l.totalCents, 0) + shippingCents, lines.reduce((a, l) => a + l.taxCents, 0) + shippingTaxCents, shippingCents, shippingTaxCents, now());
  for (const l of lines) {
    db.prepare('INSERT INTO invoicing_lines (document_id, sku, name, quantity, unit_price_cents, tax_percent, total_cents, tax_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, l.sku, l.name, l.quantity, l.unitPriceCents, l.taxPercent, l.totalCents, l.taxCents);
  }
  return get(kind, id);
}

function get(kind: Kind, id: string): Document {
  const r = db.prepare('SELECT * FROM invoicing_documents WHERE kind = ? AND id = ?').get(kind, id) as Row | undefined;
  if (!r) throw notFound(`no ${kind === 'invoice' ? 'invoice' : 'credit note'} ${id}`);
  return out(r);
}
function list(kind: Kind, orderId: string | null, year: string | null): Document[] {
  if (orderId !== null) return (db.prepare('SELECT * FROM invoicing_documents WHERE kind = ? AND order_id = ? ORDER BY seq').all(kind, orderId) as Row[]).map(out);
  if (year === null || !/^\d{4}$/.test(year)) throw invalid('orderId or year is required');
  return (db.prepare('SELECT * FROM invoicing_documents WHERE kind = ? AND year = ? ORDER BY sequence').all(kind, Number(year)) as Row[]).map(out);
}
export const getInvoice = (id: string): Document => get('invoice', id);
export const getCreditNote = (id: string): Document => get('credit_note', id);
/** The invoices of an order, or all of a year in the order of their numbers. */
export const listInvoices = (orderId: string | null, year: string | null): Document[] => list('invoice', orderId, year);
export const listCreditNotes = (orderId: string | null, year: string | null): Document[] => list('credit_note', orderId, year);

const num = (sql: string, ...args: unknown[]): number => (db.prepare(sql).get(...args) as { n: number }).n;
/** Units of an invoice's product that credit notes have taken back (a correction takes back none). */
const creditedUnits = (invoiceId: string, sku: string): number =>
  num(`SELECT COALESCE(SUM(l.quantity), 0) AS n FROM invoicing_lines l JOIN invoicing_documents d ON d.id = l.document_id WHERE d.kind = 'credit_note' AND d.invoice_id = ? AND l.sku = ?`, invoiceId, sku);
/** What credit notes have taken off an invoice's line, and off the invoice. */
const creditedOnLine = (invoiceId: string, sku: string): number =>
  num(`SELECT COALESCE(SUM(l.total_cents), 0) AS n FROM invoicing_lines l JOIN invoicing_documents d ON d.id = l.document_id WHERE d.kind = 'credit_note' AND d.invoice_id = ? AND l.sku = ?`, invoiceId, sku);
const creditedOn = (invoiceId: string): number => num(`SELECT COALESCE(SUM(total_cents), 0) AS n FROM invoicing_documents WHERE kind = 'credit_note' AND invoice_id = ?`, invoiceId);
/** Whether goods of an invoice have come back already. */
export const hasReturns = (invoiceId: string): boolean =>
  num(`SELECT COALESCE(SUM(l.quantity), 0) AS n FROM invoicing_lines l JOIN invoicing_documents d ON d.id = l.document_id WHERE d.kind = 'credit_note' AND d.invoice_id = ?`, invoiceId) > 0;

/**
 * The invoice of a shipment, for the goods in it (`sent`), with a copy of the buyer as known now. A line that goes out in
 * parts is invoiced in parts: its amount in proportion to the units, rounded down, and the part that completes the line
 * takes what is left of its amount and of its VAT, so the invoices of an order add up to the order. The shipping cost
 * of the order is on its first invoice.
 */
export function issueInvoice(order: Order, at: string, sent: { sku: string; quantity: number }[]): Document {
  const earlier = listInvoices(order.id, null);
  const before = (sku: string) => earlier.flatMap((i) => i.lines).filter((l) => l.sku === sku)
    .reduce((a, l) => ({ quantity: a.quantity + l.quantity, totalCents: a.totalCents + l.totalCents, taxCents: a.taxCents + l.taxCents }), { quantity: 0, totalCents: 0, taxCents: 0 });
  const buyer = { name: order.customerId ? findCustomer(order.customerId)?.name ?? null : null, email: order.customerEmail, address: order.shippingAddress };
  const lines = sent.map((s) => {
    const l = order.lines.find((x) => x.sku === s.sku)!;
    const b = before(s.sku);
    const last = b.quantity + s.quantity === l.quantity;
    const totalCents = last ? l.totalCents - b.totalCents : Math.floor((l.totalCents * s.quantity) / l.quantity);
    const taxCents = last ? Math.min(totalCents, Math.max(0, l.taxCents - b.taxCents)) : vatIn(totalCents, l.taxPercent);
    return { sku: l.sku, name: findProduct(l.sku)?.name ?? l.sku, quantity: s.quantity, unitPriceCents: l.unitPriceCents, taxPercent: l.taxPercent, totalCents, taxCents };
  });
  const first = earlier.length === 0;
  return write('invoice', at, order, buyer, null, null, lines, first ? order.shippingCents : 0, first ? order.shippingTaxCents : 0);
}

/**
 * The credit notes of a return, for the money given back: one per invoice the returned goods were on. The goods are
 * those of the invoice named, or else of the order's invoices from the oldest on that still have such units uncredited.
 * The refund is split over the returned goods by their value; VAT per line (R7). The return that completes the order
 * takes what is left of the invoices' VAT on goods, so the credit notes add up to the invoices.
 */
export function creditReturn(order: Order, made: OrderReturn, complete: boolean, at: string, invoiceId?: string): void {
  const invoices = listInvoices(order.id, null);
  const pieces: { invoice: Document; sold: DocumentLine; quantity: number }[] = [];
  for (const l of made.lines) {
    let left = l.quantity;
    for (const invoice of invoiceId ? invoices.filter((i) => i.id === invoiceId) : invoices) {
      const sold = invoice.lines.find((x) => x.sku === l.sku);
      const take = sold ? Math.min(left, sold.quantity - creditedUnits(invoice.id, l.sku)) : 0;
      if (take <= 0) continue;
      pieces.push({ invoice, sold: sold!, quantity: take });
      left -= take;
    }
  }
  if (pieces.length === 0) return;
  const shares = spread(made.refundCents, pieces.map((p) => p.quantity * p.sold.unitPriceCents));
  const lines = pieces.map((p, i): DocumentLine => ({ sku: p.sold.sku, name: p.sold.name, quantity: p.quantity, unitPriceCents: p.sold.unitPriceCents,
    taxPercent: p.sold.taxPercent, totalCents: shares[i], taxCents: vatIn(shares[i], p.sold.taxPercent) }));
  if (complete) {
    const before = listCreditNotes(order.id, null).reduce((a, c) => a + c.taxCents, 0);
    const rest = invoices.reduce((a, i) => a + i.taxCents - i.shippingTaxCents, 0) - before - lines.reduce((a, l) => a + l.taxCents, 0);
    const taxed = [...lines].reverse().find((l) => l.taxPercent > 0) ?? lines[lines.length - 1];
    taxed.taxCents = Math.max(0, taxed.taxCents + rest);
  }
  // The buyer as the invoice shows them today: gone once the customer was erased.
  for (const invoice of invoices) {
    const own = lines.filter((_, i) => pieces[i].invoice.id === invoice.id);
    if (own.length) write('credit_note', at, order, invoice.buyer, invoice.id, made.id, own);
  }
}

/**
 * Service corrects the amount of an invoice (R9: the invoice itself is never touched). The amount agreed replaces what
 * is left of the invoice after the credit notes against it; the difference goes back to the customer through `refund`
 * and is written as a credit note against the invoice, split over the invoice's goods by what is left on each line,
 * with the line's VAT rate. Only downwards; the same amount records nothing; the shipping cost is not corrected.
 * When the refund fails nothing is recorded and no number is used.
 */
export async function correctAmount(id: string, body: unknown, refund: (orderId: string, amountCents: number) => Promise<void>): Promise<Document> {
  const invoice = getInvoice(id);
  if (!isObject(body) || typeof body.totalCents !== 'number' || !Number.isInteger(body.totalCents) || body.totalCents < 0) throw invalid('totalCents must be a whole number of at least 0');
  const at = timeOf(body);
  const left = invoice.totalCents - creditedOn(id);
  if (body.totalCents > left) throw invalid('an invoice can only be corrected downwards');
  if (body.totalCents < invoice.shippingCents) throw invalid('the shipping cost is not corrected');
  const difference = left - body.totalCents;
  if (difference === 0) return invoice;

  await refund(invoice.orderId, difference);

  db.transaction(() => {
    const shares = spread(difference, invoice.lines.map((l) => l.totalCents - creditedOnLine(id, l.sku)));
    const lines = invoice.lines.map((l, i): DocumentLine => ({ sku: l.sku, name: l.name, quantity: 0, unitPriceCents: l.unitPriceCents,
      taxPercent: l.taxPercent, totalCents: shares[i], taxCents: vatIn(shares[i], l.taxPercent) })).filter((l) => l.totalCents > 0);
    write('credit_note', at, getOrder(invoice.orderId), getInvoice(id).buyer, id, null, lines);
    recordCorrection(invoice.orderId, difference);
  })();
  return getInvoice(id);
}

/** R4: takes the person off their invoices and credit notes. Numbers, dates, lines and amounts stay. */
export function anonymise(customerId: string): void {
  db.prepare(`UPDATE invoicing_documents SET buyer_name = NULL, buyer_email = NULL, buyer_street = NULL, buyer_city = NULL, buyer_postal_code = NULL, buyer_country = NULL
    WHERE customer_id = ?`).run(customerId);
}

// ---- the daily sales report

export interface SalesByRate { taxPercent: number; invoicedCents: number; invoicedTaxCents: number; creditedCents: number; creditedTaxCents: number }
export interface SalesReport {
  day: string; invoiceCount: number; creditNoteCount: number;
  invoicedCents: number; invoicedTaxCents: number; creditedCents: number; creditedTaxCents: number;
  byTaxRate: SalesByRate[];
}
/** What was invoiced and credited on one day: sums of the documents dated that day, and of their lines per VAT rate. */
export function salesReport(day: string | null): SalesReport {
  if (day === null || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw invalid('day must be a date, YYYY-MM-DD');
  }
  const docs = (db.prepare('SELECT * FROM invoicing_documents WHERE issued_on = ? ORDER BY seq').all(day) as Row[]).map(out);
  const of = (kind: Kind) => docs.filter((d) => d.kind === kind);
  const total = (ds: Document[], f: (d: Document) => number) => ds.reduce((a, d) => a + f(d), 0);
  const rates = new Map<number, SalesByRate>();
  for (const d of docs) {
    for (const l of d.lines) {
      if (!rates.has(l.taxPercent)) rates.set(l.taxPercent, { taxPercent: l.taxPercent, invoicedCents: 0, invoicedTaxCents: 0, creditedCents: 0, creditedTaxCents: 0 });
      const r = rates.get(l.taxPercent)!;
      if (d.kind === 'invoice') { r.invoicedCents += l.totalCents; r.invoicedTaxCents += l.taxCents; } else { r.creditedCents += l.totalCents; r.creditedTaxCents += l.taxCents; }
    }
    // The shipping cost of an invoice is in the row of its own VAT rate.
    if (d.shippingCents > 0) {
      if (!rates.has(SHIPPING_VAT_PERCENT)) rates.set(SHIPPING_VAT_PERCENT, { taxPercent: SHIPPING_VAT_PERCENT, invoicedCents: 0, invoicedTaxCents: 0, creditedCents: 0, creditedTaxCents: 0 });
      const r = rates.get(SHIPPING_VAT_PERCENT)!;
      r.invoicedCents += d.shippingCents; r.invoicedTaxCents += d.shippingTaxCents;
    }
  }
  return {
    day, invoiceCount: of('invoice').length, creditNoteCount: of('credit_note').length,
    invoicedCents: total(of('invoice'), (d) => d.totalCents), invoicedTaxCents: total(of('invoice'), (d) => d.taxCents),
    creditedCents: total(of('credit_note'), (d) => d.totalCents), creditedTaxCents: total(of('credit_note'), (d) => d.taxCents),
    byTaxRate: [...rates.values()].sort((a, b) => a.taxPercent - b.taxPercent),
  };
}
