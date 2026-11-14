// Checks that an adapter answers in the shapes of interface.md, against the
// running system. It checks shapes only, not whether the shop behaves well.
//   node kit/check.mjs <step>        (run in the folder that holds adapter.mjs, kit/ and system/)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeHttp } from './http.mjs';
import { startServer } from './server.mjs';
import { startProviders } from './providers.mjs';

const step = Number(process.argv[2] ?? 0);
const root = process.cwd();
const providers = await startProviders();
const server = await startServer(path.join(root, 'system'), providers, step >= 7 && process.argv[3] === 'b' ? { PAYMENT_PROVIDER: 'b' } : {});
if (!server.up) { console.log(`The system did not start with npm start:\n${server.log()}`); providers.close(); process.exit(1); }

const { createAdapter } = await import(pathToFileURL(path.join(root, 'adapter.mjs')).href);
const sys = createAdapter(makeHttp(server.base));
const problems = [];
const STATUS = ['pending', 'paid', 'shipped', 'cancelled', 'expired', 'returned'];
const KIND = ['receipt', 'adjustment', 'shipment', 'return', 'other'];
const is = { num: (x) => typeof x === 'number' && Number.isFinite(x), int: (x) => Number.isInteger(x), str: (x) => typeof x === 'string' && x.length > 0, bool: (x) => typeof x === 'boolean', arr: Array.isArray, strOrNull: (x) => x === null || typeof x === 'string' };
const shape = (what, v, spec) => { for (const [f, test] of Object.entries(spec)) if (!test(v?.[f])) problems.push(`${what}: field "${f}" is ${JSON.stringify(v?.[f])}`); };
async function call(name, ...args) {
  if (typeof sys[name] !== 'function') { problems.push(`${name}: the adapter has no such function`); return null; }
  let r;
  try { r = await sys[name](...args); } catch (e) { problems.push(`${name}: threw ${e.message}`); return null; }
  if (!r || typeof r.ok !== 'boolean') { problems.push(`${name}: did not return { ok, … }`); return null; }
  if (!r.ok) { console.log(`  ${name}: not ok (${r.reason})`); if (r.reason !== 'unsupported') problems.push(`${name}: a plain call was not accepted (${r.reason}); wrong mapping, or the system refuses it`); return null; }
  return r.value ?? true;
}
const product = { sku: is.str, name: is.str, priceCents: is.int, active: is.bool };
const order = { id: is.str, customerEmail: is.str, status: (x) => STATUS.includes(x), totalCents: is.int, createdAt: (x) => is.str(x) && !Number.isNaN(Date.parse(x)), lines: is.arr };
const line = { sku: is.str, quantity: is.int, unitPriceCents: is.int };
const tag = Math.random().toString(36).slice(2, 7).toUpperCase();
const sku = `CHK-${tag}`;

shape('createProduct', await call('createProduct', { sku, name: 'Check mug', priceCents: 1000 }), product);
shape('getProduct', await call('getProduct', sku), product);
shape('updateProduct', await call('updateProduct', sku, { name: 'Check mug 2' }), product);
const list = await call('listProducts', { includeInactive: true });
if (list) { if (!is.arr(list)) problems.push('listProducts: not a list'); else shape('listProducts[0]', list[0], product); }
const missing = typeof sys.getProduct === 'function' ? await sys.getProduct(`NONE-${tag}`).catch(() => null) : null;
if (missing && missing.ok) problems.push('getProduct of an unknown SKU was ok');
await call('receiveStock', { sku, quantity: 20 });
await call('adjustStock', { sku, quantity: -1 });
shape('getStock', await call('getStock', sku), { onHand: is.int, reserved: is.int, available: is.int });
const moves = await call('listStockMovements', sku);
if (moves) { if (!is.arr(moves)) problems.push('listStockMovements: not a list'); else shape('listStockMovements[0]', moves[0], { quantity: is.int, kind: (x) => KIND.includes(x), reference: (x) => x === null || typeof x === 'string' }); }
const email = `check.${tag.toLowerCase()}@example.com`;
const placed = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 2 }] });
shape('placeOrder', placed, order);
if (placed?.lines) shape('placeOrder.lines[0]', placed.lines[0], line);
const orders = await call('listOrders', { customerEmail: email });
if (orders) { if (!is.arr(orders)) problems.push('listOrders: not a list'); else shape('listOrders[0]', orders[0], order); }
if (placed?.id) {
  shape('payOrder', await call('payOrder', placed.id), { status: (x) => ['succeeded', 'declined'].includes(x), amountCents: is.int, providerChargeId: is.str });
  const pays = await call('listPayments', placed.id);
  if (pays) { if (!is.arr(pays)) problems.push('listPayments: not a list'); else shape('listPayments[0]', pays[0], { status: is.str, amountCents: is.int, providerChargeId: is.str }); }
  await call('shipOrder', placed.id);
  shape('getOrder', await call('getOrder', placed.id), order);
}
if (step >= 1) {
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (o?.id) shape('cancelOrder', await call('cancelOrder', o.id), order);
}
if (step >= 2) {
  const code = `C${tag}`;
  shape('createWarehouse', await call('createWarehouse', { code, name: 'Check warehouse' }), { code: is.str, name: is.str });
  const ws = await call('listWarehouses');
  if (ws) { if (!is.arr(ws)) problems.push('listWarehouses: not a list'); else { shape('listWarehouses[0]', ws[0], { code: is.str, name: is.str }); if (!ws.some((w) => w.code === 'MAIN')) problems.push('listWarehouses: the first warehouse must appear as MAIN'); } }
  await call('receiveStock', { sku, quantity: 3, warehouse: code });
  const s = await call('getStock', sku);
  if (s) { if (!is.arr(s.warehouses)) problems.push('getStock: "warehouses" is not a list'); else shape('getStock.warehouses[0]', s.warehouses[0], { warehouse: is.str, onHand: is.int, reserved: is.int, available: is.int }); }
  const m = await call('listStockMovements', sku);
  if (m?.length) shape('listStockMovements[0]', m[0], { warehouse: is.str });
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (o?.lines?.[0]) { if (!is.arr(o.lines[0].allocations)) problems.push('placeOrder: a line has no "allocations" list'); else shape('line.allocations[0]', o.lines[0].allocations[0], { warehouse: is.str, quantity: is.int }); }
}
if (step >= 3) {
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (o && !(is.str(o.expiresAt) && !Number.isNaN(Date.parse(o.expiresAt)))) problems.push(`placeOrder: "expiresAt" of an order waiting for payment is ${JSON.stringify(o.expiresAt)}`);
  const e = await call('expireOrders', new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());
  if (e && !(is.arr(e.expired) && e.expired.every((x) => typeof x === 'string'))) problems.push('expireOrders: "expired" is not a list of order ids');
  await call('expireOrders', null);
}
if (step >= 4) {
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (o?.id) await call('correctStock', o.id, { sku, onHand: 30 });
}
if (step >= 5) {
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 2 }] });
  if (o?.id && await call('payOrder', o.id) && await call('shipOrder', o.id)) {
    const r = await call('returnItems', o.id, { lines: [{ sku, quantity: 1 }] });
    shape('returnItems', r, { id: is.str, refundCents: is.int, lines: is.arr });
    const rs = await call('listReturns', o.id);
    if (rs) { if (!is.arr(rs)) problems.push('listReturns: not a list'); else shape('listReturns[0]', rs[0], { id: is.str, refundCents: is.int, lines: is.arr }); }
  }
}
if (step >= 6) {
  const code = `CHK${tag}`;
  shape('createDiscountCode', await call('createDiscountCode', { code, percent: 10 }), { code: is.str, percent: is.int });
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }], discountCode: code });
  shape('placeOrder with a code', o, { subtotalCents: is.int, discountCents: is.int, discountCode: is.str });
  const plain = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (plain && plain.discountCode !== null) problems.push(`placeOrder without a code: "discountCode" is ${JSON.stringify(plain.discountCode)}, expected null`);
}
if (step >= 8) {
  const s = await call('getStock', sku);
  if (s && !is.int(s.backordered)) problems.push(`getStock: "backordered" is ${JSON.stringify(s.backordered)}`);
  const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
  if (o?.lines?.[0] && !is.int(o.lines[0].backorderedQuantity)) problems.push(`placeOrder: a line's "backorderedQuantity" is ${JSON.stringify(o.lines[0].backorderedQuantity)}`);
}
if (step >= 9) {
  const customer = { id: is.str, name: is.str, email: is.str, phone: is.strOrNull };
  const address = { id: is.str, street: is.str, city: is.str, postalCode: is.str, country: is.str };
  const who = { name: 'Check Customer', email: `account.${tag.toLowerCase()}@example.com`, phone: '+48 600 100 200' };
  const c = await call('createCustomer', who);
  shape('createCustomer', c, customer);
  if (c?.id) {
    shape('getCustomer', await call('getCustomer', c.id), customer);
    shape('updateCustomer', await call('updateCustomer', c.id, { name: 'Check Customer 2' }), customer);
    const where = { street: 'Checkstraat 1', city: 'Checkstad', postalCode: '1000 AA', country: 'NL' };
    const a = await call('addAddress', c.id, where);
    shape('addAddress', a, address);
    const spare = await call('addAddress', c.id, { ...where, street: 'Checkstraat 2' });
    const as = await call('listAddresses', c.id);
    if (as) { if (!is.arr(as)) problems.push('listAddresses: not a list'); else shape('listAddresses[0]', as[0], address); }
    if (spare?.id) await call('removeAddress', c.id, spare.id);
    const o = a?.id ? await call('placeOrder', { customerId: c.id, shippingAddressId: a.id, lines: [{ sku, quantity: 1 }] }) : null;
    shape('placeOrder on an account', o, { ...order, customerId: is.str });
    if (o) shape('placeOrder on an account: shippingAddress', o.shippingAddress, { street: is.str, city: is.str, postalCode: is.str, country: is.str });
    const co = await call('listCustomerOrders', c.id);
    if (co) { if (!is.arr(co)) problems.push('listCustomerOrders: not a list'); else shape('listCustomerOrders[0]', co[0], order); }
    const plain = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
    if (plain && plain.customerId !== null) problems.push(`placeOrder without an account: "customerId" is ${JSON.stringify(plain.customerId)}, expected null`);
    if (plain && plain.shippingAddress !== null) problems.push(`placeOrder without an account: "shippingAddress" is ${JSON.stringify(plain.shippingAddress)}, expected null`);
    if (step >= 10) {
      // A paid order on the account, so that the points history has something to show.
      const big = `CHK-P-${tag}`;
      await call('createProduct', { sku: big, name: 'Check teapot', priceCents: 100000 });
      await call('receiveStock', { sku: big, quantity: 5 });
      const paid = await call('placeOrder', { customerId: c.id, lines: [{ sku: big, quantity: 1 }] });
      if (paid?.id) { await call('payOrder', paid.id); await call('shipOrder', paid.id); }
      const p = await call('getPoints', c.id);
      if (p && !is.int(p.balance)) problems.push(`getPoints: "balance" is ${JSON.stringify(p.balance)}`);
      const h = await call('listPointsHistory', c.id);
      if (h) { if (!is.arr(h)) problems.push('listPointsHistory: not a list'); else if (h.length) shape('listPointsHistory[0]', h[0], { points: is.int, kind: (x) => ['earned', 'spent', 'other'].includes(x), reference: is.strOrNull }); }
      if (step >= 11) {
        const spent = await call('placeOrder', { customerId: c.id, lines: [{ sku: big, quantity: 1 }], pointsToSpend: 1 });
        shape('placeOrder with points', spent, { pointsSpent: is.int, pointsDiscountCents: is.int });
        if (spent?.id) await call('cancelOrder', spent.id);
        const none = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
        if (none && !(none.pointsSpent === 0 && none.pointsDiscountCents === 0)) problems.push(`placeOrder without points: "pointsSpent" is ${JSON.stringify(none.pointsSpent)} and "pointsDiscountCents" is ${JSON.stringify(none.pointsDiscountCents)}, expected 0`);
      }
    }
    if (step >= 12) {
      const state = { ...customer, blocked: is.bool, erased: is.bool };
      shape('getCustomer', await call('getCustomer', c.id), state);
      shape('blockCustomer', await call('blockCustomer', c.id), state);
      shape('unblockCustomer', await call('unblockCustomer', c.id), state);
      // An account of its own: erasing must not get in the way of the checks above.
      const gone = await call('createCustomer', { name: 'Check Leaver', email: `leaver.${tag.toLowerCase()}@example.com` });
      if (gone?.id) await call('eraseCustomer', gone.id);
    }
  }
}
if (step >= 13) {
  const PO = ['open', 'received', 'closed', 'cancelled'];
  const supplier = { id: is.str, name: is.str, email: is.strOrNull };
  const purchaseOrder = { id: is.str, supplierId: is.str, status: (x) => PO.includes(x), warehouse: is.str, totalCostCents: is.int, lines: is.arr };
  const s = await call('createSupplier', { name: `Check supplier ${tag}`, email: `supplier.${tag.toLowerCase()}@example.com` });
  shape('createSupplier', s, supplier);
  const ss = await call('listSuppliers');
  if (ss) { if (!is.arr(ss)) problems.push('listSuppliers: not a list'); else shape('listSuppliers[0]', ss[0], supplier); }
  if (s?.id) {
    shape('getSupplier', await call('getSupplier', s.id), supplier);
    const bought = `CHK-B-${tag}`;
    await call('createProduct', { sku: bought, name: 'Check tin', priceCents: 900 });
    const po = await call('createPurchaseOrder', { supplierId: s.id, lines: [{ sku: bought, quantity: 10, unitCostCents: 400 }] });
    shape('createPurchaseOrder', po, purchaseOrder);
    if (po?.lines) shape('createPurchaseOrder.lines[0]', po.lines[0], { sku: is.str, quantity: is.int, unitCostCents: is.int });
    if (po?.id) shape('getPurchaseOrder', await call('getPurchaseOrder', po.id), purchaseOrder);
    const pos = await call('listPurchaseOrders', { supplierId: s.id });
    if (pos) { if (!is.arr(pos)) problems.push('listPurchaseOrders: not a list'); else shape('listPurchaseOrders[0]', pos[0], purchaseOrder); }
    const st = await call('getStock', bought);
    if (st && !is.int(st.onOrder)) problems.push(`getStock: "onOrder" is ${JSON.stringify(st.onOrder)}`);
    const off = await call('createPurchaseOrder', { supplierId: s.id, lines: [{ sku: bought, quantity: 1, unitCostCents: 400 }] });
    if (off?.id) shape('cancelPurchaseOrder', await call('cancelPurchaseOrder', off.id), purchaseOrder);
    if (step >= 14 && po?.id) {
      const part = await call('receivePurchaseOrder', po.id, { lines: [{ sku: bought, quantity: 4 }] });
      shape('receivePurchaseOrder', part, purchaseOrder);
      if (part?.lines) shape('receivePurchaseOrder.lines[0]', part.lines[0], { sku: is.str, quantity: is.int, unitCostCents: is.int, receivedQuantity: is.int });
      shape('closePurchaseOrder', await call('closePurchaseOrder', po.id), purchaseOrder);
    }
    if (step >= 15) {
      await call('receiveStock', { sku: bought, quantity: 2, unitCostCents: 450 });
      shape('getProductCost', await call('getProductCost', bought), { averageCostCents: is.int, stockValueCents: is.int });
      const ch = await call('listCostHistory', bought);
      if (ch) { if (!is.arr(ch)) problems.push('listCostHistory: not a list'); else shape('listCostHistory[0]', ch[0], { quantity: is.int, unitCostCents: is.int, averageCostCents: is.int, reference: is.strOrNull }); }
      const unknown = `CHK-U-${tag}`;
      await call('createProduct', { sku: unknown, name: 'Check spoon', priceCents: 300 });
      const uc = await call('getProductCost', unknown);
      if (uc && uc.averageCostCents !== null) problems.push(`getProductCost of a product never bought: "averageCostCents" is ${JSON.stringify(uc.averageCostCents)}, expected null`);
      const o = await call('placeOrder', { customerEmail: email, lines: [{ sku: bought, quantity: 1 }] });
      if (o?.id && await call('payOrder', o.id) && await call('shipOrder', o.id)) {
        const sent = await call('getOrder', o.id);
        if (sent?.lines?.[0] && !is.int(sent.lines[0].unitCostCents)) problems.push(`getOrder: a shipped line's "unitCostCents" is ${JSON.stringify(sent.lines[0].unitCostCents)}`);
      }
    }
    if (step >= 16) {
      const scarce = `CHK-L-${tag}`;
      await call('createProduct', { sku: scarce, name: 'Check strainer', priceCents: 700 });
      await call('receiveStock', { sku: scarce, quantity: 1 });
      await call('setReorderRule', scarce, { reorderPoint: 5, targetLevel: 20, supplierId: s.id });
      const ls = await call('listLowStock');
      if (ls) { if (!is.arr(ls)) problems.push('listLowStock: not a list'); else if (ls.length) shape('listLowStock[0]', ls[0], { sku: is.str, available: is.int, onOrder: is.int, reorderPoint: is.int }); }
      const rp = await call('listReorderProposals');
      if (rp) {
        if (!is.arr(rp)) problems.push('listReorderProposals: not a list');
        else if (rp.length) { shape('listReorderProposals[0]', rp[0], { supplierId: is.str, lines: is.arr }); shape('listReorderProposals[0].lines[0]', rp[0]?.lines?.[0], { sku: is.str, quantity: is.int }); }
      }
    }
  }
}

if (step >= 17) {
  const DAY = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const category = { code: is.str, name: is.str, taxPercent: is.int };
  const code = `T${tag}`;
  shape('createCategory', await call('createCategory', { code, name: 'Check category', taxPercent: 23 }), category);
  shape('updateCategory', await call('updateCategory', code, { name: 'Check category 2' }), category);
  const cs = await call('listCategories');
  if (cs) { if (!is.arr(cs)) problems.push('listCategories: not a list'); else shape('listCategories[0]', cs[0], category); }
  const taxed = `CHK-T-${tag}`;
  const tp = await call('createProduct', { sku: taxed, name: 'Check cup', priceCents: 1230, category: code });
  if (tp && tp.category !== code) problems.push(`createProduct in a category: "category" is ${JSON.stringify(tp.category)}`);
  const bare = await call('getProduct', sku);
  if (bare && bare.category !== null) problems.push(`getProduct of a product in no category: "category" is ${JSON.stringify(bare.category)}, expected null`);
  await call('receiveStock', { sku: taxed, quantity: 40 });
  const to = await call('placeOrder', { customerEmail: email, lines: [{ sku: taxed, quantity: 1 }, { sku, quantity: 1 }] });
  shape('placeOrder with a taxed product', to, { taxCents: is.int });
  if (to?.lines) for (const l of to.lines) shape('placeOrder with a taxed product: a line', l, { taxPercent: is.int, taxCents: is.int });
  let member = null;
  if (step >= 18) {
    const g = await call('createCustomerGroup', { name: `Check group ${tag}` });
    shape('createCustomerGroup', g, { id: is.str, name: is.str });
    const gs = await call('listCustomerGroups');
    if (gs) { if (!is.arr(gs)) problems.push('listCustomerGroups: not a list'); else shape('listCustomerGroups[0]', gs[0], { id: is.str, name: is.str }); }
    member = await call('createCustomer', { name: 'Check Wholesaler', email: `wholesale.${tag.toLowerCase()}@example.com` });
    if (member && member.groupId !== null) problems.push(`createCustomer: "groupId" of an account in no group is ${JSON.stringify(member.groupId)}, expected null`);
    if (g?.id && member?.id) {
      shape('setCustomerGroup', await call('setCustomerGroup', member.id, g.id), { id: is.str, groupId: is.str });
      await call('setGroupPrice', g.id, { sku: taxed, priceCents: 1100 });
      await call('setGroupPrice', g.id, { sku, priceCents: 900 });
      await call('removeGroupPrice', g.id, sku);
      const ps = await call('listGroupPrices', g.id);
      if (ps) { if (!is.arr(ps)) problems.push('listGroupPrices: not a list'); else shape('listGroupPrices[0]', ps[0], { sku: is.str, priceCents: is.int }); }
      const out = await call('setCustomerGroup', member.id, null);
      if (out && out.groupId !== null) problems.push(`setCustomerGroup with null: "groupId" is ${JSON.stringify(out.groupId)}, expected null`);
    }
  }
  if (step >= 19) {
    const promotion = { id: is.str, name: is.str, kind: (x) => ['multibuy', 'bundle'].includes(x), active: is.bool };
    const [m, b1, b2] = [`CHK-M-${tag}`, `CHK-S1-${tag}`, `CHK-S2-${tag}`];
    for (const s of [m, b1, b2]) { await call('createProduct', { sku: s, name: 'Check saucer', priceCents: 1000 }); await call('receiveStock', { sku: s, quantity: 10 }); }
    const multi = await call('createPromotion', { name: 'Check three for two', kind: 'multibuy', sku: m, buyQuantity: 2, freeQuantity: 1 });
    shape('createPromotion (multibuy)', multi, promotion);
    shape('createPromotion (bundle)', await call('createPromotion', { name: 'Check set', kind: 'bundle', items: [{ sku: b1, quantity: 1 }, { sku: b2, quantity: 2 }], priceCents: 2500 }), promotion);
    const ps = await call('listPromotions');
    if (ps) { if (!is.arr(ps)) problems.push('listPromotions: not a list'); else shape('listPromotions[0]', ps[0], promotion); }
    const po = await call('placeOrder', { customerEmail: email, lines: [{ sku: m, quantity: 3 }] });
    shape('placeOrder with a promotion', po, { promotionDiscountCents: is.int });
    const none = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 1 }] });
    if (none && none.promotionDiscountCents !== 0) problems.push(`placeOrder without a promotion: "promotionDiscountCents" is ${JSON.stringify(none.promotionDiscountCents)}, expected 0`);
    if (multi?.id) { const ended = await call('endPromotion', multi.id); shape('endPromotion', ended, promotion); if (ended && ended.active !== false) problems.push('endPromotion: "active" is not false'); }
  }
  if (step >= 21) {
    const docLine = { sku: is.str, name: is.str, quantity: is.int, unitPriceCents: is.int, taxPercent: is.int, totalCents: is.int, taxCents: is.int };
    const invoice = { id: is.str, number: is.str, year: is.int, sequence: is.int, issuedOn: DAY, orderId: is.str, buyerName: is.strOrNull, buyerEmail: is.strOrNull, totalCents: is.int, taxCents: is.int, lines: is.arr };
    const docs = (name, list, spec) => { if (!list) return; if (!is.arr(list)) problems.push(`${name}: not a list`); else { shape(`${name}[0]`, list[0], spec); shape(`${name}[0].lines[0]`, list[0]?.lines?.[0], docLine); } };
    const year = 2090;
    // An order on an account with an address, shipped at a given time; and one without an account, shipped now.
    let o = null;
    const buyer = await call('createCustomer', { name: 'Check Buyer', email: `buyer.${tag.toLowerCase()}@example.com` });
    const home = buyer?.id ? await call('addAddress', buyer.id, { street: 'Checkstraat 3', city: 'Checkstad', postalCode: '1000 AB', country: 'NL' }) : null;
    if (buyer?.id && home?.id) o = await call('placeOrder', { customerId: buyer.id, shippingAddressId: home.id, lines: [{ sku: taxed, quantity: 2 }] });
    if (o?.id && await call('payOrder', o.id) && await call('shipOrder', o.id, { at: `${year}-03-14T12:00:00.000Z` })) {
      const li = await call('listOrderInvoices', o.id);
      docs('listOrderInvoices', li, invoice);
      const first = li?.[0];
      if (first) {
        if (first.issuedOn !== `${year}-03-14`) problems.push(`listOrderInvoices: "issuedOn" of an order shipped at ${year}-03-14T12:00:00.000Z is ${JSON.stringify(first.issuedOn)}`);
        if (first.year !== year) problems.push(`listOrderInvoices: "year" is ${JSON.stringify(first.year)}, expected ${year}`);
        shape('listOrderInvoices[0].buyerAddress', first.buyerAddress, { street: is.str, city: is.str, postalCode: is.str, country: is.str });
        const one = await call('getInvoice', first.id);
        shape('getInvoice', one, invoice); shape('getInvoice.lines[0]', one?.lines?.[0], docLine);
      }
      docs('listInvoices', await call('listInvoices', { year }), invoice);
      const g = await call('placeOrder', { customerEmail: email, lines: [{ sku: taxed, quantity: 1 }] });
      if (g?.id && await call('payOrder', g.id) && await call('shipOrder', g.id)) {
        const gi = (await call('listOrderInvoices', g.id))?.[0];
        if (gi && gi.buyerAddress !== null) problems.push(`listOrderInvoices of an order without an address: "buyerAddress" is ${JSON.stringify(gi.buyerAddress)}, expected null`);
      }
      if (step >= 22) {
        const note = { ...invoice, invoiceId: is.str };
        const r = await call('returnItems', o.id, { lines: [{ sku: taxed, quantity: 1 }], at: `${year}-03-20T12:00:00.000Z` });
        if (r) {
          const ln = await call('listOrderCreditNotes', o.id);
          docs('listOrderCreditNotes', ln, note);
          if (ln?.[0]) {
            if (ln[0].issuedOn !== `${year}-03-20`) problems.push(`listOrderCreditNotes: "issuedOn" of a return at ${year}-03-20T12:00:00.000Z is ${JSON.stringify(ln[0].issuedOn)}`);
            const one = await call('getCreditNote', ln[0].id);
            shape('getCreditNote', one, note); shape('getCreditNote.lines[0]', one?.lines?.[0], docLine);
          }
          docs('listCreditNotes', await call('listCreditNotes', { year }), note);
        }
      }
      if (step >= 23) {
        const row = { taxPercent: is.int, invoicedCents: is.int, invoicedTaxCents: is.int, creditedCents: is.int, creditedTaxCents: is.int };
        const report = { invoiceCount: is.int, creditNoteCount: is.int, invoicedCents: is.int, invoicedTaxCents: is.int, creditedCents: is.int, creditedTaxCents: is.int, byTaxRate: is.arr };
        const sr = await call('getSalesReport', `${year}-03-14`);
        shape('getSalesReport', sr, report);
        if (sr && is.arr(sr.byTaxRate)) shape('getSalesReport.byTaxRate[0]', sr.byTaxRate[0], row);
      }
    }
  }
  if (step >= 24) {
    // A payment and a refund inside a period, and one charge on the provider's statement that the system cannot know.
    const via = process.argv[3] === 'b' ? 'b' : 'a';
    const from = new Date(Date.now() - 1000).toISOString();
    const o = await call('placeOrder', { customerEmail: email, lines: [{ sku, quantity: 2 }] });
    if (o?.id && await call('payOrder', o.id) && await call('shipOrder', o.id)) await call('returnItems', o.id, { lines: [{ sku, quantity: 1 }] });
    providers.state.charges.push({ via, chargeId: `check_${tag}`, amountCents: 4321, reference: 'check', status: 'succeed', at: new Date().toISOString() });
    const rc = await call('reconcilePayments', { from, to: new Date(Date.now() + 1000).toISOString() });
    shape('reconcilePayments', rc, { shopChargedCents: is.int, providerChargedCents: is.int, shopRefundedCents: is.int, providerRefundedCents: is.int, differences: is.arr });
    if (rc && is.arr(rc.differences)) {
      const intOrNull = (x) => x === null || is.int(x);
      for (const d of rc.differences) shape('reconcilePayments.differences[…]', d, { kind: (x) => ['charge', 'refund'].includes(x), problem: (x) => ['unknown_to_shop', 'unknown_to_provider', 'amount_differs'].includes(x), providerChargeId: is.str, orderId: is.strOrNull, shopCents: intOrNull, providerCents: intOrNull });
    }
  }
}

if (step >= 25) {
  const lower = tag.toLowerCase();
  const zoneCode = `ZC${tag}`; const carrierCode = `K${tag}`;
  const zone = { code: is.str, name: is.str, countries: (x) => is.arr(x) && x.every((c) => typeof c === 'string') };
  const carrier = { code: is.str, name: is.str };
  const shipment = { id: is.str, warehouse: is.str, lines: is.arr, invoiceId: is.str, ...(step >= 27 ? { status: (x) => ['sent', 'failed'].includes(x) } : {}) };
  const listed = (name, list, spec) => { if (!list) return; if (!is.arr(list)) problems.push(`${name}: not a list`); else shape(`${name}[0]`, list[0], spec); };
  shape('createShippingZone', await call('createShippingZone', { code: zoneCode, name: 'Check zone', countries: ['NL', 'BE'] }), zone);
  listed('listShippingZones', await call('listShippingZones'), zone);
  shape('createCarrier', await call('createCarrier', { code: carrierCode, name: 'Check carrier' }), carrier);
  listed('listCarriers', await call('listCarriers'), carrier);
  await call('setCarrierRate', carrierCode, { zone: zoneCode, maxWeightGrams: 2000, priceCents: 990 });
  await call('setCarrierRate', carrierCode, { zone: zoneCode, maxWeightGrams: 20000, priceCents: 1490 });
  listed('listCarrierRates', await call('listCarrierRates', carrierCode), { zone: is.str, maxWeightGrams: is.int, priceCents: is.int });
  const heavy = `CHK-W-${tag}`;
  const hp = await call('createProduct', { sku: heavy, name: 'Check kettle', priceCents: 2000, weightGrams: 800 });
  if (hp && hp.weightGrams !== 800) problems.push(`createProduct with a weight: "weightGrams" is ${JSON.stringify(hp.weightGrams)}`);
  const hu = await call('updateProduct', heavy, { weightGrams: 900 });
  if (hu && hu.weightGrams !== 900) problems.push(`updateProduct with a weight: "weightGrams" is ${JSON.stringify(hu.weightGrams)}`);
  const unweighed = await call('createProduct', { sku: `CHK-N-${tag}`, name: 'Check lid', priceCents: 300 });
  if (unweighed && unweighed.weightGrams !== null) problems.push(`createProduct without a weight: "weightGrams" is ${JSON.stringify(unweighed.weightGrams)}, expected null`);
  await call('receiveStock', { sku: heavy, quantity: 40 });
  const who = await call('createCustomer', { name: 'Check Receiver', email: `receiver.${lower}@example.com` });
  const where = who?.id ? await call('addAddress', who.id, { street: 'Checkstraat 5', city: 'Checkstad', postalCode: '1000 AC', country: 'NL' }) : null;
  // What an order on that account, to that address, needs; with `carrier` it has a shipping cost.
  const to = who?.id && where?.id ? { customerId: who.id, shippingAddressId: where.id } : null;
  const sent = async (lines, extra = {}, options) => {
    const o = to ? await call('placeOrder', { ...to, ...extra, lines }) : null;
    return o?.id && await call('payOrder', o.id) && await call('shipOrder', o.id, options) ? o : null;
  };
  if (to) {
    const so = await call('placeOrder', { ...to, carrier: carrierCode, lines: [{ sku: heavy, quantity: 1 }] });
    shape('placeOrder with a carrier', so, { carrier: is.str, shippingCents: is.int, shippingTaxCents: is.int });
    const none = await call('placeOrder', { ...to, lines: [{ sku: heavy, quantity: 1 }] });
    if (none && !(none.carrier === null && none.shippingCents === 0 && none.shippingTaxCents === 0)) problems.push(`placeOrder without a carrier: "carrier" is ${JSON.stringify(none.carrier)}, "shippingCents" ${JSON.stringify(none.shippingCents)} and "shippingTaxCents" ${JSON.stringify(none.shippingTaxCents)}, expected null, 0 and 0`);
    if (so?.id && await call('payOrder', so.id) && await call('shipOrder', so.id)) {
      const si = (await call('listOrderInvoices', so.id))?.[0];
      shape('listOrderInvoices of an order with a carrier', si, { shippingCents: is.int, shippingTaxCents: is.int });
    }
  }
  if (step >= 26 && to) {
    // An order whose goods are in two warehouses: one part is sent on its own, then the rest.
    const [here, there, depot] = [`CHK-H-${tag}`, `CHK-D-${tag}`, `D${tag}`];
    await call('createWarehouse', { code: depot, name: 'Check depot' });
    for (const [s, warehouse] of [[here, undefined], [there, depot]]) { await call('createProduct', { sku: s, name: 'Check tray', priceCents: 1500 }); await call('receiveStock', { sku: s, quantity: 10, ...(warehouse ? { warehouse } : {}) }); }
    const o = await call('placeOrder', { ...to, lines: [{ sku: here, quantity: 1 }, { sku: there, quantity: 2 }] });
    if (o?.lines) for (const l of o.lines) shape('placeOrder: a line', l, { shippedQuantity: is.int });
    if (o?.id && await call('payOrder', o.id)) {
      const part = await call('shipOrderPart', o.id, { warehouse: depot, at: '2091-05-02T12:00:00.000Z' });
      shape('shipOrderPart', part, shipment); shape('shipOrderPart.lines[0]', part?.lines?.[0], { sku: is.str, quantity: is.int });
      if (part && part.warehouse !== depot) problems.push(`shipOrderPart: "warehouse" is ${JSON.stringify(part.warehouse)}, expected ${depot}`);
      const half = await call('getOrder', o.id);
      if (half && half.status !== 'paid') problems.push(`getOrder of an order of which a part was sent: "status" is ${JSON.stringify(half.status)}, expected "paid"`);
      await call('shipOrder', o.id);
      const all = await call('listShipments', o.id);
      listed('listShipments', all, shipment);
      if (is.arr(all)) for (const s of all) shape('listShipments[…].lines[0]', s.lines?.[0], { sku: is.str, quantity: is.int });
      const whole = await call('getOrder', o.id);
      if (whole && whole.status !== 'shipped') problems.push(`getOrder of an order that was sent completely: "status" is ${JSON.stringify(whole.status)}, expected "shipped"`);
      if (step >= 27 && part?.id) {
        const back = await call('reportFailedDelivery', part.id, { at: '2091-05-09T12:00:00.000Z' });
        shape('reportFailedDelivery', back, shipment);
        if (back && back.status !== 'failed') problems.push(`reportFailedDelivery: "status" is ${JSON.stringify(back.status)}, expected "failed"`);
      }
    }
  }
  if (step >= 28) {
    const o = await sent([{ sku: heavy, quantity: 2 }], {}, { at: '2091-06-01T12:00:00.000Z' });
    const invoice = o ? (await call('listOrderInvoices', o.id))?.[0] : null;
    if (invoice?.id) await call('correctInvoiceAmount', invoice.id, { totalCents: invoice.totalCents - 100, at: '2091-06-08T12:00:00.000Z' });
  }
  if (step >= 30) {
    const sale = await call('createPromotion', { name: 'Check sale', kind: 'sale', percent: 10 });
    shape('createPromotion (sale)', sale, { id: is.str, name: is.str, kind: (x) => x === 'sale', active: is.bool });
    // Ended at once, so that it does not count for anything checked after it.
    if (sale?.id) { const ended = await call('endPromotion', sale.id); if (ended && ended.active !== false) problems.push('endPromotion of a sale: "active" is not false'); }
  }
  if (step >= 31 && who?.id) {
    const p = await call('setPointsBalance', who.id, { balance: 123 });
    if (p && p.balance !== 123) problems.push(`setPointsBalance: "balance" is ${JSON.stringify(p.balance)}, expected 123`);
    const now = await call('getPoints', who.id);
    if (now && now.balance !== 123) problems.push(`getPoints after setPointsBalance: "balance" is ${JSON.stringify(now.balance)}, expected 123`);
  }
  if (step >= 29) {
    // An account of its own, with an order that was sent.
    const leaver = await call('createCustomer', { name: 'Check Remover', email: `remover.${lower}@example.com` });
    if (leaver?.id) {
      const o = await call('placeOrder', { customerId: leaver.id, lines: [{ sku: heavy, quantity: 1 }] });
      if (o?.id && await call('payOrder', o.id)) await call('shipOrder', o.id);
      await call('removeCustomer', leaver.id);
    }
  }
}

server.stop(); providers.close();
if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(`  - ${p}`); }
else console.log('\nAll shapes are right.');
process.exit(0);
