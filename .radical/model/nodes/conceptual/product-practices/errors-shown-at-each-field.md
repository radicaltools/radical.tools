---
id: "80d49c76-ad53-4309-ae2f-fbf5faa449b8"
type: "requirement"
label: "Errors shown at each field"
action: "mark each field in error aria-invalid=\"true\", show at it a message tied to it with aria-describedby that says what went wrong and how to fix it, and move focus to the first field in error"
ears_type: "event-driven"
rationale: "In a short form every field is in view, so the message at the field and the focus on the first one are enough (WCAG 3.3.1 and 3.3.3; NN/g error-message guidelines: visible, near the problem, constructive)."
trigger: "a submitted form has answers that are missing or invalid"
---
