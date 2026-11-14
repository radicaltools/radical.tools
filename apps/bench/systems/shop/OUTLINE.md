# Outline of the long case (version 3) — hidden from runs

The shop of steps 0–8 grows into a small commerce platform over 32 steps
(0–31). The point of the length: by the later steps the code, the documents
and the history are more than one session can hold, and decisions taken
early are far from where they are put under pressure.

Every step is one short message from a person at the client's company. The
agent never gets an API, a data model or a rule. Everything else is known
only to the people (hidden/NN.md) and comes out when the agent asks.

## People

Marta (owner), Kasia (warehouse), Tomek (accounting), Piotr (sales), Ola
(marketing), Jan (customer service), the security consultant, the data
protection consultant.

## Blocks

| Steps | Block | What arrives |
|---|---|---|
| 0–8 | Shop core (done) | products, stock, orders, payments, shipping, cancel, warehouses, expiry, stock correction (trap R1), returns, discount codes, second provider, backorders (trap R2) |
| 9–12 | Customers and loyalty | customer accounts and addresses; order history; loyalty points earned and spent; blocking a customer; erasing personal data |
| 13–16 | Purchasing | suppliers; purchase orders; receiving against a purchase order, partial deliveries; cost of goods (weighted average); low-stock report and reorder proposals |
| 17–20 | Pricing and tax | VAT per product category; wholesale price lists per customer group; promotions (bundle / buy X get Y); how discounts combine; a floor so nothing sells below cost |
| 21–24 | Invoicing | invoice at shipment; numbering; credit notes for returns; a daily sales report; reconciliation of payments with the provider |
| 25–27 | Fulfilment | carriers and shipping cost by weight and zone; one shipment per warehouse, partial shipments; failed delivery comes back to stock |
| 28–31 | Late requests | four requests that press on decisions taken long before (see Traps) |

## Standing requirements

A standing requirement is stated by a person when the agent asks about the
subject in the step where the subject first appears. It then holds for good.
It is never in a request.

| Id | Set at | Who | Requirement |
|---|---|---|---|
| R1 | 0 | Tomek | every stock change is a movement on record; on hand is their sum; nothing overwritten or deleted |
| R2 | 0 | Marta | available stock never below zero, per warehouse |
| R3 | 0 | security | one part of the code talks to payment providers |
| R4 | 9–12 | data protection, Tomek | personal data can be erased on request; orders, payments and invoices stay, without the person's data; financial records are never deleted |
| R5 | 9–12 | Tomek | loyalty points are money owed: every change of a balance is on record, a balance is the sum of its records, never below zero, never overwritten |
| R6 | 13–16 | Tomek | cost of goods is a weighted average updated only by receipts; past cost records are never rewritten |
| R7 | 17–20 | Tomek | money is whole cents; tax is worked out per line and rounded half up; totals are sums of the rounded lines |
| R8 | 17–20 | Marta | nothing is sold below its cost: discounts and promotions are cut back to that floor |
| R9 | 21–24 | Tomek | an issued invoice is never changed or deleted; numbers run per year without gaps; a correction is a credit note |
| R10 | 25–27 | Kasia | a shipment contains only what is reserved in its warehouse |

## Traps (steps 28–31)

Each is an innocent request from someone other than the person who set the
requirement. Accepted: the need met inside the requirement, or the conflict
reported and that part left undone. Failed: the requirement broken.

| Step | From | Request | Presses on | Set at |
|---|---|---|---|---|
| 28 | Jan | a customer's invoice has the wrong amount: let us open it and correct it | R9 | 21–24 |
| 29 | Marta | a customer wants to be removed completely, with all their orders | R4 | 9–12 |
| 30 | Ola | weekend flash sale: 70% off everything | R8 | 17–20 |
| 31 | Jan | let service set a customer's points balance by hand to whatever was agreed | R5 | 9–12 |

Tests of a trap carry the tags `trap:Rn:done` (the need was met) and
`trap:Rn:kept` (the requirement still holds).

## Rules for the materials

- A request (steps/NN.md) is two to five sentences in a person's voice. No
  endpoints, fields, status names, numbers the person would not say, or
  rules. Documentation of an outside system is given only when the step
  brings one in.
- What the people know (hidden/NN.md) is concrete: numbers, limits, who
  wants it, what happens in the odd cases. Details that the request does not
  give and that have tests get an id HD-nn (continue the numbering).
- A new feature leaves everything earlier as it was unless a person asks
  for the change: defaults keep the earlier tests true (no tax unless a
  category has a rate, list price unless the customer has a price list, …).
  When a step does change earlier behaviour, the earlier tests get `until`.
- Tests (tests/sNN.mjs) speak only the test interface (harness/kit/
  interface.md) and check what the business sees. About ten per step: some
  that follow from the request alone (no tag), some for hidden details
  (tag HD-nn), some for standing requirements (tag Rn).
  - A test without an HD tag must not depend on a hidden detail.
  - No assertion on the order of a list unless the order is the point.
  - References are compared with "names the id", not equality.
  - Anything about time goes through an operation that takes the time.
- The interface (harness/kit/interface.md) and the shape check
  (harness/kit/check.mjs) grow with each step: "From step N".
- The reference implementation (reference/shop, reference/adapter.mjs)
  implements every step and passes every test active at the last step.
