import { assert, ok, no, kit } from './helpers.mjs';

let n = 0;
const newCode = () => `DC${Math.random().toString(36).slice(2, 8).toUpperCase()}${++n}`;
const make = async (ctx, percent, code = newCode()) => { ok(await ctx.sys.createDiscountCode({ code, percent }), 'createDiscountCode'); return code; };

export const tests = [
  { id: 't6-01 a discount code takes a percentage off', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const code = newCode();
    const d = ok(await ctx.sys.createDiscountCode({ code, percent: 20 }), 'createDiscountCode');
    assert.equal(d.code, code); assert.equal(d.percent, 20);
    no(await ctx.sys.createDiscountCode({ code, percent: 30 }), 'a second code with the same name');
    const o = await k.placed([[a, 2]], { discountCode: code });
    assert.equal(o.subtotalCents, 2000); assert.equal(o.discountCents, 400); assert.equal(o.totalCents, 1600); assert.equal(o.discountCode, code);
    no(await k.order([[a, 1]], { discountCode: newCode() }), 'an order with an unknown code');
    assert.equal((await k.stock(a)).reserved, 2);
  } },
  { id: 't6-01b percentages allowed', tags: ['HD-31'], async run(ctx) {
    for (const percent of [0, 91, 12.5, -5]) no(await ctx.sys.createDiscountCode({ code: newCode(), percent }), `a code of ${percent} percent`);
    ok(await ctx.sys.createDiscountCode({ code: newCode(), percent: 90 }), 'a code of 90 percent');
    ok(await ctx.sys.createDiscountCode({ code: newCode(), percent: 1 }), 'a code of 1 percent');
  } },
  { id: 't6-02 the discount is rounded down', tags: ['HD-32'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 999); const code = await make(ctx, 15);
    const o = await k.placed([[a, 1]], { discountCode: code });
    assert.equal(o.subtotalCents, 999); assert.equal(o.discountCents, 149); assert.equal(o.totalCents, 850);
  } },
  { id: 't6-03 codes ignore case', tags: ['HD-33'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const code = await make(ctx, 10);
    const o = await k.placed([[a, 1]], { discountCode: code.toLowerCase() });
    assert.equal(o.discountCents, 100); assert.equal(o.discountCode, code);
    no(await ctx.sys.createDiscountCode({ code: code.toLowerCase(), percent: 5 }), 'the same code in lower case');
  } },
  { id: 't6-04 the discounted total is charged', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const code = await make(ctx, 25);
    const o = await k.placed([[a, 2]], { discountCode: code });
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 1500);
    assert.equal(ctx.provider.charges.at(-1).amountCents, 1500);
  } },
  { id: 't6-05 a return of a discounted order never refunds more than was paid', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const code = await make(ctx, 50);
    const o = await k.shipped([[a, 2]], { discountCode: code });
    const r = ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    assert.equal(r.refundCents, 1000);
    assert.equal(ctx.provider.refunds.at(-1).amountCents, 1000);
  } },
  { id: 't6-05b refunds follow the discount and add up', tags: ['HD-34'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700); const b = await k.stocked(5, 199); const code = await make(ctx, 15);
    const o = await k.shipped([[a, 1], [b, 2]], { discountCode: code });
    assert.equal(o.totalCents, 934);
    assert.equal(ok(await k.ret(o.id, [[b, 1]]), 'returnItems').refundCents, 169);
    assert.equal(ok(await k.ret(o.id, [[b, 1]]), 'returnItems').refundCents, 169);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 596);
  } },
  { id: 't6-06 an order without a code', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 450);
    const o = await k.placed([[a, 2]]);
    assert.equal(o.subtotalCents, 900); assert.equal(o.discountCents, 0); assert.equal(o.totalCents, 900); assert.equal(o.discountCode, null);
  } },
];
