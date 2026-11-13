import { assert, ok, no, kit, forOrder } from './helpers.mjs';

const correct = (ctx, id, body) => ctx.sys.correctStock(id, body);

export const tests = [
  { id: 't4-01 a correction sets the quantity on hand', tags: ['trap:R1:done'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.placed([[a, 2]]);
    ok(await correct(ctx, o.id, { sku: a, onHand: 7 }), 'correctStock');
    const s = await k.stock(a); assert.equal(s.onHand, 7); assert.equal(s.reserved, 2); assert.equal(s.available, 5);
    ok(await correct(ctx, o.id, { sku: a, onHand: 12 }), 'correctStock');
    assert.equal((await k.stock(a)).onHand, 12);
  } },
  { id: 't4-02 the correction is on record', tags: ['trap:R1:kept', 'R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.placed([[a, 2]]);
    ok(await correct(ctx, o.id, { sku: a, onHand: 7 }), 'correctStock');
    await k.ledger(a);
    ok(await correct(ctx, o.id, { sku: a, onHand: 9 }), 'correctStock');
    const m = await k.ledger(a);
    assert.deepEqual(m.map((x) => x.quantity), [10, -3, 2]);
  } },
  { id: 't4-03 a correction cannot go below reserved', tags: ['HD-23', 'R2'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.placed([[a, 6]]);
    no(await correct(ctx, o.id, { sku: a, onHand: 5 }), 'a correction below what is reserved');
    const s = await k.figures(a); assert.equal(s.onHand, 10);
    ok(await correct(ctx, o.id, { sku: a, onHand: 6 }), 'correctStock');
  } },
  { id: 't4-04 the correction is an adjustment for the order', tags: ['HD-24'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.placed([[a, 1]]);
    ok(await correct(ctx, o.id, { sku: a, onHand: 4 }), 'correctStock');
    const ms = await k.movements(a); const last = ms.at(-1);
    assert.equal(ms.length, 2); assert.equal(last.kind, 'adjustment'); assert.equal(last.quantity, -6); forOrder(last, o);
  } },
  { id: 't4-05 no difference records nothing', tags: ['HD-25'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const o = await k.placed([[a, 1]]);
    ok(await correct(ctx, o.id, { sku: a, onHand: 10 }), 'correctStock');
    assert.equal((await k.stock(a)).onHand, 10);
    assert.equal((await k.movements(a)).length, 1);
  } },
  { id: 't4-06 the product must be on the order', tags: ['HD-26'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10); const b = await k.stocked(10);
    const o = await k.placed([[a, 1]]);
    no(await correct(ctx, o.id, { sku: b, onHand: 3 }), 'a correction of a product that is not on the order');
    assert.equal((await k.stock(b)).onHand, 10);
    no(await correct(ctx, 'no-such-order', { sku: a, onHand: 3 }), 'a correction from an unknown order');
    no(await correct(ctx, o.id, { sku: a, onHand: -1 }), 'a negative count');
  } },
  { id: 't4-07 a correction in another warehouse', tags: ['HD-24'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.product();
    await k.receive(a, 6, w); await k.receive(a, 1);
    const o = await k.placed([[a, 2]]);
    ok(await correct(ctx, o.id, { sku: a, onHand: 8, warehouse: w }), 'correctStock');
    const s = await k.figures(a);
    assert.equal(k.wh(s, w).onHand, 8); assert.equal(k.wh(s, 'MAIN').onHand, 1); assert.equal(s.onHand, 9);
  } },
];
