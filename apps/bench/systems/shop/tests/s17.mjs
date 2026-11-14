import { assert, ok, no, kit } from './helpers.mjs';

const line = (order, sku) => order.lines.find((l) => l.sku === sku);
// R7: every figure is a whole number of cents and the order's tax is the sum of its lines' tax.
const whole = (order) => {
  for (const l of order.lines) assert.ok(Number.isInteger(l.taxCents) && l.taxCents >= 0, `R7: a line's tax is ${l.taxCents}`);
  assert.ok(Number.isInteger(order.taxCents), `R7: the order's tax is ${order.taxCents}`);
  assert.equal(order.taxCents, order.lines.reduce((a, l) => a + l.taxCents, 0), 'R7: the order\'s tax is not the sum of its lines\' tax');
  assert.ok(Number.isInteger(order.totalCents), `R7: the total is ${order.totalCents}`);
};

export const tests = [
  { id: 't17-01 products are put into categories with a tax rate', async run(ctx) {
    const k = kit(ctx); const code = k.sku('CAT').slice(0, 20);
    const c = ok(await ctx.sys.createCategory({ code, name: 'Mugs', taxPercent: 23 }), 'createCategory');
    assert.equal(c.code, code); assert.equal(c.name, 'Mugs'); assert.equal(c.taxPercent, 23);
    const listed = ok(await ctx.sys.listCategories(), 'listCategories').find((x) => x.code === code);
    assert.ok(listed, 'the new category is not in the list'); assert.equal(listed.taxPercent, 23);
    const sku = k.sku();
    const p = ok(await ctx.sys.createProduct({ sku, name: 'Blue mug', priceCents: 1230, category: code }), 'createProduct');
    assert.equal(p.category, code);
    assert.equal(ok(await ctx.sys.getProduct(sku), 'getProduct').category, code);
    const plain = await k.product(1000);
    assert.equal(ok(await ctx.sys.getProduct(plain), 'getProduct').category, null);
    assert.equal(ok(await ctx.sys.updateProduct(plain, { category: code }), 'updateProduct').category, code);
  } },
  { id: 't17-02 an order shows the tax of its taxed products', async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(5, 1230, 23); const voucher = await k.stocked(5, 1000);
    const o = await k.placed([[mug, 1], [voucher, 1]]);
    assert.ok(o.taxCents > 0, 'an order with a taxed product shows no tax');
    assert.ok(o.taxCents < o.totalCents, 'the tax is not a part of the money');
    assert.equal(line(o, mug).taxPercent, 23);
    assert.ok(line(o, mug).taxCents > 0, 'the taxed line shows no tax');
    assert.equal(line(o, voucher).taxCents, 0);
    assert.equal(o.taxCents, line(o, mug).taxCents);
    assert.equal((await k.getOrder(o.id)).taxCents, o.taxCents);
  } },
  { id: 't17-03 without categories nothing changes', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 450); const zero = await k.taxed(5, 1000, 0);
    const o = await k.placed([[a, 2], [zero, 1]]);
    assert.equal(o.taxCents, 0); assert.equal(o.subtotalCents, 1900); assert.equal(o.totalCents, 1900);
    assert.equal(line(o, a).taxCents, 0); assert.equal(line(o, a).taxPercent, 0); assert.equal(line(o, zero).taxCents, 0);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 1900);
  } },
  { id: 't17-04 a rate can be changed', async run(ctx) {
    const k = kit(ctx); const code = await k.category(8); const a = await k.taxed(5, 1000, 8, code);
    const before = await k.placed([[a, 1]]);
    assert.equal(line(before, a).taxPercent, 8);
    assert.equal(ok(await ctx.sys.updateCategory(code, { taxPercent: 23 }), 'updateCategory').taxPercent, 23);
    const after = await k.placed([[a, 1]]);
    assert.equal(line(after, a).taxPercent, 23);
    assert.ok(after.taxCents > before.taxCents, 'a higher rate gives no more tax');
    no(await ctx.sys.updateCategory(k.sku('NONE').slice(0, 20), { taxPercent: 5 }), 'changing a category that does not exist');
  } },
  { id: 't17-05 prices include the tax', tags: ['HD-85'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(5, 1230, 23); const tea = await k.taxed(5, 2100, 5);
    const o = await k.placed([[mug, 2], [tea, 1]]);
    assert.equal(o.subtotalCents, 4560); assert.equal(o.totalCents, 4560);
    assert.equal(line(o, mug).taxCents, 460); assert.equal(line(o, tea).taxCents, 100); assert.equal(o.taxCents, 560);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 4560);
    assert.equal(ctx.provider.charges.at(-1).amountCents, 4560);
  } },
  { id: 't17-06 tax is rounded half up, line by line', tags: ['R7', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const code = await k.category(20);
    // 9.99 at 20 %: 166.5 cents of tax in each line. Three lines: 167 each; worked on the total it would be 500.
    const [a, b, c] = [await k.taxed(5, 999, 20, code), await k.taxed(5, 999, 20, code), await k.taxed(5, 999, 20, code)];
    const o = await k.placed([[a, 1], [b, 1], [c, 1]]);
    for (const sku of [a, b, c]) assert.equal(line(o, sku).taxCents, 167);
    assert.equal(o.taxCents, 501); assert.equal(o.totalCents, 2997);
    // One line of three units is one amount: 29.97, 499.5 cents of tax.
    const one = await k.placed([[a, 3]]);
    assert.equal(one.taxCents, 500);
    whole(o); whole(one);
  } },
  { id: 't17-07 the tax of an order is the sum of its lines, in whole cents', tags: ['R7'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector();
    const [a, b, d] = [await k.taxed(9, 1999, 23), await k.taxed(9, 333, 5), await k.stocked(9, 777)];
    const code = await k.discount(15);
    whole(await k.placed([[a, 1], [b, 7], [d, 2]]));
    whole(await k.placed([[a, 3], [b, 1], [d, 1]], { discountCode: code }));
    const o = await k.placed([[a, 2], [b, 3], [d, 1]], { customerId: c.id, discountCode: code, pointsToSpend: 37 });
    whole(o);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, o.totalCents);
    whole(await k.getOrder(o.id));
  } },
  { id: 't17-08 which rates are allowed', tags: ['HD-86'], async run(ctx) {
    const k = kit(ctx); const code = () => k.sku('C').slice(0, 20);
    for (const taxPercent of [-1, 51, 7.5, '23']) no(await ctx.sys.createCategory({ code: code(), name: 'Odd', taxPercent }), `a category at ${JSON.stringify(taxPercent)} percent`);
    ok(await ctx.sys.createCategory({ code: code(), name: 'Free', taxPercent: 0 }), 'a category at 0 percent');
    const top = code();
    ok(await ctx.sys.createCategory({ code: top, name: 'Top', taxPercent: 50 }), 'a category at 50 percent');
    no(await ctx.sys.createCategory({ code: top, name: 'Again', taxPercent: 5 }), 'a second category with the same code');
    no(await ctx.sys.createCategory({ code: 'tea', name: 'Lower case', taxPercent: 5 }), 'a category code in lower case');
    no(await ctx.sys.createCategory({ code: 'X', name: 'Short', taxPercent: 5 }), 'a category code of one character');
    no(await ctx.sys.updateCategory(top, { taxPercent: 12.5 }), 'changing a rate to 12.5 percent');
    no(await ctx.sys.createProduct({ sku: k.sku(), name: 'Lost', priceCents: 500, category: code() }), 'a product in a category that does not exist');
    const p = await k.product(500);
    no(await ctx.sys.updateProduct(p, { category: code() }), 'moving a product to a category that does not exist');
  } },
  { id: 't17-09 an order keeps the rate it was placed with', tags: ['HD-87'], async run(ctx) {
    const k = kit(ctx); const code = await k.category(23); const other = await k.category(5); const a = await k.taxed(9, 1230, 23, code);
    const o = await k.placed([[a, 1]]);
    assert.equal(o.taxCents, 230);
    ok(await ctx.sys.updateCategory(code, { taxPercent: 8 }), 'updateCategory');
    let again = await k.getOrder(o.id);
    assert.equal(again.taxCents, 230); assert.equal(line(again, a).taxPercent, 23);
    ok(await ctx.sys.updateProduct(a, { category: other }), 'updateProduct');
    again = await k.getOrder(o.id);
    assert.equal(again.taxCents, 230); assert.equal(line(again, a).taxPercent, 23);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder'); ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.getOrder(o.id)).taxCents, 230);
    const next = await k.placed([[a, 1]]);
    assert.equal(line(next, a).taxPercent, 5);
  } },
  { id: 't17-10 tax is worked on what the customer pays after discounts', tags: ['HD-88', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const mug = await k.taxed(9, 1230, 23); const half = await k.discount(50);
    const o = await k.placed([[mug, 1]], { discountCode: half });
    assert.equal(o.totalCents, 615); assert.equal(o.taxCents, 115);
    // 24.60 for two, 123 points take 6.15 off: 18.45 paid, 3.45 of it tax.
    const p = await k.placed([[mug, 2]], { customerId: c.id, pointsToSpend: 123 });
    assert.equal(p.totalCents, 1845); assert.equal(p.taxCents, 345);
  } },
  { id: 't17-11 a discount is split over the lines by their value', tags: ['HD-89', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(9, 1000, 23); const tea = await k.taxed(9, 3000, 5); const ten = await k.discount(10);
    // 400 off: 100 on the mug (900 paid, 168 tax), 300 on the tea (2700 paid, 129 tax).
    const o = await k.placed([[mug, 1], [tea, 1]], { discountCode: ten });
    assert.equal(o.discountCents, 400); assert.equal(o.totalCents, 3600);
    assert.equal(line(o, mug).taxCents, 168); assert.equal(line(o, tea).taxCents, 129); assert.equal(o.taxCents, 297);
    // 1 cent off 3 × 0.50 at three rates of 50 %: the cent goes to the first line. 49 paid there: 16 of tax; 50 paid on the others: 17.
    const one = await k.discount(1);
    const [x, y, z] = [await k.taxed(9, 50, 50), await k.taxed(9, 50, 50), await k.taxed(9, 50, 50)];
    const small = await k.placed([[x, 1], [y, 1], [z, 1]], { discountCode: one });
    assert.equal(small.discountCents, 1);
    assert.deepEqual([x, y, z].map((sku) => line(small, sku).taxCents), [16, 17, 17]);
  } },
  { id: 't17-12 a product can change its category or leave it', tags: ['HD-90'], async run(ctx) {
    const k = kit(ctx); const tea = await k.category(5); const a = await k.taxed(9, 1230, 23);
    assert.equal(ok(await ctx.sys.updateProduct(a, { category: tea }), 'updateProduct').category, tea);
    assert.equal(line(await k.placed([[a, 1]]), a).taxPercent, 5);
    assert.equal(ok(await ctx.sys.updateProduct(a, { category: null }), 'taking a product out of its category').category, null);
    const o = await k.placed([[a, 1]]);
    assert.equal(o.taxCents, 0); assert.equal(o.totalCents, 1230);
    assert.equal(ok(await ctx.sys.updateProduct(a, { name: 'Renamed' }), 'updateProduct').category, null);
  } },
];
