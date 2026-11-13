import { assert, ok, no, unavailable, kit, names, without } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const sequences = (docs) => docs.map((d) => d.sequence).sort((x, y) => x - y);
const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
// Service corrects the amount of an invoice to what was agreed.
const correct = (ctx, invoiceId, totalCents, at) => ctx.sys.correctInvoiceAmount(invoiceId, { totalCents, ...(at ? { at } : {}) });
// What the customer's papers for an order say in the end: the invoices minus the credit notes.
const billed = async (k, orderId) => sum(await k.invoices(orderId), (i) => i.totalCents) - sum(await k.creditNotes(orderId), (n) => n.totalCents);

export const tests = [
  { id: 't28-01 after a correction the customer is billed the amount agreed', tags: ['trap:R9:done'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 3, 1), [[a, 3]]);
    const invoice = await k.invoice(o.id);
    assert.equal(await billed(k, o.id), 3000);
    ok(await correct(ctx, invoice.id, 2400, k.noon(year, 3, 8)), 'correctInvoiceAmount');
    assert.equal(await billed(k, o.id), 2400, 'the papers of the order do not say the amount agreed');
  } },
  { id: 't28-02 the invoice is still what it was when it was issued', tags: ['trap:R9:kept', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id);
    const a = await k.taxed(9, 1230, 23); const b = await k.stocked(9, 450);
    await k.shippedAt(k.noon(year, 3, 1), [[b, 1]]);
    const o = await k.shippedAt(k.noon(year, 3, 2), [[a, 2], [b, 1]], { customerId: c.id, shippingAddressId: home.id });
    await k.shippedAt(k.noon(year, 3, 3), [[b, 2]]);
    const issued = await k.invoice(o.id);
    assert.equal(issued.sequence, 2);
    // Whatever the system does with the request, the invoice that went to the customer stays.
    await correct(ctx, issued.id, issued.totalCents - 500, k.noon(year, 3, 9));
    assert.deepEqual(ok(await ctx.sys.getInvoice(issued.id), 'getInvoice'), issued, 'R9: the invoice was changed');
    assert.deepEqual((await k.invoices(o.id)).find((i) => i.id === issued.id), issued, 'R9: the invoice of the order is not the one that was issued');
    const list = await k.yearInvoices(year);
    assert.deepEqual(list.find((i) => i.id === issued.id), issued, 'R9: the invoice in the list of the year is not the one that was issued');
    assert.ok(list.length >= 3);
    assert.deepEqual(sequences(list), upTo(list.length), 'R9: the invoice numbers of the year have a gap or a number twice');
    assert.equal(new Set(list.map((i) => i.number)).size, list.length);
    const notes = await k.yearCreditNotes(year);
    assert.deepEqual(sequences(notes), upTo(notes.length), 'R9: the credit note numbers of the year have a gap or a number twice');
  } },
  { id: 't28-03 the customer gets the difference back', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 3]]);
    const charge = await k.chargeOf(o.id);
    ok(await correct(ctx, (await k.invoice(o.id)).id, 2400), 'correctInvoiceAmount');
    assert.equal(ctx.provider.refunds.length, 1);
    assert.equal(ctx.provider.refunds[0].amountCents, 600); assert.equal(ctx.provider.refunds[0].chargeId, charge.chargeId);
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    assert.equal((await k.figures(a)).onHand, 6);
  } },
  { id: 't28-04 the correction is a credit note against the invoice', tags: ['HD-156'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 12, 30), [[a, 3]], { customerId: c.id, shippingAddressId: home.id });
    const invoice = await k.invoice(o.id);
    assert.equal((await k.creditNotes(o.id)).length, 0);
    ok(await correct(ctx, invoice.id, 2400, k.noon(year + 1, 1, 4)), 'correctInvoiceAmount');
    const notes = await k.creditNotes(o.id);
    assert.equal(notes.length, 1);
    const n = notes[0];
    assert.ok(names(n.invoiceId, invoice.id), 'the credit note does not name the invoice'); assert.ok(names(n.orderId, o.id));
    assert.equal(n.totalCents, 600);
    assert.equal(n.number, `K/${year + 1}/0001`); assert.equal(n.issuedOn, k.day(year + 1, 1, 4)); assert.equal(n.year, year + 1);
    assert.deepEqual(n.lines.map((l) => [l.sku, l.quantity, l.totalCents]), [[a, 0, 600]]);
    assert.equal(n.buyerName, c.name); assert.equal(n.buyerEmail, c.email); assert.deepEqual(n.buyerAddress, invoice.buyerAddress);
    assert.deepEqual(ok(await ctx.sys.getCreditNote(n.id), 'getCreditNote'), n);
    assert.equal((await k.yearInvoices(year + 1)).length, 0, 'the correction used an invoice number');
  } },
  { id: 't28-05 the tax on a correction', tags: ['HD-157', 'R7'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(9, 1230, 23); const tea = await k.taxed(9, 2100, 5);
    const o = await k.shipped([[mug, 1], [tea, 1]]);
    const invoice = await k.invoice(o.id);
    assert.equal(invoice.totalCents, 3330); assert.equal(invoice.taxCents, 330);
    ok(await correct(ctx, invoice.id, 2997), 'correctInvoiceAmount');
    const [n] = await k.creditNotes(o.id);
    assert.equal(n.totalCents, 333); assert.equal(n.taxCents, 33);
    const [lm, lt] = [n.lines.find((l) => l.sku === mug), n.lines.find((l) => l.sku === tea)];
    assert.equal(lm.totalCents, 123); assert.equal(lm.taxPercent, 23); assert.equal(lm.taxCents, 23);
    assert.equal(lt.totalCents, 210); assert.equal(lt.taxPercent, 5); assert.equal(lt.taxCents, 10);
    assert.equal(sum(n.lines, (l) => l.totalCents), n.totalCents, 'R7: the lines do not add up to the credit note'); assert.equal(sum(n.lines, (l) => l.taxCents), n.taxCents);
  } },
  { id: 't28-06 an amount can only be corrected downwards', tags: ['HD-158'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 3]]); const invoice = await k.invoice(o.id);
    no(await correct(ctx, invoice.id, 3001), 'a correction upwards');
    no(await correct(ctx, invoice.id, -1), 'an amount below zero');
    no(await correct(ctx, invoice.id, 2400.5), 'an amount with half a cent');
    no(await correct(ctx, 'no-such-invoice', 100), 'an invoice that does not exist');
    ok(await correct(ctx, invoice.id, 3000), 'the amount the invoice has already');
    assert.equal((await k.creditNotes(o.id)).length, 0); assert.equal(ctx.provider.refunds.length, 0);
    ok(await correct(ctx, invoice.id, 2400), 'correctInvoiceAmount');
    const [n] = await k.creditNotes(o.id);
    no(await correct(ctx, n.id, 100), 'correcting a credit note');
    // The shipping cost is not corrected.
    const r = await k.route([[30000, 990]]); const w = await k.weighed(5, 1000, 300);
    const p = await k.shipped([[w, 1]], r.to); const sent = await k.invoice(p.id);
    no(await correct(ctx, sent.id, 500), 'an amount below the shipping cost');
    ok(await correct(ctx, sent.id, 990), 'correctInvoiceAmount');
    assert.equal(ctx.provider.refunds.at(-1).amountCents, 1000);
    assert.equal(ctx.provider.refunds.length, 2);
  } },
  { id: 't28-07 when the refund fails nothing is corrected', tags: ['HD-159', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 5, 5), [[a, 3]]); const invoice = await k.invoice(o.id);
    ctx.provider.refundMode = 'fail';
    unavailable(await correct(ctx, invoice.id, 2400, k.noon(year, 5, 6)), 'a correction while the provider is down');
    assert.equal((await k.creditNotes(o.id)).length, 0); assert.equal((await k.yearCreditNotes(year)).length, 0);
    assert.equal(await billed(k, o.id), 3000);
    ctx.provider.refundMode = 'succeed';
    ok(await correct(ctx, invoice.id, 2400, k.noon(year, 5, 7)), 'correctInvoiceAmount');
    assert.deepEqual(sequences(await k.yearCreditNotes(year)), [1]);
    assert.deepEqual(await k.invoice(o.id), invoice);
  } },
  { id: 't28-08 a correction works on what is left of the invoice', tags: ['HD-160'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const o = await k.shipped([[a, 3]]); const invoice = await k.invoice(o.id);
    ok(await correct(ctx, invoice.id, 2500), 'correctInvoiceAmount');
    ok(await correct(ctx, invoice.id, 2000), 'a second correction');
    ok(await correct(ctx, invoice.id, 2000), 'the same amount again');
    assert.deepEqual((await k.creditNotes(o.id)).map((n) => n.totalCents), [500, 500]);
    no(await correct(ctx, invoice.id, 2500), 'back up to an earlier amount');
    assert.equal(await billed(k, o.id), 2000);
    // After a return: 30.00 invoiced, 10.00 came back, 20.00 are left.
    const p = await k.shipped([[a, 3]]); const second = await k.invoice(p.id);
    ok(await k.ret(p.id, [[a, 1]]), 'returnItems');
    no(await correct(ctx, second.id, 2500), 'an amount above what is left after the return');
    ok(await correct(ctx, second.id, 1800), 'correctInvoiceAmount');
    assert.equal(ctx.provider.refunds.at(-1).amountCents, 200);
    assert.equal(await billed(k, p.id), 1800);
  } },
  { id: 't28-09 returns after a correction give back what is left', tags: ['HD-161'], async run(ctx) {
    const k = kit(ctx); const a = await k.taxed(9, 1000, 23);
    const o = await k.shipped([[a, 3]]); const invoice = await k.invoice(o.id);
    ok(await correct(ctx, invoice.id, 2400), 'correctInvoiceAmount');
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 800);
    assert.equal(ok(await k.ret(o.id, [[a, 2]]), 'returnItems').refundCents, 1600);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(sum(ctx.provider.refunds, (r) => r.amountCents), await k.charged(o.id), 'the customer did not get back exactly what was paid');
    const notes = await k.creditNotes(o.id);
    assert.equal(notes.length, 3);
    assert.equal(sum(notes, (n) => n.totalCents), invoice.totalCents); assert.equal(sum(notes, (n) => n.taxCents), invoice.taxCents);
    assert.equal(await billed(k, o.id), 0);
  } },
  { id: 't28-10 points follow the money of a correction', tags: ['HD-162', 'R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(9, 10000); const b = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 1]], { customerId: c.id }); const invoice = await k.invoice(o.id);
    assert.equal((await k.points(c.id)).balance, 100);
    ok(await correct(ctx, invoice.id, 8000), 'correctInvoiceAmount');
    const first = await k.points(c.id);
    assert.equal(first.balance, 80);
    assert.ok(first.history.some((e) => e.points === -20 && names(e.reference, o.id)), 'the points taken back are not on record for the order');
    // The customer uses most of the points; a further correction takes only what is there.
    ok(await k.order([[b, 1]], { customerId: c.id, pointsToSpend: 70 }), 'placeOrder');
    ok(await correct(ctx, invoice.id, 5000), 'correctInvoiceAmount');
    assert.equal((await k.points(c.id)).balance, 0);
  } },
  { id: 't28-11 erasing the customer takes the buyer off the correction too', tags: ['R4', 'R9'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.taxed(9, 1230, 23);
    const o = await k.shipped([[a, 2]], { customerId: c.id, shippingAddressId: home.id });
    ok(await correct(ctx, (await k.invoice(o.id)).id, 2000), 'correctInvoiceAmount');
    const [issued] = await k.creditNotes(o.id);
    ok(await ctx.sys.eraseCustomer(c.id), 'eraseCustomer');
    const [after] = await k.creditNotes(o.id);
    without(after, [c.name, c.email, c.phone, home.street, home.city, home.postalCode], 'the credit note of the correction');
    const amounts = ({ buyerName, buyerEmail, buyerAddress, ...rest }) => rest;
    assert.deepEqual(amounts(after), amounts(issued), 'R9: erasing the customer changed more than the buyer on the credit note');
  } },
  { id: 't28-12 a correction is on the sales report of its day', tags: ['HD-121'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.taxed(9, 1230, 23);
    const o = await k.shippedAt(k.noon(year, 6, 1), [[a, 2]]);
    const before = await k.report(k.day(year, 6, 1));
    ok(await correct(ctx, (await k.invoice(o.id)).id, 2337, k.noon(year, 6, 15)), 'correctInvoiceAmount');
    assert.deepEqual(await k.report(k.day(year, 6, 1)), before, 'the report of the day of the invoice changed');
    const r = await k.report(k.day(year, 6, 15));
    assert.equal(r.invoiceCount, 0); assert.equal(r.creditNoteCount, 1);
    assert.equal(r.creditedCents, 123); assert.equal(r.creditedTaxCents, 23);
    assert.deepEqual(r.byTaxRate.map((x) => [x.taxPercent, x.creditedCents, x.creditedTaxCents]), [[23, 123, 23]]);
  } },
];
