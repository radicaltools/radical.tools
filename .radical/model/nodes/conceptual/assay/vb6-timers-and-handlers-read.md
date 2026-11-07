---
id: "3c6863e0-5aac-486a-a114-2f55266c996f"
type: "scenario"
label: "VB6 timers and handlers read"
given: "a VB6 server with a Timer control of interval 60000, a custom button control with a Click handler, and a module whose Select Case calls HandleLogin"
then: "the timer is a job every 60000 ms with its handler line, the button a control, and HandleLogin a handler with its case"
when: "Assay reads it"
---
