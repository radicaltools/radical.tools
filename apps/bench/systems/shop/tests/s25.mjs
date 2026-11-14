import { assert, ok, no, kit } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const rates = async (ctx, carrier) => ok(await ctx.sys.listCarrierRates(carrier), 'listCarrierRates');

export const tests = [
  { id: 't25-01 an order with a carrier shows its shipping cost and is charged with it', async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]); const a = await k.weighed(9, 1000, 300);
    const o = await k.paid([[a, 2]], r.to);
    assert.equal(o.carrier, r.carrier); assert.equal(o.shippingCents, 990);
    assert.equal(o.totalCents, 2990);
    assert.equal(await k.charged(o.id), 2990);
    assert.ok(ok(await ctx.sys.listCarriers(), 'listCarriers').some((c) => c.code === r.carrier), 'the carrier is not in the list of carriers');
  } },
  { id: 't25-02 a heavier parcel costs more', async run(ctx) {
    const k = kit(ctx); const r = await k.route([[1000, 500], [5000, 900]]); const a = await k.weighed(20, 1000, 300);
    assert.equal((await k.placed([[a, 1]], r.to)).shippingCents, 500);
    assert.equal((await k.placed([[a, 2]], r.to)).shippingCents, 500);
    const heavy = await k.placed([[a, 5]], r.to);
    assert.equal(heavy.shippingCents, 900); assert.equal(heavy.totalCents, 5900);
    assert.deepEqual((await rates(ctx, r.carrier)).map((x) => [x.zone, x.maxWeightGrams, x.priceCents]).sort((x, y) => x[1] - y[1]), [[r.zone, 1000, 500], [r.zone, 5000, 900]]);
  } },
  { id: 't25-03 where the parcel goes decides the price', async run(ctx) {
    const k = kit(ctx); const [near, far] = [k.country(), k.country()];
    const [zn, zf] = [await k.zone([near, k.country()]), await k.zone([far])];
    const carrier = await k.carrier([[zn, 5000, 700], [zf, 5000, 1900]]);
    const c = await k.customer(); const a = await k.weighed(9, 1000, 300);
    const [home, abroad] = [await k.address(c.id, { ...k.place(), country: near }), await k.address(c.id, { ...k.place(), country: far })];
    assert.equal((await k.placed([[a, 1]], { customerId: c.id, shippingAddressId: home.id, carrier })).shippingCents, 700);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id, shippingAddressId: abroad.id, carrier })).shippingCents, 1900);
    // Another carrier has prices of its own.
    const other = await k.carrier([[zn, 5000, 450]]);
    assert.equal((await k.placed([[a, 1]], { customerId: c.id, shippingAddressId: home.id, carrier: other })).shippingCents, 450);
  } },
  { id: 't25-04 an order without a carrier has no shipping cost', async run(ctx) {
    const k = kit(ctx); const r = await k.route(); const a = await k.weighed(9, 1000, 300);
    const o = await k.paid([[a, 2]], { customerId: r.c.id, shippingAddressId: r.home.id });
    assert.equal(o.carrier, null); assert.equal(o.shippingCents, 0); assert.equal(o.totalCents, 2000);
    assert.equal(await k.charged(o.id), 2000);
    const guest = await k.placed([[a, 1]]);
    assert.equal(guest.carrier, null); assert.equal(guest.shippingCents, 0); assert.equal(guest.totalCents, 1000);
  } },
  { id: 't25-05 the weight limits of a carrier', tags: ['HD-133'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[1000, 500], [5000, 900]]);
    const a = await k.weighed(30, 1000, 250); const light = await k.stocked(9, 1000);
    assert.equal((await k.placed([[a, 4]], r.to)).shippingCents, 500, 'a parcel of exactly the limit');
    assert.equal((await k.placed([[a, 5]], r.to)).shippingCents, 900);
    assert.equal((await k.placed([[a, 20]], r.to)).shippingCents, 900, 'a parcel of exactly the heaviest limit');
    // A product without a weight weighs nothing.
    assert.equal(ok(await ctx.sys.getProduct(light), 'getProduct').weightGrams, null);
    assert.equal((await k.placed([[a, 4], [light, 3]], r.to)).shippingCents, 500);
    const before = (await k.figures(a)).reserved;
    no(await k.order([[a, 21]], r.to), 'a parcel heavier than the carrier takes');
    assert.equal((await k.figures(a)).reserved, before);
  } },
  { id: 't25-06 a carrier that does not go there', tags: ['HD-134'], async run(ctx) {
    const k = kit(ctx); const r = await k.route(); const a = await k.weighed(9, 1000, 300);
    const elsewhere = k.country(); await k.zone([elsewhere]);
    const abroad = await k.address(r.c.id, { ...k.place(), country: elsewhere });
    const nowhere = await k.address(r.c.id, { ...k.place(), country: k.country() });
    no(await k.order([[a, 1]], { ...r.to, shippingAddressId: abroad.id }), 'an order into a zone the carrier has no prices for');
    no(await k.order([[a, 1]], { ...r.to, shippingAddressId: nowhere.id }), 'an order to a country that is in no zone');
    no(await k.order([[a, 1]], { ...r.to, carrier: 'NOSUCH' }), 'an order with a carrier that does not exist');
    assert.equal((await k.figures(a)).reserved, 0);
    ok(await k.order([[a, 1]], r.to), 'placeOrder');
  } },
  { id: 't25-07 an order without an address goes to the home country', tags: ['HD-135'], async run(ctx) {
    const k = kit(ctx); const home = await k.zoneOf('PL'); const carrier = await k.carrier([[home, 30000, 700]]); const a = await k.weighed(9, 1000, 300);
    const guest = await k.placed([[a, 1]], { carrier });
    assert.equal(guest.shippingCents, 700); assert.equal(guest.totalCents, 1700); assert.equal(guest.shippingAddress, null);
    const c = await k.customer();
    assert.equal((await k.placed([[a, 1]], { customerId: c.id, carrier })).shippingCents, 700);
    // A carrier without prices for the home country does not take such an order.
    const r = await k.route();
    no(await k.order([[a, 1]], { carrier: r.carrier }), 'an order without an address with a carrier that does not go to the home country');
  } },
  { id: 't25-08 codes and points take nothing off the shipping cost', tags: ['HD-136'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const r = await k.route([[30000, 1000]], c);
    const a = await k.weighed(9, 2000, 300); const half = await k.discount(50);
    const o = await k.placed([[a, 1]], { ...r.to, discountCode: half });
    assert.equal(o.subtotalCents, 2000); assert.equal(o.discountCents, 1000); assert.equal(o.shippingCents, 1000); assert.equal(o.totalCents, 2000);
    // Points pay for at most half of the goods: 5.00 of the 10.00 that are left, whatever the shipping costs.
    no(await k.order([[a, 1]], { ...r.to, discountCode: half, pointsToSpend: 101 }), 'points for more than half of the goods');
    const p = await k.placed([[a, 1]], { ...r.to, discountCode: half, pointsToSpend: 100 });
    assert.equal(p.pointsDiscountCents, 500); assert.equal(p.shippingCents, 1000); assert.equal(p.totalCents, 1500);
  } },
  { id: 't25-09 points are collected on the goods, not on the shipping cost', tags: ['HD-137'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]); const a = await k.weighed(9, 1000, 300);
    const o = await k.paid([[a, 3]], r.to);
    assert.equal(o.totalCents, 3990);
    assert.equal((await k.points(r.c.id)).balance, 30);
  } },
  { id: 't25-10 the shipping cost is fixed when the order is placed', tags: ['HD-138'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[1000, 500], [5000, 900]]); const a = await k.weighed(9, 1000, 300);
    const o = await k.placed([[a, 2]], r.to);
    ok(await ctx.sys.setCarrierRate(r.carrier, { zone: r.zone, maxWeightGrams: 1000, priceCents: 650 }), 'setCarrierRate');
    ok(await ctx.sys.updateProduct(a, { weightGrams: 2000 }), 'updateProduct');
    const same = await k.getOrder(o.id);
    assert.equal(same.shippingCents, 500); assert.equal(same.totalCents, 2500);
    ctx.provider.mode = 'succeed';
    ok(await k.pay(o.id), 'payOrder');
    assert.equal(await k.charged(o.id), 2500);
    assert.equal((await k.placed([[a, 2]], r.to)).shippingCents, 900);
    ok(await ctx.sys.updateProduct(a, { weightGrams: 300 }), 'updateProduct');
    assert.equal((await k.placed([[a, 2]], r.to)).shippingCents, 650);
    assert.equal((await rates(ctx, r.carrier)).length, 2, 'setting a price again made a second price');
  } },
  { id: 't25-11 the shipping cost has tax of its own, on the order and on its invoice', tags: ['HD-139', 'R7'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]);
    const mug = await k.taxed(9, 1230, 23); const tea = await k.taxed(9, 2100, 5); const plain = await k.stocked(9, 500);
    const o = await k.shipped([[mug, 1], [tea, 1]], r.to);
    assert.equal(o.shippingTaxCents, 185); assert.equal(o.taxCents, 230 + 100 + 185); assert.equal(o.totalCents, 4320);
    assert.equal(sum(o.lines, (l) => l.taxCents) + o.shippingTaxCents, o.taxCents, 'R7: the tax of the order is not the sum of its parts');
    const invoice = await k.invoice(o.id);
    assert.equal(invoice.shippingCents, 990); assert.equal(invoice.shippingTaxCents, 185);
    assert.equal(invoice.totalCents, sum(invoice.lines, (l) => l.totalCents) + 990, 'R7: the invoice is not its lines plus the shipping cost');
    assert.equal(invoice.taxCents, sum(invoice.lines, (l) => l.taxCents) + 185);
    assert.equal(invoice.totalCents, o.totalCents); assert.equal(invoice.taxCents, o.taxCents);
    assert.equal(await k.charged(o.id), invoice.totalCents);
    // Goods without tax: the tax of the order is that of the shipping cost.
    const p = await k.shipped([[plain, 2]], r.to);
    assert.equal(p.taxCents, 185); assert.equal((await k.invoice(p.id)).taxCents, 185);
    // No carrier: nothing of this on the order or the invoice.
    const q = await k.shipped([[plain, 1]]);
    assert.equal(q.shippingTaxCents, 0);
    const bare = await k.invoice(q.id);
    assert.equal(bare.shippingCents, 0); assert.equal(bare.shippingTaxCents, 0); assert.equal(bare.totalCents, 500);
  } },
  { id: 't25-12 the daily report counts the shipping cost at its rate', tags: ['HD-140', 'R7'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const r = await k.route([[30000, 990]]); const tea = await k.taxed(9, 2100, 5);
    await k.shippedAt(k.noon(year, 4, 4), [[tea, 1]], r.to);
    const report = await k.report(k.day(year, 4, 4));
    assert.equal(report.invoicedCents, 3090); assert.equal(report.invoicedTaxCents, 285);
    const row = (p) => report.byTaxRate.find((x) => x.taxPercent === p);
    assert.equal(row(5).invoicedCents, 2100); assert.equal(row(5).invoicedTaxCents, 100);
    assert.equal(row(23).invoicedCents, 990); assert.equal(row(23).invoicedTaxCents, 185);
    assert.equal(sum(report.byTaxRate, (x) => x.invoicedCents), report.invoicedCents, 'R7: the rows do not add up to the report');
    assert.equal(sum(report.byTaxRate, (x) => x.invoicedTaxCents), report.invoicedTaxCents);
  } },
  { id: 't25-13 a return does not give the shipping cost back', tags: ['HD-141'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]); const a = await k.weighed(9, 1000, 300); const ten = await k.discount(10);
    const o = await k.shipped([[a, 3]], { ...r.to, discountCode: ten });
    assert.equal(o.totalCents, 3690);
    assert.equal(ok(await k.ret(o.id, [[a, 1]]), 'returnItems').refundCents, 900);
    assert.equal(ok(await k.ret(o.id, [[a, 2]]), 'returnItems').refundCents, 1800);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(sum(ctx.provider.refunds, (x) => x.amountCents), 2700);
    const invoice = await k.invoice(o.id);
    assert.equal(sum(await k.creditNotes(o.id), (n) => n.totalCents), invoice.totalCents - invoice.shippingCents);
  } },
  { id: 't25-14 what is refused when weights, zones and carriers are set up', tags: ['HD-142'], async run(ctx) {
    const k = kit(ctx); const sys = ctx.sys; const [one, two] = [k.country(), k.country()];
    no(await sys.createProduct({ sku: k.sku(), name: 'Too light', priceCents: 100, weightGrams: -1 }), 'a weight below zero');
    no(await sys.createProduct({ sku: k.sku(), name: 'Half a gram', priceCents: 100, weightGrams: 1.5 }), 'a weight with a fraction');
    assert.equal(ok(await sys.createProduct({ sku: k.sku(), name: 'Feather', priceCents: 100, weightGrams: 0 }), 'a product that weighs nothing').weightGrams, 0);
    const zone = await k.zone([one]);
    no(await sys.createShippingZone({ code: zone, name: 'Again', countries: [two] }), 'a zone code that is taken');
    no(await sys.createShippingZone({ code: k.code(), name: 'Overlap', countries: [two, one] }), 'a country that is in another zone');
    no(await sys.createShippingZone({ code: k.code(), name: 'Empty', countries: [] }), 'a zone without countries');
    no(await sys.createShippingZone({ code: k.code(), name: 'Lower case', countries: ['xx'] }), 'a country in lower case');
    await k.zone([two]);
    const carrier = await k.carrier();
    no(await sys.createCarrier({ code: carrier, name: 'Again' }), 'a carrier code that is taken');
    no(await sys.createCarrier({ code: 'lower', name: 'Lower case' }), 'a carrier code in lower case');
    no(await sys.createCarrier({ code: 'X', name: 'Short' }), 'a carrier code of one character');
    no(await sys.setCarrierRate(carrier, { zone: 'NOSUCH', maxWeightGrams: 1000, priceCents: 500 }), 'a price for a zone that does not exist');
    no(await sys.setCarrierRate('NOSUCH', { zone, maxWeightGrams: 1000, priceCents: 500 }), 'a price for a carrier that does not exist');
    no(await sys.setCarrierRate(carrier, { zone, maxWeightGrams: 0, priceCents: 500 }), 'a price up to no weight');
    no(await sys.setCarrierRate(carrier, { zone, maxWeightGrams: 1000, priceCents: -1 }), 'a price below zero');
    assert.equal((await rates(ctx, carrier)).length, 0);
    ok(await sys.setCarrierRate(carrier, { zone, maxWeightGrams: 1000, priceCents: 0 }), 'free shipping');
  } },
];
