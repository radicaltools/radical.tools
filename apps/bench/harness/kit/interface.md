# The test interface

Every system in this benchmark designs its own HTTP API. The acceptance
tests speak one fixed interface instead. An **adapter** translates: a
JavaScript module that maps each function below onto the API of one system.

```js
// adapter.mjs
export function createAdapter(http) {
  return {
    async createProduct(input) {
      const res = await http.request('POST', '/products', { sku: input.sku, name: input.name, priceCents: input.priceCents });
      return http.result(res, (b) => ({ sku: b.sku, name: b.name, priceCents: b.priceCents, active: b.active }));
    },
    // …
  };
}
```

`http.request(method, path, body?, headers?)` returns `{ status, body }`.
`http.result(res, map)` turns an answer into the result every function
returns:

- `{ ok: true, value }` for a 2xx answer, `value` shaped as described below
- `{ ok: false, reason: 'not_found' }` for 404
- `{ ok: false, reason: 'unavailable' }` for 5xx
- `{ ok: false, reason: 'rejected' }` for any other answer

`http.unsupported()` returns `{ ok: false, reason: 'unsupported' }`: the
system has no way to do this at all.

## Rules for an adapter

An adapter is plumbing. It renames, reshapes and converts; it adds no
behaviour.

- Allowed: choosing the endpoint, renaming fields, converting units and
  signs, translating the system's own names for states and reasons into the
  names used here, picking fields out of a larger answer, making more than
  one request when the system's API needs several for one operation (for
  example to look up an id first).
- Not allowed: validating input, sorting or filtering lists, retrying,
  remembering anything between calls, computing a value the system does not
  report, turning a failure into a success or the other way round, hiding a
  missing feature. A list comes back in the order the system gave it.
- A field the system does not report at all is left `undefined`. Do not
  invent it.
- Always decide success and failure with `http.result`. The one exception:
  an operation the system reports as "nothing to do" with a 2xx answer is a
  success.
- A function for something the system cannot do returns
  `http.unsupported()`. Use it only when the system truly has no such
  capability, never because the mapping is awkward.

## Names used here

- Order status: `pending` (placed, waiting for payment), `paid`, `shipped`,
  `cancelled`, `expired`, `returned`. From step 26 an order can be sent in
  parts: it is `shipped` here once all of it has been sent; while only a
  part has been sent it is still `paid`.
- Stock movement kind: `receipt`, `adjustment`, `shipment`, `return`,
  `other`.
- Payment status: `succeeded`, `declined`.
- Kind of an entry in a customer's points history: `earned`, `spent`,
  `other`.
- Purchase order status: `open` (ordered, not everything has arrived),
  `received` (everything has arrived), `closed` (ended before everything
  arrived), `cancelled`.
- Kind of a promotion: `multibuy` (for a number of units of one product
  bought, a number of units of it are free), `bundle` (a set of products
  for one price), from step 30 `sale` (a percentage off every product).
- Shipment status (from step 27): `sent`, `failed` (the parcel came back
  undelivered).
- In a difference between the shop's payments and the provider's statement:
  kind `charge` or `refund`; problem `unknown_to_shop` (the provider lists
  it, the shop has no record of it), `unknown_to_provider` (the shop has it
  on record, the provider does not list it), `amount_differs` (both have
  it, with different amounts).
- A day is written `YYYY-MM-DD`; a time is an ISO string.
- The warehouse the shop started with is called `MAIN` here. If the system
  names it differently, translate both ways.
  If the system starts with no warehouse at all and has a way to make one,
  the adapter makes that first warehouse when it is missing, before the
  operation that needs it (look it up, create it if it is not there).
  Setting a system up the way its own API asks is not hiding a fault.

## Shapes

```
Product   { sku, name, priceCents, active,
            category,                            // from step 17: the code of the product's category, null when none
            weightGrams }                        // from step 25: the weight of one unit in grams, null when the system holds none
Stock     { onHand, reserved, available,
            backordered,                         // from step 8
            onOrder,                             // from step 13: units ordered from suppliers that have not arrived
            warehouses: [{ warehouse, onHand, reserved, available }] }   // from step 2
Movement  { quantity,      // signed: + goods in, − goods out
            kind, reference,   // reference: what the movement was for (e.g. an order id), null when none
            warehouse }        // from step 2
Order     { id, customerEmail, status, totalCents, createdAt,
            lines: [{ sku, quantity, unitPriceCents,
                      allocations: [{ warehouse, quantity }],   // from step 2: where the line is reserved
                      backorderedQuantity,                      // from step 8
                      unitCostCents,                            // from step 15: what one unit cost the shop, null when the system reports none
                      taxPercent, taxCents,                     // from step 17: the tax rate of the line and its tax, 0 when it has none
                      shippedQuantity }],                       // from step 26: units of the line that have been sent
            expiresAt,                                          // from step 3: ISO time, null when the order has no deadline
            subtotalCents, discountCents, discountCode,         // from step 6: discountCode null when none
            customerId,                                         // from step 9: the account the order belongs to, null when none
            shippingAddress,                                    // from step 9: { street, city, postalCode, country }, null when none
            pointsSpent, pointsDiscountCents,                   // from step 11: points used on the order and what they took off, 0 when none
            taxCents,                                           // from step 17: the tax of the order, 0 when none
            promotionDiscountCents,                             // from step 19: what promotions took off, 0 when none
            carrier,                                            // from step 25: the code of the carrier the order goes with, null when none
            shippingCents, shippingTaxCents }                   // from step 25: the shipping cost of the order and the tax in it, 0 when none
Payment   { status, amountCents, providerChargeId }             // providerChargeId: the id the payment provider gave
Warehouse { code, name }
Return    { id, refundCents, lines: [{ sku, quantity }] }
Discount  { code, percent }
Customer  { id, name, email, phone,          // each null when the system holds none
            blocked,                         // from step 12
            erased,                          // from step 12: true once the customer's personal data has been erased
            groupId }                        // from step 18: the customer group the account is in, null when none
Address   { id, street, city, postalCode, country }
PointsEntry { points,                        // signed: + points added, − points taken
              kind, reference }              // reference: what the entry was for (e.g. an order id), null when none
Supplier  { id, name, email }                // email null when none
PurchaseOrder { id, supplierId, status, warehouse, totalCostCents,
                lines: [{ sku, quantity, unitCostCents,
                          receivedQuantity }] }          // from step 14: units of the line that have arrived
ProductCost { averageCostCents,              // null when the system knows no cost for the product
              stockValueCents }
CostRecord  { quantity, unitCostCents,       // what came in and what one unit cost
              averageCostCents,              // the product's average cost after it
              reference }                    // what the record was for (e.g. a purchase order id), null when none
LowStock  { sku, available, onOrder, reorderPoint }
ReorderProposal { supplierId, lines: [{ sku, quantity }] }
Category  { code, name, taxPercent }
CustomerGroup { id, name }
GroupPrice { sku, priceCents }
Promotion { id, name, kind, active }         // active: false once the promotion has been ended
Invoice   { id, number,                      // number: as the system writes it
            year, sequence,                  // the two parts of the number: the year it belongs to and its place in that year's run (whole numbers)
            issuedOn,                        // the day the invoice is dated
            orderId,
            buyerName, buyerEmail,           // the buyer as the invoice shows them; each null when the invoice shows none
            buyerAddress,                    // { street, city, postalCode, country }, null when the invoice shows none
            totalCents, taxCents,            // the amount of the invoice and its tax
            lines: [{ sku, name, quantity, unitPriceCents, taxPercent,
                      totalCents, taxCents }],           // the amount of the line and its tax
            shippingCents, shippingTaxCents }            // from step 25: the shipping cost on the document and the tax in it, 0 when none
CreditNote { the fields of Invoice, and
             invoiceId }                     // the invoice the credit note is against
SalesReport { invoiceCount, creditNoteCount,
              invoicedCents, invoicedTaxCents,           // the amounts of the day's invoices and their tax
              creditedCents, creditedTaxCents,           // the amounts of the day's credit notes and their tax
              byTaxRate: [{ taxPercent, invoicedCents, invoicedTaxCents, creditedCents, creditedTaxCents }] }
ShippingZone { code, name, countries: [country, …] }        // countries as two-letter codes
Carrier   { code, name }
CarrierRate { zone, maxWeightGrams, priceCents }            // what the carrier charges for a parcel of up to that weight into the zone
Shipment  { id, warehouse,                                  // the warehouse the shipment left from
            lines: [{ sku, quantity }],                     // what is in it
            invoiceId,                                      // the invoice of the shipment
            status }                                        // from step 27
Reconciliation { shopChargedCents, providerChargedCents,     // what was charged in the period according to each side
                 shopRefundedCents, providerRefundedCents,   // what was given back in the period according to each side
                 differences: [{ kind, problem,
                                 providerChargeId,           // the provider's id of the charge (for a refund: of the charge it is against)
                                 orderId,                    // the order concerned, null when the system names none
                                 shopCents, providerCents }] }   // the amount on each side, null where that side has none
```

The amounts of a credit note, the credited figures of a sales report and
the amounts of a reconciliation are given here as amounts above zero: how
much was credited, charged or given back. A system that keeps them below
zero is translated.

## Functions

From step 0:

- `createProduct({ sku, name, priceCents })` → Product
- `getProduct(sku)` → Product
- `updateProduct(sku, { name?, priceCents?, active? })` → Product. Only the
  fields given change. `active: false` takes the product off sale.
- `listProducts({ includeInactive })` → Product[]
- `receiveStock({ sku, quantity, warehouse? })` → null. Goods came in.
- `adjustStock({ sku, quantity, warehouse? })` → null. A correction after a
  count; `quantity` is signed.
- `getStock(sku)` → Stock
- `listStockMovements(sku)` → Movement[], the product's stock history
- `placeOrder({ customerEmail, lines: [{ sku, quantity }], discountCode? })` → Order
- `getOrder(id)` → Order
- `listOrders({ customerEmail })` → Order[], the orders of one customer
- `payOrder(orderId)` → Payment. One attempt to charge the order through the
  payment provider. A declined payment is a success of this function with
  `status: 'declined'`.
- `listPayments(orderId)` → Payment[]
- `shipOrder(orderId)` → null

From step 1:

- `cancelOrder(orderId)` → Order

From step 2:

- `createWarehouse({ code, name })` → Warehouse
- `listWarehouses()` → Warehouse[]
- `warehouse` in `receiveStock`, `adjustStock`, and later functions: the
  warehouse code; left out means the caller named none.

From step 3:

- `expireOrders(now)` → `{ expired: [orderId, …] }`. Runs the job that
  expires unpaid orders, assuming the time `now` (an ISO string), or the
  real time when `now` is null.

From step 4:

- `correctStock(orderId, { sku, onHand, warehouse? })` → null. Support sets
  the counted quantity of a product from an order.

From step 5:

- `returnItems(orderId, { lines: [{ sku, quantity }], warehouse? })` → Return
- `listReturns(orderId)` → Return[]

From step 6:

- `createDiscountCode({ code, percent })` → Discount

Steps 7 and 8 add no functions.

From step 9:

- `createCustomer({ name, email, phone? })` → Customer. Opens a customer
  account.
- `getCustomer(id)` → Customer
- `updateCustomer(id, { name?, email?, phone? })` → Customer. Only the
  fields given change.
- `addAddress(customerId, { street, city, postalCode, country })` → Address
- `listAddresses(customerId)` → Address[]
- `removeAddress(customerId, addressId)` → null
- `placeOrder` also takes `customerId` (the order is placed on that
  account; `customerEmail` is then left out) and, with it,
  `shippingAddressId` (one of the account's addresses).
- `listCustomerOrders(customerId)` → Order[], the orders of one account

From step 10:

- `getPoints(customerId)` → `{ balance }`, the customer's loyalty points
- `listPointsHistory(customerId)` → PointsEntry[], every change of the
  customer's points, oldest first

From step 11:

- `placeOrder` also takes `pointsToSpend`: how many of the customer's
  points to use on the order.

From step 12:

- `blockCustomer(customerId)` → Customer
- `unblockCustomer(customerId)` → Customer
- `eraseCustomer(customerId)` → null. Erases the customer's personal data.

From step 13:

- `createSupplier({ name, email? })` → Supplier
- `getSupplier(id)` → Supplier
- `listSuppliers()` → Supplier[]
- `createPurchaseOrder({ supplierId, lines: [{ sku, quantity, unitCostCents }], warehouse? })`
  → PurchaseOrder. Goods ordered from a supplier; `unitCostCents` is the
  price agreed for one unit.
- `getPurchaseOrder(id)` → PurchaseOrder
- `listPurchaseOrders({ supplierId })` → PurchaseOrder[], the purchase
  orders of one supplier
- `cancelPurchaseOrder(id)` → PurchaseOrder

From step 14:

- `receivePurchaseOrder(id, { lines: [{ sku, quantity }] })` →
  PurchaseOrder. One delivery of goods of that purchase order came in.
- `closePurchaseOrder(id)` → PurchaseOrder. Ends a purchase order whose
  remaining goods will not come.

From step 15:

- `getProductCost(sku)` → ProductCost
- `listCostHistory(sku)` → CostRecord[], the product's cost history
- `receiveStock` also takes `unitCostCents`: what one unit of these goods
  cost; left out means the caller named none.

From step 16:

- `setReorderRule(sku, { reorderPoint, targetLevel, supplierId })` → null.
  Sets, or replaces, when the product counts as running low, the level to
  fill it up to and the supplier to order it from.
- `listLowStock()` → LowStock[], the products running low
- `listReorderProposals()` → ReorderProposal[], what the system proposes to
  order from which supplier

From step 17:

- `createCategory({ code, name, taxPercent })` → Category. A product
  category with its tax rate.
- `listCategories()` → Category[]
- `updateCategory(code, { name?, taxPercent? })` → Category. Only the fields
  given change.
- `createProduct` and `updateProduct` also take `category`: the code of the
  category the product is in; in `updateProduct`, `null` takes the product
  out of its category.

From step 18:

- `createCustomerGroup({ name })` → CustomerGroup
- `listCustomerGroups()` → CustomerGroup[]
- `setCustomerGroup(customerId, groupId)` → Customer. Puts the customer
  into the group; `groupId` null takes the customer out of any group.
- `setGroupPrice(groupId, { sku, priceCents })` → null. Sets, or replaces,
  the price of a product on the group's price list.
- `removeGroupPrice(groupId, sku)` → null. Takes the product off the
  group's price list.
- `listGroupPrices(groupId)` → GroupPrice[], the group's price list

From step 19:

- `createPromotion({ name, kind: 'multibuy', sku, buyQuantity, freeQuantity })`
  → Promotion. Buy `buyQuantity` units of the product, get `freeQuantity`
  more of it free.
- `createPromotion({ name, kind: 'bundle', items: [{ sku, quantity }], priceCents })`
  → Promotion. The products of `items` together, as a set, for
  `priceCents`.
- `listPromotions()` → Promotion[]
- `endPromotion(id)` → Promotion

Step 20 adds no functions.

From step 21:

- `shipOrder(orderId, { at }?)`: `at` is the time to assume for the
  shipment; left out means the caller named none.
- `listOrderInvoices(orderId)` → Invoice[], the invoices of one order
- `listInvoices({ year })` → Invoice[], the invoices of one year (`year` a
  whole number)
- `getInvoice(id)` → Invoice

From step 22:

- `returnItems` also takes `at`: the time to assume for the return; left
  out means the caller named none.
- `listOrderCreditNotes(orderId)` → CreditNote[], the credit notes of one
  order
- `listCreditNotes({ year })` → CreditNote[], the credit notes of one year
- `getCreditNote(id)` → CreditNote

From step 23:

- `getSalesReport(day)` → SalesReport, the sales report of one day

From step 24:

- `reconcilePayments({ from, to })` → Reconciliation. Compares the payment
  provider's statement for the period between the two times with the
  shop's own records.

From step 25:

- `createProduct` and `updateProduct` also take `weightGrams`: the weight
  of one unit.
- `createShippingZone({ code, name, countries })` → ShippingZone. A group
  of countries that carriers have prices for.
- `listShippingZones()` → ShippingZone[]
- `createCarrier({ code, name })` → Carrier
- `listCarriers()` → Carrier[]
- `setCarrierRate(carrierCode, { zone, maxWeightGrams, priceCents })` →
  null. Sets, or replaces, what the carrier charges for a parcel of up to
  that weight into the zone (`zone` is the zone's code).
- `listCarrierRates(carrierCode)` → CarrierRate[], the carrier's prices
- `placeOrder` also takes `carrier`: the code of the carrier the customer
  picked; left out means the caller named none.

From step 26:

- `shipOrderPart(orderId, { warehouse, at? })` → Shipment. Sends the part
  of the order that is in that warehouse; `at` as in `shipOrder`.
- `listShipments(orderId)` → Shipment[], the shipments of one order
- `shipOrder` still sends the whole order.

From step 27:

- `reportFailedDelivery(shipmentId, { at }?)` → Shipment. The parcel of
  that shipment came back undelivered; `at` is the time to assume, left
  out means the caller named none.

From step 28:

- `correctInvoiceAmount(invoiceId, { totalCents, at? })` → null. Service
  corrects the amount of an invoice to `totalCents`; `at` is the time to
  assume, left out means the caller named none.

From step 29:

- `removeCustomer(customerId)` → null. Removes a customer completely.

From step 30:

- `createPromotion({ name, kind: 'sale', percent })` → Promotion. A sale:
  `percent` off every product while it runs. It ends with `endPromotion`.

From step 31:

- `setPointsBalance(customerId, { balance })` → `{ balance }`. Service
  sets the customer's points balance to that number.
