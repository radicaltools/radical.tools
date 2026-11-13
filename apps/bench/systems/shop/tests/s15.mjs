import { assert, ok, no, kit, names } from './helpers.mjs';

const average = async (k, sku) => (await k.cost(sku)).averageCostCents;
const records = async (ctx, sku) => ok(await ctx.sys.listCostHistory(sku), 'listCostHistory');
const key = (r) => `${r.quantity}|${r.unitCostCents}|${r.averageCostCents}|${r.reference}`;

export const tests = [
  { id: 't15-01 what was bought has a cost', async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    const c = await k.cost(a);
    assert.equal(c.averageCostCents, 400); assert.equal(c.stockValueCents, 4000);
    no(await ctx.sys.getProductCost(k.sku('NONE')), 'the cost of an unknown product');
    no(await ctx.sys.listCostHistory(k.sku('NONE')), 'the cost history of an unknown product');
  } },
  { id: 't15-02 two purchases at different prices average out', async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400); await k.bought(a, 10, 600);
    const c = await k.cost(a);
    assert.equal(c.averageCostCents, 500); assert.equal(c.stockValueCents, 10000);
  } },
  { id: 't15-03 the stock value follows the stock', async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    await k.shipped([[a, 4]]);
    const c = await k.cost(a);
    assert.equal(c.averageCostCents, 400); assert.equal(c.stockValueCents, 2400);
  } },
  { id: 't15-04 the cost history lists the purchases', async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    assert.equal((await records(ctx, a)).length, 0);
    const first = await k.bought(a, 10, 400); const second = await k.bought(a, 10, 600);
    const h = await records(ctx, a);
    assert.equal(h.length, 2);
    const one = h.find((r) => names(r.reference, first.id)); const two = h.find((r) => names(r.reference, second.id));
    assert.ok(one && two, 'the records do not name their purchase orders');
    assert.deepEqual([one.quantity, one.unitCostCents, one.averageCostCents], [10, 400, 400]);
    assert.deepEqual([two.quantity, two.unitCostCents, two.averageCostCents], [10, 600, 500]);
  } },
  { id: 't15-05 the average is weighted by what is on the shelf', tags: ['HD-75'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000); const up = await k.product(); const down = await k.product(); const two = await k.product(); const w = await k.warehouse();
    await k.bought(a, 10, 400);
    await k.shipped([[a, 6]]);
    await k.bought(a, 12, 600);
    const c = await k.cost(a);
    assert.equal(c.averageCostCents, 550); assert.equal(c.stockValueCents, 8800);
    await k.bought(up, 3, 100); await k.bought(up, 3, 101);
    assert.equal(await average(k, up), 101, 'an average of 100.5 cents is rounded up');
    await k.bought(down, 2, 100); await k.bought(down, 1, 101);
    assert.equal(await average(k, down), 100);
    const s = await k.supplier();
    ok(await k.deliver((await k.purchased(s.id, [[two, 10, 400]])).id, [[two, 10]]), 'receivePurchaseOrder');
    ok(await k.deliver((await k.purchased(s.id, [[two, 30, 600]], w)).id, [[two, 30]]), 'receivePurchaseOrder');
    assert.equal(await average(k, two), 550, 'one average over all warehouses');
  } },
  { id: 't15-06 an empty shelf starts the average afresh', tags: ['HD-76'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 5, 400);
    await k.shipped([[a, 5]]);
    assert.equal(await average(k, a), 400);
    await k.bought(a, 5, 700);
    assert.equal(await average(k, a), 700);
  } },
  { id: 't15-07 goods received by hand, with and without a cost', tags: ['HD-77'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    ok(await ctx.sys.receiveStock({ sku: a, quantity: 10, unitCostCents: 600 }), 'a receipt with a cost');
    assert.equal(await average(k, a), 500);
    await k.receive(a, 20);
    const c = await k.cost(a);
    assert.equal(c.averageCostCents, 500); assert.equal(c.stockValueCents, 20000);
    assert.equal((await records(ctx, a)).length, 2);
    no(await ctx.sys.receiveStock({ sku: a, quantity: 1, unitCostCents: 0 }), 'a receipt at a cost of zero');
    no(await ctx.sys.receiveStock({ sku: a, quantity: 1, unitCostCents: 9.5 }), 'a receipt at a cost of half a cent');
    assert.equal((await k.figures(a)).onHand, 40);
  } },
  { id: 't15-08 a product nobody knows the cost of', tags: ['HD-79'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    let c = await k.cost(a);
    assert.equal(c.averageCostCents, null); assert.equal(c.stockValueCents, 0);
    await k.receive(a, 5);
    c = await k.cost(a);
    assert.equal(c.averageCostCents, null); assert.equal(c.stockValueCents, 0);
    const o = await k.shipped([[a, 1]]);
    assert.equal(o.lines[0].unitCostCents, null);
    await k.bought(a, 4, 300);
    c = await k.cost(a);
    assert.equal(c.averageCostCents, 300); assert.equal(c.stockValueCents, 2400);
  } },
  { id: 't15-09 a sold line shows what the goods cost when they left', tags: ['HD-78'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    const o = await k.paid([[a, 2]]);
    assert.equal(o.lines[0].unitCostCents, null);
    await k.bought(a, 10, 600);
    ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.getOrder(o.id)).lines[0].unitCostCents, 500);
    await k.bought(a, 18, 900);
    assert.equal((await k.getOrder(o.id)).lines[0].unitCostCents, 500);
  } },
  { id: 't15-10 only goods coming in from a supplier change the average', tags: ['R6'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    const same = async (after) => assert.equal(await average(k, a), 400, `the average cost changed after ${after}`);
    const o = await k.shipped([[a, 3]]); await same('a shipment');
    ok(await k.adjust(a, -2), 'adjustStock'); await same('an adjustment down');
    ok(await k.adjust(a, 1), 'adjustStock'); await same('an adjustment up');
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems'); await same('a return');
    ok(await ctx.sys.correctStock(o.id, { sku: a, onHand: 9 }), 'correctStock'); await same('a stock correction');
    ok(await ctx.sys.updateProduct(a, { priceCents: 2500 }), 'updateProduct'); await same('a change of the selling price');
    const dropped = await k.placed([[a, 2]]); ok(await k.cancel(dropped.id), 'cancelOrder'); await same('a cancelled order');
  } },
  { id: 't15-11 records of the cost history are never rewritten', tags: ['R6'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400); await k.bought(a, 10, 600);
    const early = await records(ctx, a);
    assert.equal(early.length, 2);
    await k.shipped([[a, 15]]);
    await k.bought(a, 20, 900);
    ok(await k.adjust(a, -1), 'adjustStock');
    const later = (await records(ctx, a)).map(key);
    assert.ok(later.length > early.length, 'the third purchase left no record');
    for (const r of early) {
      const i = later.indexOf(key(r));
      assert.ok(i >= 0, `the record ${JSON.stringify(r)} is no longer in the history as it was`);
      later.splice(i, 1);
    }
  } },
  { id: 't15-12 the cost of goods sold does not change afterwards', tags: ['R6'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000);
    await k.bought(a, 10, 400);
    const o = await k.shipped([[a, 2]]);
    const cost = o.lines[0].unitCostCents;
    assert.ok(Number.isInteger(cost), `the shipped line shows a cost of ${JSON.stringify(cost)}`);
    await k.bought(a, 40, 900);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    assert.equal((await k.getOrder(o.id)).lines[0].unitCostCents, cost);
  } },
];
