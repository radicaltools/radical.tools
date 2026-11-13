// The adapter of the reference implementation (reference/shop).
export function createAdapter(http) {
  const product = (b) => ({ sku: b.sku, name: b.name, priceCents: b.priceCents, active: b.active, category: b.category, weightGrams: b.weightGrams });
  const order = (b) => ({
    id: b.id, customerEmail: b.customerEmail, status: b.status, totalCents: b.totalCents, createdAt: b.createdAt,
    lines: b.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPriceCents: l.unitPriceCents, allocations: l.allocations, backorderedQuantity: l.backorderedQuantity, unitCostCents: l.unitCostCents, taxPercent: l.taxPercent, taxCents: l.taxCents, shippedQuantity: l.shippedQuantity })),
    expiresAt: b.expiresAt, subtotalCents: b.subtotalCents, discountCents: b.discountCents, discountCode: b.discountCode,
    customerId: b.customerId, shippingAddress: b.shippingAddress, pointsSpent: b.pointsSpent, pointsDiscountCents: b.pointsDiscountCents,
    taxCents: b.taxCents, promotionDiscountCents: b.promotionDiscountCents,
    carrier: b.carrier, shippingCents: b.shippingCents, shippingTaxCents: b.shippingTaxCents,
  });
  const customer = (b) => ({ id: b.id, name: b.name, email: b.email, phone: b.phone, blocked: b.blocked, erased: b.erased, groupId: b.groupId });
  const category = (b) => ({ code: b.code, name: b.name, taxPercent: b.vatPercent });
  const group = (b) => ({ id: b.id, name: b.name });
  const promotion = (b) => ({ id: b.id, name: b.name, kind: b.kind, active: b.active });
  const documentLine = (l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents, taxPercent: l.taxPercent, totalCents: l.totalCents, taxCents: l.taxCents });
  const document = (b) => ({
    id: b.id, number: b.number, year: b.year, sequence: b.sequence, issuedOn: b.issuedOn, orderId: b.orderId,
    buyerName: b.buyer.name, buyerEmail: b.buyer.email, buyerAddress: b.buyer.address,
    totalCents: b.totalCents, taxCents: b.taxCents, shippingCents: b.shippingCents, shippingTaxCents: b.shippingTaxCents,
  });
  const shipment = (b) => ({ id: b.id, warehouse: b.warehouse, status: b.status, invoiceId: b.invoiceId, lines: b.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })) });
  const zone = (b) => ({ code: b.code, name: b.name, countries: b.countries });
  const carrier = (b) => ({ code: b.code, name: b.name });
  const invoice = (b) => ({ ...document(b), lines: b.lines.map(documentLine) });
  const creditNote = (b) => ({ ...document(b), invoiceId: b.invoiceId, lines: b.lines.map(documentLine) });
  const vat = (c) => ({ ...(c.name === undefined ? {} : { name: c.name }), ...(c.taxPercent === undefined ? {} : { vatPercent: c.taxPercent }) });
  const address = (b) => ({ id: b.id, street: b.street, city: b.city, postalCode: b.postalCode, country: b.country });
  const entry = (b) => ({ points: b.points, kind: b.kind === 'earned' || b.kind === 'spent' ? b.kind : 'other', reference: b.reference });
  const supplier = (b) => ({ id: b.id, name: b.name, email: b.email });
  const purchaseOrder = (b) => ({
    id: b.id, supplierId: b.supplierId, warehouse: b.warehouse, status: b.status, totalCostCents: b.totalCostCents,
    lines: b.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitCostCents: l.unitCostCents, receivedQuantity: l.receivedQuantity })),
  });
  const payment = (b) => ({ status: b.status, amountCents: b.amountCents, providerChargeId: b.providerChargeId });
  const ret = (b) => ({ id: b.id, refundCents: b.refundCents, lines: b.lines });
  const movement = (kind) => async ({ sku, quantity, warehouse, unitCostCents }) =>
    http.result(await http.request('POST', '/stock/movements', { sku, quantity, reason: kind, ...(warehouse ? { warehouse } : {}), ...(unitCostCents === undefined ? {} : { unitCostCents }) }), () => null);
  const req = http.request;
  return {
    createProduct: async (p) => http.result(await req('POST', '/products', p), product),
    getProduct: async (sku) => http.result(await req('GET', `/products/${sku}`), product),
    updateProduct: async (sku, patch) => http.result(await req('PATCH', `/products/${sku}`, patch), product),
    listProducts: async ({ includeInactive }) => http.result(await req('GET', `/products${includeInactive ? '?includeInactive=true' : ''}`), (b) => b.map(product)),
    receiveStock: movement('receipt'),
    adjustStock: movement('adjustment'),
    getStock: async (sku) => http.result(await req('GET', `/stock/${sku}`)),
    listStockMovements: async (sku) => http.result(await req('GET', `/stock/${sku}/movements`), (b) => b.map((m) => ({ quantity: m.quantity, kind: m.reason, reference: m.reference, warehouse: m.warehouse }))),
    placeOrder: async (o) => http.result(await req('POST', '/orders', o), order),
    getOrder: async (id) => http.result(await req('GET', `/orders/${id}`), order),
    listOrders: async ({ customerEmail }) => http.result(await req('GET', `/orders?customerEmail=${encodeURIComponent(customerEmail)}`), (b) => b.map(order)),
    payOrder: async (id) => http.result(await req('POST', `/orders/${id}/payments`), payment),
    listPayments: async (id) => http.result(await req('GET', `/orders/${id}/payments`), (b) => b.map(payment)),
    shipOrder: async (id, options) => http.result(await req('POST', `/orders/${id}/shipments`, options?.at ? { at: options.at } : undefined), () => null),
    cancelOrder: async (id) => http.result(await req('POST', `/orders/${id}/cancellations`), order),
    createWarehouse: async (w) => http.result(await req('POST', '/warehouses', w)),
    listWarehouses: async () => http.result(await req('GET', '/warehouses')),
    expireOrders: async (now) => http.result(await req('POST', '/maintenance/expire-orders', now ? { now } : undefined)),
    correctStock: async (id, body) => http.result(await req('POST', `/orders/${id}/stock-corrections`, body), () => null),
    returnItems: async (id, body) => http.result(await req('POST', `/orders/${id}/returns`, body), ret),
    listReturns: async (id) => http.result(await req('GET', `/orders/${id}/returns`), (b) => b.map(ret)),
    createDiscountCode: async (d) => http.result(await req('POST', '/discount-codes', d)),
    createCustomer: async (c) => http.result(await req('POST', '/customers', c), customer),
    getCustomer: async (id) => http.result(await req('GET', `/customers/${id}`), customer),
    updateCustomer: async (id, patch) => http.result(await req('PATCH', `/customers/${id}`, patch), customer),
    addAddress: async (id, a) => http.result(await req('POST', `/customers/${id}/addresses`, a), address),
    listAddresses: async (id) => http.result(await req('GET', `/customers/${id}/addresses`), (b) => b.map(address)),
    removeAddress: async (id, addressId) => http.result(await req('DELETE', `/customers/${id}/addresses/${addressId}`), () => null),
    listCustomerOrders: async (id) => http.result(await req('GET', `/customers/${id}/orders`), (b) => b.map(order)),
    getPoints: async (id) => http.result(await req('GET', `/customers/${id}/points`), (b) => ({ balance: b.balance })),
    listPointsHistory: async (id) => http.result(await req('GET', `/customers/${id}/points/entries`), (b) => b.map(entry)),
    blockCustomer: async (id) => http.result(await req('POST', `/customers/${id}/block`), customer),
    unblockCustomer: async (id) => http.result(await req('POST', `/customers/${id}/unblock`), customer),
    eraseCustomer: async (id) => http.result(await req('POST', `/customers/${id}/erasure`), () => null),
    createSupplier: async (s) => http.result(await req('POST', '/suppliers', s), supplier),
    getSupplier: async (id) => http.result(await req('GET', `/suppliers/${id}`), supplier),
    listSuppliers: async () => http.result(await req('GET', '/suppliers'), (b) => b.map(supplier)),
    createPurchaseOrder: async (p) => http.result(await req('POST', '/purchase-orders', p), purchaseOrder),
    getPurchaseOrder: async (id) => http.result(await req('GET', `/purchase-orders/${id}`), purchaseOrder),
    listPurchaseOrders: async ({ supplierId }) => http.result(await req('GET', `/purchase-orders?supplierId=${encodeURIComponent(supplierId)}`), (b) => b.map(purchaseOrder)),
    cancelPurchaseOrder: async (id) => http.result(await req('POST', `/purchase-orders/${id}/cancellations`), purchaseOrder),
    receivePurchaseOrder: async (id, body) => http.result(await req('POST', `/purchase-orders/${id}/deliveries`, body), purchaseOrder),
    closePurchaseOrder: async (id) => http.result(await req('POST', `/purchase-orders/${id}/closure`), purchaseOrder),
    getProductCost: async (sku) => http.result(await req('GET', `/stock/${sku}/cost`), (b) => ({ averageCostCents: b.averageCostCents, stockValueCents: b.stockValueCents })),
    listCostHistory: async (sku) => http.result(await req('GET', `/stock/${sku}/cost-records`), (b) => b.map((r) => ({ quantity: r.quantity, unitCostCents: r.unitCostCents, averageCostCents: r.averageCostCents, reference: r.reference }))),
    setReorderRule: async (sku, rule) => http.result(await req('PUT', `/products/${sku}/reorder-rule`, rule), () => null),
    listLowStock: async () => http.result(await req('GET', '/reports/low-stock'), (b) => b.map((l) => ({ sku: l.sku, available: l.available, onOrder: l.onOrder, reorderPoint: l.reorderPoint }))),
    listReorderProposals: async () => http.result(await req('GET', '/reports/reorder-proposals'), (b) => b.map((p) => ({ supplierId: p.supplierId, lines: p.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })) }))),
    createCategory: async (c) => http.result(await req('POST', '/categories', { code: c.code, ...vat(c) }), category),
    listCategories: async () => http.result(await req('GET', '/categories'), (b) => b.map(category)),
    updateCategory: async (code, patch) => http.result(await req('PATCH', `/categories/${code}`, vat(patch)), category),
    createCustomerGroup: async (g) => http.result(await req('POST', '/customer-groups', g), group),
    listCustomerGroups: async () => http.result(await req('GET', '/customer-groups'), (b) => b.map(group)),
    setCustomerGroup: async (id, groupId) => http.result(await req('PUT', `/customers/${id}/group`, { groupId }), customer),
    setGroupPrice: async (groupId, { sku, priceCents }) => http.result(await req('PUT', `/customer-groups/${groupId}/prices/${sku}`, { priceCents }), () => null),
    removeGroupPrice: async (groupId, sku) => http.result(await req('DELETE', `/customer-groups/${groupId}/prices/${sku}`), () => null),
    listGroupPrices: async (groupId) => http.result(await req('GET', `/customer-groups/${groupId}/prices`), (b) => b.map((p) => ({ sku: p.sku, priceCents: p.priceCents }))),
    createPromotion: async (p) => http.result(await req('POST', '/promotions', p), promotion),
    listPromotions: async () => http.result(await req('GET', '/promotions'), (b) => b.map(promotion)),
    endPromotion: async (id) => http.result(await req('POST', `/promotions/${id}/end`), promotion),
    getInvoice: async (id) => http.result(await req('GET', `/invoices/${id}`), invoice),
    listOrderInvoices: async (orderId) => http.result(await req('GET', `/invoices?orderId=${encodeURIComponent(orderId)}`), (b) => b.map(invoice)),
    listInvoices: async ({ year }) => http.result(await req('GET', `/invoices?year=${year}`), (b) => b.map(invoice)),
    getCreditNote: async (id) => http.result(await req('GET', `/credit-notes/${id}`), creditNote),
    listOrderCreditNotes: async (orderId) => http.result(await req('GET', `/credit-notes?orderId=${encodeURIComponent(orderId)}`), (b) => b.map(creditNote)),
    listCreditNotes: async ({ year }) => http.result(await req('GET', `/credit-notes?year=${year}`), (b) => b.map(creditNote)),
    getSalesReport: async (day) => http.result(await req('GET', `/reports/sales?day=${encodeURIComponent(day)}`), (b) => ({
      invoiceCount: b.invoiceCount, creditNoteCount: b.creditNoteCount, invoicedCents: b.invoicedCents, invoicedTaxCents: b.invoicedTaxCents,
      creditedCents: b.creditedCents, creditedTaxCents: b.creditedTaxCents,
      byTaxRate: b.byTaxRate.map((r) => ({ taxPercent: r.taxPercent, invoicedCents: r.invoicedCents, invoicedTaxCents: r.invoicedTaxCents, creditedCents: r.creditedCents, creditedTaxCents: r.creditedTaxCents })),
    })),
    createShippingZone: async (z) => http.result(await req('POST', '/shipping-zones', z), zone),
    listShippingZones: async () => http.result(await req('GET', '/shipping-zones'), (b) => b.map(zone)),
    createCarrier: async (c) => http.result(await req('POST', '/carriers', c), carrier),
    listCarriers: async () => http.result(await req('GET', '/carriers'), (b) => b.map(carrier)),
    setCarrierRate: async (code, rate) => http.result(await req('PUT', `/carriers/${code}/rates`, rate), () => null),
    listCarrierRates: async (code) => http.result(await req('GET', `/carriers/${code}/rates`), (b) => b.map((r) => ({ zone: r.zone, maxWeightGrams: r.maxWeightGrams, priceCents: r.priceCents }))),
    shipOrderPart: async (id, { warehouse, at }) => http.result(await req('POST', `/orders/${id}/shipments`, { warehouse, ...(at ? { at } : {}) }), (b) => shipment(b[0])),
    listShipments: async (id) => http.result(await req('GET', `/orders/${id}/shipments`), (b) => b.map(shipment)),
    reportFailedDelivery: async (id, options) => http.result(await req('POST', `/shipments/${id}/failed-delivery`, options?.at ? { at: options.at } : undefined), shipment),
    correctInvoiceAmount: async (id, { totalCents, at }) => http.result(await req('POST', `/invoices/${id}/corrections`, { totalCents, ...(at ? { at } : {}) }), () => null),
    removeCustomer: async (id) => http.result(await req('POST', `/customers/${id}/removal`), () => null),
    setPointsBalance: async (id, { balance }) => http.result(await req('PUT', `/customers/${id}/points`, { balance }), (b) => ({ balance: b.balance })),
    reconcilePayments: async ({ from, to }) => http.result(await req('GET', `/reports/payment-reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`), (b) => ({
      shopChargedCents: b.shopChargedCents, providerChargedCents: b.providerChargedCents, shopRefundedCents: b.shopRefundedCents, providerRefundedCents: b.providerRefundedCents,
      differences: b.differences.map((d) => ({ kind: d.kind, problem: d.problem, providerChargeId: d.providerChargeId, orderId: d.orderId, shopCents: d.shopCents, providerCents: d.providerCents })),
    })),
  };
}
