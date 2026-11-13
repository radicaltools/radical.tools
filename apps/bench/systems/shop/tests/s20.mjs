import { assert, ok, no, kit } from './helpers.mjs';

const line = (order, sku) => order.lines.find((l) => l.sku === sku);
const threeForTwo = async (k, sku) => ok(await k.multibuy(sku, 2, 1), 'createPromotion');
// The figures of an order hang together: the total is the value minus what was taken off, and the lines' tax adds up (R7).
const sums = (o) => {
  assert.equal(o.totalCents, o.subtotalCents - o.promotionDiscountCents - o.discountCents - o.pointsDiscountCents, 'the total is not the value minus what was taken off');
  assert.equal(o.taxCents, o.lines.reduce((a, l) => a + l.taxCents, 0), 'R7: the order\'s tax is not the sum of its lines\' tax');
  for (const x of [o.totalCents, o.taxCents, o.promotionDiscountCents, o.discountCents, o.pointsDiscountCents]) assert.ok(Number.isInteger(x) && x >= 0, `R7: a figure of the order is ${x}`);
};

export const tests = [
  { id: 't20-01 a customer of a group gets no promotion on top', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const c = await k.member(g.id); const a = await k.stocked(20, 1000);
    await k.listed(g.id, a, 700); await threeForTwo(k, a);
    const o = await k.placed([[a, 3]], { customerId: c.id });
    assert.equal(o.promotionDiscountCents, 0); assert.equal(o.totalCents, 2100);
    // Everybody else still gets the promotion.
    const retail = await k.placed([[a, 3]]);
    assert.equal(retail.promotionDiscountCents, 1000); assert.equal(retail.totalCents, 2000);
  } },
  { id: 't20-02 a customer of a group gets nothing off with a code', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const c = await k.member(g.id); const a = await k.stocked(20, 1000); const ten = await k.discount(10);
    await k.listed(g.id, a, 700);
    const r = await k.order([[a, 2]], { customerId: c.id, discountCode: ten });
    if (r.reason === 'unsupported') throw new Error('unsupported: placeOrder');
    if (r.ok) { assert.equal(r.value.discountCents, 0); assert.equal(r.value.totalCents, 1400); }
    assert.equal((await k.placed([[a, 2]], { customerId: c.id })).totalCents, 1400);
    assert.equal((await k.placed([[a, 2]], { discountCode: ten })).totalCents, 1800);
  } },
  { id: 't20-03 a code does not make a promotion cheaper', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000); const ten = await k.discount(10);
    await threeForTwo(k, a);
    const r = await k.order([[a, 3]], { discountCode: ten });
    if (r.reason === 'unsupported') throw new Error('unsupported: placeOrder');
    if (r.ok) { assert.equal(r.value.promotionDiscountCents, 1000); assert.equal(r.value.totalCents, 2000); }
    assert.equal((await k.placed([[a, 3]])).totalCents, 2000);
  } },
  { id: 't20-04 the figures of an order add up', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const g = await k.group(); const w = await k.member(g.id);
    const a = await k.stocked(30, 1000); const b = await k.stocked(30, 450); const ten = await k.discount(10);
    await k.listed(g.id, b, 399); await threeForTwo(k, a);
    sums(await k.placed([[a, 2], [b, 3]]));
    sums(await k.placed([[a, 3], [b, 1]]));
    sums(await k.placed([[a, 4], [b, 2]], { discountCode: ten }));
    sums(await k.placed([[a, 3], [b, 2]], { customerId: c.id, discountCode: ten, pointsToSpend: 30 }));
    const o = await k.placed([[a, 3], [b, 5]], { customerId: w.id });
    sums(o);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, o.totalCents);
  } },
  { id: 't20-05 an order of a group customer with a code is refused', tags: ['HD-107'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const c = await k.member(g.id); const bare = await k.member((await k.group()).id);
    const a = await k.stocked(20, 1000); const ten = await k.discount(10);
    await k.listed(g.id, a, 700);
    no(await k.order([[a, 2]], { customerId: c.id, discountCode: ten }), 'an order of a wholesale customer with a discount code');
    // The group decides, not the price list: a group without prices is treated the same.
    no(await k.order([[a, 2]], { customerId: bare.id, discountCode: ten }), 'an order of a customer of a group without prices, with a discount code');
    assert.equal((await k.figures(a)).reserved, 0);
    ok(await ctx.sys.setCustomerGroup(c.id, null), 'setCustomerGroup');
    assert.equal((await k.placed([[a, 2]], { customerId: c.id, discountCode: ten })).totalCents, 1800);
  } },
  { id: 't20-06 no promotion for a group customer, whatever the product', tags: ['HD-106'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const c = await k.member(g.id);
    const a = await k.stocked(20, 1000); const off = await k.stocked(20, 600);
    await k.listed(g.id, a, 700); await threeForTwo(k, off);
    // `off` is not on the price list: normal price, and still no promotion.
    const o = await k.placed([[a, 1], [off, 3]], { customerId: c.id });
    assert.equal(line(o, off).unitPriceCents, 600); assert.equal(o.promotionDiscountCents, 0); assert.equal(o.totalCents, 2500);
    // An order without the account under the same e-mail address is an ordinary order.
    const guest = await k.placed([[a, 1], [off, 3]], { customerEmail: c.email });
    assert.equal(guest.promotionDiscountCents, 600); assert.equal(guest.totalCents, 2200);
  } },
  { id: 't20-07 the code counts on the lines without a promotion', tags: ['HD-108'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000); const b = await k.stocked(20, 450); const ten = await k.discount(10);
    await threeForTwo(k, a);
    // 10 % of the 9.00 of the other line; nothing off the 20.00 the promotion left.
    const o = await k.placed([[a, 3], [b, 2]], { discountCode: ten });
    assert.equal(o.subtotalCents, 3900); assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.discountCents, 90); assert.equal(o.totalCents, 2810);
    assert.equal(o.discountCode, ten);
  } },
  { id: 't20-08 a code on an order of promotions only takes nothing off', tags: ['HD-109'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000); const ten = await k.discount(10);
    await threeForTwo(k, a);
    const o = await k.placed([[a, 3]], { discountCode: ten });
    assert.equal(o.discountCents, 0); assert.equal(o.discountCode, ten); assert.equal(o.promotionDiscountCents, 1000); assert.equal(o.totalCents, 2000);
  } },
  { id: 't20-09 a promotion that was not earned leaves the line to the code', tags: ['HD-110'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20, 1000); const pot = await k.stocked(9, 5000); const cup = await k.stocked(20, 1000); const ten = await k.discount(10);
    await threeForTwo(k, a); ok(await k.bundle([[pot, 1], [cup, 2]], 6000), 'createPromotion');
    const two = await k.placed([[a, 2]], { discountCode: ten });
    assert.equal(two.promotionDiscountCents, 0); assert.equal(two.discountCents, 200); assert.equal(two.totalCents, 1800);
    const half = await k.placed([[pot, 1], [cup, 1]], { discountCode: ten });
    assert.equal(half.promotionDiscountCents, 0); assert.equal(half.discountCents, 600); assert.equal(half.totalCents, 5400);
  } },
  { id: 't20-10 points go with everything', tags: ['HD-111'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const g = await k.group();
    const a = await k.stocked(20, 1000); const b = await k.stocked(20, 450); const ten = await k.discount(10);
    await k.listed(g.id, a, 700); await threeForTwo(k, b);
    // Promotion, code and points on one order: 13.50 − 4.50 for the promotion, 10 % of the other 10.00, then points on the 18.00 left.
    no(await k.order([[b, 3], [a, 1]], { customerId: c.id, discountCode: ten, pointsToSpend: 181 }), 'points for more than half of what is left');
    const o = await k.placed([[b, 3], [a, 1]], { customerId: c.id, discountCode: ten, pointsToSpend: 180 });
    assert.equal(o.promotionDiscountCents, 450); assert.equal(o.discountCents, 100); assert.equal(o.pointsDiscountCents, 900); assert.equal(o.totalCents, 900);
    // With a price list: 2 × 7.00, half of it with points.
    ok(await ctx.sys.setCustomerGroup(c.id, g.id), 'setCustomerGroup');
    const w = await k.placed([[a, 2]], { customerId: c.id, pointsToSpend: 140 });
    assert.equal(w.subtotalCents, 1400); assert.equal(w.pointsDiscountCents, 700); assert.equal(w.totalCents, 700);
  } },
  { id: 't20-11 whatever comes together, nothing goes below cost', tags: ['R8'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const g = await k.group(); const w = await k.member(g.id);
    const a = await k.costed(30, 1000, 700); const b = await k.costed(30, 2000, 1500); const deep = await k.discount(90);
    await threeForTwo(k, a); await k.listed(g.id, b, 1200);
    const paid = (o) => o.totalCents - o.taxCents;
    // Promotion on one line, a deep code on the other: each line stops at its cost.
    const o = await k.placed([[a, 3], [b, 1]], { discountCode: deep });
    assert.equal(o.totalCents, 2100 + 1500, 'R8: goods that cost 36.00 are not sold for 36.00');
    sums(o);
    // The price list below cost, for a customer of the group.
    const list = await k.placed([[b, 2]], { customerId: w.id });
    assert.ok(paid(list) >= 3000, `R8: two units that cost 15.00 each are sold for ${paid(list)}`);
    // Points on top of a promotion that already sits on the floor: there is no room left.
    const r = await k.order([[a, 3]], { customerId: c.id, pointsToSpend: 20 });
    if (r.reason === 'unsupported') throw new Error('unsupported: placeOrder');
    if (r.ok) assert.ok(paid(r.value) >= 2100, `R8: three units that cost 7.00 each are sold for ${paid(r.value)}`);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 3600);
  } },
  { id: 't20-12 tax adds up whatever comes together', tags: ['R7', 'HD-85', 'HD-108'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(20, 1230, 23); const tea = await k.taxed(20, 2100, 5); const ten = await k.discount(10);
    await threeForTwo(k, mug);
    // Mugs: 3 for 24.60, 4.60 of it tax. Tea: 21.00 less 10 %: 18.90, 0.90 of it tax.
    const o = await k.placed([[mug, 3], [tea, 1]], { discountCode: ten });
    assert.equal(o.promotionDiscountCents, 1230); assert.equal(o.discountCents, 210); assert.equal(o.totalCents, 4350);
    assert.equal(line(o, mug).taxCents, 460); assert.equal(line(o, tea).taxCents, 90); assert.equal(o.taxCents, 550);
    sums(o);
  } },
  { id: 't20-13 without group, promotion or code an order is as before', async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(20, 1000); const ten = await k.discount(10);
    const plain = await k.placed([[a, 2]]);
    assert.equal(plain.promotionDiscountCents, 0); assert.equal(plain.discountCents, 0); assert.equal(plain.totalCents, 2000);
    const coded = await k.placed([[a, 2]], { customerId: c.id, discountCode: ten, pointsToSpend: 100 });
    assert.equal(coded.discountCents, 200); assert.equal(coded.pointsDiscountCents, 500); assert.equal(coded.totalCents, 1300);
    sums(plain); sums(coded);
  } },
];
