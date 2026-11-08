---
id: "450c1eac-3830-429f-abde-b96fc83d05a3"
type: "scenario"
label: "Status kept in quoted values read"
given: "VB6 code that saves invoices with Paid = \"N\", sets Paid = \"Y\" when one is paid, and selects WHERE Paid = 'N'"
then: "there is a state fact Paid with the values N and Y and the lines that set each"
when: "Assay reads it"
---
