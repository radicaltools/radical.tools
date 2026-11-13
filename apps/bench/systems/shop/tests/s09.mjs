import { assert, ok, no, kit, names, sleep } from './helpers.mjs';

const idSet = (list) => new Set(list.map((o) => o.id));
const sameAddress = (shown, a) => assert.deepEqual([shown?.street, shown?.city, shown?.postalCode, shown?.country], [a.street, a.city, a.postalCode, a.country]);

export const tests = [
  { id: 't9-01 a customer account is kept and can be changed', async run(ctx) {
    const k = kit(ctx); const data = k.person();
    const c = ok(await ctx.sys.createCustomer(data), 'createCustomer');
    assert.equal(typeof c.id, 'string');
    assert.deepEqual([c.name, c.email, c.phone], [data.name, data.email, data.phone]);
    const changed = ok(await ctx.sys.updateCustomer(c.id, { name: 'Anna Nowak-Lis' }), 'updateCustomer');
    assert.equal(changed.name, 'Anna Nowak-Lis');
    const read = ok(await ctx.sys.getCustomer(c.id), 'getCustomer');
    assert.deepEqual([read.name, read.email, read.phone], ['Anna Nowak-Lis', data.email, data.phone]);
    no(await ctx.sys.getCustomer('no-such-customer'), 'reading an unknown customer');
  } },
  { id: 't9-02 an account needs a real e-mail address', async run(ctx) {
    const k = kit(ctx);
    no(await ctx.sys.createCustomer({ ...k.person(), email: 'not-an-email' }), 'an account without a real address');
    const c = await k.customer();
    no(await ctx.sys.updateCustomer(c.id, { email: 'still not one' }), 'changing the address to nonsense');
    assert.equal(ok(await ctx.sys.getCustomer(c.id), 'getCustomer').email, c.email);
  } },
  { id: 't9-03 one account per e-mail address', tags: ['HD-40'], async run(ctx) {
    const k = kit(ctx); const a = await k.customer(); const b = await k.customer();
    no(await ctx.sys.createCustomer({ ...k.person(), email: a.email }), 'a second account with the same address');
    no(await ctx.sys.createCustomer({ ...k.person(), email: a.email.toUpperCase() }), 'a second account with the same address in upper case');
    no(await ctx.sys.updateCustomer(b.id, { email: a.email }), 'changing an account to an address that is taken');
    ok(await ctx.sys.updateCustomer(a.id, { email: a.email }), 'keeping the own address');
  } },
  { id: 't9-04 addresses are kept on the account', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const other = await k.customer();
    const home = await k.address(c.id); const work = await k.address(c.id);
    assert.notEqual(home.id, work.id);
    const list = ok(await ctx.sys.listAddresses(c.id), 'listAddresses');
    assert.deepEqual(idSet(list), new Set([home.id, work.id]));
    sameAddress(list.find((a) => a.id === work.id), work); sameAddress(list.find((a) => a.id === home.id), home);
    assert.equal(ok(await ctx.sys.listAddresses(other.id), 'listAddresses').length, 0);
    ok(await ctx.sys.removeAddress(c.id, home.id), 'removeAddress');
    assert.deepEqual(idSet(ok(await ctx.sys.listAddresses(c.id), 'listAddresses')), new Set([work.id]));
  } },
  { id: 't9-05 what an address needs', tags: ['HD-43'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer();
    for (const field of ['street', 'city', 'postalCode', 'country']) {
      const a = k.place(); delete a[field];
      no(await ctx.sys.addAddress(c.id, a), `an address without ${field}`);
    }
    no(await ctx.sys.addAddress(c.id, { ...k.place(), country: 'Poland' }), 'a country written out');
    no(await ctx.sys.addAddress(c.id, { ...k.place(), country: 'pl' }), 'a country code in lower case');
    ok(await ctx.sys.addAddress(c.id, { ...k.place(), country: 'DE' }), 'addAddress');
    assert.equal(ok(await ctx.sys.listAddresses(c.id), 'listAddresses').length, 1);
  } },
  { id: 't9-06 an order on an account', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(5, 700);
    const o = await k.placed([[a, 2]], { customerId: c.id, shippingAddressId: home.id });
    assert.ok(names(o.customerId, c.id), `the order's customer ${JSON.stringify(o.customerId)} does not name the account`);
    sameAddress(o.shippingAddress, home);
    assert.equal(o.status, 'pending'); assert.equal(o.totalCents, 1400);
    assert.equal((await k.figures(a)).reserved, 2);
    ctx.provider.mode = 'succeed';
    assert.equal(ok(await k.pay(o.id), 'payOrder').status, 'succeeded');
    ok(await k.ship(o.id), 'shipOrder');
    const read = await k.getOrder(o.id);
    assert.equal(read.status, 'shipped'); assert.ok(names(read.customerId, c.id)); sameAddress(read.shippingAddress, home);
  } },
  { id: 't9-07 an order on an account carries the account\'s e-mail address', tags: ['HD-41'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    const first = await k.placed([[a, 1]], { customerId: c.id });
    assert.equal(first.customerEmail, c.email);
    const moved = k.person().email;
    ok(await ctx.sys.updateCustomer(c.id, { email: moved }), 'updateCustomer');
    assert.equal((await k.placed([[a, 1]], { customerId: c.id })).customerEmail, moved);
    assert.equal((await k.getOrder(first.id)).customerEmail, c.email);
  } },
  { id: 't9-08 the history of a customer shows their orders', async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const other = await k.customer(); const a = await k.stocked(20);
    const o1 = await k.placed([[a, 1]], { customerId: c.id });
    const o2 = await k.shipped([[a, 2]], { customerId: c.id });
    const o3 = await k.placed([[a, 1]], { customerId: c.id });
    ok(await k.cancel(o3.id), 'cancelOrder');
    const foreign = await k.placed([[a, 1]], { customerId: other.id });
    await k.placed([[a, 1]]);
    const list = ok(await ctx.sys.listCustomerOrders(c.id), 'listCustomerOrders');
    assert.deepEqual(idSet(list), new Set([o1.id, o2.id, o3.id]));
    assert.equal(list.find((o) => o.id === o2.id).status, 'shipped');
    assert.equal(list.find((o) => o.id === o3.id).status, 'cancelled');
    assert.deepEqual(idSet(ok(await ctx.sys.listCustomerOrders(other.id), 'listCustomerOrders')), new Set([foreign.id]));
    no(await ctx.sys.listCustomerOrders('no-such-customer'), 'the history of an unknown customer');
  } },
  { id: 't9-09 the history is newest first', tags: ['HD-46'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(5);
    const o1 = await k.placed([[a, 1]], { customerId: c.id }); await sleep(1100);
    const o2 = await k.placed([[a, 1]], { customerId: c.id }); await sleep(1100);
    const o3 = await k.placed([[a, 1]], { customerId: c.id });
    assert.deepEqual(ok(await ctx.sys.listCustomerOrders(c.id), 'listCustomerOrders').map((o) => o.id), [o3.id, o2.id, o1.id]);
  } },
  { id: 't9-10 orders with the account\'s e-mail address belong to the account', tags: ['HD-42'], async run(ctx) {
    const k = kit(ctx); const data = k.person(); const a = await k.stocked(5);
    const before = await k.placed([[a, 1]], { customerEmail: data.email });
    const beforeUpper = await k.placed([[a, 1]], { customerEmail: data.email.toUpperCase() });
    const stranger = await k.placed([[a, 1]]);
    const c = await k.customer(data);
    const after = await k.placed([[a, 1]], { customerEmail: data.email });
    const list = ok(await ctx.sys.listCustomerOrders(c.id), 'listCustomerOrders');
    assert.deepEqual(idSet(list), new Set([before.id, beforeUpper.id, after.id]));
    assert.ok(names((await k.getOrder(after.id)).customerId, c.id));
    assert.ok(!list.some((o) => o.id === stranger.id));
  } },
  { id: 't9-11 an order keeps the address it was sent to', tags: ['HD-44'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const home = await k.address(c.id); const a = await k.stocked(5);
    const o = await k.placed([[a, 1]], { customerId: c.id, shippingAddressId: home.id });
    ok(await ctx.sys.removeAddress(c.id, home.id), 'removeAddress');
    sameAddress((await k.getOrder(o.id)).shippingAddress, home);
    no(await k.order([[a, 1]], { customerId: c.id, shippingAddressId: home.id }), 'an order to an address that was removed');
  } },
  { id: 't9-12 an order goes only to an address of its own customer', tags: ['HD-45'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const other = await k.customer(); const theirs = await k.address(other.id); const a = await k.stocked(5);
    no(await k.order([[a, 1]], { customerId: c.id, shippingAddressId: theirs.id }), 'an order to another customer\'s address');
    no(await k.order([[a, 1]], { customerId: c.id, shippingAddressId: 'no-such-address' }), 'an order to an unknown address');
    assert.equal((await k.figures(a)).reserved, 0);
  } },
  { id: 't9-13 orders without an account work as before', async run(ctx) {
    const k = kit(ctx); const a = await k.stocked(5, 450); const email = k.email();
    const o = await k.placed([[a, 2]], { customerEmail: email });
    assert.equal(o.customerEmail, email); assert.equal(o.totalCents, 900);
    assert.ok(o.customerId == null, `an order without an account names customer ${JSON.stringify(o.customerId)}`);
    assert.ok(o.shippingAddress == null);
    no(await k.order([[a, 1]], { customerId: 'no-such-customer' }), 'an order on an unknown account');
    assert.equal((await k.figures(a)).reserved, 2);
  } },
  { id: 't9-14 orders on accounts never oversell', tags: ['R2'], async run(ctx) {
    const k = kit(ctx); const c = await k.customer(); const a = await k.stocked(3);
    ok(await k.order([[a, 2]], { customerId: c.id }), 'placeOrder');
    ok(await k.order([[a, 4]], { customerId: c.id }), 'placeOrder');
    const s = await k.figures(a);
    assert.equal(s.onHand, 3); assert.equal(s.reserved, 3);
  } },
];
