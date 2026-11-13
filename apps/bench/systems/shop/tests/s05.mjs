import { assert, ok, no, unavailable, kit, forOrder } from './helpers.mjs';

export const tests = [
  { id: 't5-01 a partial return refunds and restocks', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 700); const b = await k.stocked(10, 300);
    const o = await k.shipped([[a, 3], [b, 1]]);
    const charge = await k.chargeOf(o.id);
    const r = ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    assert.equal(r.refundCents, 1400);
    assert.deepEqual(r.lines.map((l) => [l.sku, l.quantity]), [[a, 2]]);
    const refund = ctx.provider.refunds.at(-1);
    assert.equal(refund.amountCents, 1400); assert.equal(refund.chargeId, charge.chargeId);
    const s = await k.figures(a); assert.equal(s.onHand, 9); assert.equal(s.available, 9);
    assert.equal(ok(await ctx.sys.listReturns(o.id), 'listReturns').length, 1);
  } },
  { id: 't5-01b a return is on record for the order', tags: ['HD-27', 'R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 700);
    const o = await k.shipped([[a, 3]]);
    ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    const m = (await k.ledger(a)).at(-1);
    assert.equal(m.kind, 'return'); assert.equal(m.quantity, 2); forOrder(m, o);
  } },
  { id: 't5-02 everything returned ends the order', tags: ['HD-29'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 700); const b = await k.stocked(10, 300);
    const o = await k.shipped([[a, 2], [b, 1]]);
    const charge = await k.chargeOf(o.id);
    ok(await k.ret(o.id, [[a, 1], [b, 1]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(ctx.provider.refunds.filter((r) => r.chargeId === charge.chargeId).reduce((s, r) => s + r.amountCents, 0), 1700);
    no(await k.ret(o.id, [[a, 1]]), 'a return on a fully returned order');
  } },
  { id: 't5-03 no more than was ordered', tags: ['HD-26b'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 700); const other = await k.stocked(5);
    const o = await k.shipped([[a, 2]]);
    no(await k.ret(o.id, [[a, 3]]), 'returning more than was ordered');
    no(await k.ret(o.id, [[other, 1]]), 'returning a product that is not on the order');
    no(await k.ret(o.id, []), 'a return without lines');
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    no(await k.ret(o.id, [[a, 2]]), 'returning more than is left');
    assert.equal((await k.figures(a)).onHand, 9);
  } },
  { id: 't5-04 only a shipped order takes returns', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.paid([[a, 2]]);
    no(await k.ret(o.id, [[a, 1]]), 'a return on an order that has not shipped');
    no(await k.ret('no-such-order', [[a, 1]]), 'a return on an unknown order');
    assert.equal(ctx.provider.refunds.length, 0);
  } },
  { id: 't5-05 the provider fails on a refund', tags: ['HD-28'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.shipped([[a, 2]]);
    ctx.provider.refundMode = 'fail';
    unavailable(await k.ret(o.id, [[a, 1]]), 'a return while the provider is down');
    assert.equal((await k.figures(a)).onHand, 8);
    assert.equal(ok(await ctx.sys.listReturns(o.id), 'listReturns').length, 0);
    ctx.provider.refundMode = 'succeed';
    ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).status, 'returned');
  } },
  { id: 't5-06 the refund uses the price on the order', tags: ['HD-30'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 700);
    const o = await k.shipped([[a, 2]]);
    ok(await ctx.sys.updateProduct(a, { priceCents: 9900 }), 'updateProduct');
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 700);
  } },
  { id: 't5-07 a return into another warehouse', tags: ['HD-27'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.stocked(10);
    const o = await k.shipped([[a, 4]]);
    ok(await k.ret(o.id, [[a, 3]], w), 'returnItems');
    const s = await k.figures(a);
    assert.equal(k.wh(s, w).onHand, 3); assert.equal(k.wh(s, 'MAIN').onHand, 6);
  } },
];
