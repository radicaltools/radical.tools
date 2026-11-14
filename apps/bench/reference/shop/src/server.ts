import http from 'node:http';
import { db } from './db';
import { ApiError, invalid, notFound } from './errors';
import * as catalogue from './modules/catalogue';
import * as stock from './modules/stock';
import * as orders from './modules/orders';
import * as payments from './modules/payments';
import * as shipments from './modules/shipments';
import * as customers from './modules/customers';
import * as loyalty from './modules/loyalty';
import * as privacy from './modules/privacy';
import * as purchasing from './modules/purchasing';
import * as pricing from './modules/pricing';
import * as invoicing from './modules/invoicing';
import * as carriers from './modules/carriers';

type Handler = (p: string[], body: unknown, query: URLSearchParams) => unknown | Promise<unknown>;
/** Runs a synchronous handler in one transaction: a refused request records nothing. */
const tx = (status: number, f: (p: string[], body: unknown, query: URLSearchParams) => unknown): [number, Handler] =>
  [status, (p, body, query) => db.transaction(() => f(p, body, query))()];

const routes: [string, RegExp, [number, Handler]][] = [
  ['GET', /^\/health$/, [200, () => ({ status: 'ok' })]],
  ['POST', /^\/products$/, tx(201, (_p, body) => catalogue.createProduct(body))],
  ['GET', /^\/products$/, tx(200, (_p, _b, q) => catalogue.listProducts(q.get('includeInactive') === 'true'))],
  ['GET', /^\/products\/([^/]+)$/, tx(200, ([sku]) => catalogue.getProduct(sku))],
  ['PATCH', /^\/products\/([^/]+)$/, tx(200, ([sku], body) => catalogue.updateProduct(sku, body))],
  ['POST', /^\/warehouses$/, tx(201, (_p, body) => stock.createWarehouse(body))],
  ['GET', /^\/warehouses$/, tx(200, () => stock.listWarehouses())],
  ['POST', /^\/stock\/movements$/, tx(201, (_p, body) => stock.recordMovement(body))],
  ['GET', /^\/stock\/([^/]+)$/, tx(200, ([sku]) => ({ ...stock.getStockLevel(sku), onOrder: purchasing.onOrder(sku) }))],
  ['GET', /^\/stock\/([^/]+)\/cost$/, tx(200, ([sku]) => stock.getCost(sku))],
  ['GET', /^\/stock\/([^/]+)\/cost-records$/, tx(200, ([sku]) => stock.listCostRecords(sku))],
  ['GET', /^\/stock\/([^/]+)\/movements$/, tx(200, ([sku]) => stock.listMovements(sku))],
  ['POST', /^\/discount-codes$/, tx(201, (_p, body) => orders.createDiscountCode(body))],
  ['POST', /^\/orders$/, tx(201, (_p, body) => orders.placeOrder(body))],
  ['GET', /^\/orders$/, tx(200, (_p, _b, q) => orders.listOrders(q.get('customerEmail')))],
  ['GET', /^\/orders\/([^/]+)$/, tx(200, ([id]) => orders.getOrder(id))],
  ['POST', /^\/orders\/([^/]+)\/cancellations$/, tx(200, ([id]) => orders.cancelOrder(id))],
  ['POST', /^\/orders\/([^/]+)\/stock-corrections$/, tx(200, ([id], body) => orders.correctStock(id, body))],
  ['POST', /^\/orders\/([^/]+)\/payments$/, [201, ([id]) => payments.payOrder(id)]],
  ['GET', /^\/orders\/([^/]+)\/payments$/, tx(200, ([id]) => payments.listPayments(id))],
  ['POST', /^\/orders\/([^/]+)\/shipments$/, tx(201, ([id], body) => shipments.shipOrder(id, body))],
  ['POST', /^\/orders\/([^/]+)\/returns$/, [201, ([id], body) => orders.returnGoods(id, body, payments.refundOrder, invoicing.creditReturn)]],
  ['GET', /^\/orders\/([^/]+)\/shipments$/, tx(200, ([id]) => shipments.listShipments(id))],
  ['POST', /^\/shipments\/([^/]+)\/failed-delivery$/, [200, ([id], body) => shipments.failDelivery(id, body, payments.refundOrder, invoicing.creditReturn)]],
  ['GET', /^\/orders\/([^/]+)\/returns$/, tx(200, ([id]) => orders.listReturns(id))],
  ['POST', /^\/customers$/, tx(201, (_p, body) => orders.adoptOrders(customers.createCustomer(body)))],
  ['GET', /^\/customers\/([^/]+)$/, tx(200, ([id]) => customers.getCustomer(id))],
  ['PATCH', /^\/customers\/([^/]+)$/, tx(200, ([id], body) => customers.updateCustomer(id, body))],
  ['POST', /^\/customers\/([^/]+)\/addresses$/, tx(201, ([id], body) => customers.addAddress(id, body))],
  ['GET', /^\/customers\/([^/]+)\/addresses$/, tx(200, ([id]) => customers.listAddresses(id))],
  ['DELETE', /^\/customers\/([^/]+)\/addresses\/([^/]+)$/, tx(200, ([id, address]) => { customers.removeAddress(id, address); return { removed: address }; })],
  ['GET', /^\/customers\/([^/]+)\/orders$/, tx(200, ([id]) => orders.listCustomerOrders(id))],
  ['GET', /^\/customers\/([^/]+)\/points$/, tx(200, ([id]) => loyalty.getBalance(id))],
  ['GET', /^\/customers\/([^/]+)\/points\/entries$/, tx(200, ([id]) => loyalty.listEntries(id))],
  ['POST', /^\/customers\/([^/]+)\/block$/, tx(200, ([id]) => customers.setBlocked(id, true))],
  ['POST', /^\/customers\/([^/]+)\/unblock$/, tx(200, ([id]) => customers.setBlocked(id, false))],
  ['POST', /^\/customers\/([^/]+)\/erasure$/, tx(200, ([id]) => privacy.eraseCustomer(id))],
  ['POST', /^\/customers\/([^/]+)\/removal$/, [200, ([id]) => privacy.removeCustomer(id, payments.refundOrder)]],
  ['PUT', /^\/customers\/([^/]+)\/points$/, tx(200, ([id], body) => loyalty.setBalance(id, body))],
  ['POST', /^\/suppliers$/, tx(201, (_p, body) => purchasing.createSupplier(body))],
  ['GET', /^\/suppliers$/, tx(200, () => purchasing.listSuppliers())],
  ['GET', /^\/suppliers\/([^/]+)$/, tx(200, ([id]) => purchasing.getSupplier(id))],
  ['POST', /^\/purchase-orders$/, tx(201, (_p, body) => purchasing.createPurchaseOrder(body))],
  ['GET', /^\/purchase-orders$/, tx(200, (_p, _b, q) => purchasing.listPurchaseOrders(q.get('supplierId')))],
  ['GET', /^\/purchase-orders\/([^/]+)$/, tx(200, ([id]) => purchasing.getPurchaseOrder(id))],
  ['POST', /^\/purchase-orders\/([^/]+)\/cancellations$/, tx(200, ([id]) => purchasing.cancelPurchaseOrder(id))],
  ['POST', /^\/purchase-orders\/([^/]+)\/closure$/, tx(200, ([id]) => purchasing.closePurchaseOrder(id))],
  ['POST', /^\/purchase-orders\/([^/]+)\/deliveries$/, tx(201, ([id], body) => purchasing.receiveDelivery(id, body))],
  ['PUT', /^\/products\/([^/]+)\/reorder-rule$/, tx(200, ([sku], body) => purchasing.setReorderRule(sku, body))],
  ['GET', /^\/reports\/low-stock$/, tx(200, () => purchasing.listLowStock())],
  ['GET', /^\/reports\/reorder-proposals$/, tx(200, () => purchasing.listReorderProposals())],
  ['POST', /^\/categories$/, tx(201, (_p, body) => catalogue.createCategory(body))],
  ['GET', /^\/categories$/, tx(200, () => catalogue.listCategories())],
  ['PATCH', /^\/categories\/([^/]+)$/, tx(200, ([code], body) => catalogue.updateCategory(code, body))],
  ['POST', /^\/customer-groups$/, tx(201, (_p, body) => customers.createGroup(body))],
  ['GET', /^\/customer-groups$/, tx(200, () => customers.listGroups())],
  ['PUT', /^\/customers\/([^/]+)\/group$/, tx(200, ([id], body) => customers.setGroup(id, body))],
  ['GET', /^\/customer-groups\/([^/]+)\/prices$/, tx(200, ([id]) => pricing.listGroupPrices(id))],
  ['PUT', /^\/customer-groups\/([^/]+)\/prices\/([^/]+)$/, tx(200, ([id, sku], body) => pricing.setGroupPrice(id, sku, body))],
  ['DELETE', /^\/customer-groups\/([^/]+)\/prices\/([^/]+)$/, tx(200, ([id, sku]) => { pricing.removeGroupPrice(id, sku); return { removed: sku }; })],
  ['POST', /^\/promotions$/, tx(201, (_p, body) => pricing.createPromotion(body))],
  ['GET', /^\/promotions$/, tx(200, () => pricing.listPromotions())],
  ['POST', /^\/promotions\/([^/]+)\/end$/, tx(200, ([id]) => pricing.endPromotion(id))],
  ['GET', /^\/invoices$/, tx(200, (_p, _b, q) => invoicing.listInvoices(q.get('orderId'), q.get('year')))],
  ['GET', /^\/invoices\/([^/]+)$/, tx(200, ([id]) => invoicing.getInvoice(id))],
  ['POST', /^\/invoices\/([^/]+)\/corrections$/, [201, ([id], body) => invoicing.correctAmount(id, body, payments.refundOrder)]],
  ['GET', /^\/credit-notes$/, tx(200, (_p, _b, q) => invoicing.listCreditNotes(q.get('orderId'), q.get('year')))],
  ['GET', /^\/credit-notes\/([^/]+)$/, tx(200, ([id]) => invoicing.getCreditNote(id))],
  ['POST', /^\/shipping-zones$/, tx(201, (_p, body) => carriers.createZone(body))],
  ['GET', /^\/shipping-zones$/, tx(200, () => carriers.listZones())],
  ['POST', /^\/carriers$/, tx(201, (_p, body) => carriers.createCarrier(body))],
  ['GET', /^\/carriers$/, tx(200, () => carriers.listCarriers())],
  ['PUT', /^\/carriers\/([^/]+)\/rates$/, tx(200, ([code], body) => carriers.setRate(code, body))],
  ['GET', /^\/carriers\/([^/]+)\/rates$/, tx(200, ([code]) => carriers.listRates(code))],
  ['GET', /^\/reports\/sales$/, tx(200, (_p, _b, q) => invoicing.salesReport(q.get('day')))],
  ['GET', /^\/reports\/payment-reconciliation$/, [200, (_p, _b, q) => payments.reconcile(q.get('from'), q.get('to'))]],
  ['POST', /^\/maintenance\/expire-orders$/, tx(200, (_p, body) => orders.expireOrders(body))],
];

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (c) => (text += c));
    req.on('error', reject);
    req.on('end', () => {
      if (text.trim() === '') return resolve(undefined);
      try { resolve(JSON.parse(text)); } catch { reject(invalid('the body is not JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    for (const [method, pattern, [status, handler]] of routes) {
      const m = req.method === method && url.pathname.match(pattern);
      if (!m) continue;
      const body = method === 'GET' ? undefined : await readBody(req);
      return send(status, await handler(m.slice(1).map(decodeURIComponent), body, url.searchParams));
    }
    throw notFound(`no ${req.method} ${url.pathname}`);
  } catch (e) {
    if (e instanceof ApiError) return send(e.status, { error: e.code, message: e.message });
    console.error(e);
    send(500, { error: 'internal_error', message: String((e as Error)?.message ?? e) });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log(`shop listening on ${process.env.PORT ?? 3000}`));
