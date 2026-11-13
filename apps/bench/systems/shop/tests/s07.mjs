import { assert, ok, no, unavailable, kit } from './helpers.mjs';

// Run against a server started with PAYMENT_PROVIDER=b.
export const env = { PAYMENT_PROVIDER: 'b' };

export const tests = [
  { id: 't7-01 NordPay takes the payment', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700);
    const o = await k.placed([[a, 3]]);
    ctx.provider.mode = 'succeed';
    const p = ok(await k.pay(o.id), 'payOrder'); assert.equal(p.status, 'succeeded'); assert.equal(p.amountCents, 2100);
    const charge = ctx.provider.charges.at(-1);
    assert.equal(charge.via, 'b', 'the charge went to NordPay');
    assert.equal(charge.amountCents, 2100); assert.equal(charge.currency, 'EUR');
    assert.equal(p.providerChargeId, charge.chargeId);
    assert.equal((await k.getOrder(o.id)).status, 'paid');
  } },
  { id: 't7-02 NordPay refuses', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'decline';
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'declined');
    assert.equal(ctx.provider.charges.at(-1).via, 'b');
    assert.equal((await k.getOrder(o.id)).status, 'pending');
  } },
  { id: 't7-03 NordPay fails', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'fail';
    unavailable(await k.pay(o.id), 'a payment while NordPay is down');
    assert.equal(ok(await ctx.sys.listPayments(o.id), 'listPayments').length, 0);
  } },
  { id: 't7-04 NordPay refunds a return', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700);
    const o = await k.shipped([[a, 2]]);
    const charge = await k.chargeOf(o.id);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 700);
    const refund = ctx.provider.refunds.at(-1);
    assert.equal(refund.via, 'b'); assert.equal(refund.chargeId, charge.chargeId); assert.equal(refund.amountCents, 700);
    ctx.provider.refundMode = 'fail';
    unavailable(await k.ret(o.id, [[a, 1]]), 'a return while NordPay is down');
  } },
  { id: 't7-05 the whole flow on NordPay', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(6, 500);
    const o = await k.shipped([[a, 4]]);
    assert.equal(o.status, 'shipped');
    assert.equal((await k.figures(a)).onHand, 2);
    assert.ok(ctx.provider.charges.every((c) => c.via === 'b'));
  } },
  { id: 't7-06 the NordPay payment carries the order id', tags: ['HD-11'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700);
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.equal(ctx.provider.charges.at(-1).reference, o.id);
  } },
];
