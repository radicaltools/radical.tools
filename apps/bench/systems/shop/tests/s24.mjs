import { assert, ok, no, unavailable, kit, names, sleep } from './helpers.mjs';

// A moment between two things that happen: the shop's and the provider's clocks are given room around it.
const moment = async () => { await sleep(30); const at = new Date().toISOString(); await sleep(30); return at; };
const reconcile = async (ctx, from, to) => ok(await ctx.sys.reconcilePayments({ from, to }), 'reconcilePayments');
const about = (r, chargeId) => r.differences.filter((d) => d.providerChargeId === chargeId);
let n = 0;
// A charge on the provider's statement that the shop never heard of.
const ghost = (ctx, amountCents, reference) => {
  const charge = { via: 'a', chargeId: `ch_ghost_${++n}`, amountCents, reference, status: 'succeed', at: new Date().toISOString() };
  ctx.provider.charges.push(charge);
  return charge;
};

export const tests = [
  { id: 't24-01 payments that agree leave no difference', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    await k.paid([[a, 2]]); const o = await k.shipped([[a, 3]]);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.deepEqual(r.differences, []);
  } },
  { id: 't24-02 a charge the shop does not know is listed', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.paid([[a, 2]]);
    const unknown = ghost(ctx, 1234, 'no-order-of-ours');
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.differences.length, 1);
    const [d] = about(r, unknown.chargeId);
    assert.ok(d, 'the charge the shop does not know is not listed');
    assert.equal(d.kind, 'charge'); assert.equal(d.problem, 'unknown_to_shop'); assert.equal(d.providerCents, 1234); assert.equal(d.shopCents, null);
    assert.equal(about(r, (await k.chargeOf(o.id)).chargeId).length, 0);
  } },
  { id: 't24-03 a payment the provider does not list is listed', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.paid([[a, 2]]); await k.paid([[a, 1]]);
    const charge = await k.chargeOf(o.id);
    ctx.provider.charges.splice(ctx.provider.charges.indexOf(charge), 1);
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.differences.length, 1);
    const [d] = about(r, charge.chargeId);
    assert.ok(d, 'the payment the provider does not list is not among the differences');
    assert.equal(d.kind, 'charge'); assert.equal(d.problem, 'unknown_to_provider'); assert.equal(d.shopCents, 2000); assert.equal(d.providerCents, null);
    assert.ok(names(d.orderId, o.id), 'the difference does not name the order');
  } },
  { id: 't24-04 a charge with another amount is listed', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.paid([[a, 2]]);
    const charge = await k.chargeOf(o.id);
    charge.amountCents = 2500;
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.differences.length, 1);
    const [d] = about(r, charge.chargeId);
    assert.equal(d.kind, 'charge'); assert.equal(d.problem, 'amount_differs'); assert.equal(d.shopCents, 2000); assert.equal(d.providerCents, 2500);
    assert.ok(names(d.orderId, o.id), 'the difference does not name the order');
  } },
  { id: 't24-05 a declined payment is no difference', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'decline';
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'declined');
    const waiting = await k.placed([[a, 1]]);
    assert.equal(ok(await k.pay(waiting.id), 'payOrder').status, 'declined');
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'succeeded');
    const to = await moment();
    assert.deepEqual((await reconcile(ctx, from, to)).differences, []);
  } },
  { id: 't24-06 only the period is compared', tags: ['HD-132'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const before = await k.paid([[a, 1]]);
    const early = await k.chargeOf(before.id);
    const from = await moment();
    const inside = await k.paid([[a, 2]]);
    const to = await moment();
    const after = await k.paid([[a, 3]]);
    const late = await k.chargeOf(after.id);
    // The provider has lost both payments outside the period, and has a charge of its own after it.
    ctx.provider.charges.splice(ctx.provider.charges.indexOf(early), 1); ctx.provider.charges.splice(ctx.provider.charges.indexOf(late), 1);
    ghost(ctx, 999, 'later');
    const r = await reconcile(ctx, from, to);
    assert.deepEqual(r.differences, []);
    // Looked at as a whole, the differences are there.
    const whole = await reconcile(ctx, from, await moment());
    assert.equal(about(whole, late.chargeId).length, 1);
    assert.equal(whole.differences.length, 2);
    assert.equal(about(whole, (await k.chargeOf(inside.id)).chargeId).length, 0);
  } },
  { id: 't24-07 an unknown charge shows the order its reference names', tags: ['HD-127'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.placed([[a, 2]]);
    // The provider charged the card, but the shop never got the answer.
    ctx.provider.mode = 'fail';
    unavailable(await k.pay(o.id), 'payOrder');
    ctx.provider.mode = 'succeed';
    const lost = ghost(ctx, 2000, o.id); const stray = ghost(ctx, 500, 'something-else');
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.differences.length, 2);
    const [d] = about(r, lost.chargeId);
    assert.equal(d.problem, 'unknown_to_shop'); assert.ok(names(d.orderId, o.id), 'the difference does not show the order the reference names');
    assert.equal(about(r, stray.chargeId)[0].orderId, null);
  } },
  { id: 't24-08 refunds are compared charge by charge', tags: ['HD-128'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(30, 1000);
    const from = await moment();
    const [fine, lost, more, extra] = [await k.shipped([[a, 3]]), await k.shipped([[a, 3]]), await k.shipped([[a, 3]]), await k.shipped([[a, 3]])];
    const charge = async (o) => (await k.chargeOf(o.id)).chargeId;
    const refundOf = async (o) => { const id = await charge(o); return ctx.provider.refunds.find((x) => x.chargeId === id); };
    // Two returns on one order, both known to both sides.
    ok(await k.ret(fine.id, [[a, 1]]), 'returnItems'); ok(await k.ret(fine.id, [[a, 1]]), 'returnItems');
    // A refund the provider does not list.
    ok(await k.ret(lost.id, [[a, 1]]), 'returnItems');
    ctx.provider.refunds.splice(ctx.provider.refunds.indexOf(await refundOf(lost)), 1);
    // A refund with another amount at the provider.
    ok(await k.ret(more.id, [[a, 1]]), 'returnItems');
    (await refundOf(more)).amountCents = 1500;
    // A refund the shop never made.
    ctx.provider.refunds.push({ via: 'a', refundId: `re_ghost_${++n}`, chargeId: await charge(extra), amountCents: 700, at: new Date().toISOString() });
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.differences.length, 3);
    assert.equal(about(r, await charge(fine)).length, 0);
    const pick = async (o) => { const list = about(r, await charge(o)); assert.equal(list.length, 1); assert.equal(list[0].kind, 'refund'); return list[0]; };
    const [l, m, e] = [await pick(lost), await pick(more), await pick(extra)];
    assert.equal(l.problem, 'unknown_to_provider'); assert.equal(l.shopCents, 1000); assert.equal(l.providerCents, null);
    assert.equal(m.problem, 'amount_differs'); assert.equal(m.shopCents, 1000); assert.equal(m.providerCents, 1500);
    assert.equal(e.problem, 'unknown_to_shop'); assert.equal(e.shopCents, null); assert.equal(e.providerCents, 700);
  } },
  { id: 't24-09 the report shows what each side charged and gave back', tags: ['HD-129'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const o = await k.shipped([[a, 3]]); await k.paid([[a, 2]]);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    ghost(ctx, 1234, 'no-order-of-ours');
    const to = await moment();
    const r = await reconcile(ctx, from, to);
    assert.equal(r.shopChargedCents, 5000); assert.equal(r.providerChargedCents, 6234);
    assert.equal(r.shopRefundedCents, 1000); assert.equal(r.providerRefundedCents, 1000);
  } },
  { id: 't24-10 the comparison changes nothing', tags: ['HD-130'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    const waiting = await k.placed([[a, 2]]); const paid = await k.paid([[a, 1]]);
    ghost(ctx, 2000, waiting.id);
    (await k.chargeOf(paid.id)).amountCents = 700;
    const to = await moment();
    const [charges, refunds] = [ctx.provider.charges.length, ctx.provider.refunds.length];
    const first = await reconcile(ctx, from, to);
    assert.equal(first.differences.length, 2);
    assert.equal((await k.getOrder(waiting.id)).status, 'pending');
    assert.equal(ok(await ctx.sys.listPayments(waiting.id), 'listPayments').length, 0);
    assert.equal((await k.figures(a)).reserved, 3);
    const kept = ok(await ctx.sys.listPayments(paid.id), 'listPayments');
    assert.equal(kept.length, 1); assert.equal(kept[0].amountCents, 1000);
    assert.equal((await k.getOrder(paid.id)).totalCents, 1000);
    assert.equal(ctx.provider.charges.length, charges); assert.equal(ctx.provider.refunds.length, refunds);
    assert.deepEqual(await reconcile(ctx, from, to), first);
  } },
  { id: 't24-11 a provider that does not answer is reported as unavailable', tags: ['HD-131'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000);
    const from = await moment();
    await k.paid([[a, 1]]);
    const to = await moment();
    ctx.provider.statementMode = 'fail';
    unavailable(await ctx.sys.reconcilePayments({ from, to }), 'reconcilePayments');
    ctx.provider.statementMode = 'succeed';
    assert.deepEqual((await reconcile(ctx, from, to)).differences, []);
  } },
  { id: 't24-12 the period must make sense', tags: ['HD-126'], async run(ctx) {
    const from = await moment(); const to = await moment();
    no(await ctx.sys.reconcilePayments({ from: to, to: from }), 'a period that ends before it begins');
    no(await ctx.sys.reconcilePayments({ from, to: from }), 'a period of no length');
    no(await ctx.sys.reconcilePayments({ from: 'last month', to }), 'a period that cannot be read');
    ok(await ctx.sys.reconcilePayments({ from, to }), 'reconcilePayments');
  } },
];
