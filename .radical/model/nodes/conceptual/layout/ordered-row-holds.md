---
id: "8ee8ffba-a9ef-48b3-b63d-414b84fe77b1"
type: "scenario"
label: "Ordered row holds"
given: "the bookstore fixture is open on All elements and the user selects Payment Provider, then Customer (right to left on the canvas), and keeps them in a row with their order"
then: "Payment Provider is left of Customer after each step, Customer is pushed ahead rather than passed, and switching order-keeping off on the guide is saved"
when: "the user drags Payment Provider past Customer and runs Smart Layout"
---
