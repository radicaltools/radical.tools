---
id: "9b4ef8fc-9df8-4cd4-b88a-fa598c729b5c"
type: "adr"
label: "Link targets repeated at most a set number of times"
alternatives: |
  1. At most once: the simplest rule, enough for applications.
  2. No rule: the same link five times on one page.
concern: "usability"
consequences: |
  • Long pages may offer their main action again where the reader ends.
  • Each repeat still costs a tab stop; the limit keeps it at 2.
  • Cards and list items need the stretched-link pattern, written once in the design system.
context: "People use this web front end to get their tasks done, most of them without training and many on a small screen. The forces: every page added by a different person or team drifts a little from the others, until the same thing is named, placed and linked differently on each; a link repeated \"to be safe\" adds tab stops, screen-reader noise and the doubt whether two links lead to the same place; link names such as \"Read more\" say nothing out of context, and screen-reader users often list the links of a page on their own; forms are where people give up, and an error that is shown late, vaguely or out of sight costs the whole form; an empty list with no word of explanation looks broken; and usability problems are cheap to find with a few evaluators and a checklist, and expensive once users have learned to work around them."
date: "2026-11-24"
decision: "In a page's main content each target is linked at most 2 times, outside its navigation (breadcrumbs and tables of contents are navigation). A card, list item or table row whose image, title and button go to the same place counts as one link and is built as one (the title is the link, stretched over the card). Repeats are for a call to action at the top and the end of a long page, not for every mention. Link names: a link name that says where it goes together with its context. Measured as ux.links.repeated.max on every pull request."
status: "accepted"
---
