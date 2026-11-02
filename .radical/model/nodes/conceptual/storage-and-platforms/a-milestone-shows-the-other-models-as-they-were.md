---
id: "8d7d9499-d061-44cc-aee3-e0b5796db668"
type: "scenario"
label: "A milestone shows the other models as they were"
given: "payments with orders fetched at v1 and a relation to Orders API"
then: "snapshots.json keeps payments' own elements and orders' v1 commit, nothing of orders; As-is shows Orders API under its v1 name with the line to it; the live model shows v2; without the v1 fetch As-is says to run radical federation fetch"
when: "a milestone As-is is made, orders moves to v2 (Orders API renamed), the pin and the fetch follow, and As-is is shown"
---
