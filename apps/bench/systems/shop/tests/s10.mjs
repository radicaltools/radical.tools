import { assert, ok, no, kit, names } from './helpers.mjs';

let n = 0;
const discount = async (ctx, percent) => { const code = `LP${Math.random().toString(36).slice(2, 8).toUpperCase()}${++n}`; ok(await ctx.sys.createDiscountCode({ code, percent }), 'createDiscountCode'); return code; };
const history = async (ctx, id) => ok(await ctx.sys.listPointsHistory(id), 'listPointsHistory');
const key = (e) => `${e.points}|${e.reference}`;

export const tests = [
  { id: 't10-01 buying earns points', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(3, 100000);
    assert.equal(await k.balance(c.id), 0);
    assert.equal((await history(ctx, c.id)).length, 0);
    await k.paid([[a, 1]], { customerId: c.id });
    const first = await k.balance(c.id);
    assert.ok(first > 0, `a paid order of 1000 euro left a balance of ${first}`);
    await k.paid([[a, 1]], { customerId: c.id });
    assert.ok(await k.balance(c.id) > first, 'a second paid order did not add points');
    no(await ctx.sys.getPoints('no-such-customer'), 'the points of an unknown customer');
  } },
  { id: 't10-02 one point for every full euro', tags: ['HD-47'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1250); const b = await k.stocked(5, 999); const tiny = await k.stocked(5, 99);
    await k.paid([[a, 2]], { customerId: c.id });
    assert.equal(await k.balance(c.id), 25);
    await k.paid([[b, 1]], { customerId: c.id });
    assert.equal(await k.balance(c.id), 34);
    await k.paid([[tiny, 1]], { customerId: c.id });
    assert.equal(await k.balance(c.id), 34);
    assert.equal((await history(ctx, c.id)).length, 2, 'an order that earns nothing leaves no entry');
  } },
  { id: 't10-03 points count what was paid after the discount', tags: ['HD-48'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000); const code = await discount(ctx, 15);
    const o = await k.paid([[a, 2]], { customerId: c.id, discountCode: code });
    assert.equal(o.totalCents, 1700);
    assert.equal(await k.balance(c.id), 17);
  } },
  { id: 't10-04 points come with the payment', tags: ['HD-49'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 100000);
    const o = await k.placed([[a, 1]], { customerId: c.id });
    assert.equal(await k.balance(c.id), 0);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.ok(await k.balance(c.id) > 0, 'a paid order that has not been sent yet earned nothing');
  } },
  { id: 't10-05 points go to the customer who bought', async run(ctx) {
    const k = kit(ctx); const buyer = await k.customer(); const other = await k.customer(); const a = await k.stocked(5, 100000);
    await k.paid([[a, 1]], { customerId: buyer.id });
    await k.paid([[a, 1]]);
    assert.ok(await k.balance(buyer.id) > 0);
    assert.equal(await k.balance(other.id), 0);
    assert.equal((await history(ctx, other.id)).length, 0);
  } },
  { id: 't10-06 the points history says where points came from', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 100000);
    const o = await k.paid([[a, 1]], { customerId: c.id });
    const h = await history(ctx, c.id);
    const entry = h.find((e) => names(e.reference, o.id));
    assert.ok(entry, 'no entry of the points history names the order');
    assert.ok(entry.points > 0); assert.equal(entry.kind, 'earned');
    assert.equal(entry.points, await k.balance(c.id));
  } },
  { id: 't10-07 an order that is not paid earns nothing', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 100000);
    const declined = await k.placed([[a, 1]], { customerId: c.id });
    ctx.provider.mode = 'decline';
    assert.equal(ok(await k.pay(declined.id), 'payOrder').status, 'declined');
    const dropped = await k.placed([[a, 1]], { customerId: c.id });
    ok(await k.cancel(dropped.id), 'cancelOrder');
    assert.equal(await k.balance(c.id), 0);
  } },
  { id: 't10-08 the balance is the sum of the points history', tags: ['R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(20, 2350); const b = await k.stocked(20, 12999);
    await k.points(c.id);
    await k.paid([[a, 3]], { customerId: c.id });
    await k.points(c.id);
    const o = await k.shipped([[a, 2], [b, 1]], { customerId: c.id });
    await k.points(c.id);
    ok(await k.ret(o.id, [[b, 1]]), 'returnItems');
    await k.points(c.id);
    ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    const { history: h } = await k.points(c.id);
    assert.ok(h.length >= 2, 'two paid orders left fewer than two entries');
  } },
  { id: 't10-09 entries of the points history are never rewritten', tags: ['R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(20, 100000);
    const o = await k.shipped([[a, 1]], { customerId: c.id });
    const early = await history(ctx, c.id);
    assert.ok(early.length >= 1);
    await k.paid([[a, 2]], { customerId: c.id });
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    const later = (await k.points(c.id)).history.map(key);
    for (const e of early) {
      const i = later.indexOf(key(e));
      assert.ok(i >= 0, `the entry ${JSON.stringify(e)} is no longer in the history as it was`);
      later.splice(i, 1);
    }
  } },
  { id: 't10-10 a return takes back the points of what came back', tags: ['HD-50'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000);
    const o = await k.shipped([[a, 3]], { customerId: c.id });
    assert.equal(await k.balance(c.id), 30);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    assert.equal(await k.balance(c.id), 20);
    const back = (await history(ctx, c.id)).find((e) => e.points < 0);
    assert.ok(back, 'the history has no entry for the points taken back');
    assert.equal(back.points, -10); assert.ok(names(back.reference, o.id));
    ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    assert.equal((await k.points(c.id)).balance, 0);
  } },
];
