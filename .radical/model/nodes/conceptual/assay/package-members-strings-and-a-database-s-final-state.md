---
id: "a724ed72-0c22-4f41-a7bb-760ce3622b2e"
type: "scenario"
label: "Package members, strings and a database's final state"
given: "a package body whose member declares a local procedure and holds a string over several lines with -- in it and a q'[…]' string, an installer creating a helper package and dropping it at its end, a teardown script dropping everything, and a demo script calling pdf.add_page;"
then: "the package's members are header and add_page only, the helper is gone, the teardown drops nothing, and the demos project calls pdf.add_page and depends on the ora project"
when: "Assay reads and links them"
---
