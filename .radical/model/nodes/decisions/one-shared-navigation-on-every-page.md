---
id: "aed804e8-d136-4eb1-9199-942fa27af811"
type: "adr"
label: "One shared navigation on every page"
alternatives: |
  1. A shared global navigation with a navigation per section: for large sites with distinct areas.
  2. No navigation, a linear journey: for transactional services.
  3. Navigation built per page: fastest to start, and the drift this record prevents.
concern: "usability"
consequences: |
  • Navigation is learned once and found in the same place on every page (WCAG 3.2.3).
  • A new destination is one change in one component, reviewed with the navigation test.
  • Destinations beyond about seven need grouping or a second level; past that, a navigation per section serves better.
context: "People use this web front end to get their tasks done, most of them without training and many on a small screen. The forces: every page added by a different person or team drifts a little from the others, until the same thing is named, placed and linked differently on each; a link repeated \"to be safe\" adds tab stops, screen-reader noise and the doubt whether two links lead to the same place; link names such as \"Read more\" say nothing out of context, and screen-reader users often list the links of a page on their own; forms are where people give up, and an error that is shown late, vaguely or out of sight costs the whole form; an empty list with no word of explanation looks broken; and usability problems are cheap to find with a few evaluators and a checklist, and expensive once users have learned to work around them."
date: "2026-11-24"
decision: "Every page renders its header, navigation and footer from one shared layout component; pages do not build their own. The navigation is a nav landmark named \"Main\" (aria-label), lists the top destinations in a fixed order, and marks the current page with aria-current=\"page\". Parts that change on purpose (a basket count, the signed-in name) carry data-ux-varies so the navigation test leaves them out. Links in the main content: decided in the links record (up to a set limit; a link name that says where it goes together with its context)."
status: "accepted"
---
