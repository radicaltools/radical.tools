import { assert, ok, no, kit, names } from './helpers.mjs';

// Service sets a customer's points balance to the number agreed.
const set = (ctx, id, balance) => ctx.sys.setPointsBalance(id, { balance });
const history = async (ctx, id) => ok(await ctx.sys.listPointsHistory(id), 'listPointsHistory');
// R5: the history only grows; what was on record before is still there, unchanged.
const grown = (after, before) => assert.deepEqual(after.slice(0, before.length), before, 'R5: the points history was rewritten');

export const tests = [
  { id: 't31-01 service sets a balance', tags: ['trap:R5:done'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    assert.equal(await k.balance(c.id), 1000);
    assert.equal(ok(await set(ctx, c.id, 1200), 'setPointsBalance').balance, 1200);
    assert.equal(await k.balance(c.id), 1200);
    ok(await set(ctx, c.id, 300), 'setPointsBalance');
    assert.equal(await k.balance(c.id), 300);
    const fresh = await k.customer();
    ok(await set(ctx, fresh.id, 50), 'setPointsBalance');
    assert.equal(await k.balance(fresh.id), 50);
  } },
  { id: 't31-02 the balance is still the sum of its records', tags: ['trap:R5:kept', 'R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(9, 1000);
    let before = (await k.points(c.id)).history;
    // Whatever the system does with the request, the history adds up to the balance and nothing in it is rewritten.
    for (const balance of [1200, 300]) {
      await set(ctx, c.id, balance);
      const now = await k.points(c.id);
      grown(now.history, before); before = now.history;
    }
    // The same through an order that uses points and is then cancelled.
    const o = await k.placed([[a, 2]], { customerId: c.id, pointsToSpend: 100 });
    const moves = [() => set(ctx, c.id, 0), async () => ok(await k.cancel(o.id), 'cancelOrder'), () => set(ctx, c.id, 40)];
    before = (await k.points(c.id)).history;
    for (const move of moves) {
      await move();
      const now = await k.points(c.id);
      grown(now.history, before); before = now.history;
    }
  } },
  { id: 't31-03 points set by hand can be used on an order', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(9, 10000);
    ok(await set(ctx, c.id, 400), 'setPointsBalance');
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 401 }), 'more points than were set');
    const o = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 400 });
    assert.equal(o.pointsSpent, 400); assert.ok(o.totalCents < 10000);
    assert.equal(await k.balance(c.id), 0);
  } },
  { id: 't31-04 setting one balance leaves the others alone', async run(ctx) {
    const k = kit(ctx); const [c, other] = [await k.collector(), await k.collector(50000)];
    ok(await set(ctx, c.id, 7), 'setPointsBalance');
    assert.equal(await k.balance(c.id), 7); assert.equal(await k.balance(other.id), 500);
    no(await set(ctx, 'no-such-customer', 10), 'the balance of a customer that does not exist');
  } },
  { id: 't31-05 a balance set by hand is one record for the difference', tags: ['HD-171'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    const before = await history(ctx, c.id);
    ok(await set(ctx, c.id, 1200), 'setPointsBalance');
    const up = await history(ctx, c.id);
    assert.equal(up.length, before.length + 1); grown(up, before);
    assert.equal(up.at(-1).points, 200); assert.equal(up.at(-1).kind, 'other'); assert.equal(up.at(-1).reference, null);
    ok(await set(ctx, c.id, 300), 'setPointsBalance');
    const down = await history(ctx, c.id);
    assert.equal(down.length, up.length + 1); grown(down, up);
    assert.equal(down.at(-1).points, -900); assert.equal(down.at(-1).reference, null);
    assert.ok(names(down[0].reference, c.firstOrder.id), 'the record of the order is gone');
  } },
  { id: 't31-06 the same number records nothing', tags: ['HD-172'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const fresh = await k.customer();
    const before = await history(ctx, c.id);
    assert.equal(ok(await set(ctx, c.id, 1000), 'setPointsBalance').balance, 1000);
    assert.deepEqual(await history(ctx, c.id), before);
    ok(await set(ctx, fresh.id, 0), 'setPointsBalance');
    assert.equal((await history(ctx, fresh.id)).length, 0);
  } },
  { id: 't31-07 a balance is a whole number, zero or more', tags: ['HD-173', 'R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    const before = await history(ctx, c.id);
    no(await set(ctx, c.id, -1), 'a balance below zero');
    no(await set(ctx, c.id, 10.5), 'half a point');
    no(await set(ctx, c.id, undefined), 'no number at all');
    assert.deepEqual(await history(ctx, c.id), before);
    assert.equal((await k.points(c.id)).balance, 1000);
    ok(await set(ctx, c.id, 0), 'setPointsBalance');
    assert.equal((await k.points(c.id)).balance, 0);
  } },
  { id: 't31-08 an erased customer gets no points', tags: ['HD-174'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    ok(await ctx.sys.eraseCustomer(c.id), 'eraseCustomer');
    const before = await k.points(c.id);
    assert.equal(before.balance, 0);
    no(await set(ctx, c.id, 100), 'points for an erased customer');
    assert.deepEqual(await k.points(c.id), before);
  } },
  { id: 't31-09 the balance of a blocked customer can be set', tags: ['HD-58'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    ok(await set(ctx, c.id, 1500), 'setPointsBalance');
    assert.equal((await k.points(c.id)).balance, 1500);
  } },
  { id: 't31-10 a return takes back no more points than the balance that was set', tags: ['R5', 'HD-50'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    ok(await set(ctx, c.id, 5), 'setPointsBalance');
    ok(await k.ret(c.firstOrder.id, [[c.firstSku, 1]]), 'returnItems');
    const { balance, history: entries } = await k.points(c.id);
    assert.equal(balance, 0);
    assert.equal(entries.at(-1).points, -5); assert.ok(names(entries.at(-1).reference, c.firstOrder.id));
    // And the other way round: points given by hand are not taken with the order's.
    const d = await k.collector();
    ok(await set(ctx, d.id, 1300), 'setPointsBalance');
    ok(await k.ret(d.firstOrder.id, [[d.firstSku, 1]]), 'returnItems');
    assert.equal((await k.points(d.id)).balance, 300);
  } },
  { id: 't31-11 the history adds up through orders and settings', tags: ['R5'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(20, 2000);
    const steps = [
      () => set(ctx, c.id, 250),
      () => k.paid([[a, 2]], { customerId: c.id, pointsToSpend: 200 }),
      () => set(ctx, c.id, 10),
      () => k.shipped([[a, 1]], { customerId: c.id }),
      () => set(ctx, c.id, 999),
      () => set(ctx, c.id, 0),
    ];
    let before = [];
    for (const step of steps) {
      await step();
      const now = await k.points(c.id);
      grown(now.history, before); before = now.history;
    }
    assert.equal((await k.points(c.id)).balance, 0);
    assert.ok(before.length >= 6);
  } },
];
