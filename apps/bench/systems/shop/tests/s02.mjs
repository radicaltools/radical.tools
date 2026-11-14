import { assert, ok, no, kit } from './helpers.mjs';

const alloc = (line) => Object.fromEntries((line.allocations ?? []).map((a) => [a.warehouse, a.quantity]));

export const tests = [
  { id: 't2-01 warehouses', async run(ctx) {
    const k = kit(ctx); const code = k.code();
    const w = ok(await ctx.sys.createWarehouse({ code, name: 'North' }), 'createWarehouse');
    assert.equal(w.code, code); assert.equal(w.name, 'North');
    no(await ctx.sys.createWarehouse({ code, name: 'Again' }), 'a second warehouse with the same code');
    const codes = ok(await ctx.sys.listWarehouses(), 'listWarehouses').map((x) => x.code);
    assert.ok(codes.includes('MAIN'), 'the first warehouse is there'); assert.ok(codes.includes(code));
  } },
  { id: 't2-01b warehouse codes', tags: ['HD-19'], async run(ctx) {
    no(await ctx.sys.createWarehouse({ code: 'ab', name: 'Lower' }), 'a lower-case code');
    no(await ctx.sys.createWarehouse({ code: 'TOOLONGCODE1', name: 'Long' }), 'a code of 12 characters');
    no(await ctx.sys.createWarehouse({ code: 'X', name: 'Short' }), 'a code of 1 character');
  } },
  { id: 't2-02 stock per warehouse', async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 4, w); await k.receive(sku, 3);
    no(await ctx.sys.receiveStock({ sku, quantity: 1, warehouse: 'NOPE99' }), 'a receipt in an unknown warehouse');
    const s = await k.figures(sku);
    assert.equal(s.onHand, 7); assert.equal(s.available, 7);
    assert.equal(k.wh(s, w).onHand, 4); assert.equal(k.wh(s, 'MAIN').onHand, 3); assert.equal(k.wh(s, w).available, 4);
  } },
  { id: 't2-02b movements say where they happened', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 4, w); await k.receive(sku, 3);
    assert.deepEqual((await k.ledger(sku)).map((m) => [m.warehouse, m.quantity]), [[w, 4], ['MAIN', 3]]);
  } },
  { id: 't2-03 a line comes from the warehouse with the most stock', tags: ['HD-17'], async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const w2 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 5, w1); await k.receive(sku, 8, w2); await k.receive(sku, 4);
    const o = await k.placed([[sku, 4]]);
    assert.deepEqual(alloc(o.lines[0]), { [w2]: 4 });
    const s = await k.figures(sku);
    assert.equal(k.wh(s, w2).reserved, 4); assert.equal(k.wh(s, w1).reserved, 0); assert.equal(s.reserved, 4);
  } },
  { id: 't2-04 a tie goes to the first code', tags: ['HD-17'], async run(ctx) {
    const k = kit(ctx); const [w1, w2] = [k.code(), k.code()].sort();
    await k.warehouse(w2); await k.warehouse(w1); const sku = await k.product();
    await k.receive(sku, 6, w2); await k.receive(sku, 6, w1);
    const o = await k.placed([[sku, 2]]);
    assert.deepEqual(alloc(o.lines[0]), { [w1]: 2 });
  } },
  { id: 't2-05 a line is split when no warehouse covers it', tags: ['HD-17', 'HD-18'], async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const w2 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 3, w1); await k.receive(sku, 5, w2);
    const o = await k.placed([[sku, 7]]);
    assert.deepEqual(alloc(o.lines[0]), { [w2]: 5, [w1]: 2 });
    const s = await k.figures(sku);
    assert.equal(s.available, 1); assert.equal(k.wh(s, w1).available, 1); assert.equal(k.wh(s, w2).available, 0);
  } },
  { id: 't2-06 refused only when all warehouses together are short', tags: ['HD-18'], until: 7, async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 3, w1); await k.receive(sku, 2);
    no(await k.order([[sku, 6]]), 'an order beyond all warehouses');
    assert.equal((await k.stock(sku)).reserved, 0);
    ok(await k.order([[sku, 5]]), 'an order two warehouses cover together');
  } },
  { id: 't2-07 adjustment below reserved in one warehouse', tags: ['R2'], async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 5, w1);
    const o = await k.placed([[sku, 4]]);
    assert.deepEqual(alloc(o.lines[0]), { [w1]: 4 });
    await k.receive(sku, 2);
    no(await k.adjust(sku, -2, w1), 'an adjustment below what is reserved in that warehouse');
    ok(await k.adjust(sku, -1, w1), 'adjustStock');
    await k.figures(sku);
  } },
  { id: 't2-08 shipping takes from the reserved warehouses', async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const w2 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 3, w1); await k.receive(sku, 5, w2);
    await k.shipped([[sku, 8]]);
    const s = await k.figures(sku);
    assert.equal(k.wh(s, w1).onHand, 0); assert.equal(k.wh(s, w2).onHand, 0); assert.equal(s.reserved, 0);
  } },
  { id: 't2-08b a shipment is on record per warehouse', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const w2 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 3, w1); await k.receive(sku, 5, w2);
    await k.shipped([[sku, 8]]);
    const ms = (await k.ledger(sku)).filter((m) => m.kind === 'shipment');
    assert.deepEqual(Object.fromEntries(ms.map((m) => [m.warehouse, m.quantity])), { [w2]: -5, [w1]: -3 });
  } },
  { id: 't2-09 cancelling frees every warehouse', async run(ctx) {
    const k = kit(ctx); const w1 = await k.warehouse(); const w2 = await k.warehouse(); const sku = await k.product();
    await k.receive(sku, 3, w1); await k.receive(sku, 5, w2);
    const o = await k.placed([[sku, 8]]);
    ok(await k.cancel(o.id), 'cancelOrder');
    const s = await k.figures(sku);
    assert.equal(s.reserved, 0); assert.equal(k.wh(s, w1).reserved, 0); assert.equal(k.wh(s, w2).reserved, 0);
  } },
];
