import { assert, ok, no, kit, names, forOrder, without } from './helpers.mjs';

const history = async (ctx, id) => ok(await ctx.sys.listPointsHistory(id), 'listPointsHistory');
const personal = (c, a) => [c.name, c.email, c.phone, ...(a ? [a.street, a.city, a.postalCode] : [])];
// A customer with an address and one order that was paid and sent there.
async function served(k, cents = 100000) {
  const c = await k.customer(); const home = await k.address(c.id); const sku = await k.stocked(3, cents);
  const order = await k.shipped([[sku, 2]], { customerId: c.id, shippingAddressId: home.id });
  return { c, home, sku, order };
}
const erase = async (ctx, id) => ok(await ctx.sys.eraseCustomer(id), 'eraseCustomer');

export const tests = [
  { id: 't12-01 a blocked customer cannot order', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    ok(await k.order([[a, 1]], { customerId: c.id }), 'placeOrder');
    assert.equal(ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer').blocked, true);
    assert.equal(ok(await ctx.sys.getCustomer(c.id), 'getCustomer').blocked, true);
    no(await k.order([[a, 1]], { customerId: c.id }), 'an order of a blocked customer');
    assert.equal((await k.figures(a)).reserved, 1);
    no(await ctx.sys.blockCustomer('no-such-customer'), 'blocking an unknown customer');
  } },
  { id: 't12-02 a customer can be unblocked', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    assert.equal(ok(await ctx.sys.getCustomer(c.id), 'getCustomer').blocked, false);
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    assert.equal(ok(await ctx.sys.unblockCustomer(c.id), 'unblockCustomer').blocked, false);
    ok(await k.order([[a, 1]], { customerId: c.id }), 'an order after unblocking');
    const other = await k.customer();
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    ok(await k.order([[a, 1]], { customerId: other.id }), 'an order of another customer');
  } },
  { id: 't12-03 a block also holds for the e-mail address', tags: ['HD-57'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    no(await k.order([[a, 1]], { customerEmail: c.email }), 'an order without the account, with the blocked address');
    no(await k.order([[a, 1]], { customerEmail: c.email.toUpperCase() }), 'the same in upper case');
    assert.equal((await k.figures(a)).reserved, 0);
    ok(await ctx.sys.unblockCustomer(c.id), 'unblockCustomer');
    ok(await k.order([[a, 1]], { customerEmail: c.email }), 'placeOrder');
  } },
  { id: 't12-04 the orders a blocked customer already has go on', tags: ['HD-58'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5, 1000);
    const waiting = await k.placed([[a, 1]], { customerId: c.id });
    const sent = await k.shipped([[a, 2]], { customerId: c.id });
    const points = await k.balance(c.id);
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    assert.equal(await k.balance(c.id), points);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(waiting.id), 'payOrder').status, 'succeeded');
    ok(await k.ship(waiting.id), 'shipOrder');
    ok(await k.ret(sent.id, [[a, 1]]), 'returnItems');
    assert.equal(ok(await ctx.sys.listCustomerOrders(c.id), 'listCustomerOrders').length, 2);
  } },
  { id: 't12-05 blocking twice changes nothing', tags: ['HD-59'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer();
    ok(await ctx.sys.unblockCustomer(c.id), 'unblocking a customer who is not blocked');
    ok(await ctx.sys.blockCustomer(c.id), 'blockCustomer');
    assert.equal(ok(await ctx.sys.blockCustomer(c.id), 'blocking a second time').blocked, true);
    assert.equal(ok(await ctx.sys.unblockCustomer(c.id), 'unblockCustomer').blocked, false);
  } },
  { id: 't12-06 erasing takes the person out of the system', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(5);
    await erase(ctx, c.id);
    const account = await ctx.sys.getCustomer(c.id);
    if (account.ok) without(account.value, personal(c), 'the account');
    const addresses = await ctx.sys.listAddresses(c.id);
    if (addresses.ok) without(addresses.value, personal(c, home), 'the list of addresses');
    no(await k.order([[a, 1]], { customerId: c.id }), 'an order on an erased account');
    no(await ctx.sys.eraseCustomer('no-such-customer'), 'erasing an unknown customer');
  } },
  { id: 't12-07 orders and payments of an erased customer stay', tags: ['R4'], async run(ctx) {
    const k = kit(ctx); const { c, home, sku, order } = await served(k, 1250);
    const payments = ok(await ctx.sys.listPayments(order.id), 'listPayments');
    await erase(ctx, c.id);
    const kept = ok(await ctx.sys.getOrder(order.id), 'reading the order of an erased customer');
    assert.equal(kept.status, 'shipped'); assert.equal(kept.totalCents, 2500); assert.equal(kept.createdAt, order.createdAt);
    assert.deepEqual(kept.lines.map((l) => [l.sku, l.quantity, l.unitPriceCents]), [[sku, 2, 1250]]);
    assert.deepEqual(ok(await ctx.sys.listPayments(order.id), 'listPayments'), payments);
    assert.equal(payments.find((p) => p.status === 'succeeded').amountCents, 2500);
    without(kept, personal(c, home), 'the order');
  } },
  { id: 't12-08 an erased customer\'s orders cannot be found by their address', tags: ['R4'], async run(ctx) {
    const k = kit(ctx); const { c, order } = await served(k);
    await erase(ctx, c.id);
    const found = await ctx.sys.listOrders({ customerEmail: c.email });
    if (found.ok) assert.equal(found.value.length, 0, 'the e-mail address still leads to orders');
    ok(await ctx.sys.getOrder(order.id), 'reading the order by its id');
  } },
  { id: 't12-09 the stock history of an erased customer\'s orders stays', tags: ['R4', 'R1'], async run(ctx) {
    const k = kit(ctx); const { c, sku, order } = await served(k);
    const before = await k.ledger(sku);
    await erase(ctx, c.id);
    const after = await k.ledger(sku);
    assert.deepEqual(after, before);
    forOrder(after.find((m) => m.kind === 'shipment'), order);
  } },
  { id: 't12-10 a customer with unfinished orders is not erased', tags: ['HD-60'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    const waiting = await k.placed([[a, 1]], { customerId: c.id });
    no(await ctx.sys.eraseCustomer(c.id), 'erasing a customer with an order waiting for payment');
    ctx.provider.mode = 'succeed';
    ok(await k.pay(waiting.id), 'payOrder');
    no(await ctx.sys.eraseCustomer(c.id), 'erasing a customer with a paid order that has not been sent');
    assert.equal(ok(await ctx.sys.getCustomer(c.id), 'getCustomer').email, c.email);
    ok(await k.ship(waiting.id), 'shipOrder');
    const dropped = await k.placed([[a, 1]], { customerId: c.id });
    ok(await k.cancel(dropped.id), 'cancelOrder');
    await erase(ctx, c.id);
  } },
  { id: 't12-11 the empty account stays', tags: ['HD-61'], async run(ctx) {
    const k = kit(ctx); const { c, order } = await served(k);
    await erase(ctx, c.id);
    const shell = ok(await ctx.sys.getCustomer(c.id), 'reading an erased account');
    assert.equal(shell.erased, true); assert.equal(shell.name, null); assert.equal(shell.email, null); assert.equal(shell.phone, null);
    assert.equal(ok(await ctx.sys.listAddresses(c.id), 'listAddresses').length, 0);
    assert.ok(names((await k.getOrder(order.id)).customerId, c.id), 'the order no longer says which account it was on');
    ok(await ctx.sys.eraseCustomer(c.id), 'erasing a second time');
    no(await ctx.sys.updateCustomer(c.id, { name: 'Back Again' }), 'changing an erased account');
    no(await ctx.sys.addAddress(c.id, k.place()), 'an address on an erased account');
    const live = await k.customer();
    assert.equal(ok(await ctx.sys.getCustomer(live.id), 'getCustomer').erased, false);
  } },
  { id: 't12-12 the points of an erased customer are written off, on record', tags: ['HD-62', 'R5'], async run(ctx) {
    const k = kit(ctx); const { c } = await served(k);
    const before = await k.points(c.id);
    assert.ok(before.balance > 0);
    await erase(ctx, c.id);
    const after = await k.points(c.id);
    assert.equal(after.balance, 0);
    assert.equal(after.history.length, before.history.length + 1);
    assert.equal(after.history.filter((e) => e.points === -before.balance).length, 1);
    for (const e of before.history) assert.ok(after.history.some((x) => x.points === e.points && x.reference === e.reference), 'an earlier entry is gone');
  } },
  { id: 't12-13 the e-mail address is free again', tags: ['HD-63'], async run(ctx) {
    const k = kit(ctx); const { c, sku } = await served(k);
    await erase(ctx, c.id);
    const again = await k.customer({ name: c.name, email: c.email, phone: c.phone });
    assert.notEqual(again.id, c.id);
    assert.equal(ok(await ctx.sys.listCustomerOrders(again.id), 'listCustomerOrders').length, 0);
    assert.equal(await k.balance(again.id), 0);
    await k.receive(sku, 1);
    ok(await k.order([[sku, 1]], { customerId: again.id }), 'an order on the new account');
  } },
  { id: 't12-14 goods of an erased customer can still come back', tags: ['HD-64', 'R4'], async run(ctx) {
    const k = kit(ctx); const { c, sku, order } = await served(k, 1250);
    const charge = await k.chargeOf(order.id);
    await erase(ctx, c.id);
    const r = ok(await k.ret(order.id, [[sku, 1]]), 'a return on the order of an erased customer');
    assert.equal(r.refundCents, 1250);
    assert.equal(ctx.provider.refunds.at(-1).chargeId, charge.chargeId);
    assert.equal(ok(await ctx.sys.listReturns(order.id), 'listReturns').length, 1);
    assert.equal((await k.points(c.id)).balance, 0);
    await k.ledger(sku);
  } },
];
