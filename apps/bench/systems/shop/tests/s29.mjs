import { assert, ok, no, unavailable, kit, without } from './helpers.mjs';

const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
const sequences = (docs) => docs.map((d) => d.sequence).sort((x, y) => x - y);
// Marta's button: everything about a customer goes.
const remove = (ctx, id) => ctx.sys.removeCustomer(id);
const personal = (c, a) => [c.name, c.email, c.phone, ...(a ? [a.street, a.city, a.postalCode] : [])];
// What the books say about an order, without the person.
const facts = (o) => ({ status: o.status, subtotalCents: o.subtotalCents, totalCents: o.totalCents, taxCents: o.taxCents,
  lines: o.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPriceCents: l.unitPriceCents, taxPercent: l.taxPercent, taxCents: l.taxCents })) });
const amounts = (docs) => docs.map(({ buyerName, buyerEmail, buyerAddress, ...rest }) => rest);
const account = async (ctx, id) => ok(await ctx.sys.getCustomer(id), 'getCustomer');

export const tests = [
  { id: 't29-01 a removed customer is gone', tags: ['trap:R4:done'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(9, 1000);
    const sent = await k.shipped([[a, 2]], { customerId: c.id, shippingAddressId: home.id });
    const open = await k.placed([[a, 1]], { customerId: c.id, shippingAddressId: home.id });
    ok(await remove(ctx, c.id), 'removeCustomer');
    // Whatever the system still shows, the person is not in it.
    const shown = [await ctx.sys.getCustomer(c.id), await ctx.sys.listAddresses(c.id), await ctx.sys.listOrders({ customerEmail: c.email }), await ctx.sys.listCustomerOrders(c.id),
      await ctx.sys.getOrder(sent.id), await ctx.sys.getOrder(open.id), await ctx.sys.listOrderInvoices(sent.id)];
    for (const r of shown) if (r.ok) without(r.value, personal(c, home), 'what the system shows after the customer was removed');
    // A system that cannot list orders by e-mail address has nothing to find them by.
    const found = await ctx.sys.listOrders({ customerEmail: c.email });
    if (found.reason !== 'unsupported') assert.equal(ok(found, 'listOrders').length, 0, 'the orders are still found by the e-mail address');
    no(await k.order([[a, 1]], { customerId: c.id }), 'an order on the account of a removed customer');
    // The address is free: whoever opens an account with it is a new customer.
    const again = await k.customer({ name: 'Somebody New', email: c.email });
    assert.equal(ok(await ctx.sys.listCustomerOrders(again.id), 'listCustomerOrders').length, 0);
    assert.equal(await k.balance(again.id), 0);
  } },
  { id: 't29-02 the books still hold what the customer bought', tags: ['trap:R4:kept', 'R4'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id); const a = await k.taxed(9, 1230, 23);
    const to = { customerId: c.id, shippingAddressId: home.id };
    const kept = await k.shippedAt(k.noon(year, 2, 2), [[a, 2]], to);
    const back = await k.shippedAt(k.noon(year, 2, 2), [[a, 3]], to);
    ok(await k.retAt(k.noon(year, 2, 9), back.id, [[a, 1]]), 'returnItems');
    const orders = [await k.getOrder(kept.id), await k.getOrder(back.id)];
    const read = async () => ({
      orders: [facts(await k.getOrder(kept.id)), facts(await k.getOrder(back.id))],
      payments: [ok(await ctx.sys.listPayments(kept.id), 'listPayments'), ok(await ctx.sys.listPayments(back.id), 'listPayments')],
      returns: ok(await ctx.sys.listReturns(back.id), 'listReturns'),
      invoices: amounts([...await k.invoices(kept.id), ...await k.invoices(back.id)]),
      creditNotes: amounts(await k.creditNotes(back.id)),
      yearInvoices: amounts(await k.yearInvoices(year)), yearCreditNotes: amounts(await k.yearCreditNotes(year)),
      movements: await k.ledger(a),
      sold: await k.report(k.day(year, 2, 2)), credited: await k.report(k.day(year, 2, 9)),
    });
    const before = await read();
    assert.equal(before.invoices.length, 2); assert.equal(before.creditNotes.length, 1); assert.equal(orders.length, 2);
    // Whatever the system does with the request, the orders, payments, documents and stock records stay.
    await remove(ctx, c.id);
    const after = await read();
    for (const what of Object.keys(before)) assert.deepEqual(after[what], before[what], `R4: the ${what} of the customer's orders are not what they were`);
    assert.deepEqual(sequences(await k.yearInvoices(year)), [1, 2]);
  } },
  { id: 't29-03 removing one customer leaves the others as they are', async run(ctx) {
    const k = kit(ctx); const [c, other] = [await k.customer(), await k.customer()]; const home = await k.address(other.id); const a = await k.stocked(9, 1000);
    await k.shipped([[a, 1]], { customerId: c.id });
    const o = await k.shipped([[a, 2]], { customerId: other.id, shippingAddressId: home.id });
    const before = { account: await account(ctx, other.id), order: await k.getOrder(o.id), invoice: await k.invoice(o.id), points: await k.balance(other.id) };
    ok(await remove(ctx, c.id), 'removeCustomer');
    no(await remove(ctx, 'no-such-customer'), 'removing a customer that does not exist');
    assert.deepEqual({ account: await account(ctx, other.id), order: await k.getOrder(o.id), invoice: await k.invoice(o.id), points: await k.balance(other.id) }, before);
    assert.equal(ok(await ctx.sys.listAddresses(other.id), 'listAddresses').length, 1);
    ok(await k.order([[a, 1]], { customerId: other.id }), 'an order of the other customer');
  } },
  { id: 't29-04 an order that waits for payment is cancelled', tags: ['HD-163'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 1000);
    const waiting = await k.placed([[a, 3]], { customerId: c.id, pointsToSpend: 100 });
    assert.equal((await k.figures(a)).available, 2);
    no(await ctx.sys.eraseCustomer(c.id), 'erasing a customer with an open order');
    ok(await remove(ctx, c.id), 'removeCustomer');
    assert.equal((await k.getOrder(waiting.id)).status, 'cancelled');
    const stock = await k.figures(a);
    assert.equal(stock.available, 5); assert.equal(stock.reserved, 0);
    assert.equal(ctx.provider.refunds.length, 0);
    assert.equal((await k.getOrder(c.firstOrder.id)).status, 'shipped');
  } },
  { id: 't29-05 a paid order that has not gone out is called off and paid back', tags: ['HD-164'], async run(ctx) {
    const k = kit(ctx); const r = await k.route([[30000, 990]]); const a = await k.weighed(5, 1000, 300);
    const o = await k.paid([[a, 2]], r.to);
    const charge = await k.chargeOf(o.id);
    ok(await remove(ctx, r.c.id), 'removeCustomer');
    assert.equal(ctx.provider.refunds.length, 1);
    assert.equal(ctx.provider.refunds[0].amountCents, 2990); assert.equal(ctx.provider.refunds[0].chargeId, charge.chargeId);
    const after = await k.getOrder(o.id);
    assert.equal(after.status, 'cancelled'); assert.equal(after.totalCents, 2990);
    assert.equal((await k.figures(a)).available, 5);
    assert.equal((await k.invoices(o.id)).length, 0); assert.equal((await k.creditNotes(o.id)).length, 0);
    assert.ok(ok(await ctx.sys.listPayments(o.id), 'listPayments').some((p) => p.status === 'succeeded' && p.amountCents === 2990), 'the payment of the order is no longer on record');
    assert.equal((await account(ctx, r.c.id)).erased, true);
  } },
  { id: 't29-06 an order that is partly on its way stops the removal', tags: ['HD-165'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000); const late = await k.product(700);
    const o = await k.paid([[a, 1], [late, 1]], { customerId: c.id });
    ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    const waiting = await k.placed([[a, 1]], { customerId: c.id });
    no(await remove(ctx, c.id), 'removing a customer with an order that is partly sent');
    const still = await account(ctx, c.id);
    assert.equal(still.name, c.name); assert.equal(still.erased, false);
    assert.equal((await k.getOrder(waiting.id)).status, 'pending'); assert.equal((await k.getOrder(o.id)).status, 'paid');
    assert.equal(ctx.provider.refunds.length, 0);
    await k.receive(late, 1);
    ok(await k.part(o.id, 'MAIN'), 'shipOrderPart');
    ok(await remove(ctx, c.id), 'removeCustomer');
    assert.equal((await k.getOrder(o.id)).status, 'shipped'); assert.equal((await k.getOrder(waiting.id)).status, 'cancelled');
  } },
  { id: 't29-07 when the refund fails the customer is still there', tags: ['HD-166'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000);
    const o = await k.paid([[a, 2]], { customerId: c.id });
    ctx.provider.refundMode = 'fail';
    unavailable(await remove(ctx, c.id), 'removing a customer while the provider is down');
    const still = await account(ctx, c.id);
    assert.equal(still.name, c.name); assert.equal(still.email, c.email); assert.equal(still.erased, false);
    assert.equal((await k.getOrder(o.id)).status, 'paid'); assert.equal((await k.figures(a)).reserved, 2);
    ctx.provider.refundMode = 'succeed';
    ok(await remove(ctx, c.id), 'removeCustomer');
    assert.equal((await k.getOrder(o.id)).status, 'cancelled');
    assert.equal(sum(ctx.provider.refunds, (r) => r.amountCents), 2000);
  } },
  { id: 't29-08 the account stays as an empty record', tags: ['HD-167'], async run(ctx) {
    const k = kit(ctx); const group = await k.group(); const c = await k.member(group.id); const home = await k.address(c.id); const a = await k.stocked(9, 1000);
    const o = await k.shipped([[a, 1]], { customerId: c.id, shippingAddressId: home.id });
    ok(await remove(ctx, c.id), 'removeCustomer');
    const gone = await account(ctx, c.id);
    assert.equal(gone.erased, true); assert.equal(gone.name, null); assert.equal(gone.email, null); assert.equal(gone.phone, null); assert.equal(gone.groupId, null);
    assert.equal(ok(await ctx.sys.listAddresses(c.id), 'listAddresses').length, 0);
    const orders = ok(await ctx.sys.listCustomerOrders(c.id), 'listCustomerOrders');
    assert.equal(orders.length, 1);
    assert.equal(orders[0].id, o.id); assert.equal(orders[0].customerEmail, null); assert.equal(orders[0].shippingAddress, null);
    ok(await remove(ctx, c.id), 'removing a second time');
    // A customer who was erased before can be removed; nothing changes.
    const d = await k.customer();
    ok(await ctx.sys.eraseCustomer(d.id), 'eraseCustomer');
    ok(await remove(ctx, d.id), 'removing an erased customer');
    assert.equal((await account(ctx, d.id)).erased, true);
  } },
  { id: 't29-09 invoices and credit notes lose the buyer and nothing else', tags: ['R9', 'R4'], async run(ctx) {
    const k = kit(ctx); const year = k.year(); const c = await k.customer(); const home = await k.address(c.id); const a = await k.taxed(9, 1230, 23);
    const o = await k.shippedAt(k.noon(year, 4, 4), [[a, 3]], { customerId: c.id, shippingAddressId: home.id });
    ok(await k.retAt(k.noon(year, 4, 9), o.id, [[a, 1]]), 'returnItems');
    await k.shippedAt(k.noon(year, 4, 10), [[a, 1]]);
    const [invoice, note] = [await k.invoice(o.id), (await k.creditNotes(o.id))[0]];
    assert.equal(invoice.buyerName, c.name);
    ok(await remove(ctx, c.id), 'removeCustomer');
    const [after, noteAfter] = [await k.invoice(o.id), (await k.creditNotes(o.id))[0]];
    assert.equal(after.buyerName, null); assert.equal(after.buyerEmail, null); assert.equal(after.buyerAddress, null);
    without([after, noteAfter, await k.yearInvoices(year), await k.yearCreditNotes(year)], personal(c, home), 'the documents');
    assert.deepEqual(amounts([after, noteAfter]), amounts([invoice, note]), 'R9: removing the customer changed more than the buyer on the documents');
    assert.deepEqual(sequences(await k.yearInvoices(year)), [1, 2], 'R9: an invoice number is missing');
    assert.deepEqual(sequences(await k.yearCreditNotes(year)), [1]);
  } },
  { id: 't29-10 the points of a removed customer are written off by a record', tags: ['R5', 'HD-62', 'HD-163'], async run(ctx) {
    const k = kit(ctx); const c = await k.collector(); const a = await k.stocked(5, 1000);
    await k.placed([[a, 2]], { customerId: c.id, pointsToSpend: 100 });
    const before = await k.points(c.id);
    assert.equal(before.balance, 900);
    ok(await remove(ctx, c.id), 'removeCustomer');
    const { balance, history } = await k.points(c.id);
    assert.equal(balance, 0);
    assert.deepEqual(history.slice(0, before.history.length), before.history, 'R5: the points history was rewritten');
    assert.equal(history.at(-1).points, -1000);
    assert.equal(history.length, before.history.length + 2);
  } },
  { id: 't29-11 goods of a removed customer can still come back', tags: ['HD-64'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(5, 1000);
    const o = await k.shipped([[a, 2]], { customerId: c.id, shippingAddressId: home.id });
    ok(await remove(ctx, c.id), 'removeCustomer');
    const made = ok(await k.ret(o.id, [[a, 2]]), 'returnItems');
    assert.equal(made.refundCents, 2000); assert.equal(ctx.provider.refunds.at(-1).amountCents, 2000);
    assert.equal((await k.getOrder(o.id)).status, 'returned');
    assert.equal((await k.figures(a)).onHand, 5);
    without(await k.creditNotes(o.id), personal(c, home), 'the credit note of a return after the customer was removed');
    assert.equal(await k.balance(c.id), 0);
  } },
];
