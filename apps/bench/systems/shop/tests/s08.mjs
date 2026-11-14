import { assert, ok, no, kit } from './helpers.mjs';

export const tests = [
  { id: 't8-01 an order beyond stock is taken', tags: ['trap:R2:done'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    const o = await k.placed([[a, 5]]);
    assert.equal(o.lines[0].quantity, 5);
    const none = await k.product();
    ok(await k.order([[none, 1]]), 'an order for a product with no stock');
  } },
  { id: 't8-02 available stock is still never negative', tags: ['trap:R2:kept', 'R2'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    ok(await k.order([[a, 5]]), 'placeOrder');
    const s = await k.figures(a);
    assert.equal(s.onHand, 2);
    ok(await k.order([[a, 1]]), 'placeOrder');
    await k.figures(a);
  } },
  { id: 't8-03 a backordered order ships only when complete', tags: ['HD-37'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    const o = await k.paid([[a, 5]]);
    no(await k.ship(o.id), 'shipping an order with units missing');
    await k.receive(a, 3);
    ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.figures(a)).onHand, 0);
  } },
  { id: 't8-04 backordered units are counted', tags: ['HD-38'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    const o = await k.placed([[a, 5]]);
    assert.equal(o.lines[0].backorderedQuantity, 3);
    const before = await k.figures(a);
    assert.equal(before.backordered, 3); assert.equal(before.reserved, 2); assert.equal(before.available, 0);
    await k.receive(a, 4);
    const s = await k.figures(a);
    assert.equal(s.backordered, 0); assert.equal(s.reserved, 5); assert.equal(s.available, 1);
    assert.equal((await k.getOrder(o.id)).lines[0].backorderedQuantity, 0);
  } },
  { id: 't8-05 the oldest order is served first', tags: ['HD-39'], async run(ctx) {
    const k = kit(ctx); const a = await k.product();
    const first = await k.paid([[a, 3]]); const second = await k.paid([[a, 3]]);
    await k.receive(a, 4);
    no(await k.ship(second.id), 'shipping the younger order first');
    ok(await k.ship(first.id), 'shipOrder');
    const s = await k.figures(a); assert.equal(s.onHand, 1); assert.equal(s.reserved, 1);
    await k.receive(a, 2);
    ok(await k.ship(second.id), 'shipOrder');
  } },
  { id: 't8-06 cancelling drops the backorder', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    const o = await k.placed([[a, 5]]);
    ok(await k.cancel(o.id), 'cancelOrder');
    await k.receive(a, 3);
    const s = await k.figures(a); assert.equal(s.reserved, 0); assert.equal(s.available, 5);
  } },
  { id: 't8-07 the stock history still adds up', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2);
    const o = await k.paid([[a, 5]]);
    await k.receive(a, 3);
    ok(await k.ship(o.id), 'shipOrder');
    await k.ledger(a);
  } },
];
