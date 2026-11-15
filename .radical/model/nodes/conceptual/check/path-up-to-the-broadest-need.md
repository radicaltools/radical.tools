---
id: "4cdc86e2-eb18-4b1d-88e6-9fcc20022e96"
type: "scenario"
label: "Path up to the broadest need"
given: "a need Sell online with two needs inside it, Pay online and Ship orders; inside Pay online a need with a requirement, one of whose scenarios fails, and a requirement derived from that one; nothing derived from Ship orders"
then: "the path goes up from the derived requirement through its requirement and the needs to Sell online, each need broken as the failing scenario leaves its requirement; Sell online's path shows Ship orders with no requirement deriving from it; need-without-requirement names Ship orders only"
when: "the verification path of the derived requirement is asked for, then that of Sell online, and radical check runs"
---
