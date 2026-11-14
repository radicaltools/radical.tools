import { assert, ok, no, kit, names, without } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const sequences = (docs) => docs.map((d) => d.sequence).sort((x, y) => x - y);
const get = async (ctx, id) => ok(await ctx.sys.getInvoice(id), 'getInvoice');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const tests = [
  { id: 't21-01 shipping an order makes its invoice', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.paid([[a, 2]]);
    assert.equal((await k.invoices(o.id)).length, 0, 'an order has an invoice before it is shipped');
    ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    const invoice = await k.invoice(o.id);
    assert.ok(typeof invoice.number === 'string' && invoice.number.length > 0, 'the invoice has no number');
    assert.equal(invoice.totalCents, 2000);
    assert.deepEqual(await get(ctx, invoice.id), invoice);
    no(await ctx.sys.getInvoice('no-such-invoice'), 'an invoice that does not exist');
  } },
  { id: 't21-02 the invoice lists what was sold', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 450);
    const o = await k.shipped([[a, 2], [b, 3]]);
    const invoice = await k.invoice(o.id);
    assert.equal(invoice.lines.length, 2);
    const [la, lb] = [invoice.lines.find((l) => l.sku === a), invoice.lines.find((l) => l.sku === b)];
    assert.equal(la.quantity, 2); assert.equal(la.unitPriceCents, 1000); assert.equal(la.totalCents, 2000);
    assert.equal(lb.quantity, 3); assert.equal(lb.unitPriceCents, 450); assert.equal(lb.totalCents, 1350);
    assert.equal(invoice.totalCents, 3350); assert.equal(invoice.totalCents, o.totalCents);
  } },
  { id: 't21-03 no shipment, no invoice', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const waiting = await k.placed([[a, 1]]); const dropped = await k.placed([[a, 1]]); const paid = await k.paid([[a, 1]]);
    ok(await k.cancel(dropped.id), 'cancelOrder');
    no(await k.ship(waiting.id), 'shipping an order that is not paid');
    for (const o of [waiting, dropped, paid]) assert.equal((await k.invoices(o.id)).length, 0);
    ok(await k.ship(paid.id), 'shipOrder');
    no(await k.ship(paid.id), 'shipping an order a second time');
    await k.invoice(paid.id);
  } },
  { id: 't21-04 the invoices of a year can be listed', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    assert.equal((await k.yearInvoices(year)).length, 0);
    const one = await k.shippedAt(k.noon(year, 2, 10), [[a, 1]]); const two = await k.shippedAt(k.noon(year, 9, 3), [[a, 2]]);
    const next = await k.shippedAt(k.noon(year + 1, 1, 15), [[a, 1]]);
    const list = await k.yearInvoices(year);
    assert.equal(list.length, 2);
    for (const o of [one, two]) assert.ok(list.some((i) => names(i.orderId, o.id)), 'an invoice of the year is not in the list of the year');
    assert.ok(!list.some((i) => names(i.orderId, next.id)), 'an invoice of the next year is in the list');
    for (const i of list) assert.equal(i.year, year);
  } },
  { id: 't21-05 the numbers of a year run without gaps', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const first = await k.invoice((await k.shippedAt(k.noon(year, 1, 5), [[a, 1]])).id);
    assert.equal(first.year, year); assert.equal(first.sequence, 1);
    // A shipment that is refused uses no number.
    const unpaid = await k.placed([[a, 1]]);
    no(await ctx.sys.shipOrder(unpaid.id, { at: k.noon(year, 1, 6) }), 'shipping an order that is not paid');
    const second = await k.invoice((await k.shippedAt(k.noon(year, 1, 7), [[a, 1]])).id);
    const third = await k.invoice((await k.shippedAt(k.noon(year, 6, 30), [[a, 1]])).id);
    assert.equal(second.sequence, 2); assert.equal(third.sequence, 3);
    const list = await k.yearInvoices(year);
    assert.deepEqual(sequences(list), [1, 2, 3]);
    assert.equal(new Set(list.map((i) => i.number)).size, 3, 'two invoices have the same number');
  } },
  { id: 't21-06 every year has its own run of numbers', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const at = async (when) => k.invoice((await k.shippedAt(when, [[a, 1]])).id);
    assert.equal((await at(k.noon(year, 12, 30))).sequence, 1);
    assert.equal((await at(k.noon(year, 12, 31))).sequence, 2);
    const newYear = await at(k.noon(year + 1, 1, 1));
    assert.equal(newYear.year, year + 1); assert.equal(newYear.sequence, 1);
    // A shipment of the old year that is entered late takes the old year's next number.
    const late = await at(k.noon(year, 12, 31));
    assert.equal(late.year, year); assert.equal(late.sequence, 3);
    assert.equal((await at(k.noon(year + 1, 1, 2))).sequence, 2);
    assert.deepEqual(sequences(await k.yearInvoices(year)), [1, 2, 3]);
    assert.deepEqual(sequences(await k.yearInvoices(year + 1)), [1, 2]);
  } },
  { id: 't21-07 an invoice never changes', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id);
    const code = await k.category(23); const a = await k.taxed(9, 1230, 23, code); const b = await k.stocked(9, 450);
    const o = await k.shippedAt(k.noon(year, 4, 2), [[a, 2], [b, 1]], { customerId: c.id, shippingAddressId: home.id });
    const issued = await k.invoice(o.id);
    ok(await ctx.sys.updateProduct(a, { name: 'Another name', priceCents: 1999 }), 'updateProduct');
    ok(await ctx.sys.updateProduct(b, { active: false }), 'updateProduct');
    ok(await ctx.sys.updateCategory(code, { taxPercent: 8, name: 'Another category' }), 'updateCategory');
    ok(await ctx.sys.updateCustomer(c.id, { name: 'Another Person', email: k.email() }), 'updateCustomer');
    ok(await ctx.sys.removeAddress(c.id, home.id), 'removeAddress');
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    await k.shippedAt(k.noon(year, 4, 3), [[a, 1]]);
    assert.deepEqual(await get(ctx, issued.id), issued, 'R9: the invoice is not what it was when it was issued');
    assert.deepEqual(await k.invoice(o.id), issued);
    assert.deepEqual((await k.yearInvoices(year)).find((i) => i.id === issued.id), issued);
  } },
  { id: 't21-08 how the number is written', tags: ['HD-112'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const first = await k.invoice((await k.shippedAt(k.noon(year, 5, 5), [[a, 1]])).id);
    const second = await k.invoice((await k.shippedAt(k.noon(year, 5, 6), [[a, 1]])).id);
    assert.equal(first.number, `${year}/0001`); assert.equal(second.number, `${year}/0002`);
    const today = await k.invoice((await k.shipped([[a, 1]])).id);
    assert.match(today.number, /^\d{4}\/\d{4,}$/);
    assert.equal(today.number, `${today.year}/${String(today.sequence).padStart(4, '0')}`);
  } },
  { id: 't21-09 the date of the invoice is the day of the shipment', tags: ['HD-113'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const dated = await k.invoice((await k.shippedAt(k.noon(year, 7, 14), [[a, 1]])).id);
    assert.equal(dated.issuedOn, k.day(year, 7, 14)); assert.equal(dated.year, year);
    // A day long gone is taken as it is given.
    const old = await k.invoice((await k.shippedAt('1999-11-05T12:00:00.000Z', [[a, 1]])).id);
    assert.equal(old.issuedOn, '1999-11-05'); assert.equal(old.year, 1999);
    // A time that cannot be read: nothing is shipped.
    const o = await k.paid([[a, 2]]);
    no(await ctx.sys.shipOrder(o.id, { at: 'the day before yesterday' }), 'shipping at a time that cannot be read');
    assert.equal((await k.getOrder(o.id)).status, 'paid');
    assert.equal((await k.invoices(o.id)).length, 0);
    assert.equal((await k.figures(a)).reserved, 2);
    // No time given: today.
    ok(await k.ship(o.id), 'shipOrder');
    const now = await k.invoice(o.id);
    assert.match(now.issuedOn, DAY);
    assert.ok(Math.abs(new Date(`${now.issuedOn}T12:00:00Z`).getTime() - Date.now()) < 2 * 24 * 3600 * 1000, `an invoice without a given time is dated ${now.issuedOn}`);
    assert.equal(now.year, Number(now.issuedOn.slice(0, 4)));
  } },
  { id: 't21-10 the invoice keeps the buyer and the product as they were', tags: ['HD-114', 'HD-115'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(9, 1000);
    const name = ok(await ctx.sys.getProduct(a), 'getProduct').name;
    const o = await k.shipped([[a, 1]], { customerId: c.id, shippingAddressId: home.id });
    const invoice = await k.invoice(o.id);
    assert.equal(invoice.buyerName, c.name); assert.equal(invoice.buyerEmail, c.email);
    assert.deepEqual(invoice.buyerAddress, { street: home.street, city: home.city, postalCode: home.postalCode, country: home.country });
    assert.equal(invoice.lines[0].name, name);
    ok(await ctx.sys.updateCustomer(c.id, { name: 'Somebody Else' }), 'updateCustomer');
    ok(await ctx.sys.updateProduct(a, { name: 'Renamed mug' }), 'updateProduct');
    const later = await get(ctx, invoice.id);
    assert.equal(later.buyerName, c.name); assert.equal(later.lines[0].name, name);
    // An order without an account: no name, no address, the e-mail address of the order.
    const email = k.email();
    const guest = await k.invoice((await k.shipped([[a, 1]], { customerEmail: email })).id);
    assert.equal(guest.buyerName, null); assert.equal(guest.buyerEmail, email); assert.equal(guest.buyerAddress, null);
    assert.equal(guest.lines[0].name, 'Renamed mug');
  } },
  { id: 't21-11 erasing a customer takes the buyer off the invoices and nothing else', tags: ['R4', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id); const a = await k.taxed(9, 1230, 23);
    const o = await k.shippedAt(k.noon(year, 8, 8), [[a, 2]], { customerId: c.id, shippingAddressId: home.id });
    const issued = await k.invoice(o.id);
    ok(await ctx.sys.eraseCustomer(c.id), 'eraseCustomer');
    const after = await k.invoice(o.id);
    without(after, [c.name, c.email, c.phone, home.street, home.city, home.postalCode], 'the invoice');
    assert.equal(after.buyerName, null); assert.equal(after.buyerEmail, null); assert.equal(after.buyerAddress, null);
    const amounts = ({ buyerName, buyerEmail, buyerAddress, ...rest }) => rest;
    assert.deepEqual(amounts(after), amounts(issued), 'R9: erasing the customer changed more than the buyer on the invoice');
    const list = await k.yearInvoices(year);
    assert.equal(list.length, 1);
    without(list, [c.name, c.email, home.street], 'the list of the year\'s invoices');
  } },
  { id: 't21-12 the lines of an invoice add up to its totals', tags: ['R7'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    const [a, b, d] = [await k.taxed(9, 1999, 23), await k.taxed(9, 333, 5), await k.stocked(9, 777)];
    const code = await k.discount(15);
    for (const extra of [{}, { discountCode: code }, { customerId: c.id, discountCode: code, pointsToSpend: 37 }]) {
      const o = await k.shipped([[a, 2], [b, 3], [d, 1]], extra);
      const invoice = await k.invoice(o.id);
      assert.equal(sum(invoice.lines, (l) => l.totalCents), invoice.totalCents, 'R7: the lines do not add up to the invoice\'s total');
      assert.equal(sum(invoice.lines, (l) => l.taxCents), invoice.taxCents, 'R7: the lines\' tax does not add up to the invoice\'s tax');
      for (const l of invoice.lines) assert.ok(Number.isInteger(l.totalCents) && Number.isInteger(l.taxCents), 'R7: a line holds a part of a cent');
      assert.equal(invoice.totalCents, o.totalCents, 'the invoice is not for what the customer paid');
      assert.equal(invoice.taxCents, o.taxCents);
      assert.equal(await k.charged(o.id), invoice.totalCents);
    }
  } },
  { id: 't21-13 the invoice shows each line as it was paid', tags: ['HD-89', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(9, 1000, 23); const tea = await k.taxed(9, 3000, 5); const ten = await k.discount(10);
    const invoice = await k.invoice((await k.shipped([[mug, 1], [tea, 1]], { discountCode: ten })).id);
    const [lm, lt] = [invoice.lines.find((l) => l.sku === mug), invoice.lines.find((l) => l.sku === tea)];
    assert.equal(lm.unitPriceCents, 1000); assert.equal(lm.taxPercent, 23); assert.equal(lm.totalCents, 900); assert.equal(lm.taxCents, 168);
    assert.equal(lt.unitPriceCents, 3000); assert.equal(lt.taxPercent, 5); assert.equal(lt.totalCents, 2700); assert.equal(lt.taxCents, 129);
    assert.equal(invoice.totalCents, 3600); assert.equal(invoice.taxCents, 297);
  } },
];
