import { assert, ok, no, kit, names, without } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const sequences = (docs) => docs.map((d) => d.sequence).sort((x, y) => x - y);
const note = async (ctx, id) => ok(await ctx.sys.getCreditNote(id), 'getCreditNote');
// The credit note a return has just made: the one of the order that was not there before.
async function credited(k, orderId, pairs, at) {
  const before = (await k.creditNotes(orderId)).map((n) => n.id);
  const made = ok(await (at ? k.retAt(at, orderId, pairs) : k.ret(orderId, pairs)), 'returnItems');
  const fresh = (await k.creditNotes(orderId)).filter((n) => !before.includes(n.id));
  assert.equal(fresh.length, 1, `a return made ${fresh.length} credit notes`);
  return { made, note: fresh[0] };
}

export const tests = [
  { id: 't22-01 a return makes a credit note against the invoice', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 3]]);
    const invoice = await k.invoice(o.id);
    assert.equal((await k.creditNotes(o.id)).length, 0, 'an order has a credit note before anything came back');
    const { made, note: n } = await credited(k, o.id, [[a, 1]]);
    assert.ok(names(n.invoiceId, invoice.id), 'the credit note does not name the invoice');
    assert.ok(names(n.orderId, o.id), 'the credit note does not name the order');
    assert.equal(n.totalCents, 1000); assert.equal(n.totalCents, made.refundCents);
    assert.equal(ctx.provider.refunds.at(-1).amountCents, n.totalCents);
    assert.ok(typeof n.number === 'string' && n.number.length > 0, 'the credit note has no number');
    assert.deepEqual(await note(ctx, n.id), n);
    no(await ctx.sys.getCreditNote('no-such-credit-note'), 'a credit note that does not exist');
  } },
  { id: 't22-02 every return has its credit note for what came back', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 450); const ten = await k.discount(10);
    const o = await k.shipped([[a, 2], [b, 2]], { customerId: c.id, discountCode: ten, pointsToSpend: 20 });
    const first = await credited(k, o.id, [[a, 1], [b, 2]]);
    assert.deepEqual(first.note.lines.map((l) => [l.sku, l.quantity]).sort(), [[a, 1], [b, 2]].sort());
    assert.equal(first.note.totalCents, first.made.refundCents);
    const second = await credited(k, o.id, [[a, 1]]);
    assert.deepEqual(second.note.lines.map((l) => [l.sku, l.quantity]), [[a, 1]]);
    assert.equal(second.note.totalCents, second.made.refundCents);
    assert.ok(first.note.totalCents > 0 && second.note.totalCents > 0, 'a credit note is not an amount above zero');
    const all = await k.creditNotes(o.id);
    assert.equal(all.length, 2);
    assert.notEqual(all[0].number, all[1].number);
    assert.equal(sum(all, (n) => n.totalCents), sum(ctx.provider.refunds, (r) => r.amountCents), 'the credit notes are not for the money that was given back');
  } },
  { id: 't22-03 no return, no credit note', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 2]]); const paid = await k.paid([[a, 1]]);
    no(await k.ret(o.id, [[a, 3]]), 'returning more than was ordered');
    no(await k.ret(paid.id, [[a, 1]]), 'returning goods of an order that was not shipped');
    assert.equal((await k.creditNotes(o.id)).length, 0);
    assert.equal((await k.creditNotes(paid.id)).length, 0);
    await credited(k, o.id, [[a, 2]]);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
  } },
  { id: 't22-04 the credit notes of a year can be listed', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 2, 1), [[a, 3]]);
    assert.equal((await k.yearCreditNotes(year)).length, 0);
    const one = await credited(k, o.id, [[a, 1]], k.noon(year, 2, 20));
    const next = await credited(k, o.id, [[a, 1]], k.noon(year + 1, 1, 9));
    const list = await k.yearCreditNotes(year);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, one.note.id); assert.equal(list[0].year, year);
    assert.ok((await k.yearCreditNotes(year + 1)).some((n) => n.id === next.note.id));
  } },
  { id: 't22-05 a credit note leaves the invoice as it was issued', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.taxed(9, 1230, 23); const b = await k.stocked(9, 450);
    const o = await k.shippedAt(k.noon(year, 3, 3), [[a, 2], [b, 1]]);
    const issued = await k.invoice(o.id);
    await credited(k, o.id, [[a, 1]], k.noon(year, 3, 9));
    assert.deepEqual(await k.invoice(o.id), issued, 'R9: a return changed the invoice');
    await credited(k, o.id, [[a, 1], [b, 1]], k.noon(year, 3, 12));
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.deepEqual(await k.invoice(o.id), issued, 'R9: the invoice of a returned order is not what it was');
    assert.deepEqual(ok(await ctx.sys.getInvoice(issued.id), 'getInvoice'), issued);
    assert.deepEqual(await k.yearInvoices(year), [issued]);
  } },
  { id: 't22-06 the numbers of the credit notes run without gaps', tags: ['R9', 'HD-116'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(20, 1000);
    const o = await k.shippedAt(k.noon(year, 1, 2), [[a, 3]]); const p = await k.shippedAt(k.noon(year, 1, 3), [[a, 2]]);
    const first = await credited(k, o.id, [[a, 1]], k.noon(year, 2, 1));
    assert.equal(first.note.year, year); assert.equal(first.note.sequence, 1);
    // A return that fails at the payment provider, and one that is refused, use no number.
    ctx.provider.refundMode = 'fail';
    const failed = await k.retAt(k.noon(year, 2, 2), p.id, [[a, 1]]);
    assert.ok(!failed.ok, 'a return whose refund failed was accepted');
    ctx.provider.refundMode = 'succeed';
    no(await k.retAt(k.noon(year, 2, 2), o.id, [[a, 5]]), 'returning more than was ordered');
    const second = await credited(k, p.id, [[a, 1]], k.noon(year, 2, 3));
    const third = await credited(k, o.id, [[a, 2]], k.noon(year, 11, 30));
    assert.equal(second.note.sequence, 2); assert.equal(third.note.sequence, 3);
    const list = await k.yearCreditNotes(year);
    assert.deepEqual(sequences(list), [1, 2, 3]);
    assert.equal(new Set(list.map((n) => n.number)).size, 3, 'two credit notes have the same number');
  } },
  { id: 't22-07 a credit note never changes', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const code = await k.category(23); const a = await k.taxed(9, 1230, 23, code);
    const o = await k.shippedAt(k.noon(year, 5, 1), [[a, 3]], { customerId: c.id });
    const { note: issued } = await credited(k, o.id, [[a, 1]], k.noon(year, 5, 10));
    ok(await ctx.sys.updateProduct(a, { name: 'Another name', priceCents: 1999 }), 'updateProduct');
    ok(await ctx.sys.updateCategory(code, { taxPercent: 8 }), 'updateCategory');
    ok(await ctx.sys.updateCustomer(c.id, { name: 'Another Person' }), 'updateCustomer');
    await credited(k, o.id, [[a, 2]], k.noon(year, 5, 11));
    assert.deepEqual(await note(ctx, issued.id), issued, 'R9: the credit note is not what it was when it was issued');
    assert.deepEqual((await k.yearCreditNotes(year)).find((n) => n.id === issued.id), issued);
  } },
  { id: 't22-08 credit notes have numbers of their own', tags: ['HD-117'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(20, 1000);
    const o = await k.shippedAt(k.noon(year, 1, 2), [[a, 2]]);
    const first = await credited(k, o.id, [[a, 1]], k.noon(year, 1, 9));
    const p = await k.shippedAt(k.noon(year, 1, 10), [[a, 2]]);
    const second = await credited(k, p.id, [[a, 1]], k.noon(year, 1, 11));
    assert.equal(first.note.number, `K/${year}/0001`); assert.equal(second.note.number, `K/${year}/0002`);
    assert.equal((await k.invoice(o.id)).number, `${year}/0001`); assert.equal((await k.invoice(p.id)).number, `${year}/0002`);
    assert.deepEqual(sequences(await k.yearInvoices(year)), [1, 2]);
    assert.deepEqual(sequences(await k.yearCreditNotes(year)), [1, 2]);
  } },
  { id: 't22-09 the date of a credit note is the day of the return', tags: ['HD-118'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 12, 30), [[a, 3]]);
    const late = await credited(k, o.id, [[a, 1]], k.noon(year + 1, 1, 5));
    assert.equal(late.note.issuedOn, k.day(year + 1, 1, 5)); assert.equal(late.note.year, year + 1); assert.equal(late.note.sequence, 1);
    assert.equal((await k.invoice(o.id)).year, year);
    no(await k.retAt('next week', o.id, [[a, 1]]), 'a return at a time that cannot be read');
    assert.equal((await k.creditNotes(o.id)).length, 1);
    const today = await credited(k, o.id, [[a, 1]]);
    assert.match(today.note.issuedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Math.abs(new Date(`${today.note.issuedOn}T12:00:00Z`).getTime() - Date.now()) < 2 * 24 * 3600 * 1000, `a credit note without a given time is dated ${today.note.issuedOn}`);
  } },
  { id: 't22-10 the tax on a credit note', tags: ['HD-119', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(9, 1230, 23); const tea = await k.taxed(9, 2100, 5);
    const o = await k.shipped([[mug, 2], [tea, 2]]);
    const { note: one } = await credited(k, o.id, [[mug, 1]]);
    assert.equal(one.totalCents, 1230); assert.equal(one.taxCents, 230);
    assert.equal(one.lines[0].taxPercent, 23); assert.equal(one.lines[0].totalCents, 1230); assert.equal(one.lines[0].taxCents, 230);
    const { note: two } = await credited(k, o.id, [[mug, 1], [tea, 1]]);
    assert.equal(two.totalCents, 3330); assert.equal(two.taxCents, 330);
    const [lm, lt] = [two.lines.find((l) => l.sku === mug), two.lines.find((l) => l.sku === tea)];
    assert.equal(lm.totalCents, 1230); assert.equal(lm.taxCents, 230); assert.equal(lt.totalCents, 2100); assert.equal(lt.taxCents, 100); assert.equal(lt.taxPercent, 5);
  } },
  { id: 't22-11 the credit notes of a returned order add up to its invoice', tags: ['HD-120'], async run(ctx) {
    const k = kit(ctx); const a = await k.taxed(9, 999, 20); const fifteen = await k.discount(15); const b = await k.taxed(9, 1999, 23);
    // 29.97 in one line at 20 %: 5.00 of tax on the invoice, but 1.67 on each third of it.
    const o = await k.shipped([[a, 3]]);
    const invoice = await k.invoice(o.id);
    assert.equal(invoice.taxCents, 500);
    const taxes = [];
    for (let i = 0; i < 3; i++) taxes.push((await credited(k, o.id, [[a, 1]])).note.taxCents);
    assert.deepEqual(taxes, [167, 167, 166]);
    // An order with a discount, returned in two parts.
    const p = await k.shipped([[a, 2], [b, 3]], { discountCode: fifteen });
    const issued = await k.invoice(p.id);
    await credited(k, p.id, [[a, 1], [b, 1]]); await credited(k, p.id, [[a, 1], [b, 2]]);
    const notes = await k.creditNotes(p.id);
    assert.equal(sum(notes, (n) => n.totalCents), issued.totalCents); assert.equal(sum(notes, (n) => n.taxCents), issued.taxCents);
  } },
  { id: 't22-12 erasing a customer takes the buyer off the credit notes', tags: ['R4', 'R9'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.taxed(9, 1230, 23);
    const o = await k.shipped([[a, 3]], { customerId: c.id, shippingAddressId: home.id });
    const { note: issued } = await credited(k, o.id, [[a, 1]]);
    ok(await ctx.sys.eraseCustomer(c.id), 'eraseCustomer');
    const personal = [c.name, c.email, c.phone, home.street, home.city, home.postalCode];
    const after = await note(ctx, issued.id);
    without(after, personal, 'the credit note');
    const amounts = ({ buyerName, buyerEmail, buyerAddress, ...rest }) => rest;
    assert.deepEqual(amounts(after), amounts(issued), 'R9: erasing the customer changed more than the buyer on the credit note');
    // Goods of an erased customer still come back, with a credit note that names nobody.
    const { made, note: later } = await credited(k, o.id, [[a, 2]]);
    assert.equal(later.totalCents, made.refundCents); assert.equal(later.totalCents, 2460);
    without(later, personal, 'the credit note of a return after erasing');
    without(await k.creditNotes(o.id), personal, 'the credit notes of the order');
  } },
  { id: 't22-13 the lines of a credit note add up to its totals', tags: ['R7'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    const [a, b, d] = [await k.taxed(9, 1999, 23), await k.taxed(9, 333, 5), await k.stocked(9, 777)];
    const code = await k.discount(15);
    const o = await k.shipped([[a, 2], [b, 3], [d, 2]], { customerId: c.id, discountCode: code, pointsToSpend: 37 });
    for (const pairs of [[[a, 1], [b, 1]], [[b, 2], [d, 1]], [[a, 1], [d, 1]]]) {
      const { made, note: n } = await credited(k, o.id, pairs);
      assert.equal(sum(n.lines, (l) => l.totalCents), n.totalCents, 'R7: the lines do not add up to the credit note\'s total');
      assert.equal(sum(n.lines, (l) => l.taxCents), n.taxCents, 'R7: the lines\' tax does not add up to the credit note\'s tax');
      for (const l of n.lines) assert.ok(Number.isInteger(l.totalCents) && Number.isInteger(l.taxCents) && l.taxCents >= 0 && l.taxCents <= l.totalCents, 'R7: a line of the credit note is not in whole cents');
      assert.equal(n.totalCents, made.refundCents);
    }
    assert.equal(sum(await k.creditNotes(o.id), (n) => n.totalCents), o.totalCents);
  } },
];
