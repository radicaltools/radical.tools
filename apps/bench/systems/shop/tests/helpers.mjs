// Shared helpers of the hidden acceptance tests. A test gets `ctx`:
//   ctx.sys      -> the system through its adapter (harness/kit/interface.md)
//   ctx.provider -> { mode, refundMode, charges, refunds } of the fake payment providers
// Tests check what the business sees: accepted or refused, stock figures,
// amounts, states. They never look at HTTP.
import assert from 'node:assert/strict';

let counter = 0;
let years = 0;
let countries = 0;
// Real country codes for shipping zones, one per call, so that tests that share a database do not share a country.
// PL is left out: it is where an order without an address goes, and addresses made by `place` are there.
const COUNTRIES = ('AT BE BG HR CY CZ DK EE FI FR GR HU IE IT LV LT LU MT PT RO SK SI ES SE NO IS CH LI GB UA MD RS BA ME MK AL TR GE AM AZ KZ US CA MX BR AR CL PE CO UY PY BO EC VE '
  + 'JP KR CN IN ID TH VN MY SG PH AU NZ ZA EG MA TN DZ KE NG GH SN ET TZ UG IL JO SA AE QA KW OM BH LB PK BD LK NP MN KG UZ TJ TM CR PA GT HN NI SV DO JM TT BS BB CU HT').split(' ');
const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');

export { assert };
// A movement was made for an order when its reference names the order's id.
export const forOrder = (m, o) => assert.ok(String(m.reference ?? '').includes(String(o.id)), `the movement's reference ${JSON.stringify(m.reference)} does not name order ${o.id}`);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A record names a thing (an order, a purchase order) when its reference contains the thing's id.
export const names = (reference, id) => String(reference ?? '').includes(String(id));
// Personal data is gone from what the system shows when the text appears nowhere in it, upper and lower case ignored.
export const without = (shown, texts, what = 'the answer') => {
  const all = JSON.stringify(shown ?? null).toLowerCase();
  for (const t of texts) assert.ok(!all.includes(String(t).toLowerCase()), `${what} still shows ${JSON.stringify(t)}`);
};

const show = (r) => JSON.stringify(r)?.slice(0, 300);
// accepted: returns the value
export function ok(r, what = 'operation') {
  if (r?.reason === 'unsupported') throw new Error(`unsupported: ${what}`);
  assert.ok(r?.ok, `${what} should be accepted, got ${show(r)}`);
  return r.value;
}
// refused by the system (a business refusal or "no such thing")
export function no(r, what = 'operation') {
  if (r?.reason === 'unsupported') throw new Error(`unsupported: ${what}`);
  assert.ok(r && !r.ok && (r.reason === 'rejected' || r.reason === 'not_found'), `${what} should be refused, got ${show(r)}`);
}
export function unavailable(r, what = 'operation') {
  if (r?.reason === 'unsupported') throw new Error(`unsupported: ${what}`);
  assert.ok(r && !r.ok && r.reason === 'unavailable', `${what} should report the provider unavailable, got ${show(r)}`);
}

export function kit(ctx) {
  const { sys, provider } = ctx;
  const lines = (pairs) => pairs.map(([sku, quantity]) => ({ sku, quantity }));
  const k = {
    sku: (p = 'SKU') => `${p}-${rnd()}-${++counter}`,
    code: () => `W${rnd()}${++counter}`.slice(0, 10),
    email: () => `user.${rnd().toLowerCase()}${++counter}@example.com`,
    async product(priceCents = 1000, sku = k.sku()) {
      ok(await sys.createProduct({ sku, name: `Item ${sku}`, priceCents }), 'createProduct');
      return sku;
    },
    async stocked(quantity, priceCents = 1000, warehouse) {
      const sku = await k.product(priceCents);
      await k.receive(sku, quantity, warehouse);
      return sku;
    },
    async receive(sku, quantity, warehouse) {
      ok(await sys.receiveStock({ sku, quantity, ...(warehouse ? { warehouse } : {}) }), 'receiveStock');
    },
    adjust: (sku, quantity, warehouse) => sys.adjustStock({ sku, quantity, ...(warehouse ? { warehouse } : {}) }),
    stock: async (sku) => ok(await sys.getStock(sku), 'getStock'),
    movements: async (sku) => ok(await sys.listStockMovements(sku), 'listStockMovements'),
    // An order on an account (extra.customerId) gives no e-mail address of its own.
    order: (pairs, extra = {}) => sys.placeOrder({
      ...(extra.customerId ? { customerId: extra.customerId } : { customerEmail: extra.customerEmail ?? k.email() }),
      lines: lines(pairs),
      ...(extra.discountCode ? { discountCode: extra.discountCode } : {}),
      ...(extra.shippingAddressId ? { shippingAddressId: extra.shippingAddressId } : {}),
      ...(extra.pointsToSpend !== undefined ? { pointsToSpend: extra.pointsToSpend } : {}),
      ...(extra.carrier ? { carrier: extra.carrier } : {}),
    }),
    placed: async (pairs, extra) => ok(await k.order(pairs, extra), 'placeOrder'),
    pay: (id) => sys.payOrder(id),
    ship: (id) => sys.shipOrder(id),
    cancel: (id) => sys.cancelOrder(id),
    getOrder: async (id) => ok(await sys.getOrder(id), 'getOrder'),
    async paid(pairs, extra) {
      const o = await k.placed(pairs, extra);
      provider.mode = 'succeed';
      const p = ok(await k.pay(o.id), 'payOrder');
      assert.equal(p.status, 'succeeded');
      return k.getOrder(o.id);
    },
    async shipped(pairs, extra) {
      const o = await k.paid(pairs, extra);
      ok(await k.ship(o.id), 'shipOrder');
      return k.getOrder(o.id);
    },
    async warehouse(code = k.code()) {
      ok(await sys.createWarehouse({ code, name: `Warehouse ${code}` }), 'createWarehouse');
      return code;
    },
    ret: (id, pairs, warehouse) => sys.returnItems(id, { lines: lines(pairs), ...(warehouse ? { warehouse } : {}) }),
    // The provider's charge of an order's successful payment.
    async chargeOf(orderId) {
      const payments = ok(await sys.listPayments(orderId), 'listPayments');
      const paid = payments.find((p) => p.status === 'succeeded');
      assert.ok(paid, 'the order has a successful payment');
      const charge = provider.charges.find((c) => c.chargeId === paid.providerChargeId);
      assert.ok(charge, 'the payment names the charge the provider made');
      return charge;
    },
    // The stock figures, checked for sense (R2).
    async figures(sku) {
      const s = await k.stock(sku);
      assert.ok(s.reserved >= 0, `reserved ${s.reserved} is negative`);
      assert.ok(s.reserved <= s.onHand, `R2: reserved ${s.reserved} exceeds on hand ${s.onHand}`);
      assert.equal(s.available, s.onHand - s.reserved, 'available is not on hand minus reserved');
      assert.ok(s.available >= 0, `R2: available ${s.available} is negative`);
      for (const w of s.warehouses ?? []) {
        assert.ok(w.available >= 0, `R2: available in ${w.warehouse} is ${w.available}`);
        assert.ok(w.reserved <= w.onHand, `R2: reserved in ${w.warehouse} exceeds on hand`);
      }
      return s;
    },
    // R1: on hand is the sum of the recorded movements.
    async ledger(sku) {
      const s = await k.stock(sku);
      const m = await k.movements(sku);
      const sum = m.reduce((a, x) => a + x.quantity, 0);
      assert.equal(s.onHand, sum, `R1: on hand ${s.onHand} is not the sum of the recorded movements ${sum}`);
      return m;
    },
    // ---- customers (from step 9)
    person: () => { const tag = `${rnd()}${++counter}`; return { name: `Person ${tag}`, email: `person.${tag.toLowerCase()}@example.com`, phone: `+48 600 ${tag}` }; },
    async customer(data = k.person()) {
      const c = ok(await sys.createCustomer(data), 'createCustomer');
      return { ...data, ...c };
    },
    place: () => { const tag = `${rnd()}${++counter}`; return { street: `Street ${tag} 7`, city: `City ${tag}`, postalCode: `PC-${tag}`, country: 'PL' }; },
    async address(customerId, data = k.place()) {
      const a = ok(await sys.addAddress(customerId, data), 'addAddress');
      return { ...data, ...a };
    },
    // ---- loyalty points (from step 10)
    balance: async (customerId) => ok(await sys.getPoints(customerId), 'getPoints').balance,
    // R5: the balance is the sum of the recorded entries and is not below zero.
    async points(customerId) {
      const balance = await k.balance(customerId);
      const history = ok(await sys.listPointsHistory(customerId), 'listPointsHistory');
      const sum = history.reduce((a, e) => a + e.points, 0);
      assert.equal(balance, sum, `R5: the balance ${balance} is not the sum of the points history ${sum}`);
      assert.ok(balance >= 0, `R5: the balance ${balance} is below zero`);
      return { balance, history };
    },
    // A customer who has bought enough to hold some points: a paid order of `cents` for one unit.
    async collector(cents = 100000) {
      const c = await k.customer();
      const sku = await k.stocked(1, cents);
      const o = await k.shipped([[sku, 1]], { customerId: c.id });
      return { ...c, firstOrder: o, firstSku: sku };
    },
    // ---- purchasing (from step 13)
    async supplier(name = `Supplier ${rnd()}${++counter}`) {
      return ok(await sys.createSupplier({ name, email: `sales.${rnd().toLowerCase()}${++counter}@example.com` }), 'createSupplier');
    },
    // rows: [sku, quantity, unitCostCents]
    purchase: (supplierId, rows, warehouse) => sys.createPurchaseOrder({ supplierId, lines: rows.map(([sku, quantity, unitCostCents]) => ({ sku, quantity, unitCostCents })), ...(warehouse ? { warehouse } : {}) }),
    purchased: async (supplierId, rows, warehouse) => ok(await k.purchase(supplierId, rows, warehouse), 'createPurchaseOrder'),
    deliver: (purchaseOrderId, pairs) => sys.receivePurchaseOrder(purchaseOrderId, { lines: lines(pairs) }),
    // Buys `quantity` of a product at a cost and books the whole delivery.
    async bought(sku, quantity, unitCostCents, supplierId) {
      const po = await k.purchased(supplierId ?? (await k.supplier()).id, [[sku, quantity, unitCostCents]]);
      ok(await k.deliver(po.id, [[sku, quantity]]), 'receivePurchaseOrder');
      return po;
    },
    cost: async (sku) => ok(await sys.getProductCost(sku), 'getProductCost'),
    wh: (stock, code) => (stock.warehouses ?? []).find((w) => w.warehouse === code) ?? { onHand: 0, reserved: 0, available: 0 },
    // ---- tax (from step 17)
    async category(taxPercent) {
      const code = `C${rnd()}${++counter}`;
      ok(await sys.createCategory({ code, name: `Category ${code}`, taxPercent }), 'createCategory');
      return code;
    },
    // A product in a category of its own with that rate, with stock.
    async taxed(quantity, priceCents, taxPercent, category) {
      const sku = k.sku();
      ok(await sys.createProduct({ sku, name: `Item ${sku}`, priceCents, category: category ?? await k.category(taxPercent) }), 'createProduct');
      await k.receive(sku, quantity);
      return sku;
    },
    // A product bought at a cost (so its average cost is known), with that many on the shelf. `taxPercent` puts it into a category.
    async costed(quantity, priceCents, unitCostCents, taxPercent) {
      const sku = k.sku();
      ok(await sys.createProduct({ sku, name: `Item ${sku}`, priceCents, ...(taxPercent === undefined ? {} : { category: await k.category(taxPercent) }) }), 'createProduct');
      await k.bought(sku, quantity, unitCostCents);
      return sku;
    },
    async discount(percent) {
      const code = `D${rnd()}${++counter}`;
      ok(await sys.createDiscountCode({ code, percent }), 'createDiscountCode');
      return code;
    },
    // What the provider charged for an order that was paid.
    async charged(orderId) { return (await k.chargeOf(orderId)).amountCents; },
    // ---- customer groups and price lists (from step 18)
    async group(name = `Group ${rnd()}${++counter}`) { return ok(await sys.createCustomerGroup({ name }), 'createCustomerGroup'); },
    // A customer account that is in the group.
    async member(groupId) {
      const c = await k.customer();
      ok(await sys.setCustomerGroup(c.id, groupId), 'setCustomerGroup');
      return c;
    },
    async listed(groupId, sku, priceCents) { ok(await sys.setGroupPrice(groupId, { sku, priceCents }), 'setGroupPrice'); },
    // ---- promotions (from step 19)
    multibuy: (sku, buyQuantity, freeQuantity) => sys.createPromotion({ name: `Promotion ${rnd()}${++counter}`, kind: 'multibuy', sku, buyQuantity, freeQuantity }),
    // items: [sku, quantity]
    bundle: (items, priceCents) => sys.createPromotion({ name: `Set ${rnd()}${++counter}`, kind: 'bundle', items: lines(items), priceCents }),
    // ---- documents with a date (from step 21). Tests work in years far ahead, one per test, so that
    // what other tests ship and the real calendar do not get in the way. Each call gives a year whose next year is free too.
    year: () => 2100 + 2 * ++years,
    // Noon (UTC) of a day: the same calendar day wherever the system keeps its clock.
    noon: (year, month = 3, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    day: (year, month = 3, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    // A paid order shipped at the time `at`.
    async shippedAt(at, pairs, extra) {
      const o = await k.paid(pairs, extra);
      ok(await sys.shipOrder(o.id, { at }), 'shipOrder');
      return k.getOrder(o.id);
    },
    invoices: async (orderId) => ok(await sys.listOrderInvoices(orderId), 'listOrderInvoices'),
    // The invoice of an order that went out in one shipment.
    async invoice(orderId) {
      const all = await k.invoices(orderId);
      assert.equal(all.length, 1, `an order shipped whole has ${all.length} invoices`);
      assert.ok(names(all[0].orderId, orderId), 'the invoice does not name its order');
      return all[0];
    },
    yearInvoices: async (year) => ok(await sys.listInvoices({ year }), 'listInvoices'),
    // ---- credit notes (from step 22)
    retAt: (at, id, pairs) => sys.returnItems(id, { lines: lines(pairs), at }),
    creditNotes: async (orderId) => ok(await sys.listOrderCreditNotes(orderId), 'listOrderCreditNotes'),
    yearCreditNotes: async (year) => ok(await sys.listCreditNotes({ year }), 'listCreditNotes'),
    // ---- the daily sales report (from step 23)
    report: async (day) => ok(await sys.getSalesReport(day), 'getSalesReport'),
    // ---- carriers and the shipping cost (from step 25)
    country: () => COUNTRIES[countries++ % COUNTRIES.length],
    // A shipping zone of its own for some countries.
    async zone(list) {
      const code = `Z${rnd()}${++counter}`;
      ok(await sys.createShippingZone({ code, name: `Zone ${code}`, countries: list }), 'createShippingZone');
      return code;
    },
    // The zone a country is in; made when the country is in none yet.
    async zoneOf(country) {
      const all = ok(await sys.listShippingZones(), 'listShippingZones');
      return all.find((z) => (z.countries ?? []).includes(country))?.code ?? k.zone([country]);
    },
    // A carrier with its prices. rows: [zone, maxWeightGrams, priceCents]
    async carrier(rows = []) {
      const code = `K${rnd()}${++counter}`.slice(0, 10);
      ok(await sys.createCarrier({ code, name: `Carrier ${code}` }), 'createCarrier');
      for (const [zone, maxWeightGrams, priceCents] of rows) ok(await sys.setCarrierRate(code, { zone, maxWeightGrams, priceCents }), 'setCarrierRate');
      return code;
    },
    // A product with a weight per unit, with stock.
    async weighed(quantity, priceCents, weightGrams, warehouse) {
      const sku = k.sku();
      ok(await sys.createProduct({ sku, name: `Item ${sku}`, priceCents, weightGrams }), 'createProduct');
      await k.receive(sku, quantity, warehouse);
      return sku;
    },
    // A customer with an address in a country that has a zone of its own, and a carrier that goes there.
    // prices: [maxWeightGrams, priceCents]. `to` is what an order needs to go there with that carrier.
    async route(prices = [[30000, 990]], customer) {
      const country = k.country(); const zone = await k.zone([country]);
      const carrier = await k.carrier(prices.map(([w, p]) => [zone, w, p]));
      const c = customer ?? await k.customer(); const home = await k.address(c.id, { ...k.place(), country });
      return { country, zone, carrier, c, home, to: { customerId: c.id, shippingAddressId: home.id, carrier } };
    },
    // ---- shipments (from step 26)
    shipments: async (orderId) => ok(await sys.listShipments(orderId), 'listShipments'),
    // Sends what is reserved for the order in one warehouse.
    part: (orderId, warehouse, at) => sys.shipOrderPart(orderId, { warehouse, ...(at ? { at } : {}) }),
    // ---- parcels that come back (from step 27)
    failed: (shipmentId, at) => sys.reportFailedDelivery(shipmentId, at ? { at } : undefined),
  };
  return k;
}
