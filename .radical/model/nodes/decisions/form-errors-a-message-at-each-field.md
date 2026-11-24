---
id: "84859577-2c97-4afe-928c-af4e3e34ad1a"
type: "adr"
label: "Form errors: a message at each field"
alternatives: |
  1. A summary and a message at each field: for longer forms.
  2. Checks as each field is left: earlier feedback, more interruptions.
concern: "usability"
consequences: |
  • Short forms stay short: no summary block above two fields.
  • Errors out of view in a longer form would go unnoticed, hence the three-field limit.
  • Each field needs its message slot, written once in the design system.
context: "People use this web front end to get their tasks done, most of them without training and many on a small screen. The forces: every page added by a different person or team drifts a little from the others, until the same thing is named, placed and linked differently on each; a link repeated \"to be safe\" adds tab stops, screen-reader noise and the doubt whether two links lead to the same place; link names such as \"Read more\" say nothing out of context, and screen-reader users often list the links of a page on their own; forms are where people give up, and an error that is shown late, vaguely or out of sight costs the whole form; an empty list with no word of explanation looks broken; and usability problems are cheap to find with a few evaluators and a checklist, and expensive once users have learned to work around them."
date: "2026-11-24"
decision: "After a failed submit each field in error is marked aria-invalid=\"true\" and shows a message that says what went wrong and how to fix it, tied with aria-describedby, and focus moves to the first field in error. There is no error summary: this holds for forms of up to three fields that are all in view; a longer form follows the GOV.UK summary pattern and needs this record superseded. Nothing is checked before the user submits. The server checks every answer."
status: "accepted"
---
