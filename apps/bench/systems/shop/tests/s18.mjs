import { assert, ok, no, kit, names } from './helpers.mjs';

const line = (order, sku) => order.lines.find((l) => l.sku === sku);
const prices = async (ctx, groupId) => ok(await ctx.sys.listGroupPrices(groupId), 'listGroupPrices');

export const tests = [
  { id: 't18-01 a customer of a group pays the price on its list', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.stocked(9, 1000);
    const c = await k.member(g.id);
    assert.ok(names(ok(await ctx.sys.getCustomer(c.id), 'getCustomer').groupId, g.id), 'the account does not show its group');
    await k.listed(g.id, a, 700);
    const o = await k.placed([[a, 3]], { customerId: c.id });
    assert.equal(line(o, a).unitPriceCents, 700); assert.equal(o.subtotalCents, 2100); assert.equal(o.totalCents, 2100);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 2100);
    assert.equal(await k.charged(o.id), 2100);
    assert.equal(ok(await ctx.sys.getProduct(a), 'getProduct').priceCents, 1000);
  } },
  { id: 't18-02 everybody else pays the normal price', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const other = await k.group(); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 400);
    const c = await k.member(g.id); const outsider = await k.customer(); const elsewhere = await k.member(other.id);
    await k.listed(g.id, a, 700);
    assert.equal(ok(await ctx.sys.getCustomer(outsider.id), 'getCustomer').groupId, null);
    assert.equal((await k.placed([[a, 1]], { customerId: outsider.id })).totalCents, 1000);
    assert.equal((await k.placed([[a, 1]], { customerId: elsewhere.id })).totalCents, 1000);
    assert.equal((await k.placed([[a, 1]])).totalCents, 1000);
    // A product that is not on the list costs the customer of the group what it costs everybody.
    const o = await k.placed([[a, 1], [b, 2]], { customerId: c.id });
    assert.equal(line(o, a).unitPriceCents, 700); assert.equal(line(o, b).unitPriceCents, 400); assert.equal(o.totalCents, 1500);
  } },
  { id: 't18-03 a price list can be read and changed', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.stocked(9, 1000); const b = await k.stocked(9, 400); const c = await k.member(g.id);
    assert.equal((await prices(ctx, g.id)).length, 0);
    await k.listed(g.id, a, 700); await k.listed(g.id, b, 300);
    let list = await prices(ctx, g.id);
    assert.equal(list.length, 2);
    assert.equal(list.find((p) => p.sku === a).priceCents, 700); assert.equal(list.find((p) => p.sku === b).priceCents, 300);
    await k.listed(g.id, a, 650);
    list = await prices(ctx, g.id);
    assert.equal(list.length, 2); assert.equal(list.find((p) => p.sku === a).priceCents, 650);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).totalCents, 650);
    ok(await ctx.sys.removeGroupPrice(g.id, a), 'removeGroupPrice');
    assert.deepEqual((await prices(ctx, g.id)).map((p) => p.sku), [b]);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).totalCents, 1000);
    assert.ok(ok(await ctx.sys.listCustomerGroups(), 'listCustomerGroups').some((x) => x.id === g.id && x.name === g.name), 'the group is not in the list of groups');
  } },
  { id: 't18-04 a customer can change group and leave it', async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const h = await k.group(); const a = await k.stocked(9, 1000); const c = await k.member(g.id);
    await k.listed(g.id, a, 700); await k.listed(h.id, a, 800);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).totalCents, 700);
    assert.ok(names(ok(await ctx.sys.setCustomerGroup(c.id, h.id), 'setCustomerGroup').groupId, h.id));
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).totalCents, 800);
    assert.equal(ok(await ctx.sys.setCustomerGroup(c.id, null), 'taking a customer out of the group').groupId, null);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).totalCents, 1000);
  } },
  { id: 't18-05 the price list counts only on the account', tags: ['HD-91'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.stocked(9, 1000); const c = await k.member(g.id);
    await k.listed(g.id, a, 700);
    const guest = await k.placed([[a, 2]], { customerEmail: c.email });
    assert.equal(line(guest, a).unitPriceCents, 1000); assert.equal(guest.totalCents, 2000);
    assert.equal((await k.placed([[a, 2]], { customerId: c.id })).totalCents, 1400);
  } },
  { id: 't18-06 an order keeps the price it was placed with', tags: ['HD-92'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.stocked(9, 1000); const c = await k.member(g.id);
    await k.listed(g.id, a, 700);
    const o = await k.placed([[a, 2]], { customerId: c.id });
    await k.listed(g.id, a, 900);
    assert.equal((await k.getOrder(o.id)).totalCents, 1400);
    ok(await ctx.sys.removeGroupPrice(g.id, a), 'removeGroupPrice');
    ok(await ctx.sys.setCustomerGroup(c.id, null), 'setCustomerGroup');
    const same = await k.getOrder(o.id);
    assert.equal(line(same, a).unitPriceCents, 700); assert.equal(same.totalCents, 1400);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 1400);
  } },
  { id: 't18-07 what is refused for groups and price lists', tags: ['HD-93'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.product(1000); const c = await k.customer();
    no(await ctx.sys.createCustomerGroup({ name: g.name.toUpperCase() }), 'a second group with the same name in upper case');
    no(await ctx.sys.createCustomerGroup({ name: '   ' }), 'a group without a name');
    for (const priceCents of [0, -100, 9.5]) no(await ctx.sys.setGroupPrice(g.id, { sku: a, priceCents }), `a price of ${priceCents}`);
    no(await ctx.sys.setGroupPrice(g.id, { sku: k.sku('NONE'), priceCents: 500 }), 'a price for an unknown product');
    no(await ctx.sys.setGroupPrice('no-such-group', { sku: a, priceCents: 500 }), 'a price in an unknown group');
    no(await ctx.sys.setCustomerGroup(c.id, 'no-such-group'), 'putting a customer into an unknown group');
    no(await ctx.sys.setCustomerGroup('no-such-customer', g.id), 'putting an unknown customer into a group');
    assert.equal((await prices(ctx, g.id)).length, 0);
    // A price above the normal one is a price like any other.
    ok(await ctx.sys.setGroupPrice(g.id, { sku: a, priceCents: 1200 }), 'a price above the normal price');
  } },
  { id: 't18-08 a discount code stops at the cost of the goods', tags: ['R8'], async run(ctx) {
    const k = kit(ctx); const a = await k.costed(9, 1000, 600); const deep = await k.discount(90); const mild = await k.discount(10);
    const o = await k.placed([[a, 3]], { discountCode: deep });
    assert.equal(o.subtotalCents, 3000);
    assert.equal(o.totalCents, 1800, 'R8: three units that cost 6.00 each are not sold for 18.00');
    assert.equal(o.discountCents, 1200, 'the order does not show what was really taken off');
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 1800);
    assert.equal(await k.charged(o.id), 1800);
    // A discount that stays above the cost is given in full.
    const fine = await k.placed([[a, 1]], { discountCode: mild });
    assert.equal(fine.discountCents, 100); assert.equal(fine.totalCents, 900);
  } },
  { id: 't18-09 a price list does not sell below cost', tags: ['R8'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const a = await k.costed(9, 1000, 600); const c = await k.member(g.id);
    await k.listed(g.id, a, 500);
    const o = await k.placed([[a, 2]], { customerId: c.id });
    assert.ok(o.totalCents >= 1200, `R8: two units that cost 6.00 each are sold for ${o.totalCents}`);
    assert.ok(o.totalCents < 2000, 'the customer of the group pays the normal price');
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, o.totalCents);
    // A list price above the cost is used as it is.
    await k.listed(g.id, a, 750);
    assert.equal((await k.placed([[a, 2]], { customerId: c.id })).totalCents, 1500);
  } },
  { id: 't18-10 points do not take goods below cost', tags: ['R8', 'HD-96'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.costed(9, 1000, 800);
    const before = (await k.points(c.id)).balance;
    // 100 points are 5.00, half of the order, but only 2.00 lie above the cost.
    no(await k.order([[a, 1]], { customerId: c.id, pointsToSpend: 100 }), 'an order whose points would take the goods below cost');
    assert.equal((await k.figures(a)).reserved, 0);
    assert.equal((await k.points(c.id)).balance, before);
    const o = await k.placed([[a, 1]], { customerId: c.id, pointsToSpend: 40 });
    assert.equal(o.pointsDiscountCents, 200); assert.equal(o.totalCents, 800);
  } },
  { id: 't18-11 goods of unknown cost have no floor', tags: ['HD-94'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(9, 1000); const deep = await k.discount(90);
    assert.equal((await k.cost(a)).averageCostCents, null);
    const o = await k.placed([[a, 2]], { discountCode: deep });
    assert.equal(o.discountCents, 1800); assert.equal(o.totalCents, 200);
  } },
  { id: 't18-12 the floor is on the money without tax', tags: ['R8', 'HD-97', 'HD-85'], async run(ctx) {
    const k = kit(ctx); const a = await k.costed(9, 1230, 800, 23); const deep = await k.discount(90);
    // Cost 8.00; with 23 % tax on top the customer pays at least 9.84, of which 1.84 is tax.
    const o = await k.placed([[a, 1]], { discountCode: deep });
    assert.equal(o.totalCents, 984); assert.equal(o.taxCents, 184); assert.equal(o.discountCents, 246);
    assert.ok(o.totalCents - o.taxCents >= 800, 'R8: the money without tax is below the cost');
  } },
  { id: 't18-13 the floor is per line and fixed when the order is placed', tags: ['HD-98'], async run(ctx) {
    const k = kit(ctx); const thin = await k.costed(9, 1000, 900); const wide = await k.costed(9, 5000, 1000); const half = await k.discount(50);
    // Half off both: the thin line stops at 9.00, the wide one goes to 25.00. The wide margin does not pay for the thin line.
    const o = await k.placed([[thin, 1], [wide, 1]], { discountCode: half });
    assert.equal(o.totalCents, 3400); assert.equal(o.discountCents, 2600);
    // The goods get dearer afterwards: the order stays as it was placed.
    await k.bought(wide, 50, 4000);
    assert.ok((await k.cost(wide)).averageCostCents > 2500);
    assert.equal((await k.getOrder(o.id)).totalCents, 3400);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 3400);
    assert.equal((await k.placed([[wide, 1]], { discountCode: half })).totalCents, (await k.cost(wide)).averageCostCents);
  } },
  { id: 't18-14 a list price below cost becomes the cost, a normal price below cost stands', tags: ['HD-95', 'HD-99'], async run(ctx) {
    const k = kit(ctx); const g = await k.group(); const c = await k.member(g.id);
    const a = await k.costed(9, 1000, 600); const cheap = await k.costed(9, 500, 600); const fifth = await k.discount(20);
    await k.listed(g.id, a, 500); await k.listed(g.id, cheap, 400);
    const o = await k.placed([[a, 2]], { customerId: c.id });
    assert.equal(line(o, a).unitPriceCents, 600); assert.equal(o.subtotalCents, 1200); assert.equal(o.totalCents, 1200);
    // Normal price 5.00, cost 6.00, list price 4.00: the list price is lifted, but not above the normal price.
    const p = await k.placed([[cheap, 1]], { customerId: c.id });
    assert.equal(line(p, cheap).unitPriceCents, 500); assert.equal(p.totalCents, 500);
    // Without the group: the normal price stands, and a code takes nothing off it.
    const q = await k.placed([[cheap, 2]], { discountCode: fifth });
    assert.equal(q.subtotalCents, 1000); assert.equal(q.discountCents, 0); assert.equal(q.totalCents, 1000);
  } },
];
