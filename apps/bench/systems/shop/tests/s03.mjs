import { assert, ok, no, kit } from './helpers.mjs';

const MIN = 60_000;
const at = (order, ms) => new Date(new Date(order.createdAt).getTime() + ms).toISOString();
const expire = async (ctx, now) => ok(await ctx.sys.expireOrders(now ?? null), 'expireOrders').expired;

export const tests = [
  { id: 't3-01 an unpaid order expires and frees its stock', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    assert.ok((await expire(ctx, at(o, 60 * MIN))).includes(o.id));
    assert.equal((await k.getOrder(o.id)).status, 'expired');
    const s = await k.figures(a); assert.equal(s.reserved, 0); assert.equal(s.onHand, 5);
    assert.ok(!(await expire(ctx, at(o, 61 * MIN))).includes(o.id));
  } },
  { id: 't3-01b the order shows its deadline', tags: ['HD-20b'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    assert.equal(new Date(o.expiresAt).getTime() - new Date(o.createdAt).getTime(), 15 * MIN);
    assert.equal((await k.paid([[a, 1]])).expiresAt, null);
  } },
  { id: 't3-02 the deadline is 15 minutes', tags: ['HD-20a'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    assert.ok(!(await expire(ctx, at(o, 14 * MIN))).includes(o.id));
    assert.equal((await k.getOrder(o.id)).status, 'pending');
    assert.ok((await expire(ctx, at(o, 16 * MIN))).includes(o.id));
  } },
  { id: 't3-03 the boundary is exactly 15 minutes', tags: ['HD-20'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    assert.ok(!(await expire(ctx, at(o, 15 * MIN - 1000))).includes(o.id));
    assert.ok((await expire(ctx, at(o, 15 * MIN))).includes(o.id));
  } },
  { id: 't3-04 paid and shipped orders do not expire', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const p = await k.paid([[a, 1]]); const s = await k.shipped([[a, 1]]);
    const expired = await expire(ctx, at(p, 24 * 60 * MIN));
    assert.ok(!expired.includes(p.id)); assert.ok(!expired.includes(s.id));
    assert.equal((await k.getOrder(p.id)).status, 'paid');
    assert.equal((await k.stock(a)).reserved, 1);
  } },
  { id: 't3-05 an expired order is final', tags: ['HD-22'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    await expire(ctx, at(o, 16 * MIN));
    ctx.provider.mode = 'succeed';
    no(await k.pay(o.id), 'paying an expired order');
    no(await k.cancel(o.id), 'cancelling an expired order');
    assert.equal((await k.getOrder(o.id)).status, 'expired');
  } },
  { id: 't3-06 declines no longer cancel', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 2]]);
    ctx.provider.mode = 'decline';
    for (let i = 0; i < 4; i++) ok(await k.pay(o.id), 'payOrder');
    assert.equal((await k.getOrder(o.id)).status, 'pending');
    assert.equal((await k.stock(a)).reserved, 2);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
  } },
  { id: 't3-06b a decline does not extend the deadline', tags: ['HD-21'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 2]]);
    ctx.provider.mode = 'decline';
    ok(await k.pay(o.id), 'payOrder');
    assert.ok((await expire(ctx, at(o, 15 * MIN + 1000))).includes(o.id));
  } },
  { id: 't3-07 without a time the job uses the clock', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    assert.ok(!(await expire(ctx)).includes(o.id));
    assert.equal((await k.getOrder(o.id)).status, 'pending');
  } },
  { id: 't3-08 expiry is not a stock movement', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    await expire(ctx, at(o, 60 * MIN));
    assert.equal((await k.ledger(a)).length, 1);
  } },
];
