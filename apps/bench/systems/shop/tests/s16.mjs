import { assert, ok, no, kit, names } from './helpers.mjs';

const rule = (ctx, sku, reorderPoint, targetLevel, supplierId) => ctx.sys.setReorderRule(sku, { reorderPoint, targetLevel, supplierId });
const ruled = async (ctx, sku, reorderPoint, targetLevel, supplierId) => ok(await rule(ctx, sku, reorderPoint, targetLevel, supplierId), 'setReorderRule');
// The entry of the low-stock report for a product, undefined when it is not on the report.
const low = async (ctx, sku) => ok(await ctx.sys.listLowStock(), 'listLowStock').find((l) => l.sku === sku);
// What is proposed to be ordered: the proposals for one supplier, and the quantity proposed for one product (0 when none).
const proposalsFor = async (ctx, supplierId) => ok(await ctx.sys.listReorderProposals(), 'listReorderProposals').filter((p) => names(p.supplierId, supplierId));
const proposed = async (ctx, supplierId, sku) => (await proposalsFor(ctx, supplierId)).flatMap((p) => p.lines).filter((l) => l.sku === sku).reduce((a, l) => a + l.quantity, 0);

export const tests = [
  { id: 't16-01 a product that runs low is on the report', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const plenty = await k.stocked(30); const little = await k.stocked(2);
    await ruled(ctx, plenty, 5, 20, s.id); await ruled(ctx, little, 5, 20, s.id);
    assert.equal(await low(ctx, plenty), undefined, 'a product with 30 on the shelf and a minimum of 5 is reported low');
    const entry = await low(ctx, little);
    assert.ok(entry, 'a product with 2 on the shelf and a minimum of 5 is not reported low');
    assert.equal(entry.available, 2); assert.equal(entry.reorderPoint, 5); assert.equal(entry.onOrder, 0);
  } },
  { id: 't16-02 a low product comes with a proposal for its supplier', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const other = await k.supplier(); const plenty = await k.stocked(30); const little = await k.stocked(2);
    await ruled(ctx, plenty, 5, 20, s.id); await ruled(ctx, little, 5, 20, s.id);
    assert.ok(await proposed(ctx, s.id, little) > 0, 'nothing is proposed for the low product');
    assert.equal(await proposed(ctx, s.id, plenty), 0);
    assert.equal(await proposed(ctx, other.id, little), 0);
  } },
  { id: 't16-03 selling takes a product onto the report, a delivery takes it off', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(30);
    await ruled(ctx, a, 5, 40, s.id);
    assert.equal(await low(ctx, a), undefined);
    await k.shipped([[a, 28]]);
    assert.ok(await low(ctx, a), 'the product is not reported after selling down to 2');
    await k.bought(a, 38, 100, s.id);
    assert.equal(await low(ctx, a), undefined);
    assert.equal(await proposed(ctx, s.id, a), 0);
  } },
  { id: 't16-04 the report changes nothing', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(2);
    await ruled(ctx, a, 5, 20, s.id);
    await low(ctx, a); await proposalsFor(ctx, s.id); await proposalsFor(ctx, s.id);
    assert.equal(ok(await ctx.sys.listPurchaseOrders({ supplierId: s.id }), 'listPurchaseOrders').length, 0);
    const figures = await k.figures(a);
    assert.equal(figures.onHand, 2); assert.equal(figures.onOrder, 0);
  } },
  { id: 't16-05 a rule can be changed', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const other = await k.supplier(); const a = await k.stocked(3);
    await ruled(ctx, a, 5, 20, s.id);
    assert.ok(await low(ctx, a));
    await ruled(ctx, a, 1, 20, s.id);
    assert.equal(await low(ctx, a), undefined);
    await ruled(ctx, a, 10, 20, other.id);
    assert.equal((await low(ctx, a)).reorderPoint, 10);
    assert.ok(await proposed(ctx, other.id, a) > 0); assert.equal(await proposed(ctx, s.id, a), 0);
    no(await rule(ctx, k.sku('NONE'), 5, 20, s.id), 'a rule for an unknown product');
    no(await rule(ctx, a, 5, 20, 'no-such-supplier'), 'a rule with an unknown supplier');
  } },
  { id: 't16-06 low means at or below the minimum, of what can still be sold', tags: ['HD-80'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const at = await k.stocked(5); const above = await k.stocked(6); const held = await k.stocked(10); const waiting = await k.stocked(8);
    for (const sku of [at, above, held]) await ruled(ctx, sku, 5, 20, s.id);
    assert.ok(await low(ctx, at), 'a product exactly at its minimum is not reported');
    assert.equal(await low(ctx, above), undefined);
    await k.placed([[held, 6]]);
    assert.equal((await low(ctx, held)).available, 4);
    await ruled(ctx, waiting, 0, 20, s.id);
    assert.equal(await low(ctx, waiting), undefined);
    await k.placed([[waiting, 8]]);
    assert.ok(await low(ctx, waiting), 'a product with nothing left to sell and a minimum of 0 is not reported');
  } },
  { id: 't16-07 the proposal fills up to the target', tags: ['HD-81'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(2); const b = await k.product();
    await ruled(ctx, a, 5, 20, s.id); await ruled(ctx, b, 5, 20, s.id);
    assert.equal(await proposed(ctx, s.id, a), 18);
    const po = await k.purchased(s.id, [[a, 10, 100]]);
    assert.equal(await proposed(ctx, s.id, a), 8);
    assert.equal((await low(ctx, a)).onOrder, 10);
    ok(await k.deliver(po.id, [[a, 2]]), 'receivePurchaseOrder');
    assert.equal(await proposed(ctx, s.id, a), 8);
    await k.placed([[b, 4]]);
    assert.equal(await proposed(ctx, s.id, b), 24, 'units customers wait for are ordered on top');
  } },
  { id: 't16-08 enough on its way: reported, nothing proposed', tags: ['HD-81'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(2);
    await ruled(ctx, a, 5, 20, s.id);
    await k.purchased(s.id, [[a, 18, 100]]);
    const entry = await low(ctx, a);
    assert.ok(entry, 'a low product with goods on their way is not on the report');
    assert.equal(entry.onOrder, 18);
    assert.equal(await proposed(ctx, s.id, a), 0);
    assert.equal((await proposalsFor(ctx, s.id)).length, 0, 'a proposal without lines');
  } },
  { id: 't16-09 only products with a rule that are on sale are watched', tags: ['HD-82'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const free = await k.product(); const off = await k.stocked(1);
    assert.equal(await low(ctx, free), undefined);
    await ruled(ctx, off, 5, 20, s.id);
    assert.ok(await low(ctx, off));
    ok(await ctx.sys.updateProduct(off, { active: false }), 'updateProduct');
    assert.equal(await low(ctx, off), undefined);
    assert.equal(await proposed(ctx, s.id, off), 0);
    ok(await ctx.sys.updateProduct(off, { active: true }), 'updateProduct');
    assert.ok(await low(ctx, off));
  } },
  { id: 't16-10 what a rule needs', tags: ['HD-83'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(1);
    no(await rule(ctx, a, -1, 20, s.id), 'a minimum below zero');
    no(await rule(ctx, a, 2.5, 20, s.id), 'a minimum of half a unit');
    no(await rule(ctx, a, 5, 5, s.id), 'a target equal to the minimum');
    no(await rule(ctx, a, 5, 3, s.id), 'a target below the minimum');
    assert.equal(await low(ctx, a), undefined);
    await ruled(ctx, a, 0, 1, s.id);
    assert.equal(await low(ctx, a), undefined);
  } },
  { id: 't16-11 one proposal per supplier', tags: ['HD-84'], async run(ctx) {
    const k = kit(ctx); const s1 = await k.supplier(); const s2 = await k.supplier(); const a = await k.stocked(1); const b = await k.stocked(2); const c = await k.stocked(3);
    await ruled(ctx, a, 5, 20, s1.id); await ruled(ctx, b, 5, 30, s1.id); await ruled(ctx, c, 5, 10, s2.id);
    const first = await proposalsFor(ctx, s1.id); const second = await proposalsFor(ctx, s2.id);
    assert.equal(first.length, 1); assert.equal(second.length, 1);
    assert.deepEqual(first[0].lines.map((l) => [l.sku, l.quantity]).sort(), [[a, 19], [b, 28]].sort());
    assert.deepEqual(second[0].lines.map((l) => [l.sku, l.quantity]), [[c, 7]]);
  } },
  { id: 't16-12 reading the report leaves the stock history alone', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(2);
    await ruled(ctx, a, 5, 20, s.id);
    const before = await k.ledger(a);
    await low(ctx, a); await proposalsFor(ctx, s.id);
    assert.deepEqual(await k.ledger(a), before);
  } },
];
