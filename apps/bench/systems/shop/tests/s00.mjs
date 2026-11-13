import { assert, ok, no, unavailable, kit, sleep, forOrder } from './helpers.mjs';

export const tests = [
  { id: 't0-01 product create, read, duplicate', async run(ctx) {
    const k = kit(ctx); const sku = k.sku();
    const p = ok(await ctx.sys.createProduct({ sku, name: 'Mug', priceCents: 1250 }), 'createProduct');
    assert.deepEqual({ sku: p.sku, name: p.name, priceCents: p.priceCents, active: p.active }, { sku, name: 'Mug', priceCents: 1250, active: true });
    assert.equal(ok(await ctx.sys.getProduct(sku), 'getProduct').priceCents, 1250);
    no(await ctx.sys.createProduct({ sku, name: 'Other', priceCents: 1 }), 'a second product with the same SKU');
    no(await ctx.sys.getProduct(k.sku('NONE')), 'reading an unknown product');
  } },
  { id: 't0-02 lower-case SKU is refused', tags: ['HD-10'], async run(ctx) {
    const k = kit(ctx); const sku = k.sku().toLowerCase();
    no(await ctx.sys.createProduct({ sku, name: 'Mug', priceCents: 100 }), 'a lower-case SKU');
    no(await ctx.sys.getProduct(sku.toUpperCase()), 'reading the corrected SKU');
  } },
  { id: 't0-03 price must be above zero', tags: ['HD-13'], async run(ctx) {
    const k = kit(ctx);
    no(await ctx.sys.createProduct({ sku: k.sku(), name: 'Free', priceCents: 0 }), 'a free product');
    no(await ctx.sys.createProduct({ sku: k.sku(), name: 'Neg', priceCents: -5 }), 'a negative price');
    const sku = await k.product(100);
    no(await ctx.sys.updateProduct(sku, { priceCents: 0 }), 'changing the price to zero');
  } },
  { id: 't0-04 product list: on sale only, by SKU', tags: ['HD-08'], async run(ctx) {
    const k = kit(ctx); const p = `LST${Date.now() % 100000}`;
    for (const s of [`${p}-C`, `${p}-A`, `${p}-B`]) await k.product(100, s);
    ok(await ctx.sys.updateProduct(`${p}-B`, { active: false }), 'updateProduct');
    const mine = async (includeInactive) => ok(await ctx.sys.listProducts({ includeInactive }), 'listProducts').filter((x) => x.sku.startsWith(p)).map((x) => x.sku);
    assert.deepEqual(await mine(false), [`${p}-A`, `${p}-C`]);
    assert.deepEqual(await mine(true), [`${p}-A`, `${p}-B`, `${p}-C`]);
  } },
  { id: 't0-05 product change', async run(ctx) {
    const k = kit(ctx); const sku = await k.product(100);
    const p = ok(await ctx.sys.updateProduct(sku, { name: 'Renamed', priceCents: 250 }), 'updateProduct');
    assert.equal(p.name, 'Renamed'); assert.equal(p.priceCents, 250); assert.equal(p.active, true);
    assert.equal(ok(await ctx.sys.getProduct(sku)).name, 'Renamed');
    no(await ctx.sys.updateProduct(k.sku('NONE'), { name: 'x' }), 'changing an unknown product');
  } },
  { id: 't0-06 receipts add up', async run(ctx) {
    const k = kit(ctx); const sku = await k.product();
    await k.receive(sku, 10); await k.receive(sku, 5);
    const s = await k.figures(sku);
    assert.equal(s.onHand, 15); assert.equal(s.reserved, 0); assert.equal(s.available, 15);
  } },
  { id: 't0-06b the stock history lists every change', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const sku = await k.product();
    await k.receive(sku, 10); await k.receive(sku, 5); ok(await k.adjust(sku, -2), 'adjustStock');
    const m = await k.ledger(sku);
    assert.deepEqual(m.map((x) => x.quantity), [10, 5, -2]);
    assert.deepEqual(m.map((x) => x.kind), ['receipt', 'receipt', 'adjustment']);
  } },
  { id: 't0-07 receipt and adjustment quantities', tags: ['HD-06'], async run(ctx) {
    const k = kit(ctx); const sku = await k.stocked(10);
    no(await ctx.sys.receiveStock({ sku, quantity: 0 }), 'a receipt of zero');
    no(await ctx.sys.receiveStock({ sku, quantity: -3 }), 'a negative receipt');
    no(await k.adjust(sku, 0), 'an adjustment of zero');
    ok(await k.adjust(sku, -4), 'adjustStock'); ok(await k.adjust(sku, 2), 'adjustStock');
    assert.equal((await k.figures(sku)).onHand, 8);
  } },
  { id: 't0-08 adjustment cannot go below reserved', tags: ['HD-06', 'R2'], async run(ctx) {
    const k = kit(ctx); const sku = await k.stocked(10);
    await k.placed([[sku, 7]]);
    no(await k.adjust(sku, -4), 'an adjustment below what is reserved');
    const s = await k.figures(sku);
    assert.equal(s.onHand, 10); assert.equal(s.reserved, 7);
    ok(await k.adjust(sku, -3), 'adjustStock');
    assert.equal((await k.figures(sku)).available, 0);
  } },
  { id: 't0-09 stock for an unknown product', async run(ctx) {
    const k = kit(ctx);
    no(await ctx.sys.receiveStock({ sku: k.sku('NONE'), quantity: 1 }), 'a receipt for an unknown product');
  } },
  { id: 't0-10 receipt for a product off sale', tags: ['HD-03a'], async run(ctx) {
    const k = kit(ctx); const sku = await k.product();
    ok(await ctx.sys.updateProduct(sku, { active: false }), 'updateProduct');
    await k.receive(sku, 3);
    assert.equal((await k.stock(sku)).onHand, 3);
  } },
  { id: 't0-11 an order reserves stock', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 1200); const b = await k.stocked(4, 350);
    const email = k.email();
    const o = await k.placed([[a, 2], [b, 3]], { customerEmail: email });
    assert.equal(o.status, 'pending'); assert.equal(o.customerEmail, email);
    assert.equal(o.totalCents, 2 * 1200 + 3 * 350);
    assert.deepEqual(o.lines.map((l) => [l.sku, l.quantity, l.unitPriceCents]).sort(), [[a, 2, 1200], [b, 3, 350]].sort());
    const s = await k.figures(a); assert.equal(s.reserved, 2); assert.equal(s.available, 8);
    assert.equal((await k.figures(b)).available, 1);
    assert.equal((await k.getOrder(o.id)).totalCents, o.totalCents);
  } },
  { id: 't0-12 an order beyond stock is refused whole', until: 7, async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10); const b = await k.stocked(1);
    no(await k.order([[a, 2], [b, 2]]), 'an order beyond stock');
    assert.equal((await k.stock(a)).reserved, 0); assert.equal((await k.stock(b)).reserved, 0);
  } },
  { id: 't0-13 the same product twice is one line', tags: ['HD-01'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10, 100); const b = await k.stocked(10, 200);
    const o = await k.placed([[a, 2], [b, 1], [a, 3]]);
    assert.deepEqual(o.lines.map((l) => [l.sku, l.quantity]), [[a, 5], [b, 1]]);
    assert.equal(o.totalCents, 700);
    assert.equal((await k.stock(a)).reserved, 5);
  } },
  { id: 't0-14 quantity limits on an order', tags: ['HD-07'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(2000);
    no(await k.order([[a, 1001]]), 'a line of 1001');
    no(await k.order([[a, 0]]), 'a line of 0');
    ok(await k.order([[a, 1000]]), 'a line of 1000');
  } },
  { id: 't0-15 unknown products and products off sale cannot be ordered', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    no(await k.order([[k.sku('NONE'), 1]]), 'an order for an unknown product');
    ok(await ctx.sys.updateProduct(a, { active: false }), 'updateProduct');
    no(await k.order([[a, 1]]), 'an order for a product off sale');
    assert.equal((await k.stock(a)).reserved, 0);
  } },
  { id: 't0-16 the price is fixed when the order is placed', tags: ['HD-02'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000);
    const o = await k.placed([[a, 2]]);
    ok(await ctx.sys.updateProduct(a, { priceCents: 5000 }), 'updateProduct');
    const again = await k.getOrder(o.id);
    assert.equal(again.totalCents, 2000); assert.equal(again.lines[0].unitPriceCents, 1000);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').amountCents, 2000);
    assert.equal(ctx.provider.charges.at(-1).amountCents, 2000);
  } },
  { id: 't0-17 the orders of a customer', tags: ['HD-09'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10);
    const email = `Mixed.Case${Date.now()}@Example.com`;
    const o1 = await k.placed([[a, 1]], { customerEmail: email }); await sleep(1100);
    const o2 = await k.placed([[a, 1]], { customerEmail: email });
    await k.placed([[a, 1]]);
    const list = ok(await ctx.sys.listOrders({ customerEmail: email.toLowerCase() }), 'listOrders');
    assert.deepEqual(list.map((o) => o.id), [o2.id, o1.id]);
    assert.equal(list[0].customerEmail, email);
  } },
  { id: 't0-18 a payment succeeds', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700);
    const o = await k.placed([[a, 3]]);
    ctx.provider.mode = 'succeed';
    const p = ok(await k.pay(o.id), 'payOrder');
    assert.equal(p.status, 'succeeded'); assert.equal(p.amountCents, 2100);
    const charge = ctx.provider.charges.at(-1);
    assert.equal(charge.amountCents, 2100); assert.equal(p.providerChargeId, charge.chargeId);
    assert.equal((await k.getOrder(o.id)).status, 'paid');
    assert.equal(ok(await ctx.sys.listPayments(o.id), 'listPayments').length, 1);
  } },
  { id: 't0-18b the charge carries the order id', tags: ['HD-11'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 700);
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.equal(ctx.provider.charges.at(-1).reference, o.id);
  } },
  { id: 't0-19 a declined payment keeps the order waiting', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    ctx.provider.mode = 'decline';
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'declined');
    assert.equal((await k.getOrder(o.id)).status, 'pending');
    assert.equal((await k.stock(a)).reserved, 3);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.equal((await k.getOrder(o.id)).status, 'paid');
  } },
  { id: 't0-20 the third decline cancels the order', tags: ['HD-04'], until: 2, async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 3]]);
    ctx.provider.mode = 'decline';
    ok(await k.pay(o.id), 'payOrder'); ok(await k.pay(o.id), 'payOrder');
    assert.equal((await k.getOrder(o.id)).status, 'pending');
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'declined');
    assert.equal((await k.getOrder(o.id)).status, 'cancelled');
    assert.equal((await k.figures(a)).reserved, 0);
    no(await k.pay(o.id), 'a fourth attempt');
  } },
  { id: 't0-21 the provider fails', tags: ['HD-05'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    ctx.provider.mode = 'fail';
    for (let i = 0; i < 4; i++) unavailable(await k.pay(o.id), 'a payment while the provider is down');
    assert.equal(ok(await ctx.sys.listPayments(o.id), 'listPayments').length, 0);
    assert.equal((await k.getOrder(o.id)).status, 'pending');
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
  } },
  { id: 't0-22 a paid or unknown order cannot be paid', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.paid([[a, 1]]);
    const before = ctx.provider.charges.length;
    no(await k.pay(o.id), 'paying a paid order');
    no(await k.pay('no-such-order'), 'paying an unknown order');
    assert.equal(ctx.provider.charges.length, before, 'nothing was charged');
  } },
  { id: 't0-23 a shipment takes the goods out', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10); const b = await k.stocked(6);
    const o = await k.paid([[a, 4], [b, 1]]);
    const before = await k.stock(a);
    ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    const after = await k.figures(a);
    assert.equal(after.onHand, 6); assert.equal(after.reserved, 0); assert.equal(after.available, before.available);
    assert.equal((await k.figures(b)).onHand, 5);
    no(await k.ship(o.id), 'shipping twice');
  } },
  { id: 't0-23b a shipment is on record per line, for the order', tags: ['HD-12', 'R1'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(10); const b = await k.stocked(6);
    const o = await k.shipped([[a, 4], [b, 1]]);
    const ma = (await k.ledger(a)).filter((m) => m.kind === 'shipment');
    assert.equal(ma.length, 1); assert.equal(ma[0].quantity, -4); forOrder(ma[0], o);
    const mb = (await k.ledger(b)).filter((m) => m.kind === 'shipment');
    assert.equal(mb.length, 1); assert.equal(mb[0].quantity, -1);
  } },
  { id: 't0-24 only a paid order ships', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]]);
    no(await k.ship(o.id), 'shipping an unpaid order');
    no(await k.ship('no-such-order'), 'shipping an unknown order');
    assert.equal((await k.stock(a)).onHand, 5);
  } },
  { id: 't0-25 a product taken off sale after the order', tags: ['HD-03b'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    const o = await k.placed([[a, 2]]);
    ok(await ctx.sys.updateProduct(a, { active: false }), 'updateProduct');
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder'); ok(await k.ship(o.id), 'shipOrder');
    assert.equal((await k.figures(a)).onHand, 3);
  } },
  { id: 't0-26 stock figures over a mixed history', tags: ['R1', 'R2'], until: 7, async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(20);
    await k.placed([[a, 5]]); await k.figures(a);
    const o2 = await k.paid([[a, 6]]); await k.figures(a);
    ok(await k.adjust(a, -9), 'adjustStock'); await k.figures(a);
    no(await k.order([[a, 1]]), 'an order with nothing available'); await k.figures(a);
    ok(await k.ship(o2.id), 'shipOrder');
    const s = await k.figures(a); await k.ledger(a);
    assert.equal(s.onHand, 5); assert.equal(s.reserved, 5); assert.equal(s.available, 0);
  } },
  { id: 't0-27 an order needs an address and lines', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5);
    no(await k.order([[a, 1]], { customerEmail: 'not-an-email' }), 'an order without a real address');
    no(await k.order([]), 'an order without lines');
    assert.equal((await k.stock(a)).reserved, 0);
  } },
  { id: 't0-28 unknown order and stock', async run(ctx) {
    const k = kit(ctx);
    no(await ctx.sys.getOrder('no-such-order'), 'reading an unknown order');
    no(await ctx.sys.getStock(k.sku('NONE')), 'stock of an unknown product');
  } },
];
