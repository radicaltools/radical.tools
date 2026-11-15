---
id: "554972dd-c6d5-4fd5-a7d0-689fb533f349"
type: "scenario"
label: "Another model's group kept its own"
given: "payments depends on orders, which has a group of views per element"
then: "orders' group lists its views under it, and no view of payments is made, renamed, moved or removed because of it"
when: "orders is fetched, payments' model is read and its groups and viewpoints are brought in step"
---
