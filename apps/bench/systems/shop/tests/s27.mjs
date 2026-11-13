import { assert, ok, no, unavailable, kit, names, forOrder } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
// The one shipment of an order that went out whole from one warehouse.
async function parcel(k, orderId) {
  const all = await k.shipments(orderId);
  assert.equal(all.length, 1, `the order has ${all.length} shipments`);
  return all[0];
}

export const tests = [
  { id: 't27-01 a parcel that comes back is back in stock', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000);
    const o = await k.shipped([[a, 2]]);
    assert.equal((await k.figures(a)).onHand, 3);
    const s = await parcel(k, o.id);
    assert.equal(s.status, 'sent');
    const back = ok(await k.failed(s.id), 'reportFailedDelivery');
    assert.equal(back.status, 'failed');
    const stock = await k.figures(a);
    assert.equal(stock.onHand, 5); assert.equal(stock.available, 5);
    assert.equal((await parcel(k, o.id)).status, 'failed');
    ok(await k.order([[a, 5]]), 'an order for the goods that came back');
  } },
  { id: 't27-02 the customer gets the money for the parcel back', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const b = await k.stocked(5, 450);
    const o = await k.shipped([[a, 2], [b, 1]]);
    const charge = await k.chargeOf(o.id);
    ok(await k.failed((await parcel(k, o.id)).id), 'reportFailedDelivery');
    assert.equal(ctx.provider.refunds.length, 1);
    assert.equal(ctx.provider.refunds[0].amountCents, 2450); assert.equal(ctx.provider.refunds[0].chargeId, charge.chargeId);
  } },
  { id: 't27-03 the goods that came back are on the stock record', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000);
    const o = await k.shipped([[a, 2]]);
    const before = await k.ledger(a);
    ok(await k.failed((await parcel(k, o.id)).id), 'reportFailedDelivery');
    const after = await k.ledger(a);
    assert.deepEqual(after.slice(0, before.length), before, 'R1: the stock history was rewritten');
    assert.equal(after.length, before.length + 1);
    assert.equal(after.at(-1).quantity, 2);
  } },
  { id: 't27-04 the goods go back to the warehouse they left from', tags: ['HD-149', 'R10'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.stocked(4, 1000, w);
    const o = await k.shipped([[a, 3]]);
    const s = await parcel(k, o.id);
    assert.equal(s.warehouse, w);
    ok(await k.failed(s.id), 'reportFailedDelivery');
    const stock = await k.figures(a);
    assert.equal(k.wh(stock, w).onHand, 4); assert.equal(k.wh(stock, 'MAIN').onHand, 0);
    const last = (await k.ledger(a)).at(-1);
    assert.equal(last.kind, 'return'); assert.equal(last.quantity, 3); assert.equal(last.warehouse, w); forOrder(last, o);
    // What came back is reserved and sent again from where it lies.
    const next = await k.shipped([[a, 4]]);
    const again = await parcel(k, next.id);
    assert.equal(again.warehouse, w, 'R10: the shipment is not from the warehouse its goods were reserved in');
    assert.deepEqual(again.lines.map((l) => [l.sku, l.quantity]), [[a, 4]]);
    await k.figures(a);
  } },
  { id: 't27-05 a parcel that came back is credited against its invoice', tags: ['HD-150', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const w = await k.warehouse(); const a = await k.stocked(5, 1000); const b = await k.stocked(5, 450, w);
    const o = await k.paid([[a, 2], [b, 3]]);
    ok(await ctx.sys.shipOrder(o.id, { at: k.noon(year, 3, 3) }), 'shipOrder');
    const issued = await k.invoices(o.id);
    const s = (await k.shipments(o.id)).find((x) => x.warehouse === w);
    ok(await k.failed(s.id, k.noon(year, 3, 17)), 'reportFailedDelivery');
    const notes = await k.creditNotes(o.id);
    assert.equal(notes.length, 1);
    assert.ok(names(notes[0].invoiceId, s.invoiceId) || names(s.invoiceId, notes[0].invoiceId), 'the credit note is not against the invoice of the shipment');
    assert.equal(notes[0].totalCents, 1350); assert.equal(notes[0].totalCents, ctx.provider.refunds.at(-1).amountCents);
    assert.deepEqual(notes[0].lines.map((l) => [l.sku, l.quantity]), [[b, 3]]);
    assert.equal(notes[0].issuedOn, k.day(year, 3, 17));
    assert.deepEqual(await k.invoices(o.id), issued, 'R9: a parcel that came back changed an invoice');
    assert.deepEqual((await k.yearInvoices(year)).map((i) => i.sequence).sort(), [1, 2]);
  } },
  { id: 't27-06 a parcel that came back is a return of what was in it', tags: ['HD-151'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.stocked(5, 1000); const b = await k.stocked(5, 450, w);
    // One parcel, and it comes back: the order is returned.
    const single = await k.shipped([[a, 2]]);
    ok(await k.failed((await parcel(k, single.id)).id), 'reportFailedDelivery');
    assert.equal((await k.getOrder(single.id)).status, 'returned');
    const returns = ok(await ctx.sys.listReturns(single.id), 'listReturns');
    assert.equal(returns.length, 1); assert.equal(returns[0].refundCents, 2000);
    assert.deepEqual(returns[0].lines.map((l) => [l.sku, l.quantity]), [[a, 2]]);
    no(await k.ret(single.id, [[a, 1]]), 'a return of goods that came back with their parcel');
    // Two parcels, one comes back: the order stays shipped until the goods of the other are returned.
    const o = await k.paid([[a, 1], [b, 2]]);
    ok(await k.ship(o.id), 'shipOrder');
    ok(await k.failed((await k.shipments(o.id)).find((x) => x.warehouse === w).id), 'reportFailedDelivery');
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    no(await k.ret(o.id, [[b, 1]]), 'a return of goods that came back with their parcel');
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(sum(ok(await ctx.sys.listReturns(o.id), 'listReturns'), (r) => r.refundCents), o.totalCents);
  } },
  { id: 't27-07 the shipping cost is not given back for a parcel that came back', tags: ['HD-152'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]); const a = await k.weighed(5, 1000, 300);
    const o = await k.shipped([[a, 2]], r.to);
    assert.equal(o.totalCents, 2990);
    ok(await k.failed((await parcel(k, o.id)).id), 'reportFailedDelivery');
    assert.equal(ctx.provider.refunds.at(-1).amountCents, 2000);
    assert.equal((await k.creditNotes(o.id))[0].totalCents, 2000);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
  } },
  { id: 't27-08 a parcel comes back once', tags: ['HD-153'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 2]]); const s = await parcel(k, o.id);
    ok(await k.failed(s.id), 'reportFailedDelivery');
    no(await k.failed(s.id), 'booking a parcel as come back a second time');
    no(await k.failed('no-such-shipment'), 'a shipment that does not exist');
    // A parcel the customer has sent goods back from was delivered.
    const p = await k.shipped([[a, 3]]);
    ok(await k.ret(p.id, [[a, 1]]), 'returnItems');
    no(await k.failed((await parcel(k, p.id)).id), 'a parcel from which goods were returned');
    assert.equal((await k.figures(a)).onHand, 9 - 2);
    assert.equal(ctx.provider.refunds.length, 2);
    assert.equal((await parcel(k, p.id)).status, 'sent');
  } },
  { id: 't27-09 when the refund fails the parcel has not come back', tags: ['HD-154', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.stocked(5, 1000);
    const o = await k.shippedAt(k.noon(year, 8, 1), [[a, 2]]); const s = await parcel(k, o.id);
    ctx.provider.refundMode = 'fail';
    unavailable(await k.failed(s.id, k.noon(year, 8, 9)), 'a parcel that came back while the provider is down');
    assert.equal((await parcel(k, o.id)).status, 'sent');
    assert.equal((await k.figures(a)).onHand, 3);
    assert.equal((await k.creditNotes(o.id)).length, 0); assert.equal((await k.getOrder(o.id)).status, 'shipped');
    ctx.provider.refundMode = 'succeed';
    ok(await k.failed(s.id, k.noon(year, 8, 10)), 'reportFailedDelivery');
    const notes = await k.yearCreditNotes(year);
    assert.equal(notes.length, 1); assert.equal(notes[0].sequence, 1);
  } },
  { id: 't27-10 a parcel can come back before the rest of the order has gone out', tags: ['HD-155'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const late = await k.product(700);
    const o = await k.paid([[a, 2], [late, 1]]);
    const first = ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    ok(await k.failed(first.id), 'reportFailedDelivery');
    assert.equal(ctx.provider.refunds.at(-1).amountCents, 2000);
    assert.equal((await k.getOrder(o.id)).status, 'paid');
    assert.equal((await k.figures(a)).available, 5);
    await k.receive(late, 1);
    ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    ok(await k.ret(o.id, [[late, 1]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(sum(ctx.provider.refunds, (r) => r.amountCents), o.totalCents);
  } },
  { id: 't27-11 the points of a parcel that came back are taken back', tags: ['R5', 'HD-50'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000); const b = await k.stocked(5, 2500);
    const kept = await k.shipped([[b, 1]], { customerId: c.id });
    const o = await k.shipped([[a, 3]], { customerId: c.id });
    assert.equal((await k.points(c.id)).balance, 55);
    ok(await k.failed((await parcel(k, o.id)).id), 'reportFailedDelivery');
    const { balance, history } = await k.points(c.id);
    assert.equal(balance, 25);
    assert.ok(history.some((e) => e.points === -30 && names(e.reference, o.id)), 'the points taken back are not on record for the order');
    assert.ok(history.some((e) => e.points === 25 && names(e.reference, kept.id)));
  } },
  { id: 't27-12 goods that come back do not change what the goods cost', tags: ['R6'], async run(ctx) {
    const k = kit(ctx); const a = await k.costed(4, 1000, 400);
    const o = await k.shipped([[a, 2]]);
    await k.bought(a, 2, 700);
    const before = await k.cost(a); const records = ok(await ctx.sys.listCostHistory(a), 'listCostHistory');
    assert.equal(before.averageCostCents, 550);
    ok(await k.failed((await parcel(k, o.id)).id), 'reportFailedDelivery');
    const after = await k.cost(a);
    assert.equal(after.averageCostCents, 550); assert.equal(after.stockValueCents, 6 * 550);
    assert.deepEqual(ok(await ctx.sys.listCostHistory(a), 'listCostHistory'), records, 'R6: the cost history changed');
    assert.equal((await k.getOrder(o.id)).lines[0].unitCostCents, 400);
  } },
];
