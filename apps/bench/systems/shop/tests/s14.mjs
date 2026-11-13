import { assert, ok, no, kit, names } from './helpers.mjs';

const po = async (ctx, id) => ok(await ctx.sys.getPurchaseOrder(id), 'getPurchaseOrder');
const got = (p, sku) => p.lines.find((l) => l.sku === sku).receivedQuantity;

export const tests = [
  { id: 't14-01 a delivery is booked against its purchase order', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product();
    const p = await k.purchased(s.id, [[a, 40, 310], [b, 12, 1275]]);
    assert.equal(got(p, a), 0);
    const after = ok(await k.deliver(p.id, [[a, 40], [b, 12]]), 'receivePurchaseOrder');
    assert.equal(after.status, 'received'); assert.equal(got(after, a), 40); assert.equal(got(after, b), 12);
    const sa = await k.figures(a);
    assert.equal(sa.onHand, 40); assert.equal(sa.available, 40); assert.equal(sa.onOrder, 0);
    assert.equal((await k.figures(b)).onHand, 12);
    assert.equal((await po(ctx, p.id)).status, 'received');
  } },
  { id: 't14-02 a purchase order can arrive in parts', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product();
    const p = await k.purchased(s.id, [[a, 40, 310], [b, 12, 1275]]);
    const first = ok(await k.deliver(p.id, [[a, 25]]), 'receivePurchaseOrder');
    assert.equal(first.status, 'open'); assert.equal(got(first, a), 25); assert.equal(got(first, b), 0);
    let sa = await k.figures(a);
    assert.equal(sa.onHand, 25); assert.equal(sa.onOrder, 15);
    assert.equal((await k.figures(b)).onOrder, 12);
    ok(await k.deliver(p.id, [[b, 12]]), 'receivePurchaseOrder');
    assert.equal((await po(ctx, p.id)).status, 'open');
    const last = ok(await k.deliver(p.id, [[a, 15]]), 'receivePurchaseOrder');
    assert.equal(last.status, 'received'); assert.equal(got(last, a), 40);
    sa = await k.figures(a);
    assert.equal(sa.onHand, 40); assert.equal(sa.onOrder, 0);
  } },
  { id: 't14-03 deliveries are in the stock history', tags: ['R1'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(4);
    const p = await k.purchased(s.id, [[a, 40, 310]]);
    ok(await k.deliver(p.id, [[a, 25]]), 'receivePurchaseOrder');
    ok(await k.adjust(a, -2), 'adjustStock');
    ok(await k.deliver(p.id, [[a, 15]]), 'receivePurchaseOrder');
    const o = await k.shipped([[a, 6]]);
    const m = await k.ledger(a);
    assert.equal((await k.figures(a)).onHand, 36);
    assert.equal(m.filter((x) => x.quantity > 0).reduce((sum, x) => sum + x.quantity, 0), 44);
    assert.ok(m.some((x) => x.kind === 'shipment' && names(x.reference, o.id)));
  } },
  { id: 't14-04 a delivery is a receipt for its purchase order, in its warehouse', tags: ['HD-70'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product(); const w = await k.warehouse();
    const p = await k.purchased(s.id, [[a, 10, 310], [b, 5, 100]], w);
    ok(await k.deliver(p.id, [[a, 10], [b, 5]]), 'receivePurchaseOrder');
    for (const [sku, quantity] of [[a, 10], [b, 5]]) {
      const m = await k.ledger(sku);
      assert.equal(m.length, 1);
      assert.equal(m[0].kind, 'receipt'); assert.equal(m[0].quantity, quantity); assert.equal(m[0].warehouse, w);
      assert.ok(names(m[0].reference, p.id), `the movement's reference ${JSON.stringify(m[0].reference)} does not name the purchase order`);
    }
    const sa = await k.figures(a);
    assert.equal(k.wh(sa, w).onHand, 10); assert.equal(k.wh(sa, 'MAIN').onHand, 0);
  } },
  { id: 't14-05 a little more than ordered is taken, a lot more is not', tags: ['HD-71'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product(); const c = await k.product();
    const p = await k.purchased(s.id, [[a, 20, 100]]);
    no(await k.deliver(p.id, [[a, 23]]), 'a delivery of 23 for 20 ordered');
    assert.equal((await k.figures(a)).onHand, 0);
    const done = ok(await k.deliver(p.id, [[a, 22]]), 'a delivery of 22 for 20 ordered');
    assert.equal(done.status, 'received'); assert.equal(got(done, a), 22);
    assert.equal((await k.figures(a)).onHand, 22); assert.equal((await k.figures(a)).onOrder, 0);
    const parts = await k.purchased(s.id, [[b, 20, 100]]);
    ok(await k.deliver(parts.id, [[b, 15]]), 'receivePurchaseOrder');
    no(await k.deliver(parts.id, [[b, 8]]), 'a second delivery that takes the line to 23 for 20 ordered');
    ok(await k.deliver(parts.id, [[b, 7]]), 'a second delivery that takes the line to 22');
    const small = await k.purchased(s.id, [[c, 5, 100]]);
    no(await k.deliver(small.id, [[c, 6]]), 'a delivery of 6 for 5 ordered');
    ok(await k.deliver(small.id, [[c, 5]]), 'receivePurchaseOrder');
  } },
  { id: 't14-06 a purchase order whose rest will not come is closed', tags: ['HD-72'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const p = await k.purchased(s.id, [[a, 40, 310]]);
    no(await ctx.sys.closePurchaseOrder(p.id), 'closing a purchase order nothing has arrived on');
    ok(await k.deliver(p.id, [[a, 25]]), 'receivePurchaseOrder');
    assert.equal(ok(await ctx.sys.closePurchaseOrder(p.id), 'closePurchaseOrder').status, 'closed');
    const sa = await k.figures(a);
    assert.equal(sa.onOrder, 0); assert.equal(sa.onHand, 25);
    no(await k.deliver(p.id, [[a, 5]]), 'a delivery on a closed purchase order');
    assert.equal(got(await po(ctx, p.id), a), 25);
    const whole = await k.purchased(s.id, [[a, 3, 310]]);
    ok(await k.deliver(whole.id, [[a, 3]]), 'receivePurchaseOrder');
    no(await ctx.sys.closePurchaseOrder(whole.id), 'closing a purchase order that has arrived in full');
  } },
  { id: 't14-07 a purchase order with goods in cannot be called off', tags: ['HD-73'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const p = await k.purchased(s.id, [[a, 40, 310]]);
    ok(await k.deliver(p.id, [[a, 1]]), 'receivePurchaseOrder');
    no(await ctx.sys.cancelPurchaseOrder(p.id), 'cancelling a purchase order after a delivery');
    assert.equal((await po(ctx, p.id)).status, 'open');
    assert.equal((await k.figures(a)).onOrder, 39);
  } },
  { id: 't14-08 a delivery is booked whole or not at all', tags: ['HD-74'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product(); const b = await k.product(); const stray = await k.product();
    const p = await k.purchased(s.id, [[a, 10, 100], [b, 10, 100]]);
    no(await k.deliver(p.id, [[a, 5], [stray, 1]]), 'a delivery with a product that is not on the purchase order');
    no(await k.deliver(p.id, [[a, 5], [b, 30]]), 'a delivery with far too many of one product');
    assert.equal((await k.figures(a)).onHand, 0); assert.equal((await k.figures(stray)).onHand, 0);
    assert.equal(got(await po(ctx, p.id), a), 0);
    assert.equal((await k.movements(a)).length, 0);
  } },
  { id: 't14-09 what a delivery needs', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const p = await k.purchased(s.id, [[a, 10, 100]]);
    no(await k.deliver('no-such-purchase-order', [[a, 1]]), 'a delivery for an unknown purchase order');
    no(await k.deliver(p.id, []), 'a delivery without lines');
    no(await k.deliver(p.id, [[a, 0]]), 'a delivery of nothing');
    const off = await k.purchased(s.id, [[a, 10, 100]]);
    ok(await ctx.sys.cancelPurchaseOrder(off.id), 'cancelPurchaseOrder');
    no(await k.deliver(off.id, [[a, 1]]), 'a delivery on a cancelled purchase order');
    assert.equal((await k.figures(a)).onHand, 0);
    assert.equal((await k.stock(a)).onOrder, 10);
  } },
  { id: 't14-10 goods can still come in without a purchase order', async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const p = await k.purchased(s.id, [[a, 10, 100]]);
    await k.receive(a, 4);
    const sa = await k.figures(a);
    assert.equal(sa.onHand, 4); assert.equal(sa.onOrder, 10);
    const same = await po(ctx, p.id);
    assert.equal(same.status, 'open'); assert.equal(got(same, a), 0);
  } },
  { id: 't14-11 a delivery serves the orders that wait', tags: ['HD-39'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.product();
    const first = await k.paid([[a, 3]]); const second = await k.paid([[a, 3]]);
    const p = await k.purchased(s.id, [[a, 10, 100]]);
    ok(await k.deliver(p.id, [[a, 4]]), 'receivePurchaseOrder');
    no(await k.ship(second.id), 'shipping the younger order first');
    ok(await k.ship(first.id), 'shipOrder');
    ok(await k.deliver(p.id, [[a, 6]]), 'receivePurchaseOrder');
    ok(await k.ship(second.id), 'shipOrder');
    const sa = await k.figures(a);
    assert.equal(sa.onHand, 4); assert.equal(sa.backordered, 0);
  } },
  { id: 't14-12 deliveries never leave more reserved than is there', tags: ['R2'], async run(ctx) {
    const k = kit(ctx); const s = await k.supplier(); const a = await k.stocked(2);
    ok(await k.order([[a, 9]]), 'placeOrder');
    const p = await k.purchased(s.id, [[a, 5, 100]]);
    await k.figures(a);
    ok(await k.deliver(p.id, [[a, 3]]), 'receivePurchaseOrder');
    let sa = await k.figures(a);
    assert.equal(sa.onHand, 5);
    ok(await k.deliver(p.id, [[a, 2]]), 'receivePurchaseOrder');
    sa = await k.figures(a);
    assert.equal(sa.onHand, 7); assert.ok(sa.reserved <= 7);
  } },
];
