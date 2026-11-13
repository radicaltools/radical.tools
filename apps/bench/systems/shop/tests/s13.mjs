import { assert, ok, no, kit, names } from './helpers.mjs';

const row = (l) => [l.sku, l.quantity, l.unitCostCents];

export const tests = [
  { id: 't13-01 suppliers are kept', async run(ctx) {
    const k = kit(ctx);
    const s = ok(await ctx.sys.createSupplier({ name: `Ceramika ${k.sku('S')}`, email: 'biuro@ceramika.example' }), 'createSupplier');
    assert.equal(typeof s.id, 'string'); assert.ok(s.name.startsWith('Ceramika ')); assert.equal(s.email, 'biuro@ceramika.example');
    assert.equal(ok(await ctx.sys.getSupplier(s.id), 'getSupplier').name, s.name);
    const other = await k.supplier();
    const all = ok(await ctx.sys.listSuppliers(), 'listSuppliers');
    assert.ok(all.some((x) => x.id === s.id) && all.some((x) => x.id === other.id));
    no(await ctx.sys.getSupplier('no-such-supplier'), 'reading an unknown supplier');
  } },
  { id: 't13-02 one supplier per name', tags: ['HD-65'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier();
    no(await ctx.sys.createSupplier({ name: s.name }), 'a second supplier with the same name');
    no(await ctx.sys.createSupplier({ name: s.name.toUpperCase() }), 'the same name in upper case');
    no(await ctx.sys.createSupplier({ name: '   ' }), 'a supplier without a name');
  } },
  { id: 't13-03 a purchase order says what was ordered from whom', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const other = await k.supplier(); const a = await k.product(); const b = await k.product();
    const po = await k.purchased(s.id, [[a, 40, 310], [b, 12, 1275]]);
    assert.equal(typeof po.id, 'string'); assert.ok(names(po.supplierId, s.id)); assert.equal(po.status, 'open');
    assert.deepEqual(po.lines.map(row).sort(), [[a, 40, 310], [b, 12, 1275]].sort());
    assert.equal(po.totalCostCents, 40 * 310 + 12 * 1275);
    const read = ok(await ctx.sys.getPurchaseOrder(po.id), 'getPurchaseOrder');
    assert.deepEqual(read.lines.map(row).sort(), po.lines.map(row).sort()); assert.equal(read.status, 'open');
    const second = await k.purchased(s.id, [[a, 5, 300]]);
    const theirs = await k.purchased(other.id, [[a, 1, 300]]);
    const list = ok(await ctx.sys.listPurchaseOrders({ supplierId: s.id }), 'listPurchaseOrders');
    assert.deepEqual(new Set(list.map((p) => p.id)), new Set([po.id, second.id]));
    assert.ok(!list.some((p) => p.id === theirs.id));
    no(await ctx.sys.getPurchaseOrder('no-such-purchase-order'), 'reading an unknown purchase order');
  } },
  { id: 't13-04 what is on its way shows on the product', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(3); const b = await k.product();
    assert.equal((await k.stock(a)).onOrder, 0);
    await k.purchased(s.id, [[a, 40, 310], [b, 6, 100]]);
    await k.purchased((await k.supplier()).id, [[a, 15, 320]]);
    assert.equal((await k.stock(a)).onOrder, 55);
    assert.equal((await k.stock(b)).onOrder, 6);
  } },
  { id: 't13-05 ordering from a supplier does not change the stock', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(3);
    await k.purchased(s.id, [[a, 40, 310]]);
    const figures = await k.figures(a);
    assert.equal(figures.onHand, 3); assert.equal(figures.available, 3);
    assert.equal((await k.ledger(a)).length, 1);
    const o = await k.placed([[a, 5]]);
    assert.equal(o.lines[0].quantity, 5);
    assert.equal((await k.figures(a)).reserved, 3);
  } },
  { id: 't13-06 a purchase order needs a supplier, products and lines', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    no(await k.purchase('no-such-supplier', [[a, 1, 100]]), 'a purchase order for an unknown supplier');
    no(await k.purchase(s.id, [[k.sku('NONE'), 1, 100]]), 'a purchase order for an unknown product');
    no(await k.purchase(s.id, []), 'a purchase order without lines');
    assert.equal(ok(await ctx.sys.listPurchaseOrders({ supplierId: s.id }), 'listPurchaseOrders').length, 0);
    assert.equal((await k.stock(a)).onOrder, 0);
  } },
  { id: 't13-07 quantities and prices on a purchase order', tags: ['HD-66'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product();
    for (const quantity of [0, -3, 2.5, 10001]) no(await k.purchase(s.id, [[a, quantity, 100]]), `a purchase order line of ${quantity} units`);
    for (const cost of [0, -100, 9.5]) no(await k.purchase(s.id, [[a, 1, cost]]), `a purchase order line at ${cost} cents`);
    no(await k.purchase(s.id, [[a, 2, 100], [b, 1, 100], [a, 3, 100]]), 'the same product twice on one purchase order');
    ok(await k.purchase(s.id, [[a, 10000, 1]]), 'createPurchaseOrder');
    assert.equal((await k.stock(a)).onOrder, 10000);
  } },
  { id: 't13-08 a purchase order is for one warehouse', tags: ['HD-67'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const w = await k.warehouse();
    assert.equal((await k.purchased(s.id, [[a, 1, 100]])).warehouse, 'MAIN');
    assert.equal((await k.purchased(s.id, [[a, 1, 100]], w)).warehouse, w);
    no(await k.purchase(s.id, [[a, 1, 100]], 'NOWHERE'), 'a purchase order for an unknown warehouse');
  } },
  { id: 't13-09 a product that is off sale can still be bought in', tags: ['HD-68'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    ok(await ctx.sys.updateProduct(a, { active: false }), 'updateProduct');
    ok(await k.purchase(s.id, [[a, 4, 100]]), 'createPurchaseOrder');
    assert.equal((await k.stock(a)).onOrder, 4);
  } },
  { id: 't13-10 a purchase order can be called off', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const po = await k.purchased(s.id, [[a, 40, 310]]); const kept = await k.purchased(s.id, [[a, 2, 310]]);
    assert.equal(ok(await ctx.sys.cancelPurchaseOrder(po.id), 'cancelPurchaseOrder').status, 'cancelled');
    assert.equal(ok(await ctx.sys.getPurchaseOrder(po.id), 'getPurchaseOrder').status, 'cancelled');
    assert.equal(ok(await ctx.sys.getPurchaseOrder(kept.id), 'getPurchaseOrder').status, 'open');
    assert.equal((await k.stock(a)).onOrder, 2);
    no(await ctx.sys.cancelPurchaseOrder('no-such-purchase-order'), 'cancelling an unknown purchase order');
  } },
  { id: 't13-11 calling a purchase order off twice is fine', tags: ['HD-69'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const po = await k.purchased(s.id, [[a, 40, 310]]);
    ok(await ctx.sys.cancelPurchaseOrder(po.id), 'cancelPurchaseOrder');
    assert.equal(ok(await ctx.sys.cancelPurchaseOrder(po.id), 'cancelling a second time').status, 'cancelled');
    assert.equal((await k.stock(a)).onOrder, 0);
  } },
];
