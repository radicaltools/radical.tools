import { assert, ok, no, kit, names } from './helpers.mjs';

const line = (order, sku) => order.lines.find((l) => l.sku === sku);
const promotion = async (ctx, id) => ok(await ctx.sys.listPromotions(), 'listPromotions').find((p) => names(p.id, id));
// "Buy two, get the third one free" on a product.
const threeForTwo = async (k, sku) => ok(await k.multibuy(sku, 2, 1), 'createPromotion');
// A teapot at 50.00 and cups at 10.00, sold as a set of the teapot and two cups for `priceCents`.
async function teaSet(k, priceCents = 6000) {
  const pot = await k.stocked(9, 5000); const cup = await k.stocked(20, 1000);
  const set = ok(await k.bundle([[pot, 1], [cup, 2]], priceCents), 'createPromotion');
  return { pot, cup, set };
}

export const tests = [
  { id: 't19-01 buy two, get the third one free', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const p = await threeForTwo(k, a);
    assert.equal(p.active, true);
    const o = await k.placed([[a, 3]]);
    assert.equal(line(o, a).quantity, 3);
    assert.equal(o.subtotalCents, 3000); assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.totalCents, 2000);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 2000);
    assert.equal(await k.charged(o.id), 2000);
  } },
  { id: 't19-02 a promotion counts only where it is earned', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 1000);
    await threeForTwo(k, a);
    const two = await k.placed([[a, 2]]);
    assert.equal(two.promotionDiscountCents, 0); assert.equal(two.totalCents, 2000);
    assert.equal(line(two, a).quantity, 2, 'the system put units on the order that the customer did not ask for');
    const other = await k.placed([[b, 3]]);
    assert.equal(other.promotionDiscountCents, 0); assert.equal(other.totalCents, 3000);
    const mixed = await k.placed([[a, 3], [b, 3]]);
    assert.equal(mixed.promotionDiscountCents, 1000); assert.equal(mixed.totalCents, 5000);
  } },
  { id: 't19-03 a set costs its own price', async run(ctx) {
    const k = kit(ctx); const { pot, cup } = await teaSet(k, 6000);
    const o = await k.placed([[pot, 1], [cup, 2]]);
    assert.equal(o.subtotalCents, 7000); assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.totalCents, 6000);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 6000);
    const cups = await k.placed([[cup, 2]]);
    assert.equal(cups.promotionDiscountCents, 0); assert.equal(cups.totalCents, 2000);
  } },
  { id: 't19-04 a promotion can be ended', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const p = await threeForTwo(k, a);
    assert.equal((await promotion(ctx, p.id))?.active, true);
    assert.equal(ok(await ctx.sys.endPromotion(p.id), 'endPromotion').active, false);
    const o = await k.placed([[a, 3]]);
    assert.equal(o.promotionDiscountCents, 0); assert.equal(o.totalCents, 3000);
    const shown = await promotion(ctx, p.id);
    assert.ok(!shown || shown.active === false, 'the ended promotion is listed as running');
    no(await ctx.sys.endPromotion('no-such-promotion'), 'ending an unknown promotion');
  } },
  { id: 't19-05 every full group earns its free units', tags: ['HD-100'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(60, 1000); const b = await k.stocked(60, 700);
    await threeForTwo(k, a);
    for (const [units, free] of [[4, 1], [5, 1], [6, 2], [7, 2]]) {
      const o = await k.placed([[a, units]]);
      assert.equal(o.promotionDiscountCents, free * 1000, `${units} units`);
      assert.equal(o.totalCents, (units - free) * 1000);
    }
    // Buy three, get two free: a group is five units.
    ok(await k.multibuy(b, 3, 2), 'createPromotion');
    assert.equal((await k.placed([[b, 4]])).promotionDiscountCents, 0);
    assert.equal((await k.placed([[b, 5]])).promotionDiscountCents, 1400);
    assert.equal((await k.placed([[b, 11]])).promotionDiscountCents, 2800);
  } },
  { id: 't19-06 complete sets cost the set price, the rest the usual price', tags: ['HD-101'], async run(ctx) {
    const k = kit(ctx); const { pot, cup } = await teaSet(k, 6000);
    const extra = await k.placed([[pot, 1], [cup, 4]]);
    assert.equal(extra.promotionDiscountCents, 1000); assert.equal(extra.totalCents, 8000);
    const twice = await k.placed([[pot, 2], [cup, 4]]);
    assert.equal(twice.promotionDiscountCents, 2000); assert.equal(twice.totalCents, 12000);
    const pots = await k.placed([[pot, 2], [cup, 3]]);
    assert.equal(pots.promotionDiscountCents, 1000); assert.equal(pots.totalCents, 12000);
    const short = await k.placed([[pot, 1], [cup, 1]]);
    assert.equal(short.promotionDiscountCents, 0); assert.equal(short.totalCents, 6000);
  } },
  { id: 't19-07 a product is in one running promotion only', tags: ['HD-103'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 1000);
    const first = await threeForTwo(k, a);
    no(await k.multibuy(a, 1, 1), 'a second promotion on the same product');
    no(await k.bundle([[a, 1], [b, 1]], 1500), 'a set with a product that is in a running promotion');
    ok(await ctx.sys.endPromotion(first.id), 'endPromotion');
    ok(await k.bundle([[a, 1], [b, 1]], 1500), 'a set once the first promotion has ended');
    no(await k.multibuy(b, 2, 1), 'a promotion on a product that is in a running set');
    assert.equal((await k.placed([[a, 3], [b, 1]])).promotionDiscountCents, 500);
  } },
  { id: 't19-08 what is refused when a promotion is made', tags: ['HD-102'], async run(ctx) {
    const k = kit(ctx); const a = await k.product(1000); const b = await k.product(400);
    no(await k.multibuy(k.sku('NONE'), 2, 1), 'a promotion on an unknown product');
    for (const [x, y] of [[0, 1], [2, 0], [1.5, 1], [-2, 1]]) no(await k.multibuy(a, x, y), `buy ${x}, get ${y} free`);
    no(await k.bundle([], 500), 'a set without products');
    no(await k.bundle([[a, 1]], 900), 'a set of a single unit');
    no(await k.bundle([[a, 1], [a, 1]], 1500), 'a set with the same product twice');
    no(await k.bundle([[a, 1], [k.sku('NONE'), 1]], 900), 'a set with an unknown product');
    no(await k.bundle([[a, 1], [b, 1]], 1400), 'a set that costs what its products cost');
    no(await k.bundle([[a, 1], [b, 1]], 1500), 'a set that costs more than its products');
    no(await k.bundle([[a, 1], [b, 1]], 0), 'a set for nothing');
    no(await ctx.sys.createPromotion({ name: '  ', kind: 'multibuy', sku: a, buyQuantity: 2, freeQuantity: 1 }), 'a promotion without a name');
    ok(await k.bundle([[a, 2]], 1500), 'two of the same product as a set');
    const c = await k.product(300);
    ok(await k.bundle([[b, 1], [c, 1]], 699), 'a set one cent cheaper than its products');
  } },
  { id: 't19-09 the code takes its percentage of what is left after the promotion', tags: ['HD-105'], until: 19, async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const ten = await k.discount(10);
    await threeForTwo(k, a);
    const o = await k.placed([[a, 3]], { discountCode: ten });
    assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.discountCents, 200); assert.equal(o.totalCents, 1800);
  } },
  { id: 't19-10 points pay for half of what is left after the promotion', tags: ['HD-105'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(9, 1000);
    await threeForTwo(k, a);
    no(await k.order([[a, 3]], { customerId: c.id, pointsToSpend: 201 }), 'points for more than half of what is left after the promotion');
    const o = await k.placed([[a, 3]], { customerId: c.id, pointsToSpend: 200 });
    assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.pointsDiscountCents, 1000); assert.equal(o.totalCents, 1000);
  } },
  { id: 't19-11 a free unit is not given away below cost', tags: ['R8'], async run(ctx) {
    const k = kit(ctx); const a = await k.costed(9, 1000, 800); const wide = await k.costed(9, 1000, 300);
    await threeForTwo(k, a); await threeForTwo(k, wide);
    // Three units cost 24.00: the promotion takes 6.00 off, not 10.00.
    const o = await k.placed([[a, 3]]);
    assert.equal(o.totalCents, 2400, 'R8: three units that cost 8.00 each are not sold for 24.00');
    assert.equal(o.promotionDiscountCents, 600);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 2400);
    // Where the margin allows it the third unit is free.
    const free = await k.placed([[wide, 3]]);
    assert.equal(free.promotionDiscountCents, 1000); assert.equal(free.totalCents, 2000);
  } },
  { id: 't19-12 a set is not sold below the cost of its goods', tags: ['R8'], async run(ctx) {
    const k = kit(ctx); const pot = await k.costed(9, 5000, 4500); const cup = await k.costed(9, 1000, 900);
    ok(await k.bundle([[pot, 1], [cup, 2]], 3500), 'createPromotion');
    const o = await k.placed([[pot, 1], [cup, 2]]);
    assert.equal(o.subtotalCents, 7000);
    assert.equal(o.totalCents, 6300, 'R8: goods that cost 63.00 are not sold for 63.00');
    assert.equal(o.promotionDiscountCents, 700);
  } },
  { id: 't19-13 ending a promotion leaves the orders placed under it', tags: ['HD-104'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    const p = await threeForTwo(k, a);
    const o = await k.placed([[a, 3]]);
    ok(await ctx.sys.endPromotion(p.id), 'endPromotion');
    assert.equal(ok(await ctx.sys.endPromotion(p.id), 'ending a promotion a second time').active, false);
    const same = await k.getOrder(o.id);
    assert.equal(same.promotionDiscountCents, 1000); assert.equal(same.totalCents, 2000);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 2000);
  } },
  { id: 't19-14 tax follows what is paid after the promotion', tags: ['R7', 'HD-85', 'HD-89'], async run(ctx) {
    const k = kit(ctx); const a = await k.taxed(9, 1230, 23);
    await threeForTwo(k, a);
    const o = await k.placed([[a, 3]]);
    assert.equal(o.totalCents, 2460); assert.equal(o.taxCents, 460);
    assert.equal(o.taxCents, o.lines.reduce((s, l) => s + l.taxCents, 0));
    // A set over two rates: 70.00 of goods for 63.00, 10 % off each line. 45.00 at 23 % and 18.00 at 5 %.
    const pot = await k.taxed(9, 5000, 23); const cup = await k.taxed(9, 1000, 5);
    ok(await k.bundle([[pot, 1], [cup, 2]], 6300), 'createPromotion');
    const set = await k.placed([[pot, 1], [cup, 2]]);
    assert.equal(set.totalCents, 6300);
    assert.equal(line(set, pot).taxCents, 841); assert.equal(line(set, cup).taxCents, 86); assert.equal(set.taxCents, 927);
  } },
  { id: 't19-15 a return of promotion goods gives back what was paid', tags: ['HD-34'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000);
    await threeForTwo(k, a);
    const o = await k.shipped([[a, 3]]);
    assert.equal(o.totalCents, 2000);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 666);
    assert.equal(ok(await k.ret(o.id, [[a, 2]]), 'returnItems').refundCents, 1334);
    assert.equal(ctx.provider.refunds.reduce((s, r) => s + r.amountCents, 0), 2000);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
  } },
];
