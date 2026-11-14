import { assert, ok, no, kit, names } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const bySequence = (docs) => [...docs].sort((x, y) => x.sequence - y.sequence);
const content = (shipment) => shipment.lines.map((l) => [l.sku, l.quantity]).sort();
// Two products that can only be reserved in different warehouses: `a` is kept in MAIN, `b` in `w`.
async function apart(k, priceA = 1000, priceB = 450) {
  const w = await k.warehouse(); const a = await k.stocked(5, priceA); const b = await k.stocked(5, priceB, w);
  return { w, a, b };
}
const shipmentMoves = async (k, sku) => (await k.movements(sku)).filter((m) => m.kind === 'shipment');

export const tests = [
  { id: 't26-01 an order in two warehouses goes out in two shipments', async run(ctx) {
    const k = kit(ctx); const { w, a, b } = await apart(k);
    const o = await k.paid([[a, 2], [b, 3]]);
    assert.equal((await k.shipments(o.id)).length, 0, 'an order has a shipment before anything was sent');
    ok(await k.ship(o.id), 'shipOrder');
    const all = await k.shipments(o.id);
    assert.equal(all.length, 2);
    const [main, other] = [all.find((s) => s.warehouse === 'MAIN'), all.find((s) => s.warehouse === w)];
    assert.ok(main && other, 'there is not one shipment for each warehouse');
    assert.deepEqual(content(main), [[a, 2]]); assert.deepEqual(content(other), [[b, 3]]);
    assert.notEqual(main.id, other.id);
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
  } },
  { id: 't26-02 what is on the shelf goes out while the rest is waited for', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const late = await k.product(700);
    const o = await k.paid([[a, 2], [late, 1]]);
    const first = ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    assert.equal(first.warehouse, 'MAIN'); assert.deepEqual(content(first), [[a, 2]]);
    assert.equal((await k.figures(a)).onHand, 3);
    assert.equal((await k.getOrder(o.id)).status, 'paid');
    await k.receive(late, 1);
    const second = ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    assert.deepEqual(content(second), [[late, 1]]);
    assert.equal((await k.getOrder(o.id)).status, 'shipped');
    assert.deepEqual((await k.shipments(o.id)).map((s) => s.id).sort(), [first.id, second.id].sort());
  } },
  { id: 't26-03 an order in one warehouse still goes out in one shipment', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const b = await k.stocked(5, 450);
    const o = await k.shipped([[a, 2], [b, 1]]);
    const all = await k.shipments(o.id);
    assert.equal(all.length, 1);
    assert.equal(all[0].warehouse, 'MAIN'); assert.deepEqual(content(all[0]), [[a, 2], [b, 1]].sort());
    assert.equal(o.status, 'shipped');
    await k.invoice(o.id);
    no(await ctx.sys.listShipments('no-such-order'), 'the shipments of an order that does not exist');
  } },
  { id: 't26-04 a shipment holds only what is reserved in its warehouse', tags: ['R10', 'R2'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.product(1000);
    await k.receive(a, 2); await k.receive(a, 3, w);
    // Six units ordered, five on the shelves of two warehouses, one waited for.
    const o = await k.paid([[a, 6]]);
    const reserved = o.lines[0].allocations;
    assert.equal(sum(reserved, (x) => x.quantity), 5); assert.equal(o.lines[0].backorderedQuantity, 1);
    for (const at of reserved) {
      const others = (await k.figures(a)).warehouses.filter((x) => x.warehouse !== at.warehouse).map((x) => [x.warehouse, x.onHand, x.reserved]);
      const s = ok(await k.part(o.id, at.warehouse), 'shipOrderPart');
      assert.equal(s.warehouse, at.warehouse);
      assert.deepEqual(content(s), [[a, at.quantity]], 'R10: the shipment is not what was reserved in its warehouse');
      const now = await k.figures(a);
      assert.equal(k.wh(now, at.warehouse).onHand, 0); assert.equal(k.wh(now, at.warehouse).reserved, 0);
      assert.deepEqual(now.warehouses.filter((x) => x.warehouse !== at.warehouse).map((x) => [x.warehouse, x.onHand, x.reserved]), others, 'R10: a shipment touched another warehouse');
      // Nothing is left for the order there: a second shipment from it has nothing to take.
      no(await k.part(o.id, at.warehouse), 'a second shipment from a warehouse that has nothing reserved');
    }
    const after = await k.getOrder(o.id);
    assert.equal(after.status, 'paid'); assert.equal(after.lines[0].backorderedQuantity, 1); assert.equal(after.lines[0].shippedQuantity, 5);
    assert.equal(sum(await k.shipments(o.id), (s) => sum(s.lines, (l) => l.quantity)), 5, 'R10: more went out than was reserved');
  } },
  { id: 't26-05 every shipment is on the stock record of its warehouse', tags: ['R10', 'R1'], async run(ctx) {
    const k = kit(ctx); const w = await k.warehouse(); const a = await k.product(1000); const b = await k.stocked(4, 450, w);
    await k.receive(a, 4); await k.receive(a, 4, w);
    const o = await k.paid([[a, 6], [b, 2]]);
    ok(await k.ship(o.id), 'shipOrder');
    const all = await k.shipments(o.id);
    for (const sku of [a, b]) {
      const moves = await shipmentMoves(k, sku);
      for (const m of moves) assert.ok(names(m.reference, o.id), 'a shipment movement does not name the order');
      const line = o.lines.find((l) => l.sku === sku);
      for (const at of line.allocations) {
        const sent = sum(all.filter((s) => s.warehouse === at.warehouse), (s) => sum(s.lines.filter((l) => l.sku === sku), (l) => l.quantity));
        assert.equal(sent, at.quantity, `R10: ${sent} units of a product left ${at.warehouse}, ${at.quantity} were reserved there`);
        assert.equal(sum(moves.filter((m) => m.warehouse === at.warehouse), (m) => m.quantity), -at.quantity, 'R10: the stock record of the warehouse does not show what its shipment says');
      }
      assert.equal(sum(moves, (m) => m.quantity), -line.quantity);
      await k.ledger(sku); await k.figures(sku);
    }
    for (const s of all) assert.ok(s.lines.length > 0 && s.lines.every((l) => l.quantity > 0), 'an empty shipment');
  } },
  { id: 't26-06 an order is shipped when all of it has gone out', tags: ['HD-143'], async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 1000); const late = await k.product(700);
    const o = await k.paid([[a, 2], [late, 3]]);
    await k.receive(late, 1);
    no(await k.ship(o.id), 'sending the whole order while units are waited for');
    ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    const partly = await k.getOrder(o.id);
    assert.equal(partly.status, 'paid');
    assert.equal(partly.lines.find((l) => l.sku === a).shippedQuantity, 2); assert.equal(partly.lines.find((l) => l.sku === late).shippedQuantity, 1);
    no(await k.ret(o.id, [[a, 1]]), 'a return of an order that has not gone out completely');
    no(await k.ship(o.id), 'sending the whole order while units are waited for');
    await k.receive(late, 2);
    ok(await k.ship(o.id), 'sending the rest of the order');
    const done = await k.getOrder(o.id);
    assert.equal(done.status, 'shipped'); assert.equal(done.lines.find((l) => l.sku === late).shippedQuantity, 3);
    assert.equal((await k.shipments(o.id)).length, 2);
    ok(await k.ret(o.id, [[a, 1]]), 'returnItems');
    // An order that has not been sent shows nothing sent.
    assert.equal((await k.paid([[a, 1]])).lines[0].shippedQuantity, 0);
  } },
  { id: 't26-07 every shipment has its invoice for what is in it', tags: ['HD-144'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const { a, b } = await apart(k);
    const o = await k.paid([[a, 2], [b, 3]]);
    ok(await ctx.sys.shipOrder(o.id, { at: k.noon(year, 5, 5) }), 'shipOrder');
    const invoices = await k.invoices(o.id); const all = await k.shipments(o.id);
    assert.equal(invoices.length, 2);
    for (const s of all) {
      const own = invoices.filter((i) => names(s.invoiceId, i.id));
      assert.equal(own.length, 1, 'a shipment does not name its invoice');
      assert.deepEqual(own[0].lines.map((l) => [l.sku, l.quantity]).sort(), content(s));
      assert.equal(own[0].issuedOn, k.day(year, 5, 5));
      assert.equal(own[0].totalCents, s.lines[0].sku === a ? 2000 : 1350);
    }
    assert.notEqual(all[0].invoiceId, all[1].invoiceId);
    assert.deepEqual(bySequence(await k.yearInvoices(year)).map((i) => i.sequence), [1, 2]);
  } },
  { id: 't26-08 the invoices of an order add up to the order', tags: ['HD-145', 'R7'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const a = await k.taxed(1, 999, 20); const b = await k.taxed(9, 1230, 23);
    // 29.97 in one line at 20 %: 5.00 of tax on the order, sent one unit at a time.
    const o = await k.paid([[a, 3], [b, 1]]);
    assert.equal(o.taxCents, 730);
    for (const day of [1, 2, 3]) {
      if (day > 1) await k.receive(a, 1);
      ok(await k.part(o.id, 'MAIN', k.noon(year, 6, day)), 'shipOrderPart');
    }
    const invoices = bySequence(await k.invoices(o.id));
    assert.equal(invoices.length, 3);
    const line = (i) => i.lines.find((l) => l.sku === a);
    assert.deepEqual(invoices.map((i) => line(i).quantity), [1, 1, 1]);
    assert.deepEqual(invoices.map((i) => line(i).totalCents), [999, 999, 999]);
    assert.deepEqual(invoices.map((i) => line(i).taxCents), [167, 167, 166]);
    assert.deepEqual(invoices.map((i) => i.totalCents), [2229, 999, 999]);
    for (const i of invoices) { assert.equal(sum(i.lines, (l) => l.totalCents), i.totalCents); assert.equal(sum(i.lines, (l) => l.taxCents), i.taxCents); }
    assert.equal(sum(invoices, (i) => i.totalCents), o.totalCents, 'the invoices do not add up to the order');
    assert.equal(sum(invoices, (i) => i.taxCents), o.taxCents, 'the tax of the invoices does not add up to the tax of the order');
    assert.equal(await k.charged(o.id), sum(invoices, (i) => i.totalCents));
  } },
  { id: 't26-09 the shipping cost is on the first invoice', tags: ['HD-146'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const r = await k.route([[30000, 990]]); const { a, b } = await apart(k);
    const o = await k.paid([[a, 1], [b, 1]], r.to);
    assert.equal(o.totalCents, 2440);
    ok(await ctx.sys.shipOrder(o.id, { at: k.noon(year, 7, 7) }), 'shipOrder');
    const [first, second] = bySequence(await k.invoices(o.id));
    assert.equal(first.shippingCents, 990); assert.equal(second.shippingCents, 0); assert.equal(second.shippingTaxCents, 0);
    assert.equal(first.totalCents, sum(first.lines, (l) => l.totalCents) + 990);
    assert.equal(second.totalCents, sum(second.lines, (l) => l.totalCents));
    assert.equal(first.totalCents + second.totalCents, o.totalCents); assert.equal(first.taxCents + second.taxCents, o.taxCents);
  } },
  { id: 't26-10 a return is credited against the invoice its goods were on', tags: ['HD-147'], async run(ctx) {
    const k = kit(ctx); const mug = await k.taxed(5, 1230, 23); const w = await k.warehouse(); const code = await k.category(5);
    const tea = k.sku(); ok(await ctx.sys.createProduct({ sku: tea, name: 'Tea', priceCents: 2100, category: code }), 'createProduct'); await k.receive(tea, 5, w);
    const o = await k.paid([[mug, 2], [tea, 2]]);
    ok(await k.ship(o.id), 'shipOrder');
    const invoices = await k.invoices(o.id);
    const of = (sku) => invoices.find((i) => i.lines.some((l) => l.sku === sku));
    assert.notEqual(of(mug).id, of(tea).id);
    const made = ok(await k.ret(o.id, [[mug, 1], [tea, 2]]), 'returnItems');
    const notes = await k.creditNotes(o.id);
    assert.equal(notes.length, 2, 'a return of goods from two invoices did not make two credit notes');
    const [nm, nt] = [notes.find((n) => n.lines.some((l) => l.sku === mug)), notes.find((n) => n.lines.some((l) => l.sku === tea))];
    assert.ok(names(nm.invoiceId, of(mug).id) && names(nt.invoiceId, of(tea).id), 'a credit note is not against the invoice its goods were on');
    assert.deepEqual(nm.lines.map((l) => [l.sku, l.quantity]), [[mug, 1]]); assert.deepEqual(nt.lines.map((l) => [l.sku, l.quantity]), [[tea, 2]]);
    assert.equal(nm.totalCents, 1230); assert.equal(nm.taxCents, 230); assert.equal(nt.totalCents, 4200); assert.equal(nt.taxCents, 200);
    assert.equal(nm.totalCents + nt.totalCents, made.refundCents);
    assert.notEqual(nm.number, nt.number);
    // A return of goods of one invoice: one credit note. Then the order is returned and everything adds up.
    ok(await k.ret(o.id, [[mug, 1]]), 'returnItems');
    const all = await k.creditNotes(o.id);
    assert.equal(all.length, 3);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal(sum(all, (n) => n.totalCents), sum(invoices, (i) => i.totalCents)); assert.equal(sum(all, (n) => n.taxCents), sum(invoices, (i) => i.taxCents));
  } },
  { id: 't26-11 a part that cannot go out uses no invoice number', tags: ['HD-148', 'R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const w = await k.warehouse(); const a = await k.stocked(9, 1000);
    await k.shippedAt(k.noon(year, 2, 1), [[a, 1]]);
    const o = await k.paid([[a, 2]]); const unpaid = await k.placed([[a, 1]]);
    no(await k.part(o.id, w, k.noon(year, 2, 2)), 'a shipment from a warehouse that holds nothing of the order');
    no(await k.part(o.id, 'NOSUCH', k.noon(year, 2, 2)), 'a shipment from a warehouse that does not exist');
    no(await k.part(unpaid.id, 'MAIN', k.noon(year, 2, 2)), 'a shipment of an order that is not paid');
    no(await k.part('no-such-order', 'MAIN', k.noon(year, 2, 2)), 'a shipment of an order that does not exist');
    assert.equal((await k.shipments(o.id)).length, 0); assert.equal((await k.invoices(o.id)).length, 0);
    assert.equal((await k.figures(a)).reserved, 3);
    ok(await k.part(o.id, 'MAIN', k.noon(year, 2, 3)), 'shipOrderPart');
    assert.equal((await k.invoice(o.id)).sequence, 2);
    assert.deepEqual(bySequence(await k.yearInvoices(year)).map((i) => i.sequence), [1, 2]);
  } },
  { id: 't26-12 a later shipment leaves the earlier invoice as it was', tags: ['R9'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id);
    const a = await k.taxed(5, 1230, 23); const late = await k.product(700);
    const o = await k.paid([[a, 2], [late, 2]], { customerId: c.id, shippingAddressId: home.id });
    ok(await k.part(o.id, 'MAIN', k.noon(year, 9, 1)), 'shipOrderPart');
    const issued = (await k.invoices(o.id))[0];
    assert.equal(issued.totalCents, 2460);
    await k.receive(late, 2);
    ok(await k.part(o.id, 'MAIN', k.noon(year, 9, 20)), 'shipOrderPart');
    const now = await k.invoices(o.id);
    assert.equal(now.length, 2);
    assert.deepEqual(now.find((i) => i.id === issued.id), issued, 'R9: a later shipment changed the invoice of an earlier one');
    assert.deepEqual(ok(await ctx.sys.getInvoice(issued.id), 'getInvoice'), issued);
    assert.deepEqual(bySequence(await k.yearInvoices(year)).map((i) => i.sequence), [1, 2]);
  } },
];
