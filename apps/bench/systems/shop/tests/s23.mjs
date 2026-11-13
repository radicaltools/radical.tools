import { assert, ok, no, kit } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const rate = (report, taxPercent) => report.byTaxRate.find((r) => r.taxPercent === taxPercent);
const ret = async (k, at, orderId, pairs) => ok(await k.retAt(at, orderId, pairs), 'returnItems');
// What the documents of a day say, added up: the figures the report must show.
const added = (invoices, notes) => ({
  invoiceCount: invoices.length, creditNoteCount: notes.length,
  invoicedCents: sum(invoices, (d) => d.totalCents), invoicedTaxCents: sum(invoices, (d) => d.taxCents),
  creditedCents: sum(notes, (d) => d.totalCents), creditedTaxCents: sum(notes, (d) => d.taxCents),
});
const totals = ({ byTaxRate, ...rest }) => rest;
const EMPTY = { invoiceCount: 0, creditNoteCount: 0, invoicedCents: 0, invoicedTaxCents: 0, creditedCents: 0, creditedTaxCents: 0 };

export const tests = [
  { id: 't23-01 the report adds up the invoices of the day', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 450);
    await k.shippedAt(k.noon(year, 3, 14), [[a, 2]]); await k.shippedAt(k.noon(year, 3, 14), [[a, 1], [b, 3]]);
    const r = await k.report(k.day(year, 3, 14));
    assert.equal(r.invoiceCount, 2); assert.equal(r.invoicedCents, 4350);
    assert.equal(r.creditNoteCount, 0); assert.equal(r.creditedCents, 0);
  } },
  { id: 't23-02 every day has its own report', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    await k.shippedAt(k.noon(year, 3, 14), [[a, 2]]); await k.shippedAt(k.noon(year, 3, 15), [[a, 3]]); await k.shippedAt(k.noon(year + 1, 3, 14), [[a, 1]]);
    const [first, second] = [await k.report(k.day(year, 3, 14)), await k.report(k.day(year, 3, 15))];
    assert.equal(first.invoiceCount, 1); assert.equal(first.invoicedCents, 2000);
    assert.equal(second.invoiceCount, 1); assert.equal(second.invoicedCents, 3000);
    assert.equal((await k.report(k.day(year + 1, 3, 14))).invoicedCents, 1000);
  } },
  { id: 't23-03 the report shows what was credited', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    const o = await k.shippedAt(k.noon(year, 6, 1), [[a, 3]]);
    const made = await ret(k, k.noon(year, 6, 1), o.id, [[a, 1]]);
    const r = await k.report(k.day(year, 6, 1));
    assert.equal(r.invoiceCount, 1); assert.equal(r.creditNoteCount, 1);
    assert.equal(r.creditedCents, 1000); assert.equal(r.creditedCents, made.refundCents);
  } },
  { id: 't23-04 the report splits the figures by tax rate', async run(ctx) {
    const k = kit(ctx); const year = k.year(); const mug = await k.taxed(9, 1230, 23); const tea = await k.taxed(9, 2100, 5); const day = k.day(year, 9, 9);
    const o = await k.shippedAt(k.noon(year, 9, 9), [[mug, 2], [tea, 1]]); const p = await k.shippedAt(k.noon(year, 9, 9), [[tea, 2]]);
    const invoices = [await k.invoice(o.id), await k.invoice(p.id)];
    const r = await k.report(day);
    assert.deepEqual(totals(r), added(invoices, []));
    assert.ok(r.invoicedTaxCents > 0, 'a day of taxed sales shows no tax');
    for (const percent of [23, 5]) {
      const lines = invoices.flatMap((i) => i.lines).filter((l) => l.taxPercent === percent);
      const row = rate(r, percent);
      assert.ok(row, `the report has no row for ${percent} %`);
      assert.equal(row.invoicedCents, sum(lines, (l) => l.totalCents)); assert.equal(row.invoicedTaxCents, sum(lines, (l) => l.taxCents));
    }
    assert.ok(rate(r, 23).invoicedCents !== rate(r, 5).invoicedCents);
  } },
  { id: 't23-05 the report follows the documents, day by day', tags: ['HD-121'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    // Ordered and paid today, shipped on a day of its own, part of it returned on another day.
    const o = await k.paid([[a, 3]]);
    ok(await ctx.sys.shipOrder(o.id, { at: k.noon(year, 6, 1) }), 'shipOrder');
    await ret(k, k.noon(year, 6, 20), o.id, [[a, 1]]);
    const shipped = await k.report(k.day(year, 6, 1)); const returned = await k.report(k.day(year, 6, 20));
    assert.deepEqual(totals(shipped), { ...EMPTY, invoiceCount: 1, invoicedCents: 3000 });
    assert.deepEqual(totals(returned), { ...EMPTY, creditNoteCount: 1, creditedCents: 1000 });
  } },
  { id: 't23-06 invoiced and credited stand side by side', tags: ['HD-122'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.taxed(9, 1230, 23); const day = k.day(year, 6, 1);
    const o = await k.shippedAt(k.noon(year, 6, 1), [[a, 3]]);
    await ret(k, k.noon(year, 6, 1), o.id, [[a, 1]]);
    const r = await k.report(day);
    assert.equal(r.invoicedCents, 3690); assert.equal(r.invoicedTaxCents, 690);
    assert.equal(r.creditedCents, 1230); assert.equal(r.creditedTaxCents, 230);
    assert.deepEqual(r.byTaxRate, [{ taxPercent: 23, invoicedCents: 3690, invoicedTaxCents: 690, creditedCents: 1230, creditedTaxCents: 230 }]);
  } },
  { id: 't23-07 sales without tax are in the split at zero percent', tags: ['HD-123'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const plain = await k.stocked(9, 1000); const zero = await k.taxed(9, 500, 0); const mug = await k.taxed(9, 1230, 23);
    await k.shippedAt(k.noon(year, 2, 2), [[plain, 1], [zero, 2], [mug, 1]]);
    const r = await k.report(k.day(year, 2, 2));
    assert.equal(r.byTaxRate.length, 2);
    assert.deepEqual(rate(r, 0), { taxPercent: 0, invoicedCents: 2000, invoicedTaxCents: 0, creditedCents: 0, creditedTaxCents: 0 });
    assert.equal(rate(r, 23).invoicedCents, 1230);
  } },
  { id: 't23-08 a day without documents is a report of zeros', tags: ['HD-124'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(9, 1000);
    await k.shippedAt(k.noon(year, 2, 2), [[a, 1]]);
    const r = await k.report(k.day(year, 2, 3));
    assert.deepEqual(totals(r), EMPTY); assert.deepEqual(r.byTaxRate, []);
  } },
  { id: 't23-09 the day must be a real date', tags: ['HD-125'], async run(ctx) {
    const k = kit(ctx); const year = k.year();
    for (const day of ['yesterday', `${year}-02-30`, `${year}-13-01`, `${year}/03/14`, '']) no(await ctx.sys.getSalesReport(day), `a report for ${JSON.stringify(day)}`);
    ok(await ctx.sys.getSalesReport(`${year}-02-28`), 'a report for the last day of February');
  } },
  { id: 't23-10 the figures of the report are sums of the documents', tags: ['R7'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.collector(); const day = k.day(year, 10, 10); const noon = k.noon(year, 10, 10);
    const [a, b, d] = [await k.taxed(20, 999, 20), await k.taxed(20, 333, 5), await k.stocked(20, 777)];
    const e = await k.taxed(20, 1999, 20); const code = await k.discount(15);
    const orders = [
      await k.shippedAt(noon, [[a, 1], [e, 1], [b, 7]]),
      await k.shippedAt(noon, [[a, 3], [d, 2]], { discountCode: code }),
      await k.shippedAt(noon, [[a, 2], [b, 3], [d, 1], [e, 2]], { customerId: c.id, discountCode: code, pointsToSpend: 37 }),
    ];
    await ret(k, noon, orders[0].id, [[a, 1], [b, 2]]); await ret(k, noon, orders[2].id, [[e, 1], [d, 1]]); await ret(k, noon, orders[1].id, [[a, 3], [d, 2]]);
    const invoices = []; const notes = [];
    for (const o of orders) { invoices.push(await k.invoice(o.id)); notes.push(...await k.creditNotes(o.id)); }
    const r = await k.report(day);
    assert.deepEqual(totals(r), added(invoices, notes), 'R7: the report is not the sum of the documents of the day');
    // The rows by rate add up to the totals, and each row is the sum of the lines at its rate.
    assert.equal(sum(r.byTaxRate, (x) => x.invoicedCents), r.invoicedCents); assert.equal(sum(r.byTaxRate, (x) => x.invoicedTaxCents), r.invoicedTaxCents);
    assert.equal(sum(r.byTaxRate, (x) => x.creditedCents), r.creditedCents); assert.equal(sum(r.byTaxRate, (x) => x.creditedTaxCents), r.creditedTaxCents);
    for (const row of r.byTaxRate) {
      const at = (docs) => docs.flatMap((x) => x.lines).filter((l) => l.taxPercent === row.taxPercent);
      assert.equal(row.invoicedTaxCents, sum(at(invoices), (l) => l.taxCents), `R7: the tax invoiced at ${row.taxPercent} % is not the sum of the lines`);
      assert.equal(row.creditedTaxCents, sum(at(notes), (l) => l.taxCents), `R7: the tax credited at ${row.taxPercent} % is not the sum of the lines`);
      for (const x of Object.values(row)) assert.ok(Number.isInteger(x), 'R7: the report holds a part of a cent');
    }
  } },
  { id: 't23-11 the report of a day that is over stays as it was', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const code = await k.category(23); const a = await k.taxed(9, 1230, 23, code); const b = await k.stocked(9, 450);
    const day = k.day(year, 4, 4);
    const o = await k.shippedAt(k.noon(year, 4, 4), [[a, 2], [b, 2]], { customerId: c.id });
    await ret(k, k.noon(year, 4, 4), o.id, [[b, 1]]);
    const closed = await k.report(day);
    assert.equal(closed.invoiceCount, 1); assert.equal(closed.creditNoteCount, 1);
    ok(await ctx.sys.updateProduct(a, { priceCents: 1999, name: 'Another name' }), 'updateProduct');
    ok(await ctx.sys.updateCategory(code, { taxPercent: 8 }), 'updateCategory');
    await ret(k, k.noon(year, 4, 5), o.id, [[a, 2], [b, 1]]);
    await k.shippedAt(k.noon(year, 4, 5), [[a, 1]]);
    ok(await ctx.sys.eraseCustomer(c.id), 'eraseCustomer');
    assert.deepEqual(await k.report(day), closed, 'R9: the report of a day that is over has changed');
    assert.equal((await k.report(k.day(year, 4, 5))).creditNoteCount, 1);
  } },
];
