import { assert, ok, no, kit, names } from './helpers.mjs';

let n = 0;
const discount = async (ctx, percent) => { const code = `SP${Math.random().toString(36).slice(2, 8).toUpperCase()}${++n}`; ok(await ctx.sys.createDiscountCode({ code, percent }), 'createDiscountCode'); return code; };
const history = async (ctx, id) => ok(await ctx.sys.listPointsHistory(id), 'listPointsHistory');
const MIN = 60_000;
const later = (order, ms) => new Date(new Date(order.createdAt).getTime() + ms).toISOString();

export const tests = [
  { id: 't11-01 points make an order cheaper', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 10000);
    assert.ok(await k.balance(c.id) >= 1, 'a customer who bought for 1000 euro has no point to use');
    const o = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 1 });
    assert.equal(o.pointsSpent, 1);
    assert.ok(o.pointsDiscountCents > 0, 'a point took nothing off');
    assert.equal(o.subtotalCents, 10000);
    assert.equal(o.totalCents, 10000 - o.pointsDiscountCents);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, o.totalCents);
    assert.equal(ctx.provider.charges.at(-1).amountCents, o.totalCents);
  } },
  { id: 't11-02 a point is worth five cents', tags: ['HD-51'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 4000);
    const o = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 100 });
    assert.equal(o.pointsDiscountCents, 500); assert.equal(o.totalCents, 3500);
    const one = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 1 });
    assert.equal(one.pointsDiscountCents, 5); assert.equal(one.totalCents, 3995);
  } },
  { id: 't11-03 nobody uses more points than they have', tags: ['R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 5000000);
    const { balance } = await k.points(c.id);
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: balance + 1 }), 'an order using more points than the customer has');
    assert.equal((await k.figures(a)).reserved, 0);
    assert.equal((await k.points(c.id)).balance, balance);
    const fresh = await k.customer();
    no(await k.order([[a, 1]], { customerId: fresh.id, pointsToSpend: 1 }), 'an order using points of a customer who has none');
    assert.equal((await k.points(fresh.id)).balance, 0);
  } },
  { id: 't11-04 points need an account and a sensible number', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 10000);
    no(await k.order([[a, 1]], { pointsToSpend: 1 }), 'an order without an account that uses points');
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: -1 }), 'an order using a negative number of points');
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 1.5 }), 'an order using half a point');
    assert.equal((await k.figures(a)).reserved, 0);
  } },
  { id: 't11-05 points pay for at most half of an order', tags: ['HD-52'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 1000); const odd = await k.stocked(5, 1005);
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 101 }), 'points for more than half of the order');
    const o = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 100 });
    assert.equal(o.totalCents, 500);
    no(await k.order([[odd, 1]], { customerId: c.id, pointsToSpend: 101 }), 'points for more than half of an odd amount');
    ok(await k.order([[odd, 1]], { customerId: c.id, pointsToSpend: 100 }), 'placeOrder');
  } },
  { id: 't11-06 points leave the balance when the order is placed', tags: ['HD-53'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(1000); const a = await k.stocked(5, 10000);
    assert.equal(await k.balance(c.id), 10);
    ok(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 8 }), 'placeOrder');
    assert.equal(await k.balance(c.id), 2);
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 8 }), 'using the same points on a second order');
    ok(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 2 }), 'placeOrder');
    assert.equal((await k.points(c.id)).balance, 0);
  } },
  { id: 't11-07 an order that falls through gives the points back', tags: ['HD-54'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 10000);
    const start = await k.balance(c.id);
    const cancelled = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 40 });
    ok(await k.cancel(cancelled.id), 'cancelOrder');
    assert.equal(await k.balance(c.id), start);
    const back = (await history(ctx, c.id)).filter((e) => names(e.reference, cancelled.id));
    assert.deepEqual(back.map((e) => e.points).sort((x, y) => x - y), [-40, 40]);
    const expired = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 60 });
    assert.equal(await k.balance(c.id), start - 60);
    assert.ok(ok(await ctx.sys.expireOrders(later(expired, 60 * MIN)), 'expireOrders').expired.includes(expired.id));
    assert.equal((await k.points(c.id)).balance, start);
  } },
  { id: 't11-08 the points history shows what was used', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 10000);
    const o = await k.paid([[a, 1]], { customerId: c.id, pointsToSpend: 1 });
    const used = (await history(ctx, c.id)).find((e) => names(e.reference, o.id) && e.points < 0);
    assert.ok(used, 'no entry of the points history shows the points used on the order');
    assert.equal(used.points, -1); assert.equal(used.kind, 'spent');
  } },
  { id: 't11-09 the balance stays the sum of its history', tags: ['R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(20, 10000);
    await k.points(c.id);
    const dropped = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 1 });
    await k.points(c.id);
    ok(await k.cancel(dropped.id), 'cancelOrder');
    await k.points(c.id);
    const o = await k.shipped([[a, 2]], { customerId: c.id, pointsToSpend: 1 });
    await k.points(c.id);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    await k.points(c.id);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    await k.points(c.id);
    ok(await k.ret(c.firstOrder.id, [[c.firstSku, 1]]), 'returnItems');
    await k.points(c.id);
  } },
  { id: 't11-10 a balance never goes below zero', tags: ['R5', 'HD-50', 'HD-52'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 50000);
    const { balance } = await k.points(c.id);
    assert.equal(balance, 1000);
    // All the points of the first order are used on a second one; then the first order comes back.
    const second = await k.shipped([[a, 1]], { customerId: c.id, pointsToSpend: 1000 });
    assert.equal((await k.points(c.id)).balance, 450);
    ok(await k.ret(c.firstOrder.id, [[c.firstSku, 1]]), 'returnItems');
    assert.equal((await k.points(c.id)).balance, 0);
    ok(await k.ret(second.id, [[a, 1]]), 'returnItems');
    await k.points(c.id);
  } },
  { id: 't11-11 the discount code comes first, then the points', tags: ['HD-55'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 1000); const code = await discount(ctx, 10);
    const start = await k.balance(c.id);
    no(await k.order([[a, 2]], { customerId: c.id, discountCode: code, pointsToSpend: 181 }), 'points for more than half of what is left after the code');
    const o = await k.placed([[a, 2]], { customerId: c.id, discountCode: code, pointsToSpend: 100 });
    assert.equal(o.subtotalCents, 2000); assert.equal(o.discountCents, 200); assert.equal(o.pointsDiscountCents, 500); assert.equal(o.totalCents, 1300);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 1300);
    assert.equal(await k.balance(c.id), start - 100 + 13);
  } },
  { id: 't11-12 a return gives back the points used', tags: ['HD-56'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 1000);
    const start = await k.balance(c.id);
    const o = await k.shipped([[a, 2]], { customerId: c.id, pointsToSpend: 100 });
    assert.equal(o.totalCents, 1500);
    assert.equal(await k.balance(c.id), start - 100 + 15);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 750);
    assert.equal(await k.balance(c.id), start - 100 + 50 + 7);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 750);
    assert.equal((await k.points(c.id)).balance, start);
  } },
  { id: 't11-13 an order without points is as before', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 450);
    const before = await k.balance(c.id);
    const o = await k.placed([[a, 2]], { customerId: c.id });
    assert.equal(o.pointsSpent, 0); assert.equal(o.pointsDiscountCents, 0); assert.equal(o.totalCents, 900);
    assert.equal(await k.balance(c.id), before);
    const guest = await k.placed([[a, 1]]);
    assert.equal(guest.pointsSpent, 0); assert.equal(guest.totalCents, 450);
  } },
];
