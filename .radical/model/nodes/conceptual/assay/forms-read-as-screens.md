---
id: "9f539754-f002-4492-bb89-d42189bbee1f"
type: "scenario"
label: "Forms read as screens"
given: "a VB6 project with a sign-in form whose OK button's Click handler shows the main form, and a main form with a menu item that shows a report form"
then: "each form is a screen fact with its caption, size and controls at their positions, and the sign-in screen opens the main one through OK"
when: "Assay reads it"
---
