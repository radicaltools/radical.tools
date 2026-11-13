import { assert, ok, no, kit } from './helpers.mjs';

export const tests = [
  { id: 't1-01 cancel an order waiting for payment', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    assert.equal(ok(await k.cancel(o.id), 'cancelOrder').status, 'cancelled');
    assert.equal((await k.getOrder(o.id)).status, 'cancelled');
    const s = await k.figures(a); assert.equal(s.reserved, 0); assert.equal(s.onHand, 5);
    ok(await k.order([[a, 5]]), 'an order for the freed stock');
  } },
  { id: 't1-01b cancelling is not a stock movement', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    ok(await k.cancel(o.id), 'cancelOrder');
    assert.equal((await k.ledger(a)).length, 1);
  } },
  { id: 't1-02 a paid order cannot be cancelled', tags: ['HD-14'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.paid([[a, 3]]);
    no(await k.cancel(o.id), 'cancelling a paid order');
    assert.equal((await k.getOrder(o.id)).status, 'paid');
    assert.equal((await k.stock(a)).reserved, 3);
  } },
  { id: 't1-03 cancelling twice is not an error', tags: ['HD-15'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    ok(await k.cancel(o.id), 'cancelOrder');
    assert.equal(ok(await k.cancel(o.id), 'cancelling again').status, 'cancelled');
    assert.equal((await k.figures(a)).reserved, 0);
  } },
  { id: 't1-04 shipped and unknown orders', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.shipped([[a, 1]]);
    no(await k.cancel(o.id), 'cancelling a shipped order');
    no(await k.cancel('no-such-order'), 'cancelling an unknown order');
  } },
  { id: 't1-05 a cancelled order cannot be paid or shipped', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    ok(await k.cancel(o.id), 'cancelOrder');
    ctx.provider.mode = 'succeed';
    no(await k.pay(o.id), 'paying a cancelled order');
    no(await k.ship(o.id), 'shipping a cancelled order');
    assert.equal(ctx.provider.charges.length, 0);
  } },
];
